'use strict';

/* ═══════════════════════════════════════════════════════════
   Thumbnail Archive — System Tray Module
   Native Windows notification-area icon with context menu
   Powered by systray2 (Go-based, pkg-compatible)
   ═══════════════════════════════════════════════════════════ */

const path = require('path');
const fs   = require('fs');
const { exec, execSync } = require('child_process');

// ─── Menu Item Sequence IDs ────────────────────────────────
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
    return fs.readFileSync(iconPath).toString('base64');
  } catch {
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
 * Checks whether the app is registered in the Windows Run key.
 * Searches both HKCU and HKLM, and both the spaced and un-spaced value names.
 * @returns {boolean}
 */
function checkStartupRegistry() {
  if (process.platform !== 'win32') return false;
  const keys = [
    'reg query "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Thumbnail Archive"',
    'reg query "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "ThumbnailArchive"',
    'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Thumbnail Archive"',
  ];
  for (const cmd of keys) {
    try { execSync(cmd, { stdio: 'ignore' }); return true; } catch { /* not found */ }
  }
  return false;
}

/**
 * Builds the command-line string used for the startup registry value.
 * Points directly to the exe (or node + server.js in dev) with --startup flag,
 * so that Windows Startup Apps shows the correct name and icon.
 * @param {boolean} isPackaged
 * @returns {string}
 */
function buildStartupCommand(isPackaged) {
  if (isPackaged) {
    // Direct exe path — Windows Startup Apps reads the icon/name from this exe
    return `"${process.execPath}" --startup`;
  }
  // Dev: launch node with this script
  return `"${process.execPath}" "${path.join(__dirname, 'server.js')}" --startup`;
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
  if (!icon) log(`[Tray] Warning: Could not load icon from ${iconPath}`);

  const isPackaged    = typeof process.pkg !== 'undefined';
  const startupCmd    = buildStartupCommand(isPackaged);
  let   runOnStartup  = checkStartupRegistry();

  let systray;
  try {
    systray = new SysTray({
      menu: {
        icon,
        title: '',
        tooltip: `Thumbnail Archive v${appVersion}`,
        items: [
          {
            title:   'Open in Browser',
            tooltip: `Open ${serverUrl}`,
            checked: false,
            enabled: true,
          },
          {
            title:   'Restart Server',
            tooltip: 'Restart the background server',
            checked: false,
            enabled: true,
          },
          {
            title:   'Run on Startup',
            tooltip: 'Start automatically when Windows boots',
            checked: runOnStartup,
            enabled: process.platform === 'win32',
          },
          {
            title:   `About  (v${appVersion})`,
            tooltip: 'Thumbnail Archive by 4tboy',
            checked: false,
            enabled: false,
          },
          // Separator
          {
            title:   '<SEPARATOR>',
            tooltip: '',
            enabled: true,
          },
          {
            title:   'Quit',
            tooltip: 'Stop server and exit',
            checked: false,
            enabled: true,
          },
        ],
      },
      debug:   false,
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
        if (process.platform !== 'win32') break;
        runOnStartup = !runOnStartup;

        if (runOnStartup) {
          // Clean up legacy key without spaces first
          exec('reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "ThumbnailArchive" /f', () => {});
          exec(
            `reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Thumbnail Archive" /t REG_SZ /d "${startupCmd}" /f`,
            (err) => {
              if (err) log(`[Tray] Failed to enable startup: ${err.message}`);
              else     log('[Tray] Run on Startup enabled');
            },
          );
        } else {
          exec('reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Thumbnail Archive" /f', () => {});
          exec('reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "ThumbnailArchive" /f', () => {});
          exec('reg delete "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Thumbnail Archive" /f', () => {});
          log('[Tray] Run on Startup disabled');
        }

        if (action.item) {
          action.item.checked = runOnStartup;
          systray.sendAction({
            type:   'update-item',
            item:   action.item,
            seq_id: MENU.STARTUP,
          });
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

  log('[Tray] System tray icon started');
  return systray;
}

module.exports = { startTray };
