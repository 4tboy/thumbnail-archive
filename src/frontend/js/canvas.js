/**
 * Thumbnail Archive — Canvas Processing Module
 * Handles client-side format conversion (JPG/PNG/WebP) and resizing.
 */

const SIZE_MAP = {
  original: null,
  large: [1280, 720],
  medium: [640, 360],
  small: [320, 180]
};

const MIME_MAP = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};

/**
 * Loads an image from a URL into an HTMLImageElement with CORS enabled.
 * @param {string} url 
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image into canvas.'));
    img.src = url;
  });
}

/**
 * Converts a canvas element into a Blob.
 * @param {HTMLCanvasElement} canvas 
 * @param {string} mimeType 
 * @param {number} quality 
 * @returns {Promise<Blob>}
 */
function canvasToBlob(canvas, mimeType, quality = 0.95) {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== 'function') {
      reject(new Error('canvas.toBlob is not supported in this browser.'));
      return;
    }
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Blob generation failed.'));
    }, mimeType, quality);
  });
}

/**
 * Resizes and converts the image format using HTML5 Canvas.
 * @param {string} proxyUrl - Proxied image URL to bypass CORS
 * @param {string} size - 'original' | 'large' | 'medium' | 'small'
 * @param {string} format - 'jpg' | 'png' | 'webp'
 * @returns {Promise<string>} Blob URL representing the processed image
 */
export async function processImage(proxyUrl, size, format) {
  const img = await loadImage(proxyUrl);
  const dims = SIZE_MAP[size];
  
  const width = dims ? dims[0] : img.naturalWidth;
  const height = dims ? dims[1] : img.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  const mimeType = MIME_MAP[format] || 'image/jpeg';
  const blob = await canvasToBlob(canvas, mimeType, 0.95);
  return URL.createObjectURL(blob);
}
