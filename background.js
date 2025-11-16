/* Links Maker — Background Service Worker (MV3, ESM) */

import { pushLog, readLogs } from './bg/logs.js';
import { buildProfileSwitchUrl, parseAuthIndexFromUrl, parseGoogleFileId, isMeetUrl, extractResourceId } from './bg/url.js';
import { DEFAULT_PROFILES, getProfiles } from './bg/profiles.js';
import { updateBadgeForTab } from './bg/badge.js';
import { openOrActivateSocial } from './bg/social.js';
import { checkAccessForProfilesInPage, loadCacheFromStorage, invalidateCache, clearAllCache } from './bg/access.js';
import { initLinkBlocker } from './bg/blocker.js';

// Request deduplication: Map<`${url}:${tabId}`, Promise>
const pendingChecks = new Map();

// Clicking the extension icon opens Manage Profiles (Options panel in current tab)
chrome.action.onClicked.addListener(async () => {
  try {
    pushLog('info', 'action clicked: opening options');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      // Fallback to options page if no active tab
      chrome.runtime.openOptionsPage();
      return;
    }
    
    // Check if URL is injectable (not chrome://, chrome-extension://, etc.)
    const url = tab.url || '';
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://') || url.startsWith('about:')) {
      // Can't inject into these pages, open options page instead
      chrome.runtime.openOptionsPage();
      return;
    }
    
    // Inject options panel into current tab
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['inject-options.js']
      });
      pushLog('info', 'Options panel injected', { tabId: tab.id, url });
    } catch (e) {
      pushLog('error', 'Failed to inject options panel', { error: String(e), tabId: tab.id, url });
      // Only fallback to options page if it's a real error (not just already injected)
      const errorMsg = String(e);
      if (!errorMsg.includes('Cannot access') && !errorMsg.includes('already exists')) {
        chrome.runtime.openOptionsPage();
      }
    }
  } catch (e) {
    pushLog('error', 'action.onClicked error', { error: String(e) });
    // Only open options page as last resort
    try {
      chrome.runtime.openOptionsPage();
    } catch {}
  }
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

// Initialize link blocker and load access cache
(async () => {
  try { 
    await initLinkBlocker();
    await loadCacheFromStorage();
    pushLog('info', 'Background initialization complete');
  } catch (e) {
    pushLog('error', 'Background initialization error', { error: String(e) });
  }
})();

// Verify command listener is registered
if (chrome.commands?.getAll) {
  try {
    chrome.commands.getAll((commands) => {
      if (commands && Array.isArray(commands)) {
        pushLog('info', 'Registered commands', { commands: commands.map(c => ({ name: c.name, shortcut: c.shortcut })) });
      }
    });
  } catch (e) {
    // Ignore errors
  }
}

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === "sync" && changes.profiles) {
    const oldProfiles = changes.profiles.oldValue || [];
    const newProfiles = changes.profiles.newValue || [];
    
    // Only invalidate cache if authIndex values changed (not on profile switch/reorder)
    const authIndexChanged = oldProfiles.some(oldProfile => {
      const newProfile = newProfiles.find(p => 
        (p.id && p.id === oldProfile.id) || 
        (p.email && p.email === oldProfile.email) ||
        (p.authIndex === oldProfile.authIndex && p.label === oldProfile.label)
      );
      return newProfile && newProfile.authIndex !== oldProfile.authIndex;
    });
    
    if (authIndexChanged) {
      // Invalidate cache entries for changed authIndex values
      oldProfiles.forEach(oldProfile => {
        const newProfile = newProfiles.find(p => 
          (p.id && p.id === oldProfile.id) || 
          (p.email && p.email === oldProfile.email) ||
          (p.authIndex === oldProfile.authIndex && p.label === oldProfile.label)
        );
        if (newProfile && newProfile.authIndex !== oldProfile.authIndex) {
          invalidateCache(null, null, oldProfile.authIndex);
          pushLog("info", "Cache invalidated for changed authIndex", { 
            old: oldProfile.authIndex, 
            new: newProfile.authIndex,
            email: oldProfile.email || newProfile.email 
          });
        }
      });
    } else {
      pushLog("info", "Profiles changed but authIndex unchanged, cache preserved");
    }
    
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
    const { url, forceRefresh = false } = msg;
    const tabId = sender?.tab?.id;
    const checkKey = `${url}:${tabId}`;
    
    // Request deduplication: if same check is in progress, return that promise
    if (!forceRefresh && pendingChecks.has(checkKey)) {
      pushLog("info", "Access check deduplicated", { url, tabId });
      pendingChecks.get(checkKey).then(results => {
        sendResponse({ ok: true, results, supported: true, cached: true });
      }).catch(() => {
        sendResponse({ ok: false, results: {} });
      });
      return true;
    }
    
    // Start new check
    const checkPromise = (async () => {
      try {
        pushLog("info", "Access check begin", { url, tabId, forceRefresh });
        const isSupported = Boolean(parseGoogleFileId(url)) || isMeetUrl(url);
        if (!isSupported || !tabId) {
          pushLog("warn", "Access check unsupported", { url, tabId });
          return { ok: true, results: {}, supported: false };
        }
        
        // If force refresh, invalidate cache for this resource
        if (forceRefresh) {
          const resourceId = extractResourceId(url);
          if (resourceId) {
            invalidateCache(resourceId, null);
            pushLog("info", "Access cache invalidated for resource", { resourceId });
          }
        }
        
        const profiles = await getProfiles();
        const results = await checkAccessForProfilesInPage(tabId, url, profiles);
        pushLog("info", "Access check end", { url, results, cached: false });
        return { ok: true, results, supported: true, cached: false };
      } catch (e) {
        pushLog("error", "Access check failed", { url, error: String(e) });
        return { ok: false, results: {} };
      } finally {
        // Clean up deduplication map after a short delay
        setTimeout(() => {
          pendingChecks.delete(checkKey);
        }, 1000);
      }
    })();
    
    pendingChecks.set(checkKey, checkPromise);
    checkPromise.then(sendResponse).catch(() => {
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
  if (msg.type === 'lm.contentLog') {
    // Forward content script logs to the logging system
    try {
      pushLog(msg.level || 'info', `[Content] ${msg.message}`, { ...msg.data, url: msg.url, timestamp: msg.timestamp });
    } catch {}
    return true;
  }
  if (msg.type === 'lm.clearAccessCache') {
    // Manual cache clear from options panel
    try {
      clearAllCache();
      pushLog("info", "Access cache manually cleared");
      sendResponse({ ok: true });
    } catch (e) {
      pushLog("error", "Failed to clear access cache", { error: String(e) });
      sendResponse({ ok: false, error: String(e) });
    }
    return true;
  }
});

chrome.commands?.onCommand?.addListener(async (command) => {
  if (command !== 'toggle_widget') return;
  try {
    pushLog('info', 'Keyboard shortcut triggered', { command });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      pushLog('warn', 'No active tab found for toggle_widget');
      return;
    }
    pushLog('info', 'Sending toggle message to content script', { tabId: tab.id, url: tab.url });
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'lm.toggleWidget' }).catch((e) => {
      pushLog('error', 'Failed to send toggle message', { error: String(e), tabId: tab.id });
      return null;
    });
    if (response !== undefined) {
      pushLog('info', 'Toggle message response received', { response });
    }
  } catch (e) {
    pushLog('error', 'toggle_widget command error', { error: String(e) });
  }
});
