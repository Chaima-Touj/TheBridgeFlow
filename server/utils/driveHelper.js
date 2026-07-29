/**
 * Google Drive URL Helper
 * 
 * Normalizes Google Drive sharing links to preview/embed formats.
 * - Videos → /preview (iframe-friendly)
 * - Images → direct thumbnail URL (img-friendly)
 * 
 * Usage (backend):
 *   import { normalizeDriveUrl, isGoogleDriveUrl } from "../utils/driveHelper.js";
 *   const previewUrl = normalizeDriveUrl(driveUrl, "video");
 *   const imgUrl     = normalizeDriveUrl(driveUrl, "image");
 */

const DRIVE_FILE_REGEX = /\/file\/d\/([^/?#&]+)/;
const DRIVE_UC_REGEX   = /\/uc\?.*[&?]id=([^&]+)/;
const DRIVE_OPEN_REGEX = /\/open\?.*[&?]id=([^&]+)/;

/**
 * Extracts the Google Drive file ID from various sharing link formats.
 * @param {string} url
 * @returns {string|null}
 */
export function extractDriveFileId(url = "") {
  for (const regex of [DRIVE_FILE_REGEX, DRIVE_UC_REGEX, DRIVE_OPEN_REGEX]) {
    const m = url.match(regex);
    if (m) return m[1];
  }
  return null;
}

/**
 * Checks if a URL is a Google Drive sharing link.
 * @param {string} url
 * @returns {boolean}
 */
export function isGoogleDriveUrl(url = "") {
  return url.includes("drive.google.com") && extractDriveFileId(url) !== null;
}

/**
 * Converts a Google Drive sharing link to the appropriate format.
 * 
 * For videos: returns a /preview link suitable for <iframe> playback.
 * For images: returns a direct thumbnail URL suitable for <img> tags.
 * For non-Drive URLs: returns the URL unchanged.
 * 
 * @param {string} url - The original URL (Drive sharing link or other)
 * @param {"video"|"image"} type - The type of media
 * @returns {string} Normalized URL
 */
export function normalizeDriveUrl(url = "", type = "video") {
  const fileId = extractDriveFileId(url);
  if (!fileId) return url; // Not a Drive URL, return as-is

  if (type === "image") {
    // Google Drive direct image URL using the Google Drive API thumbnail
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }

  // Default: video preview URL for iframe
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/**
 * Auto-detects the type from the URL context and normalizes.
 * If the URL contains common image extensions or "image" in path, treats as image.
 * @param {string} url
 * @returns {string}
 */
export function autoNormalizeDriveUrl(url = "") {
  if (!isGoogleDriveUrl(url)) return url;
  
  const path = url.toLowerCase();
  const isImage = path.includes("image") || 
                  path.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)/) !== null;
  
  return normalizeDriveUrl(url, isImage ? "image" : "video");
}

