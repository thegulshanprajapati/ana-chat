import imageCompression from "browser-image-compression";

/**
 * Compresses an image file using browser-image-compression.
 * Target file size is around 200 KB.
 * Converts large PNGs to WEBP/JPEG when appropriate.
 * 
 * @param {File} file - The image file to compress.
 * @returns {Promise<File>} Compressed File.
 */
export async function compressImage(file) {
  const options = {
    maxSizeMB: 0.2, // Target size ~200KB
    maxWidthOrHeight: 1024,
    useWebWorker: true,
    fileType: file.type === "image/png" && file.size > 1 * 1024 * 1024 ? "image/jpeg" : file.type
  };

  try {
    const compressedFile = await imageCompression(file, options);
    // Return compressed file, ensuring name and original type match if possible
    return new File([compressedFile], file.name, {
      type: compressedFile.type,
      lastModified: Date.now()
    });
  } catch (error) {
    console.error("[compressImage] Compression failed:", error);
    throw error;
  }
}
