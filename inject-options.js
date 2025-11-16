// Links Maker — Injectable Options Panel
(function() {
  // Prevent multiple injections
  if (window.__lm_options_injected__) {
    // Toggle if already injected
    const existing = document.getElementById('lm-options-panel');
    if (existing) {
      const isVisible = existing.classList.contains('show');
      if (isVisible && window.__lm_hidePanel) {
        window.__lm_hidePanel();
      } else if (!isVisible && window.__lm_showPanel) {
        window.__lm_showPanel();
      } else {
        // Fallback if functions not available
        if (isVisible) {
          existing.classList.remove('show');
          const backdrop = document.getElementById('lm-options-backdrop');
          if (backdrop) backdrop.classList.remove('show');
        } else {
          existing.classList.add('show');
          const backdrop = document.getElementById('lm-options-backdrop');
          if (backdrop) backdrop.classList.add('show');
        }
      }
      return;
    }
  }
  window.__lm_options_injected__ = true;

  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'lm-options-backdrop';
  backdrop.className = 'lm-backdrop';
  
  // Create panel container
  const panelContainer = document.createElement('div');
  panelContainer.id = 'lm-options-panel';
  panelContainer.className = 'lm-panel';
  
  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    .lm-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 2147483646;
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
    }
    .lm-backdrop.show {
      opacity: 1;
      pointer-events: auto;
    }
    .lm-panel {
      position: fixed;
      top: 0;
      right: 0;
      width: 480px;
      max-width: 90vw;
      height: 100vh;
      max-height: 100vh;
      background: #fff;
      box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
      z-index: 2147483647;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: Poppins, Satoshi, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    .lm-panel.show {
      transform: translateX(0);
    }
    .lm-panel iframe {
      width: 100%;
      height: 100%;
      min-height: 0;
      max-height: 100vh;
      border: none;
      display: block;
      flex: 1 1 auto;
    }
    @media (max-width: 600px) {
      .lm-panel {
        width: 100vw;
        max-width: 100vw;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Create iframe for options page
  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('options.html');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  
  panelContainer.appendChild(iframe);
  document.body.appendChild(backdrop);
  document.body.appendChild(panelContainer);
  
  function showPanel() {
    backdrop.classList.add('show');
    panelContainer.classList.add('show');
  }
  
  function hidePanel() {
    backdrop.classList.remove('show');
    panelContainer.classList.remove('show');
  }
  
  // Store functions globally for toggle
  window.__lm_showPanel = showPanel;
  window.__lm_hidePanel = hidePanel;
  
  // Close on backdrop click
  backdrop.addEventListener('click', () => {
    hidePanel();
  });
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panelContainer.classList.contains('show')) {
      hidePanel();
    }
  });
  
  // Listen for close messages from iframe
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'lm-close-options') {
      hidePanel();
    }
  });
  
  // Show panel
  setTimeout(showPanel, 10);
})();

