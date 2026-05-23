# Fab Helper Script

[中文文档](README.md) | **English**

Fab Helper is a professional userscript designed to automate operations and optimize user experience on the Fab.com platform. Having undergone a complete modular refactoring (v3.5.x), the script provides powerful features including lightning-fast media blocking, intelligent HTTP 429 rate limit recovery, high-precision scroll cursor memory, and parallel multi-tab background processing.

---

## Core Features

- ⚡ **Triple-Lock Universal Resource Disabling**
  Blocks all images, video/audio media, custom fonts, and iframes (including WebGL 3D viewers) at `document-start` using **CSP Injection**, **CSS layout collapsing**, and **MutationObserver parsing overrides**. This significantly reduces network bandwidth, decreases browser rendering overhead, and frees up connection slots.
- 🔍 **Optimized Request Interception & Caching**
  Globally intercepts `/i/users/me/listings-states` API calls. The script compares requested product UIDs against the local database, filters out already-owned items from the network query, and mocks their `acquired: true` status locally. This drastically minimizes network request sizes and helps prevent HTTP 429 rate limits.
- 🔄 **Rate Limit Detection & Automated Recovery**
  Actively monitors API response statuses. When a 429 rate limit is encountered, the script pauses active tasks, applies an exponential backoff retry strategy, and uses periodic health probes to automatically resume execution once the rate limit is cleared—requiring no user intervention.
- ⚙️ **Multi-Tab Parallel Processing**
  Implements a "Main Scheduler - Worker Detail Tabs" parallel architecture. Worker detail pages are opened in lightweight background tabs to bypass main-thread UI blockage, adding items to the user's library quietly and efficiently.
- 📍 **Scroll Position Memory & Highlight Feedback**
  Uses URL cursor injection to record search scroll depths. Reopening or refreshing the page automatically scrolls back to the exact last-viewed item. A dark-theme friendly visual indicator (translucent green background and bright green text highlight) provides clear feedback upon successful restoration.
- 🖥️ **Glassmorphism Floating Dashboard**
  Designed with modern glassmorphism dark-theme aesthetics. Offers real-time metrics (tasks left, active workers, rate limit timer), a scrolling debug console, a configurations toggle panel (disable media, hide owned, auto-add, filter paid), and quick database reset controls.
- 📅 **Highly Readable Version Stamp**
  The build pipeline formats version strings using the developer's local timezone: `v[semver]-[YYYYMMDD]-[HHmm]` (e.g. `3.5.5-20260523-1347`), making it easy to track releases and troubleshoot.

---

## Directory Structure

The codebase is built modularly with all primary sources located in the `src/` directory:

```text
src/
├── config.js               # Global configuration constants, UI selectors, and DB keys
├── state.js                # Runtime state manager (AppStatus, execution flags)
├── index.js                # Script entry point, early CSP/resource blocking, and XHR/Fetch hooks
├── i18n/                   # Internationalization files
│   ├── zh.js               # Chinese language strings
│   └── en.js               # English language strings
└── modules/
    ├── api.js              # Central network interface (Fetch/XHR wrappers, data extraction)
    ├── data-cache.js       # In-memory data caching system (Listing details, prices, owned status)
    ├── database.js         # Persistent GM database wrapper (Todo, Done, Failed task storage)
    ├── instance-manager.js # Cross-tab multi-instance mutex and lock coordinator
    ├── page-diagnostics.js # Detail page DOM diagnostic and analyzer tools
    ├── page-patcher.js     # Page patching module (Cursor injection, scroll restore, highlight)
    ├── rate-limit-manager.js# HTTP 429 handling, wait countdowns, and recovery checks
    ├── task-runner.js      # Automation orchestrator (Hiding cards, scheduling workers, adding to library)
    ├── ui.js               # Console floating UI components and event bindings
    └── utils.js            # Utility helpers (Logger, Cookie parser, cursor decoder)
```

---

## Installation & Development

### Prerequisites
- Install [Node.js](https://nodejs.org/) (LTS recommended).
- Install Tampermonkey or Violentmonkey in your browser.

### Local Development
1. Clone the repository and install the development dependencies:
   ```bash
   npm install
   ```
2. Build the userscript (`dist/fab_helper.user.js`):
   ```bash
   npm run build
   ```
3. Watch mode (automatically rebuilds on file edits):
   ```bash
   npm run dev
   ```

### Deploying the Userscript
- Copy the entire contents of the generated `dist/fab_helper.user.js` file.
- Open your browser userscript manager dashboard, create a new script, paste the content, and save.
- Navigate to `https://www.fab.com` to see the control console appear on the bottom-right corner.

---

## Core Settings Configurations

Customize your script behaviors in the "Settings" tab of the dashboard:

| Configuration | Description |
| :--- | :--- |
| **Remember scroll position** | Remembers scroll coordinates in listing pages and resumes automatically upon refresh. |
| **Auto add task on scroll** | Automatically schedules free items in view to the background queue while scrolling. |
| **Hide items in library** | Visually hides already acquired products from the lists for a cleaner browsing feed. |
| **Disable images and media** | Blocks images, media, fonts, and iframe scripts globally to maximize speed and minimize bandwidth. |
| **Hide all paid items** | Completely filters out non-free products from listing feeds. |
| **Hide discounted paid items** | Hides paid items that are currently on discount, leaving only pure-free products. |

---

## Documentation

For further information regarding implementation details, please check the `docs` directory:
- [User Guide](docs/USER_GUIDE.md) (Chinese) —— Functional descriptions and walkthroughs of the dashboard UI.
- [API Reference](docs/API_REFERENCE.md) (Chinese) —— Details on modular API signatures and helper schemas.
- [Architecture Design](docs/ARCHITECTURE.md) (Chinese) —— Deep dive into parallel processing, rate limiting, and core concepts.
- [Troubleshooting](docs/TROUBLESHOOTING.md) (Chinese) —— General diagnostics and recovery guidance.
- [Changelog](docs/CHANGELOG.md) —— Historical feature iteration logs.
