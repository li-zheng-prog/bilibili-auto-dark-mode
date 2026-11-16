# Bili Theme Sync

A lightweight Microsoft Edge / Chromium extension that keeps Bilibili's native light and dark themes in sync with your system appearance.

## Installation

1. Open `edge://extensions` in Microsoft Edge.
2. Enable **Developer mode** and click **Load unpacked**.
3. Select this project's `extension` folder, which contains `manifest.json` directly.
4. Refresh any Bilibili tabs that are already open.

You can also download a versioned ZIP archive from [Releases](https://github.com/li-zheng-prog/bilibili-auto-dark-mode/releases), extract it, and load the extracted folder.

No configuration is needed after installation. Requires Edge 111 or later.

**Upgrading to 1.0.1:** If you loaded this project's `extension` folder, click **Reload** on the extensions page, confirm that the version is 1.0.1, and refresh all Bilibili tabs. If you installed from an extracted archive, replace the files in that installation folder with the new release before reloading the extension. Changes to this project do not automatically update a separate installation folder.

## How it works

- Bilibili's native theme follows your system appearance when you open or refresh a page.
- Open pages switch automatically when your system changes between light and dark mode, without a refresh.
- Switching themes manually on Bilibili keeps your choice for the current page until the next refresh or system theme change.
- Only pages with supported native theme controls or styles are updated. Other pages remain unchanged.
- The extension follows `prefers-color-scheme`, which reflects the system's app mode. In Windows Custom mode, the app mode can differ from the Windows mode.

## Footprint and permissions

The extension consists of `extension/manifest.json`, `extension/theme.js`, and the icons in `extension/icons`. It requires no build step, runtime dependencies, background service, settings page, or extension API permissions. The script runs only in top-level HTTPS pages on Bilibili's main domain and subdomains, not inside embedded players.

It reuses Bilibili's native `__css-map__` theme styles, the homepage's `bili_dark` class, the `theme_style` cookie, and the `biliThemeChange` event. When the navigation bar is mounted, the extension prefers its theme-switching event so that the menu and internal page state update together. The extension itself sends no network requests and does not read account cookies. Native theme files are still loaded from Bilibili's CDN.

Version 1.0.1 fixes skipped homepages that use native CSS classes, undetected theme elements loaded asynchronously, old themes restored during page initialization, and theme elements replaced during in-page navigation. DOM changes trigger batched updates as components become available; there is no timer-based polling. Manual actions are handled separately from initialization events to prevent stale state from overriding automatic synchronization.

**Compatibility:** Native theme support can vary across Bilibili pages, accounts, and staged rollouts. The homepage's `bili_dark` class and video pages' theme stylesheet elements were checked on November 4, 2026. The extension does not inject custom colors into pages without native support. Changes to Bilibili's theme elements or navigation bar internals may require updates to the extension.

## Testing

`tests/browser.cjs` uses Playwright and a locally installed copy of Edge to load the actual extension in an isolated temporary browser profile. It checks system themes, manual switching, refreshes, delayed theme elements, native filters, and unsupported pages. Test dependencies are not shipped with the extension.

Test pages and styles are supplied through request interception for repeatable checks, with no Bilibili login required. Optionally, set `BILI_HEADER_PATH` to the path of a current `bili-header.umd.js` file downloaded from Bilibili to check the real navigation bar's theme callbacks, manual switching, and state synchronization. Set `BILI_HOME_CSS_PATH` to the path of the current homepage stylesheet to check background color changes in both directions using the real styles.

Version 1.0.1 passed 18 checks in an isolated Edge test profile with both official resources included. System theme changes were simulated through browser media emulation; the user's Windows theme was not changed.

```powershell
npm install --prefix "$env:TEMP\bili-theme-test-tools" playwright@1.64.1 --no-audit --no-fund
$env:NODE_PATH = "$env:TEMP\bili-theme-test-tools\node_modules"
node tests/browser.cjs
```
