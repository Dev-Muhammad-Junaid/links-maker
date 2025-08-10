# Links Maker — Quick Profile Switcher (Chrome Extension, MV3)

Switch between Google account profiles quickly:
- Omnibox: type `switch`, choose a profile (Enter opens, Shift+Enter new tab)
- Context menu: right-click → Open with profile…
- In-page widget: floating modal on Google apps (Alt+L to toggle)

## Install (Load Unpacked)
1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked" and select this folder

## Configure
Open Options (Manage Profiles) to add/edit profiles. Each profile maps to an `authuser` index.

## Test with your Google accounts
- Sign into multiple accounts in Chrome (top-right profile menu) and inside Google apps.
- Go to Gmail/Drive/Docs/Meet.
- Use any of:
  - Omnibox: type `switch` → pick a profile suggestion
  - Widget: open the modal with Alt+L on supported pages
  - Right-click links: "Open with profile…"

## Notes
- Clicking the extension icon opens Manage Profiles (Options page).
- For Google apps that use `/u/<n>/` in the path (e.g., Gmail), the extension updates that segment as well as the `authuser` query param.
- If a site redirects and strips `authuser`, try again using the in-page modal or omnibox.
- Keyboard: Alt+L toggles the modal's visibility.
