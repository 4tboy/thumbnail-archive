/**
 * Thumbnail Archive — API Module
 * Encapsulates backend server communications.
 */

const API_BASE = window.location.origin;

/**
 * Fetches YouTube thumbnail details from the backend.
 * @param {string} videoUrl 
 * @returns {Promise<Object>} API JSON response
 */
export async function fetchYouTubeInfo(videoUrl) {
  const response = await fetch(`${API_BASE}/api/youtube?url=${encodeURIComponent(videoUrl)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch YouTube details.');
  }
  return data;
}

/**
 * Fetches Vimeo thumbnail details from the backend.
 * @param {string} videoUrl 
 * @returns {Promise<Object>} API JSON response
 */
export async function fetchVimeoInfo(videoUrl) {
  const response = await fetch(`${API_BASE}/api/vimeo?url=${encodeURIComponent(videoUrl)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch Vimeo details.');
  }
  return data;
}

/**
 * Shuts down the backend Node.js server.
 * @returns {Promise<void>}
 */
export async function shutdownServer() {
  await fetch(`${API_BASE}/api/shutdown`, { method: 'POST' });
}
