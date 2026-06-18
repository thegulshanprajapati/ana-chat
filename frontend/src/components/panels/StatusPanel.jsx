import { useEffect, useMemo, useState, useRef } from "react";
import { 
  ArrowLeft, 
  CircleDot, 
  Camera, 
  Image as ImageIcon, 
  Trash2, 
  Plus, 
  Send, 
  Heart, 
  Smile, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Play, 
  Pause,
  Type,
  PlusCircle,
  MinusCircle,
  Eye,
  Crop,
  Grid,
  Square,
  Smile as CircleIcon
} from "lucide-react";
import Avatar from "../common/Avatar";
import { formatDayLabel, formatTime } from "../../utils/time";
import { api } from "../../api/client";

const STATUS_STORAGE_PREFIX = "anach_status_v1";
const STATUS_FEED_STORAGE_PREFIX = "anach_status_feed_v1";

const FONT_STYLES = [
  { id: "font-sans", name: "Modern" },
  { id: "font-serif", name: "Classic" },
  { id: "font-mono", name: "Typewriter" },
  { id: "cursive-font", name: "Handwriting" }
];

const PRESET_COLORS = [
  "#ffffff", "#000000", "#e11d48", "#eab308", "#22c55e", "#3b82f6", "#a855f7"
];

// Helper to draw collage on a canvas for upload
async function createCollageDataUrl(images) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");

    // Draw dark background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (images.length === 0) {
      resolve("");
      return;
    }

    let loadedCount = 0;
    const imgElements = images.map((imgData) => {
      const img = new window.Image();
      img.src = imgData.dataUrl;
      img.onload = () => {
        loadedCount++;
        if (loadedCount === images.length) {
          drawCollage();
        }
      };
      return { 
        img, 
        scale: imgData.scale || 1, 
        x: imgData.xOffset || 0, 
        y: imgData.yOffset || 0,
        shape: imgData.shape || "square",
        cropTop: imgData.cropTop || 0,
        cropLeft: imgData.cropLeft || 0,
        cropRight: imgData.cropRight || 0,
        cropBottom: imgData.cropBottom || 0,
        widthPct: imgData.widthPct || 100,
        heightPct: imgData.heightPct || 100
      };
    });

    function drawCollage() {
      const count = imgElements.length;
      if (count === 1) {
        drawSingle(imgElements[0]);
      } else if (count === 2) {
        drawTwo(imgElements[0], imgElements[1]);
      } else if (count === 3) {
        drawThree(imgElements[0], imgElements[1], imgElements[2]);
      } else {
        drawFour(imgElements[0], imgElements[1], imgElements[2], imgElements[3]);
      }
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    }

    function drawImg(el, dx, dy, dw, dh) {
      ctx.save();
      
      // 1. Calculate cell resizing dimensions (widthPct, heightPct)
      const wPct = (el.widthPct || 100) / 100;
      const hPct = (el.heightPct || 100) / 100;
      const targetW = dw * wPct;
      const targetH = dh * hPct;
      // Center the resized box inside the allocated grid cell
      const targetX = dx + (dw - targetW) / 2;
      const targetY = dy + (dh - targetH) / 2;

      // 2. Implement shape mask clipping path
      ctx.beginPath();
      if (el.shape === "circle") {
        ctx.arc(targetX + targetW / 2, targetY + targetH / 2, Math.min(targetW, targetH) / 2, 0, Math.PI * 2);
        ctx.clip();
      } else if (el.shape === "rounded") {
        const r = 40; // radius
        ctx.moveTo(targetX + r, targetY);
        ctx.arcTo(targetX + targetW, targetY, targetX + targetW, targetY + targetH, r);
        ctx.arcTo(targetX + targetW, targetY + targetH, targetX, targetY + targetH, r);
        ctx.arcTo(targetX, targetY + targetH, targetX, targetY, r);
        ctx.arcTo(targetX, targetY, targetX + targetW, targetY, r);
        ctx.closePath();
        ctx.clip();
      } else if (el.shape === "heart") {
        const hx = targetX;
        const hy = targetY;
        ctx.moveTo(hx + targetW * 0.5, hy + targetH * 0.9);
        ctx.bezierCurveTo(hx + targetW * 0.4, hy + targetH * 0.8, hx, hy + targetH * 0.6, hx, hy + targetH * 0.35);
        ctx.bezierCurveTo(hx, hy + targetH * 0.15, hx + targetW * 0.15, hy, hx + targetW * 0.35, hy);
        ctx.bezierCurveTo(hx + targetW * 0.47, hy, hx + targetW * 0.5, hy + targetH * 0.08, hx + targetW * 0.5, hy + targetH * 0.08);
        ctx.bezierCurveTo(hx + targetW * 0.5, hy + targetH * 0.08, hx + targetW * 0.53, hy, hx + targetW * 0.65, hy);
        ctx.bezierCurveTo(hx + targetW * 0.85, hy, hx + targetW, hy + targetH * 0.15, hx + targetW, hy + targetH * 0.35);
        ctx.bezierCurveTo(hx + targetW, hy + targetH * 0.6, hx + targetW * 0.6, hy + targetH * 0.8, hx + targetW * 0.5, hy + targetH * 0.9);
        ctx.closePath();
        ctx.clip();
      } else {
        // Square
        ctx.rect(targetX, targetY, targetW, targetH);
        ctx.clip();
      }

      // 3. Implement crop clipping (insets) relative to the shape container
      const cropL = (el.cropLeft || 0) / 100 * targetW;
      const cropR = (el.cropRight || 0) / 100 * targetW;
      const cropT = (el.cropTop || 0) / 100 * targetH;
      const cropB = (el.cropBottom || 0) / 100 * targetH;

      ctx.beginPath();
      ctx.rect(targetX + cropL, targetY + cropT, targetW - cropL - cropR, targetH - cropT - cropB);
      ctx.clip();

      const imgWidth = el.img.width;
      const imgHeight = el.img.height;
      const aspect = imgWidth / imgHeight;
      const boxAspect = targetW / targetH;

      let drawWidth = targetW;
      let drawHeight = targetH;
      if (aspect > boxAspect) {
        drawWidth = targetH * aspect;
      } else {
        drawHeight = targetW / aspect;
      }

      drawWidth *= el.scale;
      drawHeight *= el.scale;

      const ox = targetX + (targetW - drawWidth) / 2 + el.x;
      const oy = targetY + (targetH - drawHeight) / 2 + el.y;

      ctx.drawImage(el.img, ox, oy, drawWidth, drawHeight);
      ctx.restore();
    }

    function drawSingle(el) {
      drawImg(el, 0, 0, canvas.width, canvas.height);
    }

    // Adjust gaps slightly to accommodate circular/heart margins
    function drawTwo(el1, el2) {
      drawImg(el1, 10, 10, canvas.width - 20, canvas.height / 2 - 20);
      drawImg(el2, 10, canvas.height / 2 + 10, canvas.width - 20, canvas.height / 2 - 20);
    }

    function drawThree(el1, el2, el3) {
      drawImg(el1, 10, 10, canvas.width - 20, canvas.height / 2 - 20);
      drawImg(el2, 10, canvas.height / 2 + 10, canvas.width / 2 - 20, canvas.height / 2 - 20);
      drawImg(el3, canvas.width / 2 + 10, canvas.height / 2 + 10, canvas.width / 2 - 20, canvas.height / 2 - 20);
    }

    function drawFour(el1, el2, el3, el4) {
      drawImg(el1, 10, 10, canvas.width / 2 - 20, canvas.height / 2 - 20);
      drawImg(el2, canvas.width / 2 + 10, 10, canvas.width / 2 - 20, canvas.height / 2 - 20);
      drawImg(el3, 10, canvas.height / 2 + 10, canvas.width / 2 - 20, canvas.height / 2 - 20);
      drawImg(el4, canvas.width / 2 + 10, canvas.height / 2 + 10, canvas.width / 2 - 20, canvas.height / 2 - 20);
    }
  });
}

export default function StatusPanel({ 
  me, 
  mobile = false, 
  selectedStatusFeed, 
  onSelectStatusFeed, 
  onBack 
}) {
  const meId = me?.id || "guest";
  const fileInputRef = useRef(null);

  // Collage Creator States
  const [imagesList, setImagesList] = useState([]); // Array of { dataUrl, scale, xOffset, yOffset, shape, cropTop, cropLeft, cropRight, cropBottom, widthPct, heightPct }
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imageEditMode, setImageEditMode] = useState(null); // null | "crop" | "resize"
  const [imageEditIndex, setImageEditIndex] = useState(null); // index of image being edited

  // Custom overlay text states for status composer
  const [hasTextOverlay, setHasTextOverlay] = useState(false);
  const [overlayText, setOverlayText] = useState("Double tap to edit text");
  const [isEditingOverlayText, setIsEditingOverlayText] = useState(false);
  const [overlayConfig, setOverlayConfig] = useState({
    x: 50, // percent
    y: 40, // percent
    fontStyle: "font-sans",
    fontSize: 24, // px
    color: "#ffffff"
  });

  // Story player states
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [liked, setLiked] = useState(false);
  const [showViewerDetails, setShowViewerDetails] = useState(false);
  
  const canvasRef = useRef(null);
  const dragStartRef = useRef(null);
  const timerRef = useRef(null);

  // Pan state for active image drag panning
  const imageDragStartRef = useRef(null);
  
  // Custom crop/resize handle drag state tracker
  const actionDragRef = useRef(null);

  // Heart rain effect states
  const [heartParticles, setHeartParticles] = useState([]);

  // Load initial media if provided by creator trigger
  useEffect(() => {
    if (selectedStatusFeed?.isCreator && selectedStatusFeed?.initialMedia) {
      if (selectedStatusFeed.initialMedia.type === "image") {
        setImagesList([{ 
          dataUrl: selectedStatusFeed.initialMedia.dataUrl, 
          scale: 1, 
          xOffset: 0, 
          yOffset: 0,
          shape: "square",
          cropTop: 0,
          cropLeft: 0,
          cropRight: 0,
          cropBottom: 0,
          widthPct: 100,
          heightPct: 100
        }]);
        setActiveImageIndex(0);
      }
      setHasTextOverlay(true);
      setOverlayText("Tap to edit text");
    } else {
      setImagesList([]);
      setHasTextOverlay(false);
      setOverlayText("Tap to edit text");
    }
  }, [selectedStatusFeed]);

  // Restart story player on feed change
  useEffect(() => {
    if (selectedStatusFeed && !selectedStatusFeed.isCreator && selectedStatusFeed.items?.length > 0) {
      setActiveStoryIndex(0);
      setProgress(0);
      setIsPaused(false);
      setLiked(false);
      setReplyText("");
      setShowViewerDetails(false);
    }
  }, [selectedStatusFeed]);

  // Story player ticker
  useEffect(() => {
    if (!selectedStatusFeed || selectedStatusFeed.isCreator || selectedStatusFeed.items?.length === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (isPaused || showViewerDetails) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const interval = 45; // ms
    const duration = 5000;
    const step = (interval / duration) * 100;

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          const nextIndex = activeStoryIndex + 1;
          if (nextIndex < selectedStatusFeed.items.length) {
            setActiveStoryIndex(nextIndex);
            setLiked(false);
            return 0;
          } else {
            clearInterval(timerRef.current);
            onSelectStatusFeed?.(null);
            return 100;
          }
        }
        return prev + step;
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [selectedStatusFeed, activeStoryIndex, isPaused, showViewerDetails, onSelectStatusFeed]);

  const activeStory = useMemo(() => {
    if (!selectedStatusFeed || selectedStatusFeed.isCreator || !selectedStatusFeed.items) return null;
    return selectedStatusFeed.items[activeStoryIndex] || null;
  }, [selectedStatusFeed, activeStoryIndex]);

  const handleReplySubmit = (e) => {
    e?.preventDefault?.();
    if (!replyText.trim()) return;
    // In a real app, send reply via API/socket here
    setReplyText("");
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be picked again
    e.target.value = "";

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagesList((prev) => {
          const newList = [
            ...prev,
            {
              dataUrl: reader.result,
              scale: 1,
              xOffset: 0,
              yOffset: 0,
              shape: "square",
              cropTop: 0,
              cropLeft: 0,
              cropRight: 0,
              cropBottom: 0,
              widthPct: 100,
              heightPct: 100
            }
          ];
          setActiveImageIndex(newList.length - 1);
          return newList;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePostStatus = async () => {
    if (imagesList.length === 0 && !overlayText.trim()) return;

    try {
      const formData = new FormData();
      
      if (imagesList.length > 0) {
        const collageDataUrl = await createCollageDataUrl(imagesList);
        const response = await fetch(collageDataUrl);
        const blob = await response.blob();
        formData.append("media", blob, "collage.jpg");
      }
      
      formData.append("text", overlayText.trim());
      
      if (hasTextOverlay) {
        formData.append("textStyles", JSON.stringify(overlayConfig));
      }

      await api.post("/users/statuses", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      window.dispatchEvent(new Event("anach_status_updated"));
      onSelectStatusFeed?.(null);
    } catch (err) {
      alert("Error posting status: " + (err.response?.data?.message || err.message));
    }
  };

  // Heart Particle Rain Loop
  const spawnHearts = () => {
    const nextParticles = [];
    for (let i = 0; i < 24; i++) {
      nextParticles.push({
        id: `h-${Date.now()}-${Math.random()}`,
        x: Math.random() * 100, 
        y: 105, 
        size: 14 + Math.random() * 20,
        speed: 1.5 + Math.random() * 2.5,
        swaySpeed: 0.02 + Math.random() * 0.05,
        swayWidth: 2 + Math.random() * 8,
        time: Math.random() * 10,
        opacity: 0.9 + Math.random() * 0.1
      });
    }
    setHeartParticles((prev) => [...prev, ...nextParticles]);
  };

  useEffect(() => {
    if (heartParticles.length === 0) return;

    const animFrame = requestAnimationFrame(() => {
      setHeartParticles((prev) => 
        prev
          .map((p) => {
            const nextY = p.y - p.speed;
            const nextTime = p.time + p.swaySpeed;
            const nextX = p.x + Math.sin(nextTime) * 0.3;
            const nextOpacity = nextY < 30 ? p.opacity - 0.025 : p.opacity;

            return { ...p, y: nextY, x: nextX, time: nextTime, opacity: nextOpacity };
          })
          .filter((p) => p.y > -10 && p.opacity > 0)
      );
    });

    return () => cancelAnimationFrame(animFrame);
  }, [heartParticles]);

  const handleLike = () => {
    setLiked(true);
    spawnHearts();
  };

  const handleDragStart = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: overlayConfig.x,
      initialY: overlayConfig.y
    };
  };

  // Image Drag Panning Handlers
  const handleImageDragStart = (e, index) => {
    e.stopPropagation();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    imageDragStartRef.current = {
      index,
      startX: clientX,
      startY: clientY,
      initialXOffset: imagesList[index].xOffset,
      initialYOffset: imagesList[index].yOffset
    };
  };

  const handleDragMove = (e) => {
    // 1. Handle overlay text dragging
    if (dragStartRef.current) {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const rect = canvasRef.current.getBoundingClientRect();
      const dx = ((clientX - dragStartRef.current.startX) / rect.width) * 100;
      const dy = ((clientY - dragStartRef.current.startY) / rect.height) * 100;

      setOverlayConfig((prev) => ({
        ...prev,
        x: Math.max(5, Math.min(95, dragStartRef.current.initialX + dx)),
        y: Math.max(5, Math.min(95, dragStartRef.current.initialY + dy))
      }));
    }

    // 2. Handle image panning drag (only when not in crop or resize active state)
    if (imageDragStartRef.current && !imageEditMode) {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const idx = imageDragStartRef.current.index;

      const dx = clientX - imageDragStartRef.current.startX;
      const dy = clientY - imageDragStartRef.current.startY;

      setImagesList(prev => prev.map((img, i) => i === idx ? {
        ...img,
        xOffset: imageDragStartRef.current.initialXOffset + dx,
        yOffset: imageDragStartRef.current.initialYOffset + dy
      } : img));
    }

    // 3. Handle Crop / Resize Drag Actions
    if (actionDragRef.current) {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const { type, handle, index, startX, startY, initialVal, elementRect } = actionDragRef.current;
      
      const dx = clientX - startX;
      const dy = clientY - startY;

      if (type === "crop") {
        const width = elementRect.width;
        const height = elementRect.height;
        const dxPct = (dx / width) * 100;
        const dyPct = (dy / height) * 100;

        setImagesList(prev => prev.map((img, i) => {
          if (i !== index) return img;
          
          let cropTop = img.cropTop;
          let cropBottom = img.cropBottom;
          let cropLeft = img.cropLeft;
          let cropRight = img.cropRight;

          if (handle === "top" || handle === "tl" || handle === "tr") {
            cropTop = Math.max(0, Math.min(100 - cropBottom - 5, initialVal.cropTop + dyPct));
          }
          if (handle === "bottom" || handle === "bl" || handle === "br") {
            cropBottom = Math.max(0, Math.min(100 - cropTop - 5, initialVal.cropBottom - dyPct));
          }
          if (handle === "left" || handle === "tl" || handle === "bl") {
            cropLeft = Math.max(0, Math.min(100 - cropRight - 5, initialVal.cropLeft + dxPct));
          }
          if (handle === "right" || handle === "tr" || handle === "br") {
            cropRight = Math.max(0, Math.min(100 - cropLeft - 5, initialVal.cropRight - dxPct));
          }

          return { ...img, cropTop, cropBottom, cropLeft, cropRight };
        }));
      } else if (type === "resize") {
        const width = elementRect.width;
        const height = elementRect.height;
        // Resize changes size of tile relative to its cell
        const dxPct = (dx / width) * 100;
        const dyPct = (dy / height) * 100;

        setImagesList(prev => prev.map((img, i) => {
          if (i !== index) return img;
          let widthPct = img.widthPct;
          let heightPct = img.heightPct;

          if (handle === "br") {
            widthPct = Math.max(20, Math.min(150, initialVal.widthPct + dxPct));
            heightPct = Math.max(20, Math.min(150, initialVal.heightPct + dyPct));
          } else if (handle === "bl") {
            widthPct = Math.max(20, Math.min(150, initialVal.widthPct - dxPct));
            heightPct = Math.max(20, Math.min(150, initialVal.heightPct + dyPct));
          } else if (handle === "tr") {
            widthPct = Math.max(20, Math.min(150, initialVal.widthPct + dxPct));
            heightPct = Math.max(20, Math.min(150, initialVal.heightPct - dyPct));
          } else if (handle === "tl") {
            widthPct = Math.max(20, Math.min(150, initialVal.widthPct - dxPct));
            heightPct = Math.max(20, Math.min(150, initialVal.heightPct - dyPct));
          }

          return { ...img, widthPct, heightPct };
        }));
      }
    }
  };

  const handleDragEnd = () => {
    dragStartRef.current = null;
    imageDragStartRef.current = null;
    actionDragRef.current = null;
  };

  const mockViewersList = useMemo(() => {
    return [
      { name: "Gulshan Kumar", time: "2m ago", avatar: "" },
      { name: "Sanjay Kumar", time: "12m ago", avatar: "" },
      { name: "Kanak Prabha", time: "1h ago", avatar: "" }
    ];
  }, []);

  // Get shape border-radius / clip-path inline styles
  const getShapeStyles = (shape) => {
    if (shape === "circle") {
      return { borderRadius: "9999px", aspectRatio: "1/1" };
    }
    if (shape === "rounded") {
      return { borderRadius: "1.5rem" };
    }
    if (shape === "heart") {
      return { clipPath: "url(#heart-clip)" };
    }
    return { borderRadius: "0px" }; // Square
  };

  // 1. PLACEHOLDER STATE
  if (!selectedStatusFeed) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-6 overflow-hidden transition-colors">
        <div className="absolute top-1/3 left-1/3 w-[30rem] h-[30rem] rounded-full bg-violet-500/5 dark:bg-violet-600/10 blur-[100px] pointer-events-none animate-pulse" />
        
        {mobile && (
          <button
            type="button"
            onClick={onBack}
            className="absolute top-4 left-4 p-3 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 transition text-slate-700 dark:text-white"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        <div className="relative z-10 flex flex-col items-center max-w-sm text-center">
          <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 shadow-[0_0_30px_rgba(139,92,246,0.1)]">
            <CircleDot size={38} />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Status Updates
          </h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
            Select a contact to view their updates, or post one of your own.
          </p>

          <button
            type="button"
            onClick={() => onSelectStatusFeed?.({
              name: me?.name || "My Status",
              avatar: me?.avatar_url,
              isMe: true,
              items: [],
              isCreator: true
            })}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-violet-600 text-white font-bold text-xs shadow-lg hover:bg-violet-500 active:scale-[0.98] transition"
          >
            <Plus size={14} />
            Share status update
          </button>
        </div>
      </div>
    );
  }

  // 2. CREATOR / COMPOSER STATE
  if (selectedStatusFeed.isCreator) {
    const activeImg = imagesList[activeImageIndex];
    return (
      <div className="relative flex h-full w-full flex-col bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden">
        {/* SVG Clip Path Injector for Heart shape */}
        <svg width="0" height="0" className="absolute pointer-events-none">
          <defs>
            <clipPath id="heart-clip" clipPathUnits="objectBoundingBox">
              <path d="M 0.5, 0.9 C 0.4, 0.8, 0, 0.6, 0, 0.35 C 0, 0.15, 0.15, 0, 0.35, 0 C 0.47, 0, 0.5, 0.08, 0.5, 0.08 C 0.5, 0.08, 0.53, 0, 0.65, 0 C 0.85, 0, 1, 0.15, 1, 0.35 C 1, 0.6, 0.6, 0.8, 0.5, 0.9" />
            </clipPath>
          </defs>
        </svg>

        <style dangerouslySetInnerHTML={{__html: `
          @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap');
          .cursive-font { font-family: 'Caveat', cursive !important; }
        `}} />

        {/* Top Navbar */}
        <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent text-white">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSelectStatusFeed?.(null)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition text-white"
            >
              <X size={18} />
            </button>
            <h2 className="text-sm font-bold">New Collage Status</h2>
          </div>

          {hasTextOverlay && (
            <div className="flex items-center gap-2 bg-black/45 backdrop-blur-md rounded-full px-3 py-1 border border-white/10 text-white">
              <select
                value={overlayConfig.fontStyle}
                onChange={(e) => setOverlayConfig(p => ({ ...p, fontStyle: e.target.value }))}
                className="bg-transparent text-xs outline-none font-semibold cursor-pointer py-1"
              >
                {FONT_STYLES.map(f => (
                  <option key={f.id} value={f.id} className="bg-slate-900 text-white">{f.name}</option>
                ))}
              </select>

              <div className="flex gap-1">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setOverlayConfig(p => ({ ...p, color: c }))}
                    className={`w-3.5 h-3.5 rounded-full border transition ${overlayConfig.color === c ? "border-white scale-110" : "border-transparent opacity-80"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => setOverlayConfig(p => ({ ...p, fontSize: Math.max(14, p.fontSize - 3) }))}
                className="text-white hover:text-violet-400 p-0.5"
              >
                <MinusCircle size={14} />
              </button>
              <button
                type="button"
                onClick={() => setOverlayConfig(p => ({ ...p, fontSize: Math.min(60, p.fontSize + 3) }))}
                className="text-white hover:text-violet-400 p-0.5"
              >
                <PlusCircle size={14} />
              </button>
            </div>
          )}
        </header>

        {/* Media Preview Canvas */}
        <div 
          ref={canvasRef}
          onMouseMove={handleDragMove}
          onTouchMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onTouchEnd={handleDragEnd}
          onMouseLeave={handleDragEnd}
          className="flex-1 w-full flex items-center justify-center relative bg-slate-200 dark:bg-slate-900 overflow-hidden select-none"
        >
          {imagesList.length === 0 ? (
            <div className="absolute inset-0 bg-gradient-to-tr from-violet-950 via-slate-950 to-indigo-950 z-0" />
          ) : (
            <div className="w-full h-full grid gap-2.5 p-4" style={{
              gridTemplateRows: imagesList.length <= 2 ? "1fr" : "1fr 1fr",
              gridTemplateColumns: imagesList.length === 1 ? "1fr" : "1fr 1fr"
            }}>
              {imagesList.map((img, idx) => {
                const isEditingThis = imageEditIndex === idx && imageEditMode !== null;
                const cropStyle = {
                  clipPath: `inset(${img.cropTop || 0}% ${img.cropRight || 0}% ${img.cropBottom || 0}% ${img.cropLeft || 0}%)`
                };
                const cellResizeStyle = {
                  width: `${img.widthPct || 100}%`,
                  height: `${img.heightPct || 100}%`,
                  margin: "auto"
                };

                const startActionDrag = (e, handle) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                  const el = e.currentTarget.closest(".collage-img-wrapper");
                  const rect = el.getBoundingClientRect();
                  actionDragRef.current = {
                    type: imageEditMode,
                    handle,
                    index: idx,
                    startX: clientX,
                    startY: clientY,
                    initialVal: {
                      cropTop: img.cropTop || 0,
                      cropBottom: img.cropBottom || 0,
                      cropLeft: img.cropLeft || 0,
                      cropRight: img.cropRight || 0,
                      widthPct: img.widthPct || 100,
                      heightPct: img.heightPct || 100
                    },
                    elementRect: rect
                  };
                };

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-center w-full h-full overflow-hidden"
                  >
                    <div 
                      onClick={() => {
                        setActiveImageIndex(idx);
                        if (imageEditIndex !== idx) {
                          setImageEditMode(null);
                          setImageEditIndex(null);
                        }
                      }}
                      className={`collage-img-wrapper relative overflow-hidden transition-all bg-black group border-2 ${activeImageIndex === idx ? "border-violet-500 scale-[0.99] shadow-lg" : "border-transparent"}`}
                      style={{
                        ...getShapeStyles(img.shape),
                        ...cellResizeStyle
                      }}
                    >
                      <div className="w-full h-full overflow-hidden relative" style={cropStyle}>
                        <img 
                          src={img.dataUrl} 
                          alt={`Collage el ${idx}`}
                          onMouseDown={(e) => handleImageDragStart(e, idx)}
                          onTouchStart={(e) => handleImageDragStart(e, idx)}
                          className="w-full h-full object-cover origin-center cursor-move"
                          style={{
                            transform: `scale(${img.scale}) translate(${img.xOffset}px, ${img.yOffset}px)`
                          }}
                        />
                      </div>
                      
                      {/* Crop & Resize Option on Hover */}
                      {!isEditingThis && (
                        <div 
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition duration-200 z-10"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveImageIndex(idx);
                              setImageEditIndex(idx);
                              setImageEditMode("crop");
                            }}
                            className="bg-violet-600 hover:bg-violet-500 backdrop-blur-sm px-3 py-1.5 rounded-lg text-white flex items-center gap-1.5 text-xs font-bold shadow-lg border border-white/20 active:scale-95 transition"
                          >
                            <Crop size={14} />
                            <span>Crop</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveImageIndex(idx);
                              setImageEditIndex(idx);
                              setImageEditMode("resize");
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 backdrop-blur-sm px-3 py-1.5 rounded-lg text-white flex items-center gap-1.5 text-xs font-bold shadow-lg border border-white/20 active:scale-95 transition"
                          >
                            <Grid size={14} />
                            <span>Resize</span>
                          </button>
                        </div>
                      )}

                      {/* Interactive Crop Handles Overlay */}
                      {isEditingThis && imageEditMode === "crop" && (
                        <div className="absolute inset-0 z-20 pointer-events-none">
                          <div className="absolute inset-0 border-2 border-dashed border-violet-400 opacity-60"></div>
                          {/* Drag crop handles */}
                          <div onMouseDown={(e) => startActionDrag(e, "top")} onTouchStart={(e) => startActionDrag(e, "top")} className="absolute top-0 inset-x-0 h-3 cursor-n-resize pointer-events-auto bg-violet-400/20 hover:bg-violet-400/40 transition"></div>
                          <div onMouseDown={(e) => startActionDrag(e, "bottom")} onTouchStart={(e) => startActionDrag(e, "bottom")} className="absolute bottom-0 inset-x-0 h-3 cursor-s-resize pointer-events-auto bg-violet-400/20 hover:bg-violet-400/40 transition"></div>
                          <div onMouseDown={(e) => startActionDrag(e, "left")} onTouchStart={(e) => startActionDrag(e, "left")} className="absolute left-0 inset-y-0 w-3 cursor-w-resize pointer-events-auto bg-violet-400/20 hover:bg-violet-400/40 transition"></div>
                          <div onMouseDown={(e) => startActionDrag(e, "right")} onTouchStart={(e) => startActionDrag(e, "right")} className="absolute right-0 inset-y-0 w-3 cursor-e-resize pointer-events-auto bg-violet-400/20 hover:bg-violet-400/40 transition"></div>

                          {/* Corner handles */}
                          <div onMouseDown={(e) => startActionDrag(e, "tl")} onTouchStart={(e) => startActionDrag(e, "tl")} className="absolute top-0 left-0 w-4 h-4 bg-violet-500 border border-white cursor-nwse-resize pointer-events-auto shadow-md"></div>
                          <div onMouseDown={(e) => startActionDrag(e, "tr")} onTouchStart={(e) => startActionDrag(e, "tr")} className="absolute top-0 right-0 w-4 h-4 bg-violet-500 border border-white cursor-nesw-resize pointer-events-auto shadow-md"></div>
                          <div onMouseDown={(e) => startActionDrag(e, "bl")} onTouchStart={(e) => startActionDrag(e, "bl")} className="absolute bottom-0 left-0 w-4 h-4 bg-violet-500 border border-white cursor-nesw-resize pointer-events-auto shadow-md"></div>
                          <div onMouseDown={(e) => startActionDrag(e, "br")} onTouchStart={(e) => startActionDrag(e, "br")} className="absolute bottom-0 right-0 w-4 h-4 bg-violet-500 border border-white cursor-nwse-resize pointer-events-auto shadow-md"></div>
                        </div>
                      )}

                      {/* Interactive Resize Handles Overlay */}
                      {isEditingThis && imageEditMode === "resize" && (
                        <div className="absolute inset-0 z-20 pointer-events-none">
                          <div className="absolute inset-0 border-2 border-indigo-400 opacity-60"></div>
                          {/* Corner Resize Handles */}
                          <div onMouseDown={(e) => startActionDrag(e, "tl")} onTouchStart={(e) => startActionDrag(e, "tl")} className="absolute -top-1 -left-1 w-4 h-4 bg-indigo-500 border border-white cursor-nwse-resize pointer-events-auto rounded-full shadow-md"></div>
                          <div onMouseDown={(e) => startActionDrag(e, "tr")} onTouchStart={(e) => startActionDrag(e, "tr")} className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 border border-white cursor-nesw-resize pointer-events-auto rounded-full shadow-md"></div>
                          <div onMouseDown={(e) => startActionDrag(e, "bl")} onTouchStart={(e) => startActionDrag(e, "bl")} className="absolute -bottom-1 -left-1 w-4 h-4 bg-indigo-500 border border-white cursor-nesw-resize pointer-events-auto rounded-full shadow-md"></div>
                          <div onMouseDown={(e) => startActionDrag(e, "br")} onTouchStart={(e) => startActionDrag(e, "br")} className="absolute -bottom-1 -right-1 w-4 h-4 bg-indigo-500 border border-white cursor-nwse-resize pointer-events-auto rounded-full shadow-md"></div>
                        </div>
                      )}

                      {activeImageIndex === idx && (
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-violet-600/90 text-white text-[9px] font-bold tracking-wide pointer-events-none z-10">ACTIVE</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Draggable Text Overlay */}
          {hasTextOverlay && (
            <div
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              onDoubleClick={() => setIsEditingOverlayText(true)}
              className={`absolute z-30 px-4 py-2 cursor-move select-none rounded-xl active:bg-white/10 ${overlayConfig.fontStyle}`}
              style={{
                left: `${overlayConfig.x}%`,
                top: `${overlayConfig.y}%`,
                transform: "translate(-50%, -50%)",
                fontSize: `${overlayConfig.fontSize}px`,
                color: overlayConfig.color,
                textShadow: "0 2px 8px rgba(0,0,0,0.85)"
              }}
            >
              {isEditingOverlayText ? (
                <input
                  type="text"
                  value={overlayText}
                  onChange={(e) => setOverlayText(e.target.value)}
                  onBlur={() => setIsEditingOverlayText(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setIsEditingOverlayText(false);
                  }}
                  className="bg-transparent text-white outline-none border-b border-white text-center w-64"
                  autoFocus
                />
              ) : (
                overlayText
              )}
            </div>
          )}
        </div>

        {/* Cropping, Resizing & Shape Mask tools for active image */}
        {imagesList.length > 0 && activeImg && (
          <div className="px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between z-20">
            <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1"><Crop size={14} /> Edit Image {activeImageIndex + 1}:</span>
              
              {/* Scale/Size adjustment */}
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-semibold text-slate-400">Scale / Zoom:</label>
                <input 
                  type="range" 
                  min="0.5" 
                  max="3.0" 
                  step="0.05"
                  value={activeImg.scale}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setImagesList(prev => prev.map((img, idx) => idx === activeImageIndex ? { ...img, scale: val } : img));
                  }}
                  className="w-24 accent-violet-600"
                />
              </div>

              {/* Shape mask selectors */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-850 p-0.5 rounded-lg border border-slate-200/50 dark:border-slate-800">
                {["square", "rounded", "circle", "heart"].map((shape) => (
                  <button
                    key={shape}
                    type="button"
                    onClick={() => {
                      setImagesList(prev => prev.map((img, idx) => idx === activeImageIndex ? { ...img, shape } : img));
                    }}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold capitalize transition ${
                      activeImg.shape === shape
                        ? "bg-violet-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    {shape}
                  </button>
                ))}
              </div>

              {/* Exit Crop / Resize Mode Button if active */}
              {imageEditMode && (
                <button
                  type="button"
                  onClick={() => {
                    setImageEditMode(null);
                    setImageEditIndex(null);
                  }}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition shadow-sm"
                >
                  Done Editing
                </button>
              )}
            </div>

            <button 
              type="button"
              onClick={() => {
                setImagesList(prev => prev.filter((_, idx) => idx !== activeImageIndex));
                setActiveImageIndex(0);
                setImageEditMode(null);
                setImageEditIndex(null);
              }}
              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition"
              title="Remove this image"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}

        {/* Bottom Composer Bar */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 relative z-20 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 transition text-xs font-semibold text-slate-700 dark:text-white"
              >
                <Grid size={14} className="text-violet-500" />
                Add Image {imagesList.length > 0 ? `(${imagesList.length})` : "to Collage"}
              </button>
              
              <button
                type="button"
                onClick={() => setHasTextOverlay(prev => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition text-xs font-semibold ${hasTextOverlay ? "bg-violet-600 text-white" : "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white"}`}
              >
                <Type size={14} />
                Text Overlay
              </button>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <button
              type="button"
              onClick={handlePostStatus}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 transition text-xs font-bold text-white shadow-lg shadow-violet-950/30"
            >
              <Send size={12} />
              Post Update
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. STORY VIEWER STATE
  const hasMedia = activeStory?.mediaUrl;

  return (
    <div className="relative flex h-full w-full flex-col bg-slate-950 text-white overflow-hidden">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap');
        .cursive-font { font-family: 'Caveat', cursive !important; }
      `}} />

      {/* Background Media Blur Canvas */}
      {hasMedia && (
        <div 
          className="absolute inset-0 bg-cover bg-center blur-3xl opacity-35 scale-110 pointer-events-none z-0"
          style={{ backgroundImage: `url(${activeStory.mediaUrl})` }}
        />
      )}

      {/* Text Gradient Background (if no media) */}
      {!hasMedia && (
        <div className="absolute inset-0 bg-gradient-to-tr from-violet-950 via-slate-950 to-indigo-950 pointer-events-none z-0 animate-pulse" />
      )}

      {/* Heart Particle Burst Overlay */}
      {heartParticles.map((p) => (
        <div
          key={p.id}
          className="absolute pointer-events-none z-45 text-rose-500"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            fontSize: `${p.size}px`,
            opacity: p.opacity,
            transform: `translate(-50%, -50%) rotate(${Math.sin(p.time) * 15}deg)`,
            textShadow: "0 2px 10px rgba(225,29,72,0.5)",
            transition: "opacity 0.1s"
          }}
        >
          ❤️
        </div>
      ))}

      {/* Top Controls Overlay */}
      <div className="absolute top-0 inset-x-0 z-30 p-4 bg-gradient-to-b from-black/80 to-transparent flex flex-col gap-3">
        {/* Multi-segment story progress indicators */}
        <div className="flex gap-1.5 w-full">
          {selectedStatusFeed.items.map((item, idx) => {
            let widthPct = 0;
            if (idx < activeStoryIndex) widthPct = 100;
            else if (idx === activeStoryIndex) widthPct = progress;

            return (
              <div 
                key={item.id}
                className="h-[3px] flex-1 bg-white/20 rounded-full overflow-hidden"
              >
                <div 
                  className="h-full bg-white transition-all duration-[45ms] ease-linear rounded-full"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* User Info & Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={selectedStatusFeed.name} src={selectedStatusFeed.avatar} size={36} />
            <div>
              <p className="text-xs font-bold">{selectedStatusFeed.name}</p>
              <p className="text-[10px] text-white/60 mt-0.5">
                {activeStory ? formatDayLabel(activeStory.created_at) : ""} {activeStory && formatTime(activeStory.created_at) ? `• ${formatTime(activeStory.created_at)}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsPaused((prev) => !prev)}
              className="p-2 rounded-full hover:bg-white/10 text-white transition"
              title={isPaused ? "Play" : "Pause"}
            >
              {isPaused ? <Play size={16} fill="white" /> : <Pause size={16} fill="white" />}
            </button>
            <button
              type="button"
              onClick={() => onSelectStatusFeed?.(null)}
              className="p-2 rounded-full hover:bg-white/10 text-white transition"
              title="Close viewer"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Immersive Canvas Area */}
      <div 
        ref={canvasRef}
        className="flex-1 w-full flex items-center justify-center relative z-10 px-4 overflow-hidden"
      >
        {/* Left/Right Click zones for quick navigation */}
        <div 
          onClick={() => {
            if (activeStoryIndex > 0) {
              setActiveStoryIndex(activeStoryIndex - 1);
              setProgress(0);
            }
          }}
          className="absolute left-0 inset-y-0 w-1/4 cursor-pointer z-20 flex items-center justify-start p-4 group"
        >
          <div className="h-10 w-10 rounded-full bg-black/40 text-white/50 group-hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 backdrop-blur-md transition">
            <ChevronLeft size={20} />
          </div>
        </div>

        <div 
          onClick={() => {
            const nextIdx = activeStoryIndex + 1;
            if (nextIdx < selectedStatusFeed.items.length) {
              setActiveStoryIndex(nextIdx);
              setProgress(0);
            } else {
              onSelectStatusFeed?.(null);
            }
          }}
          className="absolute right-0 inset-y-0 w-1/4 cursor-pointer z-20 flex items-center justify-end p-4 group"
        >
          <div className="h-10 w-10 rounded-full bg-black/40 text-white/50 group-hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 backdrop-blur-md transition">
            <ChevronRight size={20} />
          </div>
        </div>

        {/* Media Frame */}
        <div className="max-h-full max-w-full flex flex-col items-center justify-center relative select-none">
          {hasMedia ? (
            <img 
              src={activeStory.mediaUrl} 
              alt="Story content" 
              className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-2xl"
            />
          ) : null}

          {/* Text Overlay rendered with customized styling parameters */}
          {activeStory?.text && (
            <div 
              className={`absolute select-none z-30 px-4 py-2 ${activeStory.textStyles ? activeStory.textStyles.fontStyle : "font-sans"} ${!hasMedia ? "relative mt-0 text-center" : ""}`}
              style={activeStory.textStyles ? {
                left: `${activeStory.textStyles.x}%`,
                top: `${activeStory.textStyles.y}%`,
                transform: "translate(-50%, -50%)",
                fontSize: `${activeStory.textStyles.fontSize}px`,
                color: activeStory.textStyles.color,
                textShadow: "0 2px 8px rgba(0,0,0,0.85)",
                position: "absolute"
              } : {
                textShadow: "0 2px 8px rgba(0,0,0,0.85)",
                fontSize: "20px",
                color: "#ffffff"
              }}
            >
              {activeStory.text}
            </div>
          )}
        </div>

        {/* Slide-up Viewer Details list */}
        {showViewerDetails && selectedStatusFeed.isMe && (
          <div className="absolute inset-x-0 bottom-0 bg-slate-900/98 backdrop-blur-xl border-t border-slate-800 rounded-t-3xl p-5 z-50 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold flex items-center gap-1.5"><Eye size={16} /> Views ({mockViewersList.length})</h3>
              <button 
                type="button" 
                onClick={() => setShowViewerDetails(false)}
                className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition text-white"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              {mockViewersList.map((viewer, index) => (
                <div key={index} className="flex items-center justify-between border-b border-slate-800/40 pb-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={viewer.name} src={viewer.avatar} size={28} />
                    <span className="text-xs font-semibold text-slate-200">{viewer.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{viewer.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Reply/Like Bar (Hidden for own updates) */}
      <div className="p-4 bg-gradient-to-t from-black/95 to-transparent relative z-20 flex items-center gap-3">
        {selectedStatusFeed.isMe ? (
          <div className="flex-1 flex items-center justify-between bg-black/40 border border-white/10 rounded-full px-5 py-2.5 backdrop-blur-md">
            <span className="text-xs text-white/70">My Status update • {mockViewersList.length} views</span>
            <button
              type="button"
              onClick={() => setShowViewerDetails(prev => !prev)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-400 hover:text-violet-300 transition"
            >
              <Eye size={15} />
              View Detail
            </button>
          </div>
        ) : (
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleReplySubmit(e);
            }} 
            className="flex-1 flex items-center gap-2.5"
          >
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Reply to ${selectedStatusFeed.name}...`}
              className="flex-1 bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/10 rounded-full px-5 py-2.5 text-xs text-white placeholder-white/55 outline-none focus:border-white/30 backdrop-blur-md transition"
            />

            <button
              type="button"
              onClick={handleLike}
              className={`p-2.5 rounded-full transition active:scale-90 ${liked ? "bg-rose-500/20 text-rose-500 border border-rose-500/30" : "bg-white/10 hover:bg-white/15 text-white/80 border border-white/5"}`}
              title="Like status"
            >
              <Heart size={16} fill={liked ? "currentColor" : "none"} className={liked ? "animate-pulse" : ""} />
            </button>

            <button
              type="submit"
              disabled={!replyText.trim() && !liked}
              className="p-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Send reply"
            >
              <Send size={15} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
