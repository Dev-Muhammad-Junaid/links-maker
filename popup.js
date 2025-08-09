/* Links Maker — Popup (clean BW layout) */

const previewEl = document.getElementById("preview");
const buttonsEl = document.getElementById("buttons");
const importBtn = document.getElementById("import");
const manageBtn = document.getElementById("manage");
const addCurrentBtn = document.getElementById("addCurrent");
const errorEl = document.getElementById("error");

function showError(msg, detail) {
  errorEl.style.display = "block";
  errorEl.textContent = detail ? `${msg}: ${detail}` : msg;
}

function clearError() {
  errorEl.style.display = "none";
  errorEl.textContent = "";
}

function buildUrl(currentUrlString, desiredIndex) {
  try {
    const u = new URL(currentUrlString);
    u.searchParams.set("authuser", String(desiredIndex));
    u.pathname = u.pathname.replace(/(\/)u\/(\d+)(\/|$)/, `$1u/${desiredIndex}$3`);
    return u.toString();
  } catch (e) {
    console.warn("[LinksMaker:Popup] Failed to build url", e);
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

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

function render(profiles, currentUrl) {
  buttonsEl.innerHTML = "";
  previewEl.textContent = currentUrl || "";

  profiles.forEach((p) => {
    const btn = document.createElement("button");
    btn.className = "profile";
    btn.textContent = `${p.label} (${p.authIndex})`;
    btn.addEventListener("click", async (ev) => {
      const targetUrl = buildUrl(currentUrl, p.authIndex);
      const tab = await getActiveTab();
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || !tab?.id) {
        await chrome.tabs.create({ url: targetUrl });
      } else {
        await chrome.tabs.update(tab.id, { url: targetUrl });
      }
      window.close();
    });
    buttonsEl.appendChild(btn);
  });
}

function loadProfiles(cb) {
  chrome.storage.sync.get({ profiles: null }, ({ profiles }) => {
    const data = Array.isArray(profiles) && profiles.length > 0 ? profiles : [
      { id: "work", label: "Work", authIndex: 0 },
      { id: "personal", label: "Personal", authIndex: 1 }
    ];
    cb(data);
  });
}

async function init() {
  clearError();
  const tab = await getActiveTab();
  const currentUrl = tab?.url || "https://accounts.google.com/";
  loadProfiles((data) => render(data, currentUrl));
}

importBtn.addEventListener("click", () => {
  clearError();
  importBtn.disabled = true;
  importBtn.textContent = "Importing…";
  chrome.runtime.sendMessage({ type: "lm.fetchAccounts" }, (res) => {
    if (!res) {
      console.error("[LinksMaker:Popup] No response from background on import");
      showError("Import failed", "No background response");
    }
    if (!res?.ok || !Array.isArray(res.accounts) || res.accounts.length === 0) {
      console.warn("[LinksMaker:Popup] Import failed or empty", res ? JSON.stringify(res) : "null");
      showError("Import failed", res ? JSON.stringify(res) : "No result");
      importBtn.textContent = "Import";
      importBtn.disabled = false;
      return;
    }
    const profiles = res.accounts.map((a, i) => ({ id: (a.email || a.label || `acc-${i}`).toLowerCase(), label: a.email || a.label || `Account ${i}` , authIndex: i }));
    chrome.storage.sync.set({ profiles }, () => {
      if (chrome.runtime.lastError) {
        console.error("[LinksMaker:Popup] Failed to save profiles", chrome.runtime.lastError);
        showError("Save failed", chrome.runtime.lastError.message || String(chrome.runtime.lastError));
        importBtn.textContent = "Import";
        importBtn.disabled = false;
        return;
      }
      importBtn.textContent = "Imported";
      setTimeout(() => { importBtn.textContent = "Import"; }, 1200);
      importBtn.disabled = false;
      const currentUrl = previewEl.textContent;
      loadProfiles((data) => render(data, currentUrl));
    });
  });
});

manageBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

addCurrentBtn.addEventListener("click", async () => {
  clearError();
  const tab = await getActiveTab();
  const currentUrl = tab?.url || "";
  const idx = parseAuthIndexFromUrl(currentUrl);
  if (idx === null || Number.isNaN(idx)) {
    showError("Could not detect authuser from current URL");
    return;
  }
  chrome.storage.sync.get({ profiles: [] }, ({ profiles }) => {
    const p = Array.isArray(profiles) ? profiles : [];
    const label = `Account ${idx}`;
    const exists = p.some((x) => x.authIndex === idx);
    const next = exists ? p : p.concat([{ id: `acc-${idx}`, label, authIndex: idx }]);
    chrome.storage.sync.set({ profiles: next }, () => {
      const url = previewEl.textContent;
      loadProfiles((data) => render(data, url));
    });
  });
});

init();
