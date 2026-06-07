'use strict';

/* ═══════════════════════════════════════════════════════════
   Thumbnail Archive — System Tray Module
   Native Windows notification-area icon with context menu
   Powered by systray2 (Go-based, pkg-compatible)
   ═══════════════════════════════════════════════════════════ */

const path = require('path');
const fs   = require('fs');
const { exec, execSync } = require('child_process');

// ─── Menu Item IDs ────────────────────────────────────────
const MENU = Object.freeze({
  OPEN:    0,
  RESTART: 1,
  STARTUP: 2,
  ABOUT:   3,
  SEP:     4,
  QUIT:    5,
});

/**
 * Reads the .ico file and returns a base64-encoded string
 * required by the systray2 library for the tray icon.
 * @param {string} iconPath - Absolute path to the .ico file
 * @returns {string} Base64 string or empty string on failure
 */
function loadIconBase64(iconPath) {
  try {
    const buf = fs.readFileSync(iconPath);
    return buf.toString('base64');
  } catch (err) {
    return '';
  }
}

/**
 * Opens the given URL in the user's default browser.
 * @param {string} url
 */
function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
            : process.platform === 'darwin' ? `open "${url}"`
            : `xdg-open "${url}"`;
  exec(cmd, { windowsHide: true }, () => {});
}

/**
 * Starts the system tray icon with a context menu.
 *
 * @param {Object}   opts
 * @param {string}   opts.appVersion  - Version string to display in "About"
 * @param {string}   opts.serverUrl   - URL the server is listening on
 * @param {string}   opts.iconPath    - Absolute path to the .ico file
 * @param {Function} opts.onQuit      - Callback when user clicks Quit
 * @param {Function} opts.onRestart   - Callback when user clicks Restart Server
 * @param {Function} opts.logFn       - Logger function
 * @returns {Object|null} The SysTray instance, or null on failure
 */
function startTray({ appVersion, serverUrl, iconPath, onQuit, onRestart, logFn }) {
  const log = typeof logFn === 'function' ? logFn : () => {};

  let SysTray;
  try {
    SysTray = require('systray2').default || require('systray2');
  } catch (err) {
    log(`[Tray] Failed to load systray2: ${err.message}`);
    return null;
  }

  const icon = loadIconBase64(iconPath);
  if (!icon) {
    log(`[Tray] Warning: Could not load icon from ${iconPath}`);
  }

  const isPackaged = typeof process.pkg !== 'undefined';
  const exePath = isPackaged ? process.execPath : __filename;

  let runOnStartup = false;
  if (process.platform === 'win32') {
    try {
      execSync('reg query HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run /v ThumbnailArchive', { stdio: 'ignore' });
      runOnStartup = true;
    } catch (err) {
      runOnStartup = false;
    }
  }

  let systray;
  try {
    systray = new SysTray({
      menu: {
        icon,
        title: '',
        tooltip: `Thumbnail Archive v${appVersion}`,
        items: [
          {
            title: '  Open in Browser',
            tooltip: `Open ${serverUrl}`,
            checked: false,
            enabled: true,
          },
          {
            title: '  Restart Server',
            tooltip: 'Restart the background server',
            checked: false,
            enabled: true,
          },
          {
            title: '  Run on Startup',
            tooltip: 'Start automatically when Windows boots',
            checked: runOnStartup,
            enabled: process.platform === 'win32',
          },
          {
            title: `  About  (v${appVersion})`,
            tooltip: 'Thumbnail Archive by 4tboy',
            checked: false,
            enabled: false,
          },
          // Separator — disabled item with dashes
          {
            title: '─────────────',
            tooltip: '',
            checked: false,
            enabled: false,
          },
          {
            title: '  Quit',
            tooltip: 'Stop server and exit',
            checked: false,
            enabled: true,
          },
        ],
      },
      debug: false,
      copyDir: isPackaged,
    });
  } catch (err) {
    log(`[Tray] Failed to create tray: ${err.message}`);
    return null;
  }

  systray.onClick((action) => {
    switch (action.seq_id) {
      case MENU.OPEN:
        log('[Tray] User clicked: Open in Browser');
        openBrowser(serverUrl);
        break;

      case MENU.RESTART:
        log('[Tray] User clicked: Restart Server');
        if (typeof onRestart === 'function') onRestart();
        break;

      case MENU.STARTUP:
        if (process.platform === 'win32') {
          runOnStartup = !runOnStartup;
          if (runOnStartup) {
            exec(`reg add HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run /v ThumbnailArchive /t REG_SZ /d "\\"${exePath}\\"" /f`, (err) => {
              if (err) log(`[Tray] Failed to enable startup: ${err.message}`);
              else log('[Tray] Enabled Run on Startup');
            });
          } else {
            exec(`reg delete HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run /v ThumbnailArchive /f`, (err) => {
              if (err) log(`[Tray] Failed to disable startup: ${err.message}`);
              else log('[Tray] Disabled Run on Startup');
            });
          }
          if (action.item) {
            action.item.checked = runOnStartup;
            systray.sendAction({
              type: 'update-item',
              item: action.item,
              seq_id: MENU.STARTUP,
            });
          }
        }
        break;

      case MENU.QUIT:
        log('[Tray] User clicked: Quit');
        systray.kill(false);
        if (typeof onQuit === 'function') onQuit();
        break;

      default:
        break;
    }
  });

  log('[Tray] System tray icon started ✓');
  return systray;
}

module.exports = { startTray };
