/**
 * Thumbnail Archive — Main Frontend Orchestrator
 * Integrates api, canvas, and ui modules, handling event bindings.
 */

import { fetchYouTubeInfo, fetchVimeoInfo, shutdownServer } from './api.js';
import { processImage } from './canvas.js';
import { showToast, addToHistory, initTheme, clearHistory } from './ui.js';

// DOM Elements
const urlInput = document.getElementById('urlInput');
const fetchBtn = document.getElementById('fetchBtn');
const errorMsg = document.getElementById('errorMsg');
const resultZone = document.getElementById('resultZone');
const thumbImg = document.getElementById('thumbImg');
const platformBadge = document.getElementById('platformBadge');
const resultQuality = document.getElementById('resultQuality');
const resultId = document.getElementById('resultId');
const downloadBtn = document.getElementById('downloadBtn');
const downloadFilename = document.getElementById('downloadFilename');
const resetBtn = document.getElementById('resetBtn');
const advToggle = document.getElementById('advToggle');
const advPanel = document.getElementById('advPanel');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const shutdownBtn = document.getElementById('shutdownBtn');
const shutdownScreen = document.getElementById('shutdownScreen');

// State Variables
let currentData = null;
let imageHref = '#';
const options = {
  size: 'original',
  format: 'jpg'
};

const QUALITY_RES = { maxres: '1080p', hq: '720p', mq: '480p', hd: '1080p' };
const SIZE_RES = { large: '720p', medium: '480p', small: '180p' };

/**
 * Validates the platform based on URL pattern matching.
 * @param {string} url 
 * @returns {'youtube'|'vimeo'|null}
 */
function detectPlatform(url) {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/vimeo\.com/i.test(url)) return 'vimeo';
  return null;
}

function showError(msg) {
  errorMsg.textContent = msg;
  urlInput.focus();
}

function clearError() {
  errorMsg.textContent = '';
}

function setLoading(on) {
  fetchBtn.classList.toggle('is-loading', on);
  fetchBtn.disabled = on;
  urlInput.disabled = on;
}

function sanitizeFilename(str) {
  return String(str || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
}

/**
 * Builds a friendly filename for the downloaded image.
 */
function buildFilename(data, size, format) {
  const ext = format === 'jpg' ? 'jpg' : format;
  const resolution = SIZE_RES[size] || QUALITY_RES[data.quality] || '720p';
  const platform = (data.platform || 'video').toLowerCase();
  const title = sanitizeFilename(data.title || data.platform || 'Thumbnail');
  const author = sanitizeFilename(data.author || data.videoId || '');
  const authorPart = author ? ` - ${author}` : '';
  return `${title}${authorPart} (${resolution}, ${platform}).${ext}`;
}

/**
 * Re-processes the image with the canvas when format/size option changes.
 */
async function buildImageHref() {
  if (!currentData) return;

  const size = options.size;
  const format = options.format;
  const fname = buildFilename(currentData, size, format);

  downloadFilename.textContent = fname;

  const fallbackUrl = `${window.location.origin}/api/download?imageUrl=${encodeURIComponent(currentData.thumbnailUrl)}&filename=${encodeURIComponent(fname)}`;

  try {
    const proxyUrl = `${window.location.origin}/api/download?imageUrl=${encodeURIComponent(currentData.thumbnailUrl)}&filename=${encodeURIComponent(fname)}`;
    const blobUrl = await processImage(proxyUrl, size, format);
    
    if (imageHref && imageHref.startsWith('blob:')) {
      URL.revokeObjectURL(imageHref);
    }
    imageHref = blobUrl;
  } catch (err) {
    console.warn('Canvas processing failed, falling back to server proxy:', err.message);
    imageHref = fallbackUrl;
  }
}

/**
 * Renders the fetch results in the UI.
 */
function renderResult(data, sourceUrl) {
  currentData = { ...data, _sourceUrl: sourceUrl || '' };

  platformBadge.textContent = data.platform;
  platformBadge.className = `result-badge platform--${data.platform.toLowerCase()}`;
  resultQuality.textContent = data.quality ? data.quality.toUpperCase() : '';
  resultId.textContent = data.videoId || '';

  thumbImg.classList.remove('is-loaded');
  thumbImg.alt = `${data.platform} thumbnail — ${data.videoId}`;
  thumbImg.src = data.thumbnailUrl;
  thumbImg.onload = () => thumbImg.classList.add('is-loaded');
  
  thumbImg.onerror = () => {
    thumbImg.src = '';
    showError('Preview loading failed — but downloading should still work.');
  };

  buildImageHref().then(() => {
    if (downloadBtn) {
      downloadBtn.disabled = false;
      downloadBtn.classList.remove('is-disabled');
    }
  });

  downloadFilename.style.display = '';
  resultZone.setAttribute('aria-hidden', 'false');
  resultZone.classList.add('is-visible');
  
  setTimeout(() => {
    resultZone.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
}

function hideResult() {
  resultZone.classList.remove('is-visible');
  resultZone.setAttribute('aria-hidden', 'true');
  thumbImg.classList.remove('is-loaded');
  thumbImg.src = '';
  currentData = null;

  if (imageHref && imageHref.startsWith('blob:')) {
    URL.revokeObjectURL(imageHref);
  }
  imageHref = '#';
  downloadFilename.textContent = '';
  downloadFilename.style.display = 'none';

  if (downloadBtn) {
    downloadBtn.disabled = true;
    downloadBtn.classList.add('is-disabled');
  }
}

/**
 * Central handler for retrieving video thumbnail data.
 */
async function handleFetch() {
  const raw = urlInput.value.trim();
  clearError();

  if (!raw) {
    showError('Please paste a YouTube or Vimeo URL.');
    return;
  }

  try {
    new URL(raw);
  } catch {
    showError('Please enter a valid URL.');
    return;
  }

  const platform = detectPlatform(raw);
  if (!platform) {
    showError('URL not recognized. Please use a YouTube or Vimeo link.');
    return;
  }

  hideResult();
  setLoading(true);

  try {
    let data;
    if (platform === 'youtube') {
      data = await fetchYouTubeInfo(raw);
    } else {
      data = await fetchVimeoInfo(raw);
    }
    renderResult(data, raw);
    showToast('Link Analyzed', data.title || 'Video info parsed successfully', 'success');
  } catch (err) {
    showError(err.message || 'Could not reach the backend server.');
    showToast('Fetch Failed', err.message || 'Verification failed.', 'error');
  } finally {
    setLoading(false);
  }
}

// Event Bindings
fetchBtn.addEventListener('click', handleFetch);
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleFetch();
});

// Clipboard paste listener to trigger auto-fetch
document.addEventListener('paste', (e) => {
  // Ignore if user is typing in another input
  if (document.activeElement !== urlInput && document.activeElement.tagName === 'INPUT') return;

  const pastedText = (e.clipboardData || window.clipboardData).getData('text');
  if (pastedText && (pastedText.includes('youtube.com') || pastedText.includes('youtu.be') || pastedText.includes('vimeo.com'))) {
    e.preventDefault();
    urlInput.value = pastedText.trim();
    clearError();
    hideResult();
    handleFetch();
  }
});

urlInput.addEventListener('input', () => {
  if (errorMsg.textContent) clearError();
  if (currentData) hideResult();
});

resetBtn.addEventListener('click', () => {
  hideResult();
  clearError();
  urlInput.value = '';
  urlInput.focus();
  advToggle.setAttribute('aria-expanded', 'false');
  advPanel.setAttribute('aria-hidden', 'true');
});

advToggle.addEventListener('click', () => {
  const open = advToggle.getAttribute('aria-expanded') === 'true';
  advToggle.setAttribute('aria-expanded', String(!open));
  advPanel.setAttribute('aria-hidden', String(open));
});

// Option Pills selection listeners
document.querySelectorAll('.pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const group = pill.dataset.option;
    const value = pill.dataset.value;
    options[group] = value;

    document.querySelectorAll(`.pill[data-option="${group}"]`).forEach(p => {
      p.classList.toggle('pill--active', p.dataset.value === value);
    });

    if (currentData) {
      buildImageHref();
    }
  });
});

downloadBtn.addEventListener('click', () => {
  if (!currentData) return;

  const fname = buildFilename(currentData, options.size, options.format);
  
  const link = document.createElement('a');
  link.href = imageHref;
  link.download = fname;
  link.click();

  addToHistory(currentData.title, currentData.platform, options.size, options.format);
  showToast('Image Saved', fname, 'success');
});

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener('click', clearHistory);
}

// Server Shutdown Trigger
if (shutdownBtn && shutdownScreen) {
  shutdownBtn.addEventListener('click', async () => {
    const confirmStop = confirm('Are you sure you want to stop all background services and close this application?');
    if (!confirmStop) return;

    shutdownScreen.setAttribute('aria-hidden', 'false');
    shutdownScreen.classList.add('is-active');

    try {
      await shutdownServer();
      showToast('Shutting Down', 'Background server terminated.', 'info');
    } catch (err) {
      console.log('Server connection closed.');
    }
  });
}

// Initialize theme and auto-focus
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setTimeout(() => urlInput.focus(), 500);
});
export { handleFetch };
