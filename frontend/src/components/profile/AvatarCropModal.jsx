import React, { useState, useCallback, useEffect, useRef } from "react";
import Cropper from "react-easy-crop";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCw, Maximize, Check } from "lucide-react";
import ZoomSlider from "./ZoomSlider";
import RotateSlider from "./RotateSlider";
import AvatarPreview from "./AvatarPreview";
import { getCroppedImg } from "./cropImage";

export const AvatarCropModal = ({
  open,
  imageSrc,
  currentAvatarUrl,
  userName,
  onClose,
  onCropComplete: onCropFinish,
  saving = false
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [livePreviewUrl, setLivePreviewUrl] = useState("");
  const previewTimerRef = useRef(null);

  // Reset cropper state when modal opens with new image
  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setCroppedAreaPixels(null);
      setLivePreviewUrl("");
    }
  }, [open, imageSrc]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Debounced live preview generation during drag/zoom/rotate
  const generateLivePreview = useCallback(
    async (pixels) => {
      if (!imageSrc || !pixels) return;
      try {
        const croppedBlob = await getCroppedImg(imageSrc, pixels, rotation);
        if (livePreviewUrl) {
          URL.revokeObjectURL(livePreviewUrl);
        }
        setLivePreviewUrl(URL.createObjectURL(croppedBlob));
      } catch (err) {
        console.error("Failed to generate live preview:", err);
      }
    },
    [imageSrc, rotation, livePreviewUrl]
  );

  const onCropChange = useCallback((c) => setCrop(c), []);
  const onZoomChange = useCallback((z) => setZoom(z), []);
  const onRotationChange = useCallback((r) => setRotation(r), []);

  const onCropAreaChange = useCallback(
    (croppedArea, croppedPixels) => {
      setCroppedAreaPixels(croppedPixels);
      
      // Debounce preview rendering for better performance
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
      previewTimerRef.current = setTimeout(() => {
        generateLivePreview(croppedPixels);
      }, 100);
    },
    [generateLivePreview]
  );

  // Clean up Object URL
  useEffect(() => {
    return () => {
      if (livePreviewUrl) URL.revokeObjectURL(livePreviewUrl);
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [livePreviewUrl]);

  const handleReset = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  }, []);

  const handleFit = useCallback(() => {
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  }, []);

  const handleSave = useCallback(async () => {
    if (!croppedAreaPixels || saving) return;
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      onCropFinish(croppedBlob);
    } catch (err) {
      console.error("Failed to crop image:", err);
    }
  }, [imageSrc, croppedAreaPixels, rotation, onCropFinish, saving]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/45 dark:bg-slate-950/75 backdrop-blur-[8px]"
        />

        {/* Modal content box */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 shadow-2xl backdrop-blur-xl flex flex-col max-h-[90vh] md:max-h-[85vh] text-slate-800 dark:text-slate-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 px-6 py-4">
            <h3 className="text-base font-bold tracking-tight">Crop Profile Picture</h3>
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 dark:text-slate-400 transition-colors"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Cropper Container */}
            <div className="relative h-64 md:h-72 w-full overflow-hidden rounded-2xl bg-slate-950 shadow-inner">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={onCropChange}
                onZoomChange={onZoomChange}
                onRotationChange={onRotationChange}
                onCropComplete={onCropAreaChange}
              />
            </div>

            {/* Live Preview section */}
            <AvatarPreview
              currentUrl={currentAvatarUrl}
              previewUrl={livePreviewUrl}
              name={userName}
            />

            {/* Crop Controls */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Zoom</span>
                <ZoomSlider value={zoom} onChange={onZoomChange} />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Rotation</span>
                <RotateSlider value={rotation} onChange={onRotationChange} />
              </div>
            </div>

            {/* Quick Action buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-900">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-violet-500 transition-colors"
              >
                <RefreshCw size={14} />
                Reset
              </button>

              <button
                type="button"
                onClick={handleFit}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-violet-500 transition-colors"
              >
                <Maximize size={14} />
                Fit Image
              </button>
            </div>

          </div>

          {/* Footer Controls */}
          <div className="border-t border-slate-100 dark:border-slate-900 px-6 py-4 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/10">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-md shadow-violet-500/10 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={14} />
                  Save Avatar
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AvatarCropModal;
