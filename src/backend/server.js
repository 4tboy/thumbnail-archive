const fs = require('fs');
const path = require('path');
const { exec, execSync, spawn } = require('child_process');
const os = require('os');

const isPackaged = typeof process.pkg !== 'undefined';
const executableDir = isPackaged ? path.dirname(process.execPath) : path.join(__dirname, '../..');

const APP_DATA_DIR = path.join(process.env.LOCALAPPDATA || process.env.APPDATA || os.tmpdir(), 'ThumbnailArchive');
if (!fs.existsSync(APP_DATA_DIR)) fs.mkdirSync(APP_DATA_DIR, { recursive: true });

// ─── Silent / hidden launch ──────────────────────────────────────────────────
// Hide the console window immediately when launched via --startup, --hidden,
// or when running as a packaged exe.  Developers can force visibility with
// --show-console.  Uses a tiny PowerShell heredoc to call ShowWindow(0).
const ARGS = new Set(process.argv.slice(2));
const FORCE_SHOW = ARGS.has('--show-console');
const SHOULD_HIDE = !FORCE_SHOW && (isPackaged || ARGS.has('--startup') || ARGS.has('--hidden'));

function hideConsoleWindow() {
  if (process.platform !== 'win32' || !SHOULD_HIDE) return;
  try {
    const psCode = [
      'Add-Type -TypeDefinition @"',
      'using System; using System.Runtime.InteropServices;',
      'public class _Win32 {',
      '  [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();',
      '  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);',
      '}',
      '"@ -ErrorAction SilentlyContinue',
      '$h = [_Win32]::GetConsoleWindow()',
      'if ($h -ne [IntPtr]::Zero) { [_Win32]::ShowWindow($h, 0) | Out-Null }',
    ].join('\n');
    const psFile = path.join(APP_DATA_DIR, '_hide.ps1');
    fs.writeFileSync(psFile, psCode, 'utf8');
    execSync(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${psFile}"`, { windowsHide: true });
  } catch { /* best-effort */ }
}

hideConsoleWindow();

// ─── --version flag ──────────────────────────────────────────────────────────
if (ARGS.has('--version')) {
  const { version } = require('../../package.json');
  console.log(version);
  process.exit(0);
}

// No configuration or core directory needed

function logToFile(msg) {
  try {
    const logFile = path.join(APP_DATA_DIR, 'ThumbnailArchive-debug.log');
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {}
}

// Track systray instance for cleanup on crash
let _trayInstance = null;

function _crashCleanup(label, detail) {
  logToFile(`[${label}] ${detail}`);
  try { if (_trayInstance) _trayInstance.kill(false); } catch { /* ignore */ }
  process.exit(1);
}

process.on('uncaughtException',   (err)    => _crashCleanup('UNCAUGHT EXCEPTION',  `${err.message}\n${err.stack}`));
process.on('unhandledRejection',  (reason) => _crashCleanup('UNHANDLED REJECTION', reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason)));

if (process.platform === 'win32') {
  const overrideStream = (streamName) => {
    try {
      const stream = process[streamName];
      const originalWrite = stream.write;
      stream.write = function(chunk, encoding, callback) {
        try {
          return originalWrite.call(stream, chunk, encoding, callback);
        } catch (err) {
          return true;
        }
      };
    } catch (e) {}
  };
  overrideStream('stdout');
  overrideStream('stderr');
}

const express = require('express');
const cors = require('cors');
const { startTray } = require('./tray');
const { version: APP_VERSION } = require('../../package.json');

const app = express();
let PORT = 80;
const FALLBACK_PORT = 23456;
const STATIC_DIR = path.join(__dirname, '../frontend');

app.use(cors({ origin: ['http://localhost', 'http://127.0.0.1', 'http://ta.tool'] }));
app.use(express.json());

const rateLimit = require('express-rate-limit');

// Rate limiter for API routes
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests — please wait a minute and try again.' },
});

app.use('/api/youtube', apiLimiter);
app.use('/api/vimeo',   apiLimiter);

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload Too Large (Max 5MB)' });
  }
  next(err);
});

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.use(express.static(STATIC_DIR));


// Check if upstream URL exists (using Node 18 native fetch)
async function urlExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return res.status === 200;
  } catch (err) {
    return false;
  }
}

// Fetch JSON data from endpoint (using Node 18 native fetch)
async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ThumbnailArchive/2.0 (Node.js)' },
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) throw new Error(`Upstream returned status ${res.status}`);
  return await res.json();
}

function extractYouTubeID(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

app.get('/api/youtube', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string' || url === 'null' || url === 'undefined') return res.status(400).json({ error: 'Valid URL parameter is required.' });
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'URL must start with http:// or https://' });

  const videoId = extractYouTubeID(url);
  if (!videoId) return res.status(400).json({ error: 'Could not extract a valid YouTube video ID from that URL.' });

  const maxres = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const hq = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const mq = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  const [maxresOk, hqOk] = await Promise.all([urlExists(maxres), urlExists(hq)]);
  const thumbnailUrl = maxresOk ? maxres : hqOk ? hq : mq;
  const quality = maxresOk ? 'maxres' : 'hq';

  let title = null, author = null;
  try {
    const oembed = await fetchJSON(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    title = oembed.title || null;
    author = oembed.author_name || null;
  } catch (_) {}

  return res.json({
    platform: 'YouTube',
    videoId,
    thumbnailUrl,
    quality,
    title,
    author,
    filename: `YouTube-Thumbnail-${videoId}.jpg`,
  });
});

app.get('/api/vimeo', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string' || url === 'null' || url === 'undefined') return res.status(400).json({ error: 'Valid URL parameter is required.' });
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'URL must start with http:// or https://' });

  const vimeoIdMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (!vimeoIdMatch) return res.status(400).json({ error: 'Could not extract a valid Vimeo video ID from that URL.' });

  const videoId = vimeoIdMatch[1];
  const apiUrl = `https://vimeo.com/api/v2/video/${videoId}.json`;

  try {
    const data = await fetchJSON(apiUrl);
    const video = Array.isArray(data) ? data[0] : data;
    if (!video || !video.thumbnail_large) {
      return res.status(404).json({ error: 'No thumbnail found for this Vimeo video.' });
    }

    const thumbnailUrl = video.thumbnail_large.replace(/_\d+(\?|$)/, '_1280$1');

    return res.json({
      platform: 'Vimeo',
      videoId,
      thumbnailUrl,
      fallbackUrl: video.thumbnail_large,
      title: video.title || null,
      author: video.user_name || null,
      quality: 'hd',
      filename: `Vimeo-Thumbnail-${videoId}.jpg`,
    });
  } catch {
    return res.status(502).json({ error: 'Failed to reach Vimeo API. The video may be private or unavailable.' });
  }
});

app.get('/api/download', async (req, res) => {
  const { imageUrl, filename } = req.query;
  if (!imageUrl || !filename) return res.status(400).json({ error: 'Missing imageUrl or filename.' });

  let parsedUrl;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid image URL.' });
  }

  try {
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!imgRes.ok) {
      return res.status(imgRes.status === 404 ? 404 : 502).json({
        error: `Upstream returned status ${imgRes.status}.`,
      });
    }

    const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_ ()]/g, '');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Type', 'image/jpeg');

    const arrayBuffer = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch image for download.' });
  }
});

app.post('/api/shutdown', (req, res) => {
  res.json({ success: true, message: 'Server is shutting down...' });
  console.log('\n  ✦ Shutdown requested. Terminating all services...\n');
  logToFile('[Server] Shutdown requested via API');
  setTimeout(() => {
    process.exit(0);
  }, 500);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

let SERVER_URL = '';
let httpServer = null;

function startServer(portToTry) {
  httpServer = app.listen(portToTry, '127.0.0.1')
    .on('listening', () => {
      PORT = httpServer.address().port;
      SERVER_URL = PORT === 80 ? 'http://ta.tool' : `http://127.0.0.1:${PORT}`;

      console.log(`\n  ✦ Thumbnail Archive v${APP_VERSION} running at ${SERVER_URL}`);
      console.log(`  → Open your browser at: ${SERVER_URL}\n`);
      logToFile(`[Server] Listening on port ${PORT}`);

      const iconPath = path.join(executableDir, 'icon.ico');

      _trayInstance = startTray({
        appVersion: APP_VERSION,
        serverUrl:  SERVER_URL,
        iconPath,
        onQuit: () => process.exit(0),
        onRestart: () => {
          logToFile('[Server] Restart requested from Tray');
          const args = isPackaged
            ? ['--startup']
            : [...process.argv.slice(1), '--startup'];
          const child = spawn(process.execPath, args, {
            detached:    true,
            stdio:       'ignore',
            windowsHide: true,
          });
          child.unref();
          process.exit(0);
        },
        logFn: logToFile,
      });

      // Auto-open browser unless this was a silent startup launch
      if (!ARGS.has('--startup') && !ARGS.has('--hidden')) {
        exec(
          process.platform === 'win32' ? `start "" "${SERVER_URL}"` : `open "${SERVER_URL}"`,
          { windowsHide: true },
          () => {},
        );
      }
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logToFile(`[Server] Port ${portToTry} is in use.`);
        if (portToTry === 80) {
          // Another instance is already running — open the browser to it and exit
          logToFile('[Server] Another instance detected. Opening browser to existing instance.');
          exec('start "" "http://ta.tool"', { windowsHide: true }, () => {});
          process.exit(0);
        } else {
          logToFile('[Server] Fatal error: Fallback port is also in use.');
          process.exit(1);
        }
      } else {
        process.exit(0);
      }
    });
}

startServer(PORT);
