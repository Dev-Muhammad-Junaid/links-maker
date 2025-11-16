/* Links Maker — Content Script (modal for Google/YouTube; minimal bar for socials) */
(function () {
  if (window.__links_maker_injected__) return;
  window.__links_maker_injected__ = true;

  const host = location.hostname;
  const isGoogle = /(^|\.)google\.com$/.test(host) || /(^|\.)cloud\.google\.com$/.test(host);
  const isYouTube = /(^|\.)youtube\.com$/.test(host);
  const isSocial = /(^|\.)facebook\.com$/.test(host) || /(^|\.)instagram\.com$/.test(host) || /(^|\.)snapchat\.com$/.test(host) || /(^|\.)tiktok\.com$/.test(host) || /(^|\.)linkedin\.com$/.test(host) || /(^|\.)x\.com$/.test(host) || /(^|\.)twitter\.com$/.test(host);
  const isSupportedHost = isGoogle || isYouTube || isSocial;
  if (!isSupportedHost) return;

  // ---------- Socials: minimal icons-only bar ----------
  if (isSocial) {
    chrome.storage.sync.get({ features: { socialsEnabled: true } }, ({ features }) => {
      if (!Boolean(features?.socialsEnabled)) return;
    const STORAGE_KEY_SOCIAL_POS = '__lm_social_pos__GLOBAL__';

    const socialBar = document.createElement('div');
    socialBar.style.position = 'fixed';
    socialBar.style.top = '16px';
    socialBar.style.right = '16px';
    socialBar.style.zIndex = '2147483647';
    socialBar.style.display = 'none';
    socialBar.style.background = '#fff';
    socialBar.style.color = '#000';
    socialBar.style.border = '1px solid #e5e7eb';
    socialBar.style.borderRadius = '999px';
    socialBar.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
    socialBar.style.padding = '10px 12px';
    socialBar.style.fontFamily = 'Poppins, Satoshi, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    socialBar.style.backdropFilter = 'saturate(180%) blur(8px)';
    socialBar.style.userSelect = 'none';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '12px';

    // Drag handle (shows on hover)
    const handle = document.createElement('div');
    handle.title = 'Drag to move';
    handle.style.width = '14px';
    handle.style.height = '28px';
    handle.style.marginRight = '8px';
    handle.style.borderRadius = '6px';
    handle.style.background = 'linear-gradient(180deg, #e5e7eb, #d1d5db)';
    handle.style.opacity = '0';
    handle.style.transition = 'opacity 0.15s ease';
    handle.style.cursor = 'grab';

    socialBar.addEventListener('mouseenter', () => { handle.style.opacity = '1'; });
    socialBar.addEventListener('mouseleave', () => { if (!isDragging) handle.style.opacity = '0'; });

    let isDragging = false; let dragOffsetX = 0; let dragOffsetY = 0;

    function onMouseMove(e) {
      if (!isDragging) return;
      const newLeft = e.clientX - dragOffsetX;
      const newTop = e.clientY - dragOffsetY;
      socialBar.style.left = `${Math.max(8, Math.min(window.innerWidth - socialBar.offsetWidth - 8, newLeft))}px`;
      socialBar.style.top = `${Math.max(8, Math.min(window.innerHeight - socialBar.offsetHeight - 8, newTop))}px`;
      socialBar.style.right = '';
    }

    function onMouseUp() {
      if (!isDragging) return;
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      handle.style.cursor = 'grab';
      handle.style.opacity = '0';
      // Persist position (GLOBAL)
      const topPx = parseInt(socialBar.style.top || '16', 10) || 16;
      const leftPx = parseInt(socialBar.style.left || `${window.innerWidth - socialBar.offsetWidth - 16}`, 10) || 16;
      chrome.storage.local.set({ [STORAGE_KEY_SOCIAL_POS]: { top: topPx, left: leftPx } });
    }

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      // Ensure we have left-based positioning to start dragging
      if (!socialBar.style.left) {
        const rect = socialBar.getBoundingClientRect();
        socialBar.style.left = `${rect.left}px`;
        socialBar.style.top = `${rect.top}px`;
        socialBar.style.right = '';
      }
      isDragging = true;
      handle.style.cursor = 'grabbing';
      dragOffsetX = e.clientX - socialBar.getBoundingClientRect().left;
      dragOffsetY = e.clientY - socialBar.getBoundingClientRect().top;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    const socials = [
      { name: 'Facebook', url: 'https://www.facebook.com/', host: 'facebook.com', icon: 'https://www.facebook.com/favicon.ico' },
      { name: 'Instagram', url: 'https://www.instagram.com/', host: 'instagram.com', icon: 'https://www.instagram.com/favicon.ico' },
      { name: 'Snapchat', url: 'https://www.snapchat.com/', host: 'snapchat.com', icon: 'https://www.snapchat.com/favicon.ico' },
      { name: 'TikTok', url: 'https://www.tiktok.com/', host: 'tiktok.com', icon: 'https://www.tiktok.com/favicon.ico' },
      { name: 'LinkedIn', url: 'https://www.linkedin.com/', host: 'linkedin.com', icon: 'https://www.linkedin.com/favicon.ico' },
      { name: 'X', url: 'https://x.com/', host: 'x.com', icon: 'https://abs.twimg.com/favicons/twitter.ico' }
    ];

    function makeSocialAnchor(s, idx) {
      const a = document.createElement('a');
      a.href = s.url;
      a.title = s.name;
      a.setAttribute('role', 'button');
      a.setAttribute('tabindex', '0');
      a.style.display = 'flex';
      a.style.alignItems = 'center';
      a.style.justifyContent = 'center';
      a.style.padding = '6px';
      a.style.borderRadius = '10px';
      a.style.outline = 'none';

      const img = document.createElement('img');
      img.src = s.icon;
      img.alt = s.name;
      img.style.width = '32px';
      img.style.height = '32px';
      img.style.borderRadius = '8px';
      img.style.display = 'block';
      a.appendChild(img);

      const applyFocus = (focused) => {
        a.style.background = focused ? '#f3f4f6' : 'transparent';
      };

      a.addEventListener('focus', () => applyFocus(true));
      a.addEventListener('blur', () => applyFocus(false));
      a.addEventListener('mouseenter', () => applyFocus(true));
      a.addEventListener('mouseleave', () => applyFocus(document.activeElement === a));

      function openOrActivate() {
        chrome.runtime.sendMessage({ type: 'lm.openOrActivateSocial', url: s.url, host: s.host });
      }

      a.addEventListener('click', (e) => { e.preventDefault(); openOrActivate(); });
      a.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); openOrActivate(); }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const next = a.nextElementSibling || row.querySelector('a');
          next && next.focus();
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const prev = a.previousElementSibling || row.querySelectorAll('a')[row.querySelectorAll('a').length - 1];
          prev && prev.focus();
        }
      });

      return a;
    }

    // Append handle first, then icons
    row.appendChild(handle);
    socials.forEach((s, i) => row.appendChild(makeSocialAnchor(s, i)));

    socialBar.appendChild(row);
    document.documentElement.appendChild(socialBar);

    // Restore last position (GLOBAL)
    chrome.storage.local.get([STORAGE_KEY_SOCIAL_POS], (items) => {
      const pos = items[STORAGE_KEY_SOCIAL_POS];
      if (pos && typeof pos.top === 'number' && typeof pos.left === 'number') {
        socialBar.style.top = `${pos.top}px`;
        socialBar.style.left = `${pos.left}px`;
        socialBar.style.right = '';
      }
    });

    function toggle(show) {
      socialBar.style.display = show ? 'block' : 'none';
      if (show) {
        // Focus first icon for keyboard navigation
        const first = row.querySelector('a');
        first && first.focus();
      }
    }

      chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'lm.toggleWidget') {
        try {
          console.log('[LinksMaker:Content] Toggle widget message received (social)');
          const isHidden = socialBar.style.display === 'none' || socialBar.style.display === '';
          console.log('[LinksMaker:Content] Social bar state:', { isHidden, display: socialBar.style.display });
          toggle(isHidden);
        } catch (e) {
          console.error('[LinksMaker:Content] Social toggle error', e);
        }
      }
    });
    
    console.log('[LinksMaker:Content] Message listener registered for social bar');

      // In-page SPA URL watcher: observe pushState/replaceState and popstate
      (function installSpaWatcher(){
        let lastHref = location.href;
        const notify = () => {
          const href = location.href;
          if (href === lastHref) return;
          lastHref = href;
          try { chrome.runtime.sendMessage({ type: 'lm.spaUrlChanged', url: href }); } catch {}
        };
        const origPush = history.pushState;
        const origReplace = history.replaceState;
        try {
          history.pushState = function(){ const r = origPush.apply(this, arguments); setTimeout(notify, 0); return r; };
          history.replaceState = function(){ const r = origReplace.apply(this, arguments); setTimeout(notify, 0); return r; };
        } catch {}
        window.addEventListener('popstate', notify, true);
        const obs = new MutationObserver(() => { notify(); });
        try { obs.observe(document, { subtree: true, childList: true }); } catch {}
        setInterval(notify, 1500);
      })();
    });
    return; // Do not proceed to Google/YouTube UI when on socials
  }

  // ---------- Google/YouTube: full modal ----------
  const isDocsFile = () => host === 'docs.google.com' && (/\/document\//.test(location.pathname) || /\/spreadsheets\//.test(location.pathname) || /\/presentation\//.test(location.pathname));
  const isDriveFile = () => host === 'drive.google.com' && (/\/file\//.test(location.pathname) || /open\?id=/.test(location.search));
  const isMeet = () => host === 'meet.google.com';
  const supportsAccessProbe = () => isDocsFile() || isDriveFile() || isMeet();

  function assetUrl(name) { return chrome.runtime.getURL(name); }

  function getFaviconUrl() {
    const link = document.querySelector('link[rel~="icon"]') || document.querySelector('link[rel="shortcut icon"]');
    if (link?.href) return link.href;
    return `${location.origin}/favicon.ico`;
  }

  function buildUrl(currentUrlString, desiredIndex) {
    try {
      const u = new URL(currentUrlString);
      u.searchParams.set("authuser", String(desiredIndex));
      u.pathname = u.pathname.replace(/(\/)u\/(\d+)(\/|$)/, `$1u/${desiredIndex}$3`);
      return u.toString();
    } catch (e) {
      console.warn("[LinksMaker:Content] Failed to build url", e);
      return currentUrlString;
    }
  }

  function buildAccountChooserUrl(continueUrl, authIndex) {
    const base = 'https://accounts.google.com/AccountChooser';
    const params = new URLSearchParams({ continue: continueUrl });
    if (authIndex !== undefined && authIndex !== null) params.set('authuser', String(authIndex));
    return `${base}?${params.toString()}`;
  }

  function parseAuthIndexFromUrl(urlStr) {
    try {
      const u = new URL(urlStr);
      const q = u.searchParams.get("authuser");
      if (q !== null && q !== undefined) return Number(q);
      const pathMatch = u.pathname.match(/\/u\/(\d+)/);
      if (pathMatch) return Number(pathMatch[1]);
    } catch {}
    return null;
  }

  function scanCurrentGoogleAccount() {
    try {
      const accAnchor = document.querySelector('a[aria-label^="Google Account"], a[aria-label*="Google Account"]');
      const img = accAnchor?.querySelector('img');
      const aria = accAnchor?.getAttribute('aria-label') || img?.getAttribute('aria-label') || img?.getAttribute('alt') || '';
      let name = null; let email = null;
      const m = aria.match(/Google Account:?\s*(.*?)\s*\(([^)]+)\)/i);
      if (m) { name = m[1]; email = m[2]; }
      const photoUrl = img?.src || null;
      if (name || email || photoUrl) { return { name, email, photoUrl }; }
    } catch (e) { console.warn('[LinksMaker:Content] scanCurrentGoogleAccount failed', e); }
    return null;
  }

  async function upsertCurrentAccountIntoProfiles() {
    const details = scanCurrentGoogleAccount();
    const idx = parseAuthIndexFromUrl(location.href);
    if (!details || idx === null || Number.isNaN(idx)) return;

    chrome.storage.sync.get({ profiles: [] }, ({ profiles }) => {
      const list = Array.isArray(profiles) ? profiles.slice() : [];
      const existing = list.find((p) => p.authIndex === idx);
      if (existing) {
        existing.name = details.name || existing.name;
        existing.email = details.email || existing.email;
        existing.photoUrl = details.photoUrl || existing.photoUrl;
        if (!existing.label && (existing.name || existing.email)) existing.label = existing.name || existing.email;
      } else {
        list.push({ id: `acc-${idx}`, label: details.name || details.email || `Account ${idx}`, authIndex: idx, ...details });
      }
      chrome.storage.sync.set({ profiles: list }, () => render(list));
    });
  }

  function detectActiveAuthIndex(profiles) {
    const fromUrl = parseAuthIndexFromUrl(location.href);
    if (fromUrl !== null && !Number.isNaN(fromUrl)) return fromUrl;
    const scanned = scanCurrentGoogleAccount();
    if (scanned?.email) {
      const found = (profiles || []).find((p) => p.email && p.email.toLowerCase() === scanned.email.toLowerCase());
      if (found) return found.authIndex;
    }
    return null;
  }

  // Modal container
  const modal = document.createElement("div");
  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.zIndex = "999999";
  modal.style.display = "none";

  const backdrop = document.createElement("div");
  backdrop.style.position = "absolute";
  backdrop.style.inset = "0";
  backdrop.style.background = "rgba(0,0,0,0.35)";
  backdrop.addEventListener("click", () => toggle(false));

  const panel = document.createElement("div");
  panel.style.position = "absolute";
  panel.style.top = "10%";
  panel.style.left = "50%";
  panel.style.transform = "translateX(-50%)";
  panel.style.width = "420px";
  panel.style.maxWidth = "92vw";
  panel.style.background = "#fff";
  panel.style.color = "#000";
  panel.style.borderRadius = "12px";
  panel.style.boxShadow = "0 24px 72px rgba(0,0,0,0.28)";
  panel.style.padding = "24px";
  panel.style.fontFamily = "Poppins, Satoshi, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

  const topCard = document.createElement("div");
  topCard.style.display = "flex";
  topCard.style.alignItems = "center";
  topCard.style.gap = "14px";
  topCard.style.background = "#f3f4f6";
  topCard.style.padding = "16px 18px";
  topCard.style.borderRadius = "12px";
  topCard.style.marginBottom = "16px";

  const siteIcon = document.createElement("img");
  siteIcon.src = getFaviconUrl();
  siteIcon.style.width = "32px"; siteIcon.style.height = "32px"; siteIcon.style.borderRadius = "8px";
  const siteTitle = document.createElement("div");
  // Extract just the website name, removing tags/subline (everything after | or -)
  let siteName = document.title || location.hostname;
  if (siteName.includes('|')) {
    siteName = siteName.split('|')[0].trim();
  } else if (siteName.includes('—')) {
    siteName = siteName.split('—')[0].trim();
  } else if (siteName.includes('-')) {
    // Only split on dash if it's not part of the domain
    const parts = siteName.split(' - ');
    if (parts.length > 1 && !parts[0].includes('.')) {
      siteName = parts[0].trim();
    }
  }
  siteTitle.textContent = siteName;
  siteTitle.style.fontWeight = "700";
  const siteInfo = document.createElement("div");
  siteInfo.appendChild(siteTitle);
  topCard.appendChild(siteIcon); topCard.appendChild(siteInfo);

  const title = document.createElement("div");
  title.textContent = "Switch Profiles";
  title.style.fontWeight = "700";
  title.style.margin = "12px 0 6px";

  const checkBtn = document.createElement("button");
  checkBtn.style.border = "1px solid #d1d5db";
  checkBtn.style.background = "#fff";
  checkBtn.style.borderRadius = "999px";
  checkBtn.style.padding = "6px 10px";
  checkBtn.style.cursor = "pointer";
  if (isYouTube) {
    checkBtn.textContent = 'Choose';
  } else if (supportsAccessProbe()) {
    checkBtn.textContent = 'Check access';
  } else {
    checkBtn.style.display = 'none';
  }

  const titleRow = document.createElement("div");
  titleRow.style.display = "flex";
  titleRow.style.alignItems = "center";
  titleRow.style.justifyContent = "space-between";
  titleRow.appendChild(title);
  titleRow.appendChild(checkBtn);

  const list = document.createElement("div");
  list.style.marginTop = "12px";
  list.style.display = "grid";
  list.style.gap = "12px";

  let displaySettings = { showAvatars: true, showEmails: true };
  let activeIdxCache = null;
  let latestResults = {};
  let loadingByIndex = {};
  
  // Debouncing for automatic access checks
  let accessCheckTimeout = null;
  let lastCheckedUrl = null;
  let lastCheckTimestamp = 0;
  const ACCESS_CHECK_DEBOUNCE = 2000; // 2 seconds

  function createSpinner() {
    const s = document.createElement('div');
    s.style.width = '20px'; s.style.height = '20px'; s.style.border = '2px solid #e5e7eb'; s.style.borderTopColor = '#111'; s.style.borderRadius = '999px'; s.style.animation = 'lmspin 0.8s linear infinite';
    return s;
  }

  const style = document.createElement('style');
  style.textContent = '@keyframes lmspin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }';
  document.documentElement.appendChild(style);

  function createRow(profile) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.alignItems = "center";
    left.style.gap = "12px";

    const dot = document.createElement("span");
    dot.style.width = "12px"; dot.style.height = "12px"; dot.style.borderRadius = "999px";
    const isActive = activeIdxCache !== null && activeIdxCache === profile.authIndex;
    dot.style.background = isActive ? "#22c55e" : "#d1d5db";

    left.appendChild(dot);

    if (displaySettings.showAvatars) {
      const providerIcon = document.createElement("img");
      providerIcon.src = profile.photoUrl || getFaviconUrl();
      providerIcon.alt = "profile";
      providerIcon.style.width = "22px"; providerIcon.style.height = "22px"; providerIcon.style.borderRadius = profile.photoUrl ? "999px" : "6px";
      left.appendChild(providerIcon);
    }

    const textCol = document.createElement("div");
    const name = document.createElement("div");
    name.textContent = profile.name || profile.label || `Account ${profile.authIndex}`;
    name.style.fontWeight = "700";
    textCol.appendChild(name);

    if (displaySettings.showEmails && profile.email) {
      const email = document.createElement("div");
      email.textContent = profile.email;
      email.style.fontSize = "12px"; email.style.color = "#6b7280";
      textCol.appendChild(email);
    }

    left.appendChild(textCol);

    const right = document.createElement("div");
    right.style.display = 'flex'; right.style.gap = '8px'; right.style.alignItems = 'center';

    const showStatus = supportsAccessProbe();
    let statusBadge = null;
    let spinner = null;

    if (showStatus) {
      statusBadge = document.createElement('img');
      statusBadge.style.width = '20px';
      statusBadge.style.height = '20px';
      statusBadge.alt = 'status';
      spinner = createSpinner();
    }

    const applyStatus = (status) => {
      if (!showStatus) return;
      if (loadingByIndex[profile.authIndex]) {
        statusBadge.style.display = 'none';
        right.contains(spinner) || right.appendChild(spinner);
      } else {
        spinner.remove();
        statusBadge.style.display = '';
        if (status === 'access') {
          statusBadge.src = assetUrl('Checkmark.png'); statusBadge.title = 'Access';
        } else if (status === 'no_access') {
          statusBadge.src = assetUrl('Cross.png'); statusBadge.title = 'No access';
        } else {
          statusBadge.src = assetUrl('Warning.png'); statusBadge.title = 'Unknown';
        }
      }
    };

    const status = latestResults[profile.authIndex]?.status;
    applyStatus(status);

    if (showStatus) right.appendChild(statusBadge);

    const action = document.createElement("button");
    action.textContent = "Switch";
    action.style.border = "1px solid #e5e7eb";
    action.style.background = "#fff";
    action.style.borderRadius = "8px";
    action.style.padding = "8px 16px";
    action.style.cursor = "pointer";
    action.style.fontFamily = "Poppins, Satoshi, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    action.style.fontSize = "12px";
    action.style.fontWeight = "500";
    action.style.color = "#111827";
    action.style.transition = "all 0.15s ease";
    action.addEventListener("mouseenter", () => {
      action.style.background = "#f3f4f6";
      action.style.borderColor = "#111827";
    });
    action.addEventListener("mouseleave", () => {
      action.style.background = "#fff";
      action.style.borderColor = "#e5e7eb";
    });
    action.addEventListener("mousedown", () => {
      action.style.transform = "scale(0.98)";
    });
    action.addEventListener("mouseup", () => {
      action.style.transform = "";
    });
    action.addEventListener("click", () => {
      const target = buildUrl(location.href, profile.authIndex);
      location.href = target;
    });
    right.appendChild(action);

    row.appendChild(left); row.appendChild(right);

    row.__applyStatus = applyStatus;
    return row;
  }

  panel.appendChild(topCard);
  panel.appendChild(titleRow);
  panel.appendChild(list);

  modal.appendChild(backdrop);
  modal.appendChild(panel);
  document.documentElement.appendChild(modal);

  let profilesCache = [];
  const indexToRow = new Map();

  function render(profiles) {
    profilesCache = profiles;
    indexToRow.clear();
    activeIdxCache = detectActiveAuthIndex(profilesCache);
    list.innerHTML = "";
    profiles.forEach((p) => {
      const row = createRow(p);
      list.appendChild(row);
      indexToRow.set(p.authIndex, row);
    });
  }

  function setLoadingState(isLoading) {
    checkBtn.disabled = isLoading;
    profilesCache.forEach((p) => {
      loadingByIndex[p.authIndex] = isLoading;
      const row = indexToRow.get(p.authIndex);
      row?.__applyStatus(latestResults[p.authIndex]?.status);
    });
  }

  function triggerAccessCheck(immediate = false, forceRefresh = false) {
    if (!(isDocsFile() || isDriveFile() || isMeet())) return;
    
    const currentUrl = location.href;
    const now = Date.now();
    
    // Debounce: if same URL checked recently and not immediate, skip
    if (!immediate && currentUrl === lastCheckedUrl) {
      const timeSinceLastCheck = now - lastCheckTimestamp;
      if (timeSinceLastCheck < ACCESS_CHECK_DEBOUNCE) {
        // Debounced - skip check
        return;
      }
    }
    
    // Clear any pending debounced check
    if (accessCheckTimeout) {
      clearTimeout(accessCheckTimeout);
      accessCheckTimeout = null;
    }
    
    // Execute check (with optional delay for debouncing)
    const executeCheck = () => {
      lastCheckedUrl = currentUrl;
      lastCheckTimestamp = Date.now();
      
      // Log via background (non-blocking)
      try {
        chrome.runtime.sendMessage({ 
          type: 'lm.contentLog', 
          level: 'info', 
          message: 'Access check start', 
          data: { url: currentUrl, forceRefresh } 
        }).catch(() => {});
      } catch {}
      
      setLoadingState(true);
      chrome.runtime.sendMessage({ 
        type: 'lm.checkAccess', 
        url: currentUrl,
        forceRefresh 
      }, (res) => {
        try {
          chrome.runtime.sendMessage({ 
            type: 'lm.contentLog', 
            level: 'info', 
            message: 'Access check response', 
            data: { results: res, cached: res?.cached } 
          }).catch(() => {});
        } catch {}
        setLoadingState(false);
        if (!res?.ok) return;
        latestResults = res.results || {};
        profilesCache.forEach((p) => {
          const row = indexToRow.get(p.authIndex);
          if (row) {
            row.__applyStatus(latestResults[p.authIndex]?.status);
          }
        });
      });
    };
    
    if (immediate) {
      executeCheck();
    } else {
      accessCheckTimeout = setTimeout(executeCheck, 300); // Small delay for debouncing
    }
  }

  function toggle(show) {
    modal.style.display = show ? "block" : "none";
    if (show) {
      upsertCurrentAccountIntoProfiles();
      chrome.storage.sync.get({ display: { showAvatars: true, showEmails: true }, profiles: [] }, ({ display, profiles }) => {
        displaySettings = { showAvatars: Boolean(display?.showAvatars), showEmails: Boolean(display?.showEmails) };
        render(Array.isArray(profiles) ? profiles : []);
      });
    }
  }

  function init() {
    chrome.storage.sync.get({ profiles: null }, ({ profiles }) => {
      const data = Array.isArray(profiles) && profiles.length > 0 ? profiles : [
        { id: "work", label: "Work", authIndex: 0 },
        { id: "personal", label: "Personal", authIndex: 1 }
      ];
      render(data);
    });

    if (isDocsFile() || isDriveFile() || isMeet()) {
      const ACCESS_CHECK_DELAY = 800;
      setTimeout(() => triggerAccessCheck(), ACCESS_CHECK_DELAY);
    }
  }

  checkBtn.addEventListener('click', () => {
    if (isYouTube) {
      const chooser = buildAccountChooserUrl(location.href, null);
      location.href = chooser;
    } else {
      // Force refresh on manual button click
      triggerAccessCheck(true, true);
    }
  });

  // Register message listener early, before init()
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg !== "object") return false;
    if (msg.type === "lm.toggleWidget") {
      try {
        console.log('[LinksMaker:Content] Toggle widget message received');
        const isHidden = modal.style.display === "none" || modal.style.display === "";
        console.log('[LinksMaker:Content] Modal state:', { isHidden, display: modal.style.display });
        toggle(isHidden);
        return true;
      } catch (e) {
        console.error('[LinksMaker:Content] Toggle error', e);
        return false;
      }
    }
    return false;
  });
  
  console.log('[LinksMaker:Content] Message listener registered for Google/YouTube modal');

  init();
})();
