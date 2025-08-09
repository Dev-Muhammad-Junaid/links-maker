# Links Maker — Quick Profile Switcher (Chrome Extension, MV3)

Switch between Google account profiles quickly:
- Omnibox: type `switch`, choose a profile (Enter opens, Shift+Enter new tab)
- Toolbar popup: click the extension icon near the address bar → pick a profile
- Context menu: right-click → Open with profile…
- In-page widget: floating buttons on Google apps (top-right; draggable; Alt+L to toggle)

## Install (Load Unpacked)
1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked" and select this folder

## Configure
Open Options (from the extension card) to add/edit profiles. Each profile maps to an `authuser` index.

## Test with your Google accounts
- Sign into multiple accounts in Chrome (top-right profile menu) and inside Google apps.
- Go to Gmail/Drive/Docs/Meet.
- Use any of:
  - Popup: click extension icon → choose profile
  - Omnibox: type `switch` → pick a profile suggestion
  - Widget: use the top-right floating buttons; drag to reposition; position is remembered per origin
  - Right-click links: "Open with profile…"

## Notes
- For Google apps that use `/u/<n>/` in the path (e.g., Gmail), the extension updates that segment as well as the `authuser` query param.
- If a site redirects and strips `authuser`, try again from the popup or omnibox; some flows sanitize URLs.
- Keyboard: Alt+L toggles the widget's visibility.
- Logs: check the background service worker (chrome://extensions → Inspect) and the page console for `[LinksMaker]` messages.
