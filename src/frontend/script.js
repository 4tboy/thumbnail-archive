/* ═══════════════════════════════════════════════════════════
   Thumbnail Archive — Frontend Script
   Minimalist Version · Pure YouTube & Vimeo Downloader
   ═══════════════════════════════════════════════════════════ */

const API_BASE = window.location.origin;

// ─── DOM Refs ─────────────────────────────────────────────
const urlInput         = document.getElementById('urlInput');
const fetchBtn         = document.getElementById('fetchBtn');
const errorMsg         = document.getElementById('errorMsg');
const resultZone       = document.getElementById('resultZone');
const emptyState       = document.getElementById('emptyState');
const urlHelperText    = document.getElementById('urlHelperText');
const thumbImg         = document.getElementById('thumbImg');
const platformBadge    = document.getElementById('platformBadge');
const resultQuality    = document.getElementById('resultQuality');
const resultId         = document.getElementById('resultId');
const downloadBtn      = document.getElementById('downloadBtn');
const downloadFilename = document.getElementById('downloadFilename');
const resetBtn         = document.getElementById('resetBtn');

// Advanced options
const advToggle = document.getElementById('advToggle');
const advPanel  = document.getElementById('advPanel');

// Premium Session History elements
const historyZone      = document.getElementById('historyZone');
const historyList      = document.getElementById('historyList');
const clearHistoryBtn  = document.getElementById('clearHistoryBtn');

// Premium Floating Toast Notification Container
const toastContainer  = document.getElementById('toastContainer');

function showToast(title, message, type = 'success') {
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  const icon = type === 'success' ? '✓' : '⚠';

  const iconEl = document.createElement('span');
  iconEl.className = 'toast__icon';
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.textContent = icon;

  const bodyEl = document.createElement('div');
  bodyEl.className = 'toast__body';

  const titleEl = document.createElement('h4');
  titleEl.className = 'toast__title';
  titleEl.textContent = title;

  const msgEl = document.createElement('p');
  msgEl.className = 'toast__msg';
  msgEl.textContent = message;
  msgEl.title = message;

  bodyEl.appendChild(titleEl);
  bodyEl.appendChild(msgEl);
  toast.appendChild(iconEl);
  toast.appendChild(bodyEl);

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px) scale(0.9)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 4000);
}

// ─── Options state ─────────────────────────────────────────
const options = {
  size:   'original',
  format: 'jpg',
};

const SIZE_LABELS = { original: 'Original', large: 'Large', medium: 'Medium', small: 'Small' };
const SIZE_MAP = {
  original: null,
  large:    [1280, 720],
  medium:   [640,  360],
  small:    [320,  180],
};

// Global state
let currentData    = null;
let cachedImage    = null;
let imageHref      = '#';

const sessionHistory = [];     

advToggle.addEventListener('click', () => {
  const open = advToggle.getAttribute('aria-expanded') === 'true';
  advToggle.setAttribute('aria-expanded', String(!open));
  advPanel.setAttribute('aria-hidden',    String(open));
});

document.querySelectorAll('.pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const group = pill.dataset.option;
    const value = pill.dataset.value;
    options[group] = value;

    document.querySelectorAll(`.pill[data-option="${group}"]`).forEach(p => {
      p.classList.toggle('pill--active', p.dataset.value === value);
    });

    if (group === 'size' || group === 'format') {
      if (currentData) buildImageHref();
    }
  });
});

function detectPlatform(url) {
  if (/youtube\.com|youtu\.be/i.test(url)) return { api: 'youtube', name: 'YouTube' };
  if (/vimeo\.com/i.test(url))             return { api: 'vimeo', name: 'Vimeo' };
  return null;
}

function showError(msg) { errorMsg.textContent = msg; urlInput.focus(); }
function clearError()   { errorMsg.textContent = ''; }

function setLoading(on) {
  fetchBtn.classList.toggle('is-loading', on);
  fetchBtn.disabled  = on;
  urlInput.disabled  = on;
}

function sanitizeFilename(str) {
  return String(str || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
}

function buildFilename(data, size, format) {
  const ext        = format === 'jpg' ? 'jpg' : (format === 'webp' ? 'webp' : 'png');
  const platform     = (data.platform || 'video').toLowerCase();
  const title      = sanitizeFilename(data.title  || data.platform || 'Thumbnail');
  const author     = sanitizeFilename(data.author || data.videoId  || '');
  
  if (author) {
    return `${author} - ${title} - ${platform}.${ext}`;
  }
  return `${title} - ${platform}.${ext}`;
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== 'function') {
      reject(new Error('canvas.toBlob is not supported in this browser'));
      return;
    }
    canvas.toBlob((blob) => resolve(blob), mime, quality);
  });
}

async function buildImageHref() {
  if (!currentData) return;

  const size   = options.size;
  const format = options.format;
  const dims   = SIZE_MAP[size];
  const mime   = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
  const fname  = buildFilename(currentData, size, format);

  downloadFilename.textContent = fname;

  const fallbackUrl = `${API_BASE}/api/download?imageUrl=${encodeURIComponent(currentData.thumbnailUrl)}&filename=${encodeURIComponent(fname)}`;

  if (!cachedImage || !cachedImage.complete) {
    imageHref = fallbackUrl;
    return;
  }

  try {
    const w = dims ? dims[0] : cachedImage.naturalWidth;
    const h = dims ? dims[1] : cachedImage.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(cachedImage, 0, 0, w, h);

    const blob = await canvasToBlob(canvas, mime, 0.95);
    if (blob) {
      if (imageHref && imageHref.startsWith('blob:')) URL.revokeObjectURL(imageHref);
      imageHref = URL.createObjectURL(blob);
    } else {
      imageHref = fallbackUrl;
    }
  } catch (_) {
    imageHref = fallbackUrl;
  }
}

function addToHistory(title, type, quality, format) {
  const item = {
    title: title || 'Thumbnail Image',
    type,
    quality: SIZE_LABELS[quality] || 'Original',
    format: format.toUpperCase(),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  sessionHistory.unshift(item);
  if (sessionHistory.length > 50) sessionHistory.length = 50;

  renderHistory();
}

function renderHistory() {
  if (!historyZone || !historyList) return;

  if (sessionHistory.length === 0) {
    historyZone.classList.remove('is-visible');
    historyZone.setAttribute('aria-hidden', 'true');
    historyList.innerHTML = '<p class="history-empty">Your successful downloads in this session will appear here.</p>';
    return;
  }

  historyList.innerHTML = '';
  sessionHistory.forEach(item => {
    const el = document.createElement('div');
    el.className = `history-item history-item--${item.type}`;
    
    let typeIcon = '↓';

    const mainDiv = document.createElement('div');
    mainDiv.className = 'history-item__main';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'history-item__icon';
    iconSpan.textContent = typeIcon;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'history-item__title';
    titleSpan.textContent = item.title;
    titleSpan.title = item.title;

    mainDiv.appendChild(iconSpan);
    mainDiv.appendChild(titleSpan);

    const metaDiv = document.createElement('div');
    metaDiv.className = 'history-item__meta';

    const metaSpan = document.createElement('span');
    metaSpan.textContent = `${item.quality} · ${item.format}`;

    const timeSpan = document.createElement('span');
    timeSpan.style.opacity = '0.5';
    timeSpan.style.marginLeft = '8px';
    timeSpan.textContent = item.timestamp;

    metaDiv.appendChild(metaSpan);
    metaDiv.appendChild(timeSpan);

    const statusSpan = document.createElement('span');
    statusSpan.className = 'history-item__status';
    statusSpan.textContent = '✓ Saved';

    el.appendChild(mainDiv);
    el.appendChild(metaDiv);
    el.appendChild(statusSpan);
    historyList.appendChild(el);
  });

  historyZone.classList.add('is-visible');
  historyZone.setAttribute('aria-hidden', 'false');
}

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener('click', () => {
    sessionHistory.length = 0;
    renderHistory();
  });
}

if (downloadBtn) {
  downloadBtn.addEventListener('click', async () => {
    if (!currentData) return;
    const cleanTitle = currentData.title || 'Thumbnail';
    const size   = options.size;
    const format = options.format;

    // Single download
    const fname  = buildFilename(currentData, size, format);
    const link   = document.createElement('a');
    link.href     = imageHref;
    link.download = fname;
    link.click();

    addToHistory(cleanTitle, 'image', size, format);
    showToast('Image Saved', fname, 'success');
  });
}

function renderResult(data, sourceUrl) {
  currentData = { ...data, _sourceUrl: sourceUrl || '' };

  const isEmpty = !data.thumbnailUrl;
  
  if (isEmpty) {
    emptyState.style.display = 'flex';
    emptyState.setAttribute('aria-hidden', 'false');
    document.querySelector('.result-frame').style.display = 'none';
  } else {
    emptyState.style.display = 'none';
    emptyState.setAttribute('aria-hidden', 'true');
    document.querySelector('.result-frame').style.display = 'block';
  }

  platformBadge.textContent = data.platform;
  let pClass = data.platform.toLowerCase().replace(/[^a-z0-9]/g, '');
  platformBadge.className   = `result-badge platform--${pClass}`;
  resultQuality.textContent = data.quality ? data.quality.toUpperCase() : '';
  resultId.textContent      = data.videoId || '';

  thumbImg.classList.remove('is-loaded');
  thumbImg.alt     = `${data.platform} thumbnail — ${data.videoId}`;
  thumbImg.src = `${API_BASE}/api/download?imageUrl=${encodeURIComponent(data.thumbnailUrl)}&filename=preview.jpg`;
  thumbImg.onload  = () => { thumbImg.classList.add('is-loaded'); };
  thumbImg.onerror = () => {
    thumbImg.src = '';
    showError('Preview failed — the download link should still work.');
  };

  cachedImage = new Image();
  cachedImage.crossOrigin = 'anonymous';
  cachedImage.onload  = () => buildImageHref();
  cachedImage.onerror = () => buildImageHref();
  cachedImage.src = `${API_BASE}/api/download?imageUrl=${encodeURIComponent(data.thumbnailUrl)}&filename=${encodeURIComponent(data.filename)}`;

  buildImageHref();

  if (downloadBtn) {
    downloadBtn.disabled = false;
    downloadBtn.classList.remove('is-disabled');
  }

  downloadFilename.style.display = '';
  downloadFilename.textContent = buildFilename(currentData, options.size, options.format);

  resultZone.setAttribute('aria-hidden', 'false');
  resultZone.classList.add('is-visible');
  setTimeout(() => resultZone.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
}

function hideResult() {
  resultZone.classList.remove('is-visible');
  resultZone.setAttribute('aria-hidden', 'true');
  thumbImg.classList.remove('is-loaded');
  thumbImg.src              = '';
  currentData               = null;

  if (imageHref && imageHref.startsWith('blob:')) URL.revokeObjectURL(imageHref);
  imageHref = '#';
  downloadFilename.textContent = '';
  downloadFilename.style.display = 'none';
  cachedImage = null;

  if (downloadBtn) {
    downloadBtn.disabled = true;
    downloadBtn.classList.add('is-disabled');
  }
}

let fetchController = null;
let isFetching = false;

async function handleFetch() {
  if (isFetching && fetchController) {
    fetchController.abort();
  }
  
  const raw = urlInput.value.trim();
  clearError();

  if (!raw) { showError('Please paste a YouTube or Vimeo URL.'); urlInput.focus(); return; }

  try { new URL(raw); } catch { showError('Please enter a valid URL.'); return; }

  const pInfo = detectPlatform(raw);
  if (!pInfo) {
    showError('URL not recognised. Supported platforms: YouTube, Vimeo.');
    return;
  }

  hideResult();
  setLoading(true);
  isFetching = true;
  fetchController = new AbortController();

  try {
    const res  = await fetch(`${API_BASE}/api/${pInfo.api}?url=${encodeURIComponent(raw)}`, { signal: fetchController.signal });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || 'An unexpected error occurred.');
      showToast('Fetch Failed', data.error || 'Verify video URL', 'error');
      return;
    }
    renderResult(data, raw);
    showToast('Link Analyzed', data.title || 'Video info parsed successfully', 'success');
  } catch (err) {
    if (err.name === 'AbortError') return;
    showError("Could not reach the local server. Make sure it's running: node server.js");
    showToast('Connection Failed', 'Local background server is offline', 'error');
  } finally {
    setLoading(false);
    isFetching = false;
  }
}

fetchBtn.addEventListener('click', handleFetch);

function handleUrlInputKeydown(e) { 
  if (e.key === 'Enter') handleFetch(); 
}
urlInput.addEventListener('keydown', handleUrlInputKeydown);

document.addEventListener('paste', (e) => {
  const pastedText = (e.clipboardData || window.clipboardData).getData('text');
  if (pastedText && (pastedText.includes('youtube.com') || pastedText.includes('youtu.be') || pastedText.includes('vimeo.com'))) {
    e.preventDefault();
    urlInput.value = pastedText.trim();
    if (errorMsg.textContent) clearError();
    if (currentData) hideResult();
    handleFetch();
  }
});

urlInput.addEventListener('input', () => {
  const raw = urlInput.value.trim();
  if (raw && !/^https?:\/\//i.test(raw)) {
    if (urlHelperText) urlHelperText.style.display = 'block';
    urlInput.style.borderColor = 'var(--error)';
  } else {
    if (urlHelperText) urlHelperText.style.display = 'none';
    urlInput.style.borderColor = '';
  }
  if (errorMsg.textContent) clearError();
  if (currentData) hideResult();
});

resetBtn.addEventListener('click', () => {
  hideResult(); clearError();
  urlInput.value = '';
  urlInput.focus();
  advToggle.setAttribute('aria-expanded', 'false');
  advPanel.setAttribute('aria-hidden', 'true');
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(() => urlInput.focus(), 800));
} else {
  setTimeout(() => urlInput.focus(), 800);
}

const shutdownBtn    = document.getElementById('shutdownBtn');
const shutdownScreen = document.getElementById('shutdownScreen');

if (shutdownBtn && shutdownScreen) {
  shutdownBtn.addEventListener('click', async () => {
    const confirmStop = confirm('Are you sure you want to stop all background services and close this application?');
    if (!confirmStop) return;

    shutdownScreen.setAttribute('aria-hidden', 'false');
    shutdownScreen.classList.add('is-active');

    try {
      await fetch(`${API_BASE}/api/shutdown`, { method: 'POST' });
    } catch (err) {
      console.log('Server connection terminated successfully.');
    }
  });
}
