function resolveBase() {
  const raw = (import.meta.env.BASE_URL || "/").toString();
  if (!raw) return "/";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

export function withBase(pathname) {
  const base = resolveBase();
  const clean = (pathname || "").toString().replace(/^\//, "");
  return `${base}${clean}`;
}

export function navigateTo(pathname) {
  window.location.href = withBase(pathname);
}

export function isPathWithBase(prefix) {
  const target = withBase(prefix);
  return window.location.pathname.startsWith(target);
}

