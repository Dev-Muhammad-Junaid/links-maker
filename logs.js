(function(){
  const out = document.getElementById('out');
  const refreshBtn = document.getElementById('refresh');
  const clearBtn = document.getElementById('clear');
  const exportBtn = document.getElementById('export');

  function fmt(entry){
    try { return JSON.stringify(entry); } catch { return String(entry); }
  }

  function render(list){
    try {
      const text = (list || []).map(fmt).join('\n');
      out.value = text;
    } catch { out.value = ''; }
  }

  function load(){
    try {
      chrome.storage.local.get(['__lm_logs'], (items) => {
        const logs = Array.isArray(items.__lm_logs) ? items.__lm_logs : [];
        render(logs);
      });
    } catch { render([]); }
  }

  refreshBtn.addEventListener('click', load);
  clearBtn.addEventListener('click', () => {
    try { chrome.storage.local.set({ __lm_logs: [] }, load); } catch {}
  });
  exportBtn.addEventListener('click', () => {
    try {
      chrome.storage.local.get(['__lm_logs'], (items) => {
        const logs = Array.isArray(items.__lm_logs) ? items.__lm_logs : [];
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        chrome.downloads?.download?.({ url, filename: 'links-maker-logs.json', saveAs: true });
      });
    } catch {}
  });

  load();
})();


