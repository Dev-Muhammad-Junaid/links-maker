/* Links Maker — Background Service Worker (MV3, ESM) */

import { pushLog, readLogs } from './bg/logs.js';
import { buildProfileSwitchUrl, parseAuthIndexFromUrl, parseGoogleFileId, isMeetUrl } from './bg/url.js';
import { DEFAULT_PROFILES, getProfiles } from './bg/profiles.js';
import { updateBadgeForTab } from './bg/badge.js';
import { openOrActivateSocial } from './bg/social.js';
import { checkAccessForProfilesInPage } from './bg/access.js';
import { initLinkBlocker } from './bg/blocker.js';

// Clicking the extension icon opens Manage Profiles (Options page)
chrome.action.onClicked.addListener(async () => {
  try {
    pushLog('info', 'action clicked: opening options');
    chrome.runtime.openOptionsPage();
  } catch {}
});

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
      chrome.contextMenus.create({ id: "lm-open-logs", parentId: "lm-root", title: "Open Logs", contexts: ["action"] });
    });
  });
});

// Initialize link blocker
(async () => {
  try { await initLinkBlocker(); } catch {}
})();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.profiles) {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({ id: "lm-root", title: "Links Maker", contexts: ["action"] });
      chrome.contextMenus.create({ id: "lm-root-open", title: "Open with profile…", contexts: ["page", "frame", "selection", "link", "image", "video", "audio"] });
      getProfiles().then((profiles) => {
        profiles.forEach((p) => {
          chrome.contextMenus.create({ id: `lm-open-${p.authIndex}`, parentId: "lm-root-open", title: `${p.label} (authuser=${p.authIndex})`, contexts: ["page", "frame", "selection", "link", "image", "video", "audio"] });
        });
        chrome.contextMenus.create({ id: "lm-open-logs", parentId: "lm-root", title: "Open Logs", contexts: ["action"] });
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
  try {
    if (info.menuItemId === 'lm-open-logs') {
      const url = chrome.runtime.getURL('logs.html');
      await chrome.tabs.create({ url });
    }
  } catch {}
});

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
  if (msg.type === 'lm.spaUrlChanged') {
    try {
      const tabId = sender?.tab?.id;
      const url = msg.url;
      if (tabId && url) {
        // Lazy import to avoid cycle on initial load
        import('./bg/blocker.js').then(({ checkAndBlock }) => {
          checkAndBlock(tabId, url, 'content_watcher');
        }).catch(() => {});
      }
    } catch {}
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
