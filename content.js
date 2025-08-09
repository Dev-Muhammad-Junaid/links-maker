/* Links Maker — Content Script (modal layout + account capture, no carousel) */
(function () {
  if (window.__links_maker_injected__) return;
  window.__links_maker_injected__ = true;

  const host = location.hostname;
  const isGoogle = /(^|\.)google\.com$/.test(host) || /(^|\.)cloud\.google\.com$/.test(host);
  if (!isGoogle) return;

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
    // Prefer URL; fallback to email match
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
  panel.style.width = "420px"; // slightly bigger
  panel.style.maxWidth = "92vw";
  panel.style.background = "#fff";
  panel.style.color = "#000";
  panel.style.borderRadius = "12px";
  panel.style.boxShadow = "0 24px 72px rgba(0,0,0,0.28)";
  panel.style.padding = "24px"; // larger padding
  panel.style.fontFamily = "Poppins, Satoshi, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

  // Top website card (no carousel)
  const topCard = document.createElement("div");
  topCard.style.display = "flex";
  topCard.style.alignItems = "center";
  topCard.style.gap = "14px";
  topCard.style.background = "#f3f4f6";
  topCard.style.padding = "16px 18px"; // bigger
  topCard.style.borderRadius = "12px"; // bigger radius
  topCard.style.marginBottom = "16px";

  const siteIcon = document.createElement("img");
  siteIcon.src = getFaviconUrl();
  siteIcon.style.width = "32px"; siteIcon.style.height = "32px"; siteIcon.style.borderRadius = "8px"; // bigger
  const siteTitle = document.createElement("div");
  siteTitle.textContent = document.title || location.hostname;
  siteTitle.style.fontWeight = "700";
  const siteSub = document.createElement("div");
  siteSub.textContent = location.hostname;
  siteSub.style.fontSize = "12px"; siteSub.style.color = "#6b7280";
  const siteInfo = document.createElement("div");
  siteInfo.appendChild(siteTitle); siteInfo.appendChild(siteSub);
  topCard.appendChild(siteIcon); topCard.appendChild(siteInfo);

  // Title
  const title = document.createElement("div");
  title.textContent = "Switch Profiles";
  title.style.fontWeight = "700";
  title.style.margin = "12px 0 6px";

  // Connections list (our profiles)
  const list = document.createElement("div");
  list.style.marginTop = "12px";
  list.style.display = "grid";
  list.style.gap = "12px"; // larger gap

  let displaySettings = { showAvatars: true, showEmails: true };
  let activeIdxCache = null;

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
    dot.style.width = "12px"; // bigger indicator
    dot.style.height = "12px";
    dot.style.borderRadius = "999px";
    const isActive = activeIdxCache !== null && activeIdxCache === profile.authIndex;
    dot.style.background = isActive ? "#22c55e" : "#d1d5db";

    left.appendChild(dot);

    if (displaySettings.showAvatars) {
      const providerIcon = document.createElement("img");
      providerIcon.src = profile.photoUrl || getFaviconUrl();
      providerIcon.alt = "profile";
      providerIcon.style.width = "22px"; // bigger avatar
      providerIcon.style.height = "22px";
      providerIcon.style.borderRadius = profile.photoUrl ? "999px" : "6px";
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
      email.style.fontSize = "12px"; // smaller, not bold
      email.style.color = "#6b7280";
      textCol.appendChild(email);
    }

    left.appendChild(textCol);

    const action = document.createElement("button");
    action.textContent = "Switch";
    action.style.border = "1px solid #d1d5db";
    action.style.background = "#fff";
    action.style.borderRadius = "999px";
    action.style.padding = "8px 14px"; // larger button
    action.style.cursor = "pointer";
    action.addEventListener("click", () => { const target = buildUrl(location.href, profile.authIndex); location.href = target; });

    row.appendChild(left); row.appendChild(action);
    return row;
  }

  panel.appendChild(topCard);
  panel.appendChild(title);
  panel.appendChild(list);

  modal.appendChild(backdrop);
  modal.appendChild(panel);
  document.documentElement.appendChild(modal);

  let profilesCache = [];

  function render(profiles) {
    profilesCache = profiles;
    activeIdxCache = detectActiveAuthIndex(profilesCache);
    list.innerHTML = "";
    profiles.forEach((p) => list.appendChild(createRow(p)));
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
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "lm.toggleWidget") {
      const isHidden = modal.style.display === "none" || modal.style.display === "";
      toggle(isHidden);
    }
  });

  init();
})();
