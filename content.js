/* Links Maker — Content Script (modal for Google/YouTube; minimal bar for socials) */
(function () {
  if (window.__links_maker_injected__) return;
  window.__links_maker_injected__ = true;

  const host = location.hostname;
  const isGoogle = /(^|\.)google\.com$/.test(host) || /(^|\.)cloud\.google\.com$/.test(host);
  const isYouTube = /(^|\.)youtube\.com$/.test(host);
  const isSocial = /(^|\.)facebook\.com$/.test(host) || /(^|\.)instagram\.com$/.test(host) || /(^|\.)snapchat\.com$/.test(host) || /(^|\.)tiktok\.com$/.test(host);
  const isSupportedHost = isGoogle || isYouTube || isSocial;
  if (!isSupportedHost) return;

  // ---------- Socials: minimal icons-only bar ----------
  if (isSocial) {
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

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '14px';

    const socials = [
      { name: 'Facebook', url: 'https://www.facebook.com/', host: 'facebook.com', icon: 'https://www.facebook.com/favicon.ico' },
      { name: 'Instagram', url: 'https://www.instagram.com/', host: 'instagram.com', icon: 'https://www.instagram.com/favicon.ico' },
      { name: 'Snapchat', url: 'https://www.snapchat.com/', host: 'snapchat.com', icon: 'https://www.snapchat.com/favicon.ico' },
      { name: 'TikTok', url: 'https://www.tiktok.com/', host: 'tiktok.com', icon: 'https://www.tiktok.com/favicon.ico' }
    ];

    socials.forEach((s) => {
      const a = document.createElement('a');
      a.href = s.url;
      a.title = s.name;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.sendMessage({ type: 'lm.openOrActivateSocial', url: s.url, host: s.host });
      });
      const img = document.createElement('img');
      img.src = s.icon;
      img.alt = s.name;
      img.style.width = '32px';
      img.style.height = '32px';
      img.style.borderRadius = '8px';
      img.style.display = 'block';
      a.appendChild(img);
      row.appendChild(a);
    });

    socialBar.appendChild(row);
    document.documentElement.appendChild(socialBar);

    function toggle(show) {
      socialBar.style.display = show ? 'block' : 'none';
    }

    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'lm.toggleWidget') {
        const isHidden = socialBar.style.display === 'none' || socialBar.style.display === '';
        toggle(isHidden);
      }
    });

    return; // Do not proceed to Google/YouTube UI when on socials
  }

  // ---------- Google/YouTube: full modal ----------
  const isDocsFile = () => host === 'docs.google.com' && (/\/document\//.test(location.pathname) || /\/spreadsheets\//.test(location.pathname) || /\/presentation\//.test(location.pathname));
  const isDriveFile = () => host === 'drive.google.com' && (/\/file\//.test(location.pathname) || /open\?id=/.test(location.search));
  const supportsAccessProbe = () => isDocsFile() || isDriveFile();

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
  siteTitle.textContent = document.title || location.hostname;
  siteTitle.style.fontWeight = "700";
  const siteSub = document.createElement("div");
  siteSub.textContent = location.hostname;
  siteSub.style.fontSize = "12px"; siteSub.style.color = "#6b7280";
  const siteInfo = document.createElement("div");
  siteInfo.appendChild(siteTitle); siteInfo.appendChild(siteSub);
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
    action.style.border = "1px solid #d1d5db"; action.style.background = "#fff"; action.style.borderRadius = "999px"; action.style.padding = "8px 14px"; action.style.cursor = "pointer";
    action.addEventListener("click", () => {
      if (isYouTube) {
        const target = buildUrl(location.href, profile.authIndex);
        location.href = target;
      } else {
        const target = buildUrl(location.href, profile.authIndex);
        location.href = target;
      }
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

  function triggerAccessCheck() {
    if (!(isDocsFile() || isDriveFile())) return;
    console.log('[LinksMaker:Content] check start', location.href);
    setLoadingState(true);
    chrome.runtime.sendMessage({ type: 'lm.checkAccess', url: location.href }, (res) => {
      console.log('[LinksMaker:Content] check response', res);
      setLoadingState(false);
      if (!res?.ok) return;
      latestResults = res.results || {};
      profilesCache.forEach((p) => indexToRow.get(p.authIndex)?.__applyStatus(latestResults[p.authIndex]?.status));
    });
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

    if (isDocsFile() || isDriveFile()) {
      setTimeout(() => triggerAccessCheck(), 800);
    }
  }

  checkBtn.addEventListener('click', () => {
    if (isYouTube) {
      const chooser = buildAccountChooserUrl(location.href, null);
      location.href = chooser;
    } else {
      triggerAccessCheck();
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "lm.toggleWidget") {
      const isHidden = modal.style.display === "none" || modal.style.display === "";
      toggle(isHidden);
    }
  });

  init();
})();
