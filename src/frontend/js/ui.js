/**
 * Thumbnail Archive — UI Module
 * Controls DOM modifications, animations, history lists, and toasts.
 */

// DOM Elements cache
const toastContainer = document.getElementById('toastContainer');
const historyList = document.getElementById('historyList');
const historyZone = document.getElementById('historyZone');

// Session history store
const sessionHistory = [];

const SIZE_LABELS = {
  original: 'Original',
  large: '1280×720',
  medium: '640×360',
  small: '320×180'
};

/**
 * Display a premium floating toast notification.
 * @param {string} title 
 * @param {string} message 
 * @param {'success'|'error'|'info'} type 
 */
export function showToast(title, message, type = 'success') {
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  const icon = type === 'success' ? '✓' : type === 'error' ? '⚠' : 'ℹ';

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

  // Trigger entrance transition
  requestAnimationFrame(() => {
    toast.classList.add('toast--visible');
  });

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px) scale(0.9)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 4000);
}

/**
 * Add a record to session history and re-render.
 * @param {string} title 
 * @param {'youtube'|'vimeo'} platform 
 * @param {string} size 
 * @param {string} format 
 */
export function addToHistory(title, platform, size, format) {
  const item = {
    title: title || 'Thumbnail Image',
    platform: platform.toLowerCase(),
    quality: SIZE_LABELS[size] || 'Original',
    format: format.toUpperCase(),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  sessionHistory.unshift(item);
  if (sessionHistory.length > 30) sessionHistory.length = 30; // Cap at 30 items

  renderHistory();
}

/**
 * Renders the session history block.
 */
export function renderHistory() {
  if (!historyZone || !historyList) return;

  if (sessionHistory.length === 0) {
    historyZone.classList.remove('is-visible');
    historyZone.setAttribute('aria-hidden', 'true');
    historyList.innerHTML = '<p class="history-empty">Your saved downloads in this session will appear here.</p>';
    return;
  }

  historyList.innerHTML = '';
  sessionHistory.forEach(item => {
    const el = document.createElement('div');
    el.className = `history-item history-item--${item.platform}`;

    const mainDiv = document.createElement('div');
    mainDiv.className = 'history-item__main';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'history-item__icon';
    iconSpan.textContent = '↓';

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

/**
 * Clears the session history list.
 */
export function clearHistory() {
  sessionHistory.length = 0;
  renderHistory();
}

/**
 * Initializes and handles theme switching.
 */
export function initTheme() {
  const currentTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const activeTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = activeTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      showToast('Theme Changed', `Switched to ${newTheme} mode.`, 'info');
    });
  }
}
