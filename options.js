/* Links Maker — Options logic */

const profilesContainer = document.getElementById("profiles");
const addBtn = document.getElementById("add");
const saveBtn = document.getElementById("save");
const showAvatarsEl = document.getElementById("showAvatars");
const showEmailsEl = document.getElementById("showEmails");

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
    { profiles: null, display: { showAvatars: true, showEmails: true } },
    ({ profiles, display }) => {
      const data = Array.isArray(profiles) && profiles.length > 0 ? profiles : [
        { id: "work", label: "Work", authIndex: 0 },
        { id: "personal", label: "Personal", authIndex: 1 },
      ];
      render(data);
      showAvatarsEl.checked = Boolean(display?.showAvatars);
      showEmailsEl.checked = Boolean(display?.showEmails);
    }
  );
}

addBtn.addEventListener("click", () => {
  profilesContainer.appendChild(createRow());
});

saveBtn.addEventListener("click", () => {
  // Merge with existing to preserve photoUrl
  chrome.storage.sync.get({ profiles: [] }, ({ profiles: existing }) => {
    const edited = rowsToProfiles();
    const merged = edited.map((p) => {
      const prev = (existing || []).find((x) => x.authIndex === p.authIndex) || {};
      return { ...prev, ...p };
    });
    const display = { showAvatars: showAvatarsEl.checked, showEmails: showEmailsEl.checked };
    chrome.storage.sync.set({ profiles: merged, display }, () => {
      if (chrome.runtime.lastError) {
        console.warn("[LinksMaker:Options] Save error", chrome.runtime.lastError);
        return;
      }
      console.info("[LinksMaker:Options] Saved", { profiles: merged, display });
    });
  });
});

load();
