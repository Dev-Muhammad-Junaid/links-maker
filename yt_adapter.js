/* Links Maker — YouTube Adapter (standalone, not wired) */
(function (global) {
  const LOG_PREFIX = '[LinksMaker:YouTube]';

  function log(level, message, data) {
    try { console[level](`${LOG_PREFIX} ${message}`, data || ''); } catch {}
  }

  function buildAccountChooserUrl(authIndex, continueUrl) {
    const base = 'https://accounts.google.com/AccountChooser';
    const cont = encodeURIComponent(continueUrl || 'https://www.youtube.com/');
    const url = `${base}?continue=${cont}&authuser=${encodeURIComponent(String(authIndex))}`;
    log('info', 'buildAccountChooserUrl', { authIndex, continueUrl: continueUrl || 'https://www.youtube.com/', url });
    return url;
  }

  // Try to detect the current email from header UI (best-effort)
  function detectCurrentEmail() {
    try {
      const avatarBtn = document.querySelector('button#avatar-btn');
      if (!avatarBtn) return null;
      const aria = avatarBtn.getAttribute('aria-label') || '';
      const m = aria.match(/\(([^)]+@[^)]+)\)/); // capture email inside parentheses
      if (m) return m[1];
      const img = avatarBtn.querySelector('img');
      const alt = (img?.getAttribute('alt') || '').trim();
      if (/@/.test(alt)) return alt;
    } catch (e) { log('warn', 'detectCurrentEmail failed', String(e)); }
    return null;
  }

  // Open avatar menu and attempt to click the account by email (best-effort, DOM may change)
  async function switchInPageByEmail(email) {
    try {
      const avatarBtn = document.querySelector('button#avatar-btn');
      if (!avatarBtn) { log('warn', 'avatar button not found'); return false; }
      avatarBtn.click();
      // Wait for menu to render
      await new Promise((r) => setTimeout(r, 300));
      const items = Array.from(document.querySelectorAll('a[role="menuitem"], a.ytd-compact-link-renderer'));
      const target = items.find((a) => (a.getAttribute('aria-label') || a.textContent || '').toLowerCase().includes(String(email).toLowerCase()));
      if (target) {
        target.click();
        log('info', 'switchInPageByEmail clicked', { email });
        return true;
      }
      // Fallback: click the generic "Switch account" then try again
      const switchEntry = items.find((a) => /switch\s+account/i.test(a.textContent || a.getAttribute('aria-label') || ''));
      if (switchEntry) {
        switchEntry.click();
        await new Promise((r) => setTimeout(r, 300));
        const entries = Array.from(document.querySelectorAll('a[role="menuitem"], a.ytd-compact-link-renderer'));
        const match = entries.find((a) => (a.getAttribute('aria-label') || a.textContent || '').toLowerCase().includes(String(email).toLowerCase()));
        if (match) { match.click(); log('info', 'switchInPageByEmail clicked (after switch menu)', { email }); return true; }
      }
      log('warn', 'switchInPageByEmail no matching entry', { email });
      return false;
    } catch (e) {
      log('error', 'switchInPageByEmail error', String(e));
      return false;
    }
  }

  function gotoWithAccountChooser(authIndex, continueUrl) {
    const url = buildAccountChooserUrl(authIndex, continueUrl);
    try { location.assign(url); } catch { location.href = url; }
  }

  global.LinksMakerYouTubeAdapter = {
    buildAccountChooserUrl,
    detectCurrentEmail,
    switchInPageByEmail,
    gotoWithAccountChooser
  };
})(typeof window !== 'undefined' ? window : self);
