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

function ensureDocsUIndex(urlObj, desiredIndex) {
  try {
    if (urlObj.hostname !== 'docs.google.com') return;
    const p = urlObj.pathname;
    const re = /(\/(document|spreadsheets|presentation)\/(?:u\/\d+\/)?d\/)/;
    if (!re.test(p)) return;
    if (/\/(document|spreadsheets|presentation)\/u\/\d+\/d\//.test(p)) return;
    urlObj.pathname = p.replace(/\/(document|spreadsheets|presentation)\/d\//, `/$1/u/${desiredIndex}/d/`);
  } catch {}
}

function ensureMeetUIndex(urlObj, desiredIndex) {
  try {
    if (urlObj.hostname !== 'meet.google.com') return;
    const p = urlObj.pathname || '/';
    if (/^\/u\/\d+\//.test(p)) return; // already has /u/{n}/
    // Insert /u/{n}/ as the first segment for meeting/join paths
    if (p === '/' ) return; // landing page; skip
    urlObj.pathname = `/u/${desiredIndex}${p.startsWith('/') ? '' : '/'}${p.replace(/^\//, '')}`;
  } catch {}
}

function replaceAuthUserParam(urlObj, desiredIndex) {
  const params = urlObj.searchParams;
  params.set("authuser", String(desiredIndex));
  urlObj.search = params.toString();
}

function replacePathUIndex(urlObj, desiredIndex) {
  const originalPath = urlObj.pathname;
  const replaced = originalPath.replace(/(\/)u\/(\d+)(\/|$)/, `$1u/${desiredIndex}$3`);
  if (replaced !== originalPath) {
    urlObj.pathname = replaced;
  }
}

function buildProfileSwitchUrl(currentUrlString, desiredIndex) {
  try {
    const urlObj = new URL(currentUrlString);
    const isGoogle = isGoogleLikeHost(urlObj.hostname);

    if (isGoogle) {
      replaceAuthUserParam(urlObj, desiredIndex);
      replacePathUIndex(urlObj, desiredIndex);
      ensureDocsUIndex(urlObj, desiredIndex);
      ensureMeetUIndex(urlObj, desiredIndex);
    } else {
      replaceAuthUserParam(urlObj, desiredIndex);
    }

    return urlObj.toString();
  } catch (e) {
    pushLog("warn", "buildProfileSwitchUrl error", { error: String(e), currentUrlString, desiredIndex });
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

function parseAuthIndexFromUrl(urlString) {
  try {
    const u = new URL(urlString);
    const q = u.searchParams.get("authuser");
    if (q !== null && q !== undefined) return Number(q);
    const m = u.pathname.match(/\/u\/(\d+)/);
    if (m) return Number(m[1]);
  } catch {}
  return null;
}

function parseGoogleFileId(urlString) {
  try {
    const u = new URL(urlString);
    const host = u.hostname;
    const path = u.pathname;
    let m = path.match(/\/(document|spreadsheets|presentation)\/(?:u\/\d+\/)?d\/([^/]+)/);
    if (host === 'docs.google.com' && m) {
      return { kind: m[1], id: m[2] };
    }
    m = path.match(/\/file\/d\/([^/]+)/);
    if (host === 'drive.google.com' && m) {
      return { kind: 'driveFile', id: m[1] };
    }
    const qid = u.searchParams.get('id');
    if (qid && (host.endsWith('google.com'))) {
      return { kind: 'driveFile', id: qid };
    }
  } catch {}
  return null;
}

function isMeetUrl(urlString) {
  try {
    const u = new URL(urlString);
    if (u.hostname !== 'meet.google.com') return false;
    const p = u.pathname || '/';
    if (/^\/lookup\//.test(p)) return true;
    if (/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}(\W|$)/i.test(p)) return true;
    if (/^\/v2\//.test(p)) return true;
    return false;
  } catch { return false; }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

// In-memory and persistent logs
const LOGS = [];
const MAX_LOGS = 1000;
function pushLog(level, message, data) {
  const entry = { ts: new Date().toISOString(), level, message, data: data ?? null };
  LOGS.push(entry);
  if (LOGS.length > MAX_LOGS) LOGS.shift();
  chrome.storage.local.set({ __lm_logs: LOGS.slice(-MAX_LOGS) });
}

async function readLogs() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["__lm_logs"], (items) => {
      resolve(Array.isArray(items.__lm_logs) ? items.__lm_logs : LOGS);
    });
  });
}

// Clicking the extension icon opens Manage Profiles (Options page)
chrome.action.onClicked.addListener(async () => {
  try {
    pushLog('info', 'action clicked: opening options');
    chrome.runtime.openOptionsPage();
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
      chrome.storage.sync.set({ profiles: DEFAULT_PROFILES });
    }
  });

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "lm-root", title: "Links Maker", contexts: ["action"] });
    getProfiles().then((profiles) => {
      chrome.contextMenus.create({ id: "lm-root-open", title: "Open with profile…", contexts: ["page", "frame", "selection", "link", "image", "video", "audio"] });
      profiles.forEach((p) => {
        chrome.contextMenus.create({ id: `lm-open-${p.authIndex}`, parentId: "lm-root-open", title: `${p.label} (authuser=${p.authIndex})`, contexts: ["page", "frame", "selection", "link", "image", "video", "audio"] });
      });
    });
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.profiles) {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({ id: "lm-root", title: "Links Maker", contexts: ["action"] });
      chrome.contextMenus.create({ id: "lm-root-open", title: "Open with profile…", contexts: ["page", "frame", "selection", "link", "image", "video", "audio"] });
      getProfiles().then((profiles) => {
        profiles.forEach((p) => {
          chrome.contextMenus.create({ id: `lm-open-${p.authIndex}`, parentId: "lm-root-open", title: `${p.label} (authuser=${p.authIndex})`, contexts: ["page", "frame", "selection", "link", "image", "video", "audio"] });
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
  } catch (e) { pushLog("error", "contextMenus.onClicked", { error: String(e) }); }
});

// Open or activate existing social tab
async function openOrActivateSocial(url, host) {
  try {
    const tabs = await chrome.tabs.query({ url: `*://*.${host}/*` });
    if (tabs && tabs.length > 0) {
      const t = tabs[0];
      await chrome.tabs.update(t.id, { active: true });
      await chrome.windows.update(t.windowId, { focused: true });
      return { ok: true, activated: true, tabId: t.id };
    }
    const created = await chrome.tabs.create({ url });
    return { ok: true, created: true, tabId: created.id };
  } catch (e) {
    pushLog('error', 'openOrActivateSocial failed', { error: String(e), url, host });
    return { ok: false, error: String(e) };
  }
}

async function probeAccess(url, authIndex) {
  const targetUrl = buildProfileSwitchUrl(url, authIndex);
  if (!targetUrl) { pushLog("warn", "Access probe skip — bad url", { authIndex, url }); return { status: "unknown", reason: "bad_url" }; }
  pushLog("info", "Access probe built", { authIndex, method: "GET", url: targetUrl });
  try {
    const resp = await fetch(targetUrl, { credentials: "include", cache: "no-store", redirect: "follow" });
    const finalUrl = resp.url || "";
    let text = "";
    try { text = await resp.text(); } catch {}
    const lowered = (text || "").toLowerCase();
    const isLogin = /accounts\.google\.com|servicelogin|signin/.test(finalUrl) || lowered.includes("sign in");
    const isDenied = resp.status === 401 || resp.status === 403 || /request\s*access|need\s*access|share\?ths=true/.test(lowered);
    const classified = (isLogin || isDenied) ? "no_access" : ((resp.status === 200 || resp.status === 204) ? "access" : "unknown");
    pushLog("info", "Access probe response", { authIndex, statusCode: resp.status, finalUrl, classified });
    return { status: classified, code: resp.status, finalUrl };
  } catch (e) {
    pushLog("error", "Access probe error", { authIndex, error: String(e) });
    return { status: "unknown", reason: "fetch_error" };
  }
}

async function checkAccessForProfiles(url, profiles) {
  const results = {};
  for (const p of profiles) {
    results[p.authIndex] = await probeAccess(url, p.authIndex);
  }
  return results;
}

async function probeAccessInPage(tabId, url, authIndex) {
  const targetUrl = buildProfileSwitchUrl(url, authIndex);
  if (!targetUrl) { pushLog("warn", "Access probe skip — bad url", { authIndex, url }); return { status: "unknown", reason: "bad_url" }; }
  pushLog("info", "Access probe built (page)", { authIndex, method: "GET", url: targetUrl });
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      args: [targetUrl],
      func: async (requestUrl) => {
        try {
          const resp = await fetch(requestUrl, { credentials: 'include', redirect: 'follow' });
          let text = '';
          try { text = await resp.text(); } catch {}
          const snippet = (text || '').toLowerCase().slice(0, 4000);
          return { ok: true, status: resp.status, finalUrl: resp.url, snippet };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      }
    });
    const r = res?.result || {};
    if (!r.ok) { pushLog("error", "Access probe page error", { authIndex, error: r.error }); return { status: 'unknown', reason: 'fetch_error' }; }

    // Heuristic classification; add Meet-aware rules
    let classified = 'unknown';
    const status = Number(r.status);
    try {
      const finalHost = new URL(r.finalUrl || targetUrl).hostname;
      const s = String(r.snippet || '').toLowerCase();
      const redirectedToLogin = /accounts\.google\.com/.test(r.finalUrl || '');

      if (status === 401 || status === 403 || redirectedToLogin) {
        classified = 'no_access';
      } else if (finalHost === 'meet.google.com') {
        const hasJoinNow = s.includes('join now') || s.includes('rejoin');
        const askToJoin = s.includes('ask to join') || s.includes('request to join') || s.includes("you can’t join") || s.includes("you can't join") || s.includes('doesn’t exist') || s.includes("doesn't exist");
        if (hasJoinNow) classified = 'access';
        else if (askToJoin) classified = 'no_access';
        else if (status === 200) classified = 'unknown';
      } else {
        classified = (status === 200 || status === 204) ? 'access' : ((status === 401 || status === 403) ? 'no_access' : 'unknown');
      }
    } catch {
      classified = (Number(r.status) === 200 || Number(r.status) === 204) ? 'access' : ((Number(r.status) === 401 || Number(r.status) === 403) ? 'no_access' : 'unknown');
    }

    pushLog("info", "Access probe response (page)", { authIndex, statusCode: r.status, finalUrl: r.finalUrl, classified });
    return { status: classified, code: r.status, finalUrl: r.finalUrl };
  } catch (e) {
    pushLog("error", "Access probe exec error", { authIndex, error: String(e) });
    return { status: "unknown", reason: "exec_error" };
  }
}

async function checkAccessForProfilesInPage(tabId, url, profiles) {
  const results = {};
  for (const p of profiles) {
    results[p.authIndex] = await probeAccessInPage(tabId, url, p.authIndex);
  }
  return results;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "lm.checkAccess") {
    const { url } = msg;
    const tabId = sender?.tab?.id;
    pushLog("info", "Access check begin", { url, tabId });
    const isSupported = Boolean(parseGoogleFileId(url)) || isMeetUrl(url);
    if (!isSupported || !tabId) {
      pushLog("warn", "Access check unsupported", { url, tabId });
      sendResponse({ ok: true, results: {}, supported: false });
      return true;
    }
    getProfiles().then(async (profiles) => {
      const fresh = await checkAccessForProfilesInPage(tabId, url, profiles);
      pushLog("info", "Access check end", { url, results: fresh });
      sendResponse({ ok: true, results: fresh, supported: true, revalidating: false });
    }).catch((e) => {
      pushLog("error", "Access check failed", { url, error: String(e) });
      sendResponse({ ok: false, results: {} });
    });
    return true;
  }
  if (msg.type === 'lm.openOrActivateSocial') {
    openOrActivateSocial(msg.url, msg.host).then((r) => sendResponse(r));
    return true;
  }
});

chrome.commands?.onCommand?.addListener(async (command) => {
  if (command !== 'toggle_widget') return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    await chrome.tabs.sendMessage(tab.id, { type: 'lm.toggleWidget' }).catch(() => {});
  } catch {}
});
