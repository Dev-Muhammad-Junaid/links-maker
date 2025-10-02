// Logs module for Links Maker (MV3)

const MAX_LOGS = 1000;
const LOGS = [];

export function pushLog(level, message, data) {
  const entry = { ts: new Date().toISOString(), level, message, data: data ?? null };
  LOGS.push(entry);
  if (LOGS.length > MAX_LOGS) LOGS.shift();
  try {
    chrome.storage.local.set({ __lm_logs: LOGS.slice(-MAX_LOGS) });
  } catch {}
}

export async function readLogs() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(["__lm_logs"], (items) => {
        resolve(Array.isArray(items.__lm_logs) ? items.__lm_logs : LOGS);
      });
    } catch {
      resolve(LOGS);
    }
  });
}
