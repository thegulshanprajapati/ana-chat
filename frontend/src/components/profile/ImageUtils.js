import { createImage } from "./cropImage";

export const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp"
]);

export const MAX_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validates the selected image file.
 * 
 * @param {File} file - The file to validate.
 * @returns {Promise<{ valid: boolean, error?: string }>} Validation result.
 */
export async function validateImage(file) {
  if (!file) {
    return { valid: false, error: "No file selected." };
  }

  // File type check
  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      valid: false,
      error: "Unsupported file format. Please upload JPG, JPEG, PNG or WEBP."
    };
  }

  // File size check
  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      error: "File is too large. Maximum size allowed is 10 MB."
    };
  }

  // Load image to check dimensions and corruption
  try {
    const objectUrl = URL.createObjectURL(file);
    const img = await createImage(objectUrl);
    URL.revokeObjectURL(objectUrl);

    // Minimum resolution check
    if (img.width < 300 || img.height < 300) {
      return {
        valid: false,
        error: `Resolution is too low (${img.width}x${img.height}px). Minimum required is 300x300px.`
      };
    }

    // Maximum resolution check
    if (img.width > 8000 || img.height > 8000) {
      return {
        valid: false,
        error: `Resolution is too high (${img.width}x${img.height}px). Maximum allowed is 8000x8000px.`
      };
    }

    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: "The image appears to be corrupted or invalid."
    };
  }
}

/**
 * Helper to convert a blob back to a File object.
 */
export function blobToFile(blob, fileName = "avatar.webp") {
  return new File([blob], fileName, {
    type: "image/webp",
    lastModified: Date.now()
  });
}
