import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Camera, Upload, AlertCircle, RefreshCw } from "lucide-react";
import { validateImage } from "./ImageUtils";
import { compressImage } from "./compressImage";
import AvatarCropModal from "./AvatarCropModal";

export const AvatarUploader = ({
  currentAvatarUrl,
  userName,
  onUploadSuccess,
  notify
}) => {
  const [selectedImageSrc, setSelectedImageSrc] = useState("");
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Clean up Object URL
  useEffect(() => {
    return () => {
      if (selectedImageSrc) URL.revokeObjectURL(selectedImageSrc);
    };
  }, [selectedImageSrc]);

  // Handle file selection (Drop, Browse, Clipboard)
  const handleFileProcess = useCallback(
    async (file) => {
      if (!file) return;
      setProcessing(true);

      try {
        // 1. Validation checks
        const validation = await validateImage(file);
        if (!validation.valid) {
          notify?.({
            type: "error",
            title: "Validation Error",
            message: validation.error || "Invalid file."
          });
          return;
        }

        // 2. Auto Compression
        let processedFile = file;
        try {
          processedFile = await compressImage(file);
        } catch (compErr) {
          console.warn("Compression failed, uploading original image instead:", compErr);
        }

        // 3. Create preview object URL for cropper
        const objectUrl = URL.createObjectURL(processedFile);
        setSelectedImageSrc(objectUrl);
        setCropModalOpen(true);
      } catch (err) {
        notify?.({
          type: "error",
          title: "Processing Failed",
          message: "Could not read the uploaded image."
        });
      } finally {
        setProcessing(false);
      }
    },
    [notify]
  );

  // React Dropzone hook configuration
  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        handleFileProcess(acceptedFiles[0]);
      }
    },
    [handleFileProcess]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"]
    },
    maxFiles: 1,
    disabled: processing
  });

  // Handle paste from clipboard
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items ? Array.from(e.clipboardData.items) : [];
      const fileItem = items.find((item) => item.kind === "file" && item.type.startsWith("image/"));
      if (fileItem) {
        const file = fileItem.getAsFile();
        if (file) {
          e.preventDefault();
          handleFileProcess(file);
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleFileProcess]);

  // Handle crop completion & upload
  const handleCropComplete = useCallback(
    async (croppedBlob) => {
      setProcessing(true);
      setCropModalOpen(false);

      const form = new FormData();
      // Use original file name or standard naming
      form.append("avatar", croppedBlob, "avatar.webp");

      try {
        // Send post request to /api/users/profile/avatar
        const response = await fetch("/api/users/profile/avatar", {
          method: "POST",
          headers: {
            // Let the browser set the boundary headers automatically
            Authorization: `Bearer ${localStorage.getItem("token") || ""}` // Fallback auth header
          },
          body: form
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to save avatar to server");
        }

        const data = await response.json();
        notify?.({
          type: "success",
          title: "Avatar saved",
          message: "Profile picture was successfully updated."
        });

        if (onUploadSuccess) {
          onUploadSuccess(data.avatarUrl);
        }
      } catch (err) {
        notify?.({
          type: "error",
          title: "Upload Failed",
          message: err.message || "Could not upload cropped profile picture."
        });
      } finally {
        setProcessing(false);
      }
    },
    [onUploadSuccess, notify]
  );

  return (
    <div className="flex flex-col items-center">
      <div
        {...getRootProps()}
        className={`relative group cursor-pointer rounded-full p-1 border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-violet-500 dark:hover:border-violet-400 transition-all duration-300 ${
          isDragActive ? "border-violet-500 scale-[1.02] bg-violet-500/5" : ""
        }`}
      >
        <input {...getInputProps()} />

        {/* Circular Avatar Window */}
        <div className="relative rounded-full overflow-hidden w-[130px] h-[130px] bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
          {currentAvatarUrl ? (
            <img
              src={currentAvatarUrl}
              alt={userName || "Profile avatar"}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <Upload size={32} className="text-slate-400 dark:text-slate-600" />
          )}

          {/* Hover Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-center p-2">
            {processing ? (
              <RefreshCw size={22} className="text-white animate-spin mb-1" />
            ) : (
              <Camera size={22} className="text-white mb-1" />
            )}
            <span className="text-[9px] uppercase font-extrabold tracking-wider text-white">
              {processing ? "Processing..." : "Change Photo"}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] font-medium text-slate-400 dark:text-[var(--panel-muted)] text-center max-w-[200px]">
        Drag & drop, paste, or click photo to upload custom avatar
      </p>

      {/* Cropper Modal */}
      <AvatarCropModal
        open={cropModalOpen}
        imageSrc={selectedImageSrc}
        currentAvatarUrl={currentAvatarUrl}
        userName={userName}
        onClose={() => setCropModalOpen(false)}
        onCropComplete={handleCropComplete}
        saving={processing}
      />
    </div>
  );
};

export default AvatarUploader;
