import { API_BASE_URL } from "../../api/client";

function avatarUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/uploads/")) return `${API_BASE_URL}${path}`;
  if (path.startsWith("uploads/")) return `${API_BASE_URL}/${path}`;
  if (path.startsWith("/")) return path;
  return `${API_BASE_URL}/uploads/${path}`;
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
