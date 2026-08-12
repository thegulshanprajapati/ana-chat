/**
 * Utility to load an image from a URL.
 */
export const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new window.Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous"); // Prevent tainted canvas
    image.src = url;
  });

/**
 * Converts degree to radian.
 */
export function getRadianAngle(degreeValue) {
  return (degreeValue * Math.PI) / 180;
}

/**
 * Calculates the bounding box size of a rotated rectangle.
 */
export function rotateSize(width, height, rotation) {
  const rotRad = getRadianAngle(rotation);

  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

/**
 * Generates the cropped 512x512 image in WebP format.
 * Strips EXIF metadata automatically as part of canvas render.
 * 
 * @param {string} imageSrc - The image source URL (object URL).
 * @param {Object} pixelCrop - The pixel crop coordinates from react-easy-crop.
 * @param {number} rotation - The rotation angle in degrees.
 * @returns {Promise<Blob>} The cropped image Blob.
 */
export async function getCroppedImg(imageSrc, pixelCrop, rotation = 0) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not get 2D context for canvas");
  }

  const rotRad = getRadianAngle(rotation);

  // Calculate bounding box of rotated image
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  );

  // Set canvas size to match the rotated bounding box
  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // Translate canvas context to center point to rotate and draw
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);

  // Draw the image
  ctx.drawImage(image, 0, 0);

  // Extract cropped area
  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d");

  if (!croppedCtx) {
    throw new Error("Could not get 2D context for cropped canvas");
  }

  // Force output size to 512x512
  croppedCanvas.width = 512;
  croppedCanvas.height = 512;

  // Draw the cropped section onto the 512x512 canvas
  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    512,
    512
  );

  // Return canvas as webp blob for high quality and small file size
  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob((file) => {
      if (file) {
        resolve(file);
      } else {
        reject(new Error("Canvas crop export failed"));
      }
    }, "image/webp", 0.95);
  });
}
