// Links Maker — Content Script Utilities

// Simple logger for content scripts (sends to background for storage)
export function logContent(level, message, data) {
  // Also log to console for immediate debugging
  const prefix = '[LinksMaker:Content]';
  try {
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](prefix, message, data || '');
  } catch {}
  
  // Send to background for storage (non-blocking)
  try {
    chrome.runtime.sendMessage({
      type: 'lm.contentLog',
      level,
      message,
      data,
      url: location.href,
      timestamp: new Date().toISOString()
    }).catch(() => {}); // Ignore errors
  } catch {}
}

// Constants for content script
export const ACCESS_CHECK_DELAY = 800;
export const STORAGE_KEY_SOCIAL_POS = '__lm_social_pos__GLOBAL__';

