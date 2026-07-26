import { API_BASE_URL } from "../../api/client";

function avatarUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  
  let resolvedPath = path;
  if (path.startsWith("/uploads/")) {
    resolvedPath = path;
  } else if (path.startsWith("uploads/")) {
    resolvedPath = `/${path}`;
  } else if (!path.startsWith("/")) {
    // Just a filename, add /uploads/ prefix
    resolvedPath = `/uploads/${path}`;
  }
  
  const fullUrl = `${API_BASE_URL}${resolvedPath}`;
  // Add cache-busting based on filename to force fresh image loads when avatar changes
  // Use a simple hash of the filepath -if the path changes, the cache-bust parameter changes
  const cacheKey = Math.abs(path.split("").reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0));
  return `${fullUrl}?v=${cacheKey}`;
}

function initials(name) {
  if (!name) return "U";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function Avatar({ name, src, size = 40, className = "" }) {
  const resolved = avatarUrl(src);
  const style = { width: `${size}px`, height: `${size}px` };

  return (
    <div
      style={style}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-fuchsia-400 via-violet-500 to-slate-950 font-semibold text-white ${className}`}
      aria-label={name ? `${name} avatar` : "User avatar"}
    >
      {resolved ? (
        <img src={resolved} alt={name || "avatar"} className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs">{initials(name)}</span>
      )}
    </div>
  );
}
