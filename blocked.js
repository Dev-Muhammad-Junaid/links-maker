(function(){
  function qs(k){ return new URLSearchParams(location.search).get(k) || ''; }
  const urlEl = document.getElementById('url');
  const patEl = document.getElementById('pattern');
  const backBtn = document.getElementById('back');
  const overrideBtn = null;
  const disableBlocking = null;

  const target = qs('target');
  const pattern = qs('pattern');
  urlEl.textContent = target;
  patEl.textContent = pattern || '(unknown)';

  backBtn.addEventListener('click', () => {
    try { history.back(); } catch { location.href = 'about:blank'; }
  });

  // override disabled by design

  // disable toggle removed
})();


