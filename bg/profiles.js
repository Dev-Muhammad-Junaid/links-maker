// Profiles module for Links Maker (MV3)

export const DEFAULT_PROFILES = [
  { id: "work", label: "Work", authIndex: 0 },
  { id: "personal", label: "Personal", authIndex: 1 }
];

export async function getProfiles() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ profiles: DEFAULT_PROFILES }, (items) => {
      const profiles = Array.isArray(items.profiles) && items.profiles.length > 0
        ? items.profiles
        : DEFAULT_PROFILES;
      resolve(profiles);
    });
  });
}
