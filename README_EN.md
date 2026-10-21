# Fab Helper Script

[中文文档](README.md) | **English**

Fab Helper is a high-performance automation userscript and experience optimization tool tailored for the [Fab.com](https://www.fab.com) platform (v3.5.x). Built for seamless mass asset browsing and claiming, it integrates **API-First ultra-fast claiming**, **native official zero-price checkout automation**, **aggressive media blocking**, **smart rate-limit backoff & recovery**, **CAPTCHA safety pause & system notifications**, and **high-precision cursor scroll memory**.

---

## Core Features

- ⚡ **Triple-Lock Universal Resource Disabling**  
  At the earliest lifecycle (`document-start`), images, video/audio media, custom web fonts, and irrelevant iframes (including high-overhead WebGL 3D viewers) are blocked via **CSP injection**, **CSS layout collapsing**, and **MutationObserver parsing interception**. This drastically reduces network usage and memory overhead, unleashing multi-tab concurrency.

- 🚀 **API-First Fast Claiming with Graceful DOM Fallback**  
  Pioneers an API-First strategy directly invoking official endpoints to complete claims in seconds. When facing multi-license selectors, special frontend requirements, or network anomalies, it smoothly falls back to full DOM automation on the detail page.

- 📦 **Automated Bundle Collection & Zero-Price Checkout Pipeline**  
  Full native support for Fab Bundle collections. Whether linked via `/bundles/` or `/listings/` routes, the script identifies bundles and drives the official zero-price purchase flow (`/payment/web/purchase`), automatically submitting and bidirectionally verifying server-side ownership.

- 💎 **100% Discount Freebies & CC0 License Coverage**  
  Beyond permanent $0 assets, it fully handles promotional **100% discount freebies** (where original price > 0 but discounted price is 0), CC0 public domain listings, and fallback offer extraction from `startingPrice`.

- 🛡️ **CAPTCHA / Human Verification Protection & System Notifications**  
  When challenged by Cloudflare Turnstile, ArkoseLabs, hCaptcha, reCAPTCHA, or security checks:
  - **No Force Close**: Disables timeout closing, keeps the verification tab open, and mounts a prominent alert banner;
  - **Safety Fuse Pause**: The main controller pauses immediately to protect the account from further rate limiting;
  - **Queue Preservation**: The interrupted task stays safe at the head of the To-Do queue;
  - **Desktop System Notification**: Enable notifications in Settings with one click. When a challenge occurs, a native desktop alert guides manual verification.

- 🔄 **Intelligent HTTP 429 Rate-Limit Recovery**  
  Continuously monitors response headers. When rate limited, it pauses operations, applies backoff intervals, and automatically resumes via scheduled refreshes and lightweight health probes once cleared.

- 📍 **High-Precision Scroll Cursor Memory**  
  Uses URL cursor injection and DOM anchor techniques to track search scroll depth. Refreshing or reopening seamlessly restores the exact last-viewed item with dark-theme highlight feedback.

- 🖥️ **Glassmorphism Floating Dashboard**  
  A modern dark-themed glassmorphism control panel featuring real-time counters (To-Do, Added, Failed, Visible, Hidden), live operation logs, quick-toggle configurations, and one-click data reset or retry controls.

---

## Directory Structure

Built modularly using ES Modules with primary source code under `src/`:

```text
src/
├── config.js                        # Global configuration, UI selectors, and database keys
├── state.js                         # Runtime state manager (Execution status, queues, instance info)
├── index.js                         # Entry point, early CSP/resource blocking, and network hooks
├── i18n/                            # Internationalization dictionaries
│   ├── zh.js                        # Chinese language pack
│   └── en.js                        # English language pack
└── modules/
    ├── api.js                       # Central network interface (Fetch/XHR wrappers, data extraction)
    ├── bundle-claim.js              # Bundle identification, checkout URL validation & iframe automation
    ├── captcha-detection.js         # Centralized human verification (CAPTCHA/Turnstile) detector
    ├── verification-notifications.js# Desktop notification permissions & verification alerts
    ├── claim-strategy.js            # Claim orchestrator (ApiClaim & DomClaim coordination)
    ├── data-cache.js                # In-memory caching system (Listings, prices, owned status)
    ├── database.js                  # Persistent GM storage (Todo, Done, Failed task queues)
    ├── detail-claim.js              # Detail page DOM claiming core (License selection, adult warning, button click)
    ├── instance-manager.js          # Cross-tab instance coordination and mutex locks
    ├── keepalive.js                 # Background keep-alive (Web Worker heartbeat & WebRTC anti-freeze)
    ├── listing-source.js            # Listing data source adapter (Cursor pagination, price calculation)
    ├── page-diagnostics.js          # Detail page DOM diagnostics and analysis tools
    ├── page-patcher.js              # Page patching module (Cursor injection, scroll restore, debouncing)
    ├── pipeline.js                  # Execution pipeline state machine
    ├── pipeline-adapter.js          # Pipeline storage and event log adapter
    ├── pipeline-scheduler.js        # Pipeline scheduler loop and self-healing engine
    ├── rate-limit-detection.js      # Accurate HTTP 429 status detector
    ├── rate-limit-manager.js        # Rate limit cooldown, history tracking, and probe recovery
    ├── task-runner.js               # Task orchestrator and card scanner (Main scheduler & worker tabs)
    ├── ui.js                        # Floating dashboard UI construction and event bindings
    └── utils.js                     # Utility helpers (Cookies, logger, DOM tools)
```

---

## Installation & Development

### Prerequisites
- Install [Node.js](https://nodejs.org/) (Node.js 18+ LTS recommended).
- Install a userscript manager in your browser: [Tampermonkey](https://www.tampermonkey.net/) or Violentmonkey.

### Local Development
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Build the userscript (`dist/fab_helper.user.js`):
   ```bash
   npm run build
   ```
3. Watch mode (automatically rebuilds on file change):
   ```bash
   npm run dev
   ```
4. Run the unit test suite:
   ```bash
   npm test
   ```

### Deployment
1. After building, copy the full contents of `dist/fab_helper.user.js`.
2. Open Tampermonkey, create a new script, paste the code, and save (`Ctrl+S` / `Cmd+S`).
3. Navigate to [Fab.com Free Search](https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt); the dashboard will appear at the bottom-right corner.

---

## Core Settings Configurations

Customize behaviors in the **"Settings"** tab of the dashboard:

| Configuration | Description |
| :--- | :--- |
| **Auto add on scroll** | Automatically queues free products in view while scrolling. |
| **Auto scroll page** | Automatically scrolls the page down smoothly to load and claim the entire library unattended. |
| **Remember scroll position** | Remembers search scroll depth and automatically restores position on page reopen/refresh. |
| **Auto resume after 429** | Pauses on 429 rate limits and resumes automatically once the cooldown probe succeeds. |
| **Auto refresh empty page** | Automatically reloads the page to fetch the next batch when all items in view are hidden or empty. |
| **Hide discounted paid** | Hides paid items that are currently discounted (leaving only free and 100% off items). |
| **Hide all paid** | Hides all non-free items from the list. |
| **Block large resources** | Blocks images, media, 3D WebGL viewers, and non-essential fonts for maximum speed and savings. |
| **Verification notifications** | Click to grant browser notification permissions for manual verification alerts. |
| **Debug mode** | Enables detailed diagnostic logs for troubleshooting. |

---

## What to Do When a CAPTCHA Appears

When platform security checks or CAPTCHAs are triggered, Fab Helper handles it safely:

1. **Auto Pause & Tab Kept Open**: Task dispatch pauses immediately, and the verification tab remains open with a red banner at the top.
2. **Desktop Notification**: If enabled in Settings, your browser sends a desktop notification alerting you that manual verification is needed.
3. **Verify & Resume**:
   - Switch to the tab with **`⚠️【需验证】`** in its title and complete the challenge manually;
   - Return to the Fab search page and click **"Start Tasks"** on the dashboard to resume claiming.

---

## Documentation

- [User Guide](docs/USER_GUIDE.md) (Chinese) —— Complete walkthrough of dashboard features and notification setups.
- [Troubleshooting](docs/TROUBLESHOOTING.md) (Chinese) —— Common issues, rate limits, and verification troubleshooting.
- [Architecture Design](docs/ARCHITECTURE.md) (Chinese) —— Deep dive into multi-tab concurrency, claim strategies, and internal design.
- [Changelog](docs/CHANGELOG.md) —— Comprehensive version iteration and bugfix history.
