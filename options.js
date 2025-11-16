/* Links Maker — Options logic */

const backdrop = document.getElementById("backdrop");
const panel = document.getElementById("panel");
const closeBtn = document.getElementById("closeBtn");
const profilesContainer = document.getElementById("profiles");
const addBtn = document.getElementById("add");
const saveBtn = document.getElementById("save");
const showAvatarsEl = document.getElementById("showAvatars");
const showEmailsEl = document.getElementById("showEmails");
const featureSocialsEl = document.getElementById("featureSocials");
const featureLinkBlockingEl = document.getElementById("featureLinkBlocking");
const blockedPatternsEl = document.getElementById("blockedPatterns");
const blockedPatternsStatusEl = document.getElementById("blockedPatternsStatus");
const logsOutEl = document.getElementById("logsOut");
const logsRefreshBtn = document.getElementById("logsRefresh");
const logsClearBtn = document.getElementById("logsClear");
const logsExportBtn = document.getElementById("logsExport");
const logsOpenLink = document.getElementById("logsOpen");
const clearCacheBtn = document.getElementById("clearCache");
const cacheStatusEl = document.getElementById("cacheStatus");

// Check if we're in an iframe
const isInIframe = window.parent !== window;

// Add class to body if in iframe for CSS targeting
if (isInIframe) {
  document.body.classList.add('in-iframe');
  document.documentElement.classList.add('in-iframe');
  // Ensure html and body take full height
  document.documentElement.style.height = '100%';
  document.body.style.height = '100%';
  document.body.style.display = 'flex';
  document.body.style.flexDirection = 'column';
}

// Show panel with animation
function showPanel() {
  if (!isInIframe) {
    backdrop.classList.add("show");
  }
  panel.classList.add("show");
}

// Hide panel with animation
function hidePanel() {
  if (!isInIframe) {
    backdrop.classList.remove("show");
  }
  panel.classList.remove("show");
}

// Close handlers
closeBtn.addEventListener("click", () => {
  hidePanel();
  // If in iframe, send message to parent to close
  if (isInIframe) {
    window.parent.postMessage({ type: 'lm-close-options' }, '*');
  } else {
    setTimeout(() => window.close(), 300);
  }
});

if (!isInIframe) {
  backdrop.addEventListener("click", () => {
    hidePanel();
    setTimeout(() => window.close(), 300);
  });
}

// Show panel on load
setTimeout(showPanel, 10);

function createRow(profile = { id: "", label: "", authIndex: 0, name: "", email: "", photoUrl: "" }) {
  const row = document.createElement("div");
  row.className = "row";

  // Column 1: Profile preview (avatar/name/email) + editable custom label
  const profileCol = document.createElement("div");
  profileCol.className = "profileBox";

  const avatar = document.createElement("img");
  avatar.className = "avatar";
  avatar.src = profile.photoUrl || "";
  avatar.alt = "avatar";
  avatar.onerror = () => { avatar.style.display = "none"; };

  const info = document.createElement("div");
  const name = document.createElement("div");
  name.className = "name";
  name.textContent = profile.name || profile.label || `Account ${profile.authIndex}`;

  const email = document.createElement("div");
  email.className = "email";
  email.textContent = profile.email || "";

  const customLabel = document.createElement("input");
  customLabel.type = "text";
  customLabel.className = "labelInput";
  customLabel.placeholder = "Custom label (optional)";
  customLabel.value = profile.label || "";

  info.appendChild(name);
  info.appendChild(email);
  info.appendChild(customLabel);

  profileCol.appendChild(avatar);
  profileCol.appendChild(info);

  // Column 2: authuser index
  const idx = document.createElement("input");
  idx.type = "number";
  idx.min = "0";
  idx.step = "1";
  idx.value = String(profile.authIndex ?? 0);

  // Column 3: remove button
  const remove = document.createElement("button");
  remove.textContent = "✕";
  remove.title = "Remove";
  remove.addEventListener("click", () => row.remove());

  row.appendChild(profileCol);
  row.appendChild(idx);
  row.appendChild(remove);

  return row;
}

function rowsToProfiles() {
  const rows = Array.from(profilesContainer.querySelectorAll(".row"));
  return rows
    .map((row, i) => {
      const profileCol = row.querySelector(".profileBox");
      const nameEl = profileCol.querySelector(".name");
      const emailEl = profileCol.querySelector(".email");
      const labelEl = profileCol.querySelector(".labelInput");
      const idxEl = row.querySelector('input[type="number"]');

      const label = (labelEl.value || "").trim();
      const authIndex = Number(idxEl.value || 0);

      return {
        id: (label || nameEl.textContent || `p${i}`).toLowerCase().replace(/\s+/g, "-"),
        label,
        name: nameEl.textContent || "",
        email: emailEl.textContent || "",
        // avatar URL is not editable here; we keep saved one if already present in storage
        authIndex: Number.isNaN(authIndex) ? 0 : authIndex,
      };
    })
    .filter((p) => (p.label || p.name));
}

function render(profiles) {
  profilesContainer.innerHTML = "";
  profiles.forEach((p) => profilesContainer.appendChild(createRow(p)));
}

function load() {
  chrome.storage.sync.get(
    { profiles: null, display: { showAvatars: true, showEmails: true }, features: { socialsEnabled: true, linkBlockingEnabled: false }, blocked: { patterns: [] } },
    ({ profiles, display, features, blocked }) => {
      const data = Array.isArray(profiles) && profiles.length > 0 ? profiles : [
        { id: "work", label: "Work", authIndex: 0 },
        { id: "personal", label: "Personal", authIndex: 1 },
      ];
      render(data);
      showAvatarsEl.checked = Boolean(display?.showAvatars);
      showEmailsEl.checked = Boolean(display?.showEmails);
      featureSocialsEl.checked = Boolean(features?.socialsEnabled ?? true);
      featureLinkBlockingEl.checked = Boolean(features?.linkBlockingEnabled ?? false);
      const patterns = Array.isArray(blocked?.patterns) ? blocked.patterns : [];
      blockedPatternsEl.value = patterns.join("\n");
    }
  );
  loadLogs();
}

addBtn.addEventListener("click", () => {
  profilesContainer.appendChild(createRow());
});

// Auto-save blocked patterns with debounce
let blockedPatternsTimeout = null;
function saveBlockedPatterns() {
  if (blockedPatternsTimeout) {
    clearTimeout(blockedPatternsTimeout);
  }
  // Show saving indicator
  if (blockedPatternsStatusEl) {
    blockedPatternsStatusEl.textContent = 'Saving...';
    blockedPatternsStatusEl.style.opacity = '0.6';
  }
  blockedPatternsTimeout = setTimeout(() => {
    const patterns = (blockedPatternsEl.value || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    chrome.storage.sync.get({ blocked: { patterns: [] } }, ({ blocked }) => {
      chrome.storage.sync.set({ blocked: { patterns } }, () => {
        if (chrome.runtime.lastError) {
          console.warn("[LinksMaker:Options] Save blocked patterns error", chrome.runtime.lastError);
          if (blockedPatternsStatusEl) {
            blockedPatternsStatusEl.textContent = 'Error';
            blockedPatternsStatusEl.style.opacity = '1';
            setTimeout(() => { blockedPatternsStatusEl.style.opacity = '0'; }, 2000);
          }
          return;
        }
        console.info("[LinksMaker:Options] Blocked patterns auto-saved", { patterns });
        // Show saved indicator
        if (blockedPatternsStatusEl) {
          blockedPatternsStatusEl.textContent = '✓ Saved';
          blockedPatternsStatusEl.style.opacity = '1';
          setTimeout(() => { blockedPatternsStatusEl.style.opacity = '0'; }, 2000);
        }
      });
    });
  }, 500); // Debounce 500ms
}

blockedPatternsEl.addEventListener("input", saveBlockedPatterns);
blockedPatternsEl.addEventListener("change", saveBlockedPatterns);

saveBtn.addEventListener("click", () => {
  // Merge with existing to preserve photoUrl
  chrome.storage.sync.get({ profiles: [] }, ({ profiles: existing }) => {
    const edited = rowsToProfiles();
    const merged = edited.map((p) => {
      const prev = (existing || []).find((x) => x.authIndex === p.authIndex) || {};
      return { ...prev, ...p };
    });
    const display = { showAvatars: showAvatarsEl.checked, showEmails: showEmailsEl.checked };
    const features = { socialsEnabled: featureSocialsEl.checked, linkBlockingEnabled: featureLinkBlockingEl.checked };
    // Note: blocked patterns are auto-saved, but we include them here for consistency
    const patterns = (blockedPatternsEl.value || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    chrome.storage.sync.set({ profiles: merged, display, features, blocked: { patterns } }, () => {
      if (chrome.runtime.lastError) {
        console.warn("[LinksMaker:Options] Save error", chrome.runtime.lastError);
        return;
      }
      console.info("[LinksMaker:Options] Saved", { profiles: merged, display, features, blocked: { patterns } });
    });
  });
});

function renderLogs(list){
  try { logsOutEl.value = (list || []).map((e) => JSON.stringify(e)).join("\n"); } catch { logsOutEl.value = ""; }
}

function loadLogs(){
  try {
    chrome.storage.local.get(["__lm_logs"], (items) => {
      const logs = Array.isArray(items.__lm_logs) ? items.__lm_logs : [];
      renderLogs(logs);
    });
  } catch { renderLogs([]); }
}

logsRefreshBtn.addEventListener("click", loadLogs);
logsClearBtn.addEventListener("click", () => {
  try { chrome.storage.local.set({ __lm_logs: [] }, loadLogs); } catch {}
});
logsExportBtn.addEventListener("click", () => {
  try {
    chrome.storage.local.get(["__lm_logs"], (items) => {
      const logs = Array.isArray(items.__lm_logs) ? items.__lm_logs : [];
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      chrome.downloads?.download?.({ url, filename: "links-maker-logs.json", saveAs: true });
    });
  } catch {}
});
logsOpenLink.addEventListener("click", (e) => {
  e.preventDefault();
  try { chrome.tabs.create({ url: chrome.runtime.getURL("logs.html") }); } catch {}
});

clearCacheBtn.addEventListener("click", () => {
  if (clearCacheBtn.disabled) return;
  
  clearCacheBtn.disabled = true;
  cacheStatusEl.textContent = "Clearing...";
  cacheStatusEl.style.opacity = "1";
  
  chrome.runtime.sendMessage({ type: 'lm.clearAccessCache' }, (response) => {
    clearCacheBtn.disabled = false;
    if (response?.ok) {
      cacheStatusEl.textContent = "✓ Cache cleared successfully";
      cacheStatusEl.style.color = "var(--lm-color-success)";
      setTimeout(() => {
        cacheStatusEl.style.opacity = "0";
        setTimeout(() => {
          cacheStatusEl.textContent = "";
          cacheStatusEl.style.color = "var(--lm-color-muted)";
        }, 300);
      }, 2000);
    } else {
      cacheStatusEl.textContent = "✗ Failed to clear cache";
      cacheStatusEl.style.color = "var(--lm-color-error)";
      setTimeout(() => {
        cacheStatusEl.style.opacity = "0";
        setTimeout(() => {
          cacheStatusEl.textContent = "";
          cacheStatusEl.style.color = "var(--lm-color-muted)";
        }, 300);
      }, 2000);
    }
  });
});

load();
