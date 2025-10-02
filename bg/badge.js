// Badge utilities for Links Maker (MV3)
import { parseAuthIndexFromUrl } from './url.js';

export function updateBadgeForTab(tabId, url) {
  const idx = parseAuthIndexFromUrl(url || "");
  const text = idx === null || Number.isNaN(idx) ? "" : String(idx);
  chrome.action.setBadgeBackgroundColor({ color: "#000" });
  chrome.action.setBadgeTextColor?.({ color: "#fff" });
  chrome.action.setBadgeText({ tabId, text });
}
