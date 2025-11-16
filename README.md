# Links Maker — Quick Profile Switcher

A powerful Chrome Extension (Manifest V3) that helps you quickly switch between Google account profiles and manage your social media access. Perfect for users managing multiple Google accounts and social platforms.

## 🚀 Features

### Core Functionality

- **Profile Switching**: Quickly switch between Google account profiles on Google services (Gmail, Drive, Docs, Meet, YouTube, etc.)
- **Multiple Access Methods**:
  - **Omnibox**: Type `switch` in the address bar and select a profile
  - **Context Menu**: Right-click links → "Open with profile…"
  - **In-Page Widget**: Floating modal accessible via `Alt+L` keyboard shortcut
- **Smart URL Handling**: Automatically handles `authuser` query params and `/u/{n}/` path segments
- **Access Checking**: Verify which profiles have access to Google Docs, Drive files, and Meet links
- **Account Auto-Detection**: Automatically captures and saves Google account details (name, email, avatar)

### Social Media Widget

- **Quick Access Bar**: Minimal, draggable icons-only bar for social platforms
- **Supported Platforms**: Facebook, Instagram, Snapchat, TikTok, LinkedIn, X (Twitter)
- **Smart Tab Management**: Activates existing tabs instead of creating duplicates
- **Keyboard Navigation**: Full keyboard support with arrow keys and Enter
- **Position Memory**: Remembers bar position globally across all sites
- **Feature Toggle**: Enable/disable via Options page

### Link Blocking

- **Pattern-Based Blocking**: Block URLs using wildcard patterns (`*`, `?`)
- **SPA Detection**: Automatically detects Single Page Application (SPA) URL changes
- **Multiple Detection Methods**: Uses webNavigation API, history state updates, and tab URL changes
- **Blocked Page**: Custom blocked page with pattern information
- **Feature Toggle**: Enable/disable via Options page

### Logging & Debugging

- **Built-in Logs Viewer**: View extension logs directly in Options page
- **Standalone Logs Page**: Full-featured logs viewer (`logs.html`)
- **Export Functionality**: Export logs as JSON
- **Automatic Logging**: Tracks extension operations, errors, and access checks

### Display Options

- **Customizable Display**: Show/hide avatars and emails in profile list
- **Profile Management**: Add, edit, and remove profiles with custom labels
- **Visual Indicators**: Status badges for access checks (✓ access, ✗ no access, ⚠ unknown)

## 📦 Installation

### Load Unpacked (Development)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **"Load unpacked"**
5. Select the `links-maker` folder

### From Source

```bash
git clone https://github.com/Dev-Muhammad-Junaid/links-maker.git
cd links-maker
# Follow "Load Unpacked" steps above
```

## 🎯 Usage

### Switching Profiles

#### Method 1: Omnibox
1. Type `switch` in the Chrome address bar
2. Select a profile from suggestions
3. Press `Enter` to open in current tab, or `Shift+Enter` for new tab

#### Method 2: In-Page Widget
1. Navigate to a supported Google or social media site
2. Press `Alt+L` (or `Option+L` on Mac) to toggle the modal
3. Click "Switch" next to your desired profile

#### Method 3: Context Menu
1. Right-click any link or page
2. Select **"Links Maker"** → **"Open with profile…"**
3. Choose your profile

### Social Media Widget

1. Navigate to any supported social media site (Facebook, Instagram, X, etc.)
2. The social bar appears in the top-right corner (if enabled)
3. Click any icon to open/activate that platform
4. Drag the bar by the handle (appears on hover) to reposition
5. Use arrow keys for keyboard navigation

### Link Blocking

1. Open **Options** (click extension icon or right-click → Links Maker → Options)
2. Enable **"Enable Link Blocking"** toggle
3. Add URL patterns in the **"Blocked links"** textarea (one per line)
4. Patterns support wildcards:
   - `*` matches any characters
   - `?` matches single character
   - Examples:
     - `*://*.example.com/*` - Block all URLs from example.com
     - `https://bad.site.com/path` - Block specific URL
     - `*facebook.com/groups/*` - Block Facebook groups
     - `# This is a comment` - Lines starting with `#` are ignored

### Access Checking

On Google Docs, Drive files, or Meet links:
1. Open the Switch Profiles modal (`Alt+L`)
2. Click **"Check access"** button
3. View status indicators:
   - ✓ Green checkmark = Has access
   - ✗ Red X = No access
   - ⚠ Warning = Unknown status

## ⚙️ Configuration

### Options Page

Access via:
- Clicking the extension icon
- Right-click → Links Maker → Options
- Navigate to `chrome://extensions/` → Links Maker → Options

### Settings

- **Display**:
  - Show avatars
  - Show emails
  
- **Features**:
  - Enable Socials widget
  - Enable Link Blocking

- **Profiles**:
  - Add/remove profiles
  - Set custom labels
  - Configure `authuser` index

- **Blocked Links**:
  - Add URL patterns (wildcards supported)
  - One pattern per line
  - Comments start with `#`

- **Logs**:
  - View extension logs
  - Refresh, clear, or export logs
  - Open full logs page

## 🛠️ Tech Stack

### Core Technologies

- **Chrome Extension Manifest V3** - Modern extension platform
- **Vanilla JavaScript (ES6+)** - No frameworks, pure JavaScript
- **ES Modules** - Modern module system for code organization
- **Chrome APIs**:
  - `chrome.storage` (sync/local) - Settings and data persistence
  - `chrome.tabs` - Tab management and navigation
  - `chrome.webNavigation` - URL change detection and blocking
  - `chrome.scripting` - Content script injection and execution
  - `chrome.contextMenus` - Right-click menu integration
  - `chrome.omnibox` - Address bar suggestions
  - `chrome.commands` - Keyboard shortcuts
  - `chrome.downloads` - Log export functionality
  - `chrome.action` - Extension icon and badge

### Architecture

```
links-maker/
├── manifest.json          # Extension manifest (MV3)
├── background.js          # Service worker entry point
├── content.js             # Content script (modal/widget)
├── options.html/js        # Options page UI
├── logs.html/js          # Standalone logs viewer
├── blocked.html/js       # Blocked page UI
├── content.css           # Minimal CSS (most styles inline)
├── bg/                   # Background modules
│   ├── access.js        # Access checking logic
│   ├── badge.js         # Tab badge updates
│   ├── blocker.js       # Link blocking engine
│   ├── logs.js          # Logging utilities
│   ├── profiles.js      # Profile management
│   ├── social.js        # Social tab activation
│   └── url.js           # URL manipulation utilities
└── assets/              # Icons and images
    ├── Checkmark.png
    ├── Cross.png
    └── Warning.png
```

### Key Design Decisions

1. **No Build Tools**: Pure JavaScript, no bundlers or transpilers
2. **ES Modules**: Modern module system for better code organization
3. **Inline Styles**: Most CSS is inline to avoid conflicts with site styles
4. **Storage Strategy**:
   - `chrome.storage.sync` - User settings, profiles, patterns (syncs across devices)
   - `chrome.storage.local` - Logs, position data (device-specific)
5. **SPA Detection**: Multiple methods to catch URL changes in SPAs:
   - `webNavigation.onBeforeNavigate`
   - `webNavigation.onHistoryStateUpdated`
   - `webNavigation.onCommitted`
   - `tabs.onUpdated`
   - Content script URL watcher

### Supported Sites

**Google Services**:
- `*.google.com` (Gmail, Drive, Docs, Sheets, Slides, etc.)
- `*.cloud.google.com`
- `*.youtube.com`
- `*.meet.google.com`

**Social Media**:
- `*.facebook.com`
- `*.instagram.com`
- `*.snapchat.com`
- `*.tiktok.com`
- `*.linkedin.com`
- `*.x.com` / `*.twitter.com`

## 🔧 Development

### Project Structure

- **Background Script** (`background.js`): Service worker handling extension logic
- **Content Script** (`content.js`): Injected into pages, provides UI
- **Options Page**: Settings and configuration UI
- **Modules** (`bg/`): Reusable utility modules

### Key Modules

- **`bg/url.js`**: URL parsing and manipulation for Google services
- **`bg/access.js`**: Access checking via fetch and page execution
- **`bg/blocker.js`**: Link blocking with pattern matching and SPA detection
- **`bg/social.js`**: Social media tab activation logic
- **`bg/logs.js`**: Centralized logging system
- **`bg/profiles.js`**: Profile data management
- **`bg/badge.js`**: Tab badge updates showing current authuser index

### Testing

1. Load extension in developer mode
2. Test on various Google services
3. Check logs via Options page or `logs.html`
4. Test link blocking with various patterns
5. Verify social widget on different platforms

### Debugging

- Use the built-in logs viewer in Options
- Check browser console for content script logs
- Use Chrome DevTools → Extensions → Service Worker for background debugging
- Export logs for detailed analysis

## 📝 Permissions

The extension requires these permissions:

- `storage` - Save settings and profiles
- `tabs` - Manage tabs and detect URL changes
- `activeTab` - Access current tab
- `contextMenus` - Right-click menu
- `scripting` - Inject content scripts and execute code
- `downloads` - Export logs
- `webNavigation` - Detect navigation and block URLs
- `host_permissions` - Access all sites for profile switching and blocking

## 🐛 Troubleshooting

### Profile switching doesn't work
- Ensure you're signed into multiple Google accounts in Chrome
- Check that the `authuser` parameter is being added to URLs
- Try using the Account Chooser button on YouTube

### Social widget not appearing
- Check that "Enable Socials widget" is enabled in Options
- Verify you're on a supported social media domain
- Try refreshing the page

### Link blocking not working
- Ensure "Enable Link Blocking" is enabled in Options
- Check that patterns are correctly formatted (one per line)
- Verify patterns don't have syntax errors
- Check logs for blocking attempts

### Access check shows "Unknown"
- Access checking works best on Google Docs, Drive files, and Meet links
- Some URLs may not be checkable due to redirects or authentication flows
- Check logs for detailed access check results

## 📄 License

[Add your license here]

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues, feature requests, or questions, please open an issue on GitHub.

---

**Version**: 0.3.0  
**Manifest**: V3  
**Last Updated**: 2024
