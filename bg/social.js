// Social tab activation module for Links Maker (MV3)
import { pushLog } from './logs.js';

export async function openOrActivateSocial(url, host) {
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
