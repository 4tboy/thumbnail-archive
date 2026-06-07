const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const isPackaged = typeof process.pkg !== 'undefined';
const executableDir = isPackaged ? path.dirname(process.execPath) : path.join(__dirname, '../..');

function logToFile(msg) {
  try {
    const logDir = process.env.LOCALAPPDATA || process.env.APPDATA || require('os').tmpdir();
    const logFile = path.join(logDir, 'ThumbnailArchive-debug.log');
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {}
}

process.on('uncaughtException', (err) => {
  logToFile(`[UNCAUGHT EXCEPTION] ${err.message}\n${err.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason);
  logToFile(`[UNHANDLED REJECTION] ${msg}`);
  process.exit(1);
});

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

app.use(cors());
app.use(express.json());

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
  if (!url) return res.status(400).json({ error: 'URL parameter is required.' });

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
  if (!url) return res.status(400).json({ error: 'URL parameter is required.' });

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

  const allowedHosts = ['img.youtube.com', 'i.vimeocdn.com', 'vumbnail.com'];
  let parsedUrl;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid image URL.' });
  }

  if (!allowedHosts.some((h) => parsedUrl.hostname.endsWith(h))) {
    return res.status(403).json({ error: 'Domain not permitted for proxied download.' });
  }

  try {
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!imgRes.ok) {
      return res.status(imgRes.status === 404 ? 404 : 502).json({
        error: `Upstream returned status ${imgRes.status}.`,
      });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
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
  httpServer = app.listen(portToTry)
    .on('listening', () => {
      PORT = portToTry;
      SERVER_URL = PORT === 80 ? 'http://ta.tool' : `http://ta.tool:${PORT}`;
      
      console.log(`\n  ✦ Thumbnail Archive v${APP_VERSION} running at ${SERVER_URL}\n`);
      logToFile(`[Server] Listening on port ${PORT}`);

      const iconPath = path.join(executableDir, 'icon.ico');

      startTray({
        appVersion: APP_VERSION,
        serverUrl: SERVER_URL,
        iconPath,
        onQuit: () => process.exit(0),
        onRestart: () => {},
        logFn: logToFile,
      });

      const platform = process.platform;
      const cmd = platform === 'win32' ? `start "" "${SERVER_URL}"` :
                  platform === 'darwin' ? `open "${SERVER_URL}"` :
                                          `xdg-open "${SERVER_URL}"`;
      
      exec(cmd, { windowsHide: true }, (err) => {
        if (err) console.log(`  → Open your browser at: ${SERVER_URL}`);
      });
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logToFile(`[Server] Port ${portToTry} is in use.`);
        if (portToTry === 80) {
          logToFile(`[Server] Retrying on fallback port ${FALLBACK_PORT}...`);
          startServer(FALLBACK_PORT);
        } else {
          logToFile(`[Server] Fatal error: Fallback port ${FALLBACK_PORT} is also in use.`);
          process.exit(1);
        }
      } else {
        process.exit(0);
      }
    });
}

startServer(PORT);
