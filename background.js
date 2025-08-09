/* Links Maker — Background Service Worker (MV3) */

const DEFAULT_PROFILES = [
  { id: "work", label: "Work", authIndex: 0 },
  { id: "personal", label: "Personal", authIndex: 1 }
];

const GOOGLE_HOST_PATTERNS = [
  /(^|\.)google\.com$/,
  /(^|\.)cloud\.google\.com$/
];

function isGoogleLikeHost(hostname) {
  return GOOGLE_HOST_PATTERNS.some((re) => re.test(hostname));
}

function replaceAuthUserParam(urlObj, desiredIndex) {
  const original = urlObj.toString();
  const params = urlObj.searchParams;
  params.set("authuser", String(desiredIndex));
  urlObj.search = params.toString();
  console.debug("[LinksMaker] authuser param set:", { from: original, to: urlObj.toString() });
}

function replacePathUIndex(urlObj, desiredIndex) {
  const originalPath = urlObj.pathname;
  const replaced = originalPath.replace(/(\/)u\/(\d+)(\/|$)/, `$1u/${desiredIndex}$3`);
  if (replaced !== originalPath) {
    urlObj.pathname = replaced;
    console.debug("[LinksMaker] path u-index replaced:", { from: originalPath, to: replaced });
  }
}

function buildProfileSwitchUrl(currentUrlString, desiredIndex) {
  try {
    const urlObj = new URL(currentUrlString);
    const isGoogle = isGoogleLikeHost(urlObj.hostname);

    if (isGoogle) {
      replaceAuthUserParam(urlObj, desiredIndex);
      replacePathUIndex(urlObj, desiredIndex);
    } else {
      replaceAuthUserParam(urlObj, desiredIndex);
    }

    console.debug("[LinksMaker] buildProfileSwitchUrl", {
      input: currentUrlString,
      desiredIndex,
      output: urlObj.toString(),
      hostname: urlObj.hostname,
      pathname: urlObj.pathname,
      search: urlObj.search
    });

    return urlObj.toString();
  } catch (e) {
    console.warn("[LinksMaker] Failed to build switch URL:", e, { currentUrlString, desiredIndex });
    return null;
  }
}

async function getProfiles() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ profiles: DEFAULT_PROFILES }, (items) => {
      const profiles = Array.isArray(items.profiles) && items.profiles.length > 0
        ? items.profiles
        : DEFAULT_PROFILES;
      resolve(profiles);
    });
  });
}

function findProfileByInput(profiles, input) {
  if (!input) return null;
  const lower = String(input).toLowerCase();
  const asNum = Number(lower);
  if (!Number.isNaN(asNum)) {
    return profiles.find((p) => p.authIndex === asNum) || null;
  }
  return profiles.find((p) => p.id === lower || p.label.toLowerCase() === lower) || null;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "lm.toggleWidget" });
  } catch {}
});

function updateBadgeForTab(tabId, url) {
  const idx = parseAuthIndexFromUrl(url || "");
  const text = idx === null || Number.isNaN(idx) ? "" : String(idx);
  chrome.action.setBadgeBackgroundColor({ color: "#000" });
  chrome.action.setBadgeTextColor?.({ color: "#fff" });
  chrome.action.setBadgeText({ tabId, text });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    updateBadgeForTab(tabId, changeInfo.url || tab.url || "");
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  updateBadgeForTab(tabId, tab?.url || "");
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({ profiles: null }, ({ profiles }) => {
    if (!Array.isArray(profiles) || profiles.length === 0) {
      chrome.storage.sync.set({ profiles: DEFAULT_PROFILES }, () => {
        if (chrome.runtime.lastError) {
          console.warn("[LinksMaker] Failed to seed default profiles:", chrome.runtime.lastError);
        } else {
          console.info("[LinksMaker] Seeded default profiles", DEFAULT_PROFILES);
        }
      });
    }
  });

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "lm-root", title: "Open with profile…", contexts: ["page", "frame", "selection", "link", "image", "video", "audio"] });
    getProfiles().then((profiles) => {
      profiles.forEach((p) => {
        chrome.contextMenus.create({ id: `lm-open-${p.authIndex}`, parentId: "lm-root", title: `${p.label} (authuser=${p.authIndex})`, contexts: ["page", "frame", "selection", "link", "image", "video", "audio"] });
      });
    });
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.profiles) {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({ id: "lm-root", title: "Open with profile…", contexts: ["page", "frame", "selection", "link", "image", "video", "audio"] });
      getProfiles().then((profiles) => {
        profiles.forEach((p) => {
          chrome.contextMenus.create({ id: `lm-open-${p.authIndex}`, parentId: "lm-root", title: `${p.label} (authuser=${p.authIndex})`, contexts: ["page", "frame", "selection", "link", "image", "video", "audio"] });
        });
      });
    });
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (!info.menuItemId || typeof info.menuItemId !== "string") return;
    const match = info.menuItemId.match(/^lm-open-(\d+)$/);
    if (!match) return;
    const targetIndex = Number(match[1]);

    const currentUrl = info.linkUrl || (tab && tab.url) || null;
    if (!currentUrl) return;

    const targetUrl = buildProfileSwitchUrl(currentUrl, targetIndex);
    if (!targetUrl) return;

    await chrome.tabs.create({ url: targetUrl, index: (tab && tab.index !== undefined) ? tab.index + 1 : undefined });
  } catch (e) {
    console.error("[LinksMaker] contextMenus.onClicked error", e);
  }
});

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const profiles = await getProfiles();
  const activeTab = await getActiveTab();
  const currentUrl = activeTab && activeTab.url ? activeTab.url : "https://accounts.google.com/";

  const suggestions = profiles.map((p) => {
    const preview = buildProfileSwitchUrl(currentUrl, p.authIndex) || currentUrl;
    return {
      content: String(p.authIndex),
      description: `Switch to <match>${p.label}</match> — <dim>authuser=${p.authIndex}</dim> → <url>${preview}</url>`
    };
  });

  suggest(suggestions);
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  try {
    const profiles = await getProfiles();
    const activeTab = await getActiveTab();
    const currentUrl = activeTab && activeTab.url ? activeTab.url : "https://accounts.google.com/";

    const chosen = findProfileByInput(profiles, text) || profiles[0];
    const targetUrl = buildProfileSwitchUrl(currentUrl, chosen.authIndex) || currentUrl;

    if (disposition === "currentTab") {
      if (activeTab?.id) {
        await chrome.tabs.update(activeTab.id, { url: targetUrl });
      } else {
        await chrome.tabs.create({ url: targetUrl });
      }
    } else if (disposition === "newForegroundTab") {
      await chrome.tabs.create({ url: targetUrl, active: true });
    } else if (disposition === "newBackgroundTab") {
      await chrome.tabs.create({ url: targetUrl, active: false });
    } else {
      await chrome.tabs.create({ url: targetUrl });
    }
  } catch (e) {
    console.error("[LinksMaker] omnibox.onInputEntered error", e);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle_widget") return;
  const tab = await getActiveTab();
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "lm.toggleWidget" });
  } catch (e) {}
});

async function fetchListAccounts(url) {
  const resp = await fetch(url, { credentials: "include", cache: "no-cache" });
  const status = resp.status;
  const text = await resp.text();
  let data = null;
  try { data = JSON.parse(text); } catch {
    const cleaned = text.replace(/^\)\]\}'\s*/, '');
    try { data = JSON.parse(cleaned); } catch {}
  }
  return { status, text, data };
}

async function fetchGoogleAccounts() {
  try {
    const urls = [
      "https://accounts.google.com/ListAccounts?gpsia=1&source=ChromeExtension&json=standard",
      "https://accounts.google.com/ListAccounts?gpsia=1&source=OneGoogleBar&json=standard"
    ];

    for (const url of urls) {
      console.info("[LinksMaker] Import: requesting", url);
      const { status, text, data } = await fetchListAccounts(url);
      console.info("[LinksMaker] Import: status", status);
      const raw = data && (data.accounts || data.Ac || data.users || []);
      if (Array.isArray(raw) && raw.length > 0) {
        const accounts = raw.map((a, i) => ({
          label: a.email || a.displayName || a.gaiaEmail || `Account ${i}`,
          email: a.email || a.gaiaEmail || null,
          authIndex: i
        }));
        console.info("[LinksMaker] Import: parsed accounts", accounts);
        return accounts;
      }
      console.warn("[LinksMaker] Import: empty payload body=", text.slice(0, 200));
    }

    return [];
  } catch (e) {
    console.warn("[LinksMaker] fetchGoogleAccounts failed", e);
    return [];
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "lm.buildUrl") {
    const { currentUrl, authIndex } = msg;
    const out = buildProfileSwitchUrl(currentUrl, Number(authIndex));
    sendResponse({ ok: Boolean(out), url: out });
  } else if (msg.type === "lm.fetchAccounts") {
    fetchGoogleAccounts().then((accts) => sendResponse({ ok: true, accounts: accts }))
      .catch((e) => {
        console.warn("[LinksMaker] Import: error", e);
        sendResponse({ ok: false, accounts: [] });
      });
    return true;
  }
});
