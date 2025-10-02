// Link blocking module for Links Maker (MV3)
import { pushLog } from './logs.js';

let featuresCache = { socialsEnabled: true, linkBlockingEnabled: false };
let patternsCache = [];
let regexCache = [];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wildcardToRegex(pattern) {
  // Trim and ignore empty/comment lines
  const raw = String(pattern || '').trim();
  if (!raw || raw.startsWith('#')) return null;

  // If no scheme present and no wildcard, allow substring match anywhere in URL
  const hasScheme = /:\/\//.test(raw);
  let source = raw;
  if (!hasScheme && !/[\*\?]/.test(raw)) {
    source = `*${raw}*`;
  }

  // Escape then replace wildcards
  const escaped = source.split('*').map(part => part.split('?').map(escapeRegex).join('.')).join('.*');
  const finalSrc = `^${escaped}$`;
  try {
    return new RegExp(finalSrc, 'i');
  } catch {
    return null;
  }
}

async function loadConfig() {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get({ features: { socialsEnabled: true, linkBlockingEnabled: false }, blocked: { patterns: [] } }, (items) => {
        featuresCache = {
          socialsEnabled: Boolean(items?.features?.socialsEnabled ?? true),
          linkBlockingEnabled: Boolean(items?.features?.linkBlockingEnabled ?? false)
        };
        patternsCache = Array.isArray(items?.blocked?.patterns) ? items.blocked.patterns : [];
        regexCache = patternsCache
          .map(wildcardToRegex)
          .filter(Boolean);
        pushLog('info', 'Blocker config loaded', { features: featuresCache, patternsCount: regexCache.length });
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

function matchesBlocked(urlString) {
  try {
    if (!featuresCache.linkBlockingEnabled) return null;
    if (!urlString || typeof urlString !== 'string') return null;
    // Allow one-time override query param
    try { if (new URL(urlString).searchParams.get('lm_override') === '1') return null; } catch {}
    for (let i = 0; i < regexCache.length; i++) {
      const re = regexCache[i];
      if (re.test(urlString)) {
        return { pattern: patternsCache[i] };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function getBlockedPageUrl(targetUrl, pattern) {
  const page = chrome.runtime.getURL('blocked.html');
  const params = new URLSearchParams();
  params.set('target', targetUrl || '');
  if (pattern) params.set('pattern', pattern);
  return `${page}?${params.toString()}`;
}

export async function checkAndBlock(tabId, url, source) {
  try {
    if (!featuresCache.linkBlockingEnabled) return false;
    if (!url || url.startsWith('chrome-extension://')) return false;
    const match = matchesBlocked(url);
    pushLog('info', 'checkAndBlock', { tabId, url, matched: Boolean(match), pattern: match?.pattern, source });
    if (!match) return false;
    const redirectUrl = getBlockedPageUrl(url, match.pattern);
    try {
      await chrome.tabs.update(tabId, { url: redirectUrl });
      return true;
    } catch (e) {
      pushLog('error', 'tabs.update redirect failed (checkAndBlock)', { error: String(e), url, redirectUrl, source });
      return false;
    }
  } catch (e) {
    pushLog('error', 'checkAndBlock error', { error: String(e), tabId, url, source });
    return false;
  }
}

async function onBeforeNavigate(details) {
  try {
    if (details.frameId !== 0) return; // top-level only
    const url = details.url || '';
    if (!url || url.startsWith('chrome-extension://')) return;
    const enabled = Boolean(featuresCache.linkBlockingEnabled);
    if (!enabled) {
      pushLog('info', 'Blocker skipped (disabled)', { url });
      return;
    }
    const match = matchesBlocked(url);
    pushLog('info', 'Blocker check', { url, matched: Boolean(match), pattern: match?.pattern, patternsCount: regexCache.length });
    if (!match) return;
    const redirectUrl = getBlockedPageUrl(url, match.pattern);
    pushLog('info', 'Blocking navigation', { url, pattern: match.pattern });
    try {
      await chrome.tabs.update(details.tabId, { url: redirectUrl });
    } catch (e) {
      pushLog('error', 'tabs.update redirect failed', { error: String(e), url, redirectUrl });
    }
  } catch (e) {
    pushLog('error', 'onBeforeNavigate error', { error: String(e) });
  }
}

async function onUrlChange(details, source) {
  try {
    if (details.frameId !== 0) return; // top-level only
    const url = details.url || '';
    if (!url || url.startsWith('chrome-extension://')) return;
    if (!featuresCache.linkBlockingEnabled) return;
    await checkAndBlock(details.tabId, url, source);
  } catch (e) {
    pushLog('error', 'onUrlChange error', { error: String(e), source });
  }
}

export async function initLinkBlocker() {
  await loadConfig();
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if (changes.features || changes.blocked) {
        loadConfig();
      }
    });
  } catch {}

  try {
    chrome.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
    pushLog('info', 'Blocker listener attached', {});
  } catch (e) {
    pushLog('error', 'webNavigation listener failed', { error: String(e) });
  }

  // SPA and committed navigations
  try { chrome.webNavigation.onHistoryStateUpdated.addListener((d) => onUrlChange(d, 'history')); } catch (e) { pushLog('error', 'onHistoryStateUpdated attach failed', { error: String(e) }); }
  try { chrome.webNavigation.onCommitted.addListener((d) => onUrlChange(d, 'committed')); } catch (e) { pushLog('error', 'onCommitted attach failed', { error: String(e) }); }
  try { chrome.webNavigation.onReferenceFragmentUpdated?.addListener?.((d) => onUrlChange(d, 'fragment')); } catch (e) { pushLog('error', 'onReferenceFragmentUpdated attach failed', { error: String(e) }); }

  // Fallback: tabs.onUpdated changeInfo.url for SPA URL changes
  try {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (!changeInfo || !changeInfo.url) return;
      if (!featuresCache.linkBlockingEnabled) return;
      const url = changeInfo.url || '';
      if (!url || url.startsWith('chrome-extension://')) return;
      pushLog('info', 'tabs.onUpdated URL change observed', { tabId, url });
      checkAndBlock(tabId, url, 'tabs.onUpdated');
    });
  } catch {}
}



