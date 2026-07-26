export function noop() {
  return undefined;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function formatTimestamp(value: Date | string) {
  return new Date(value).toISOString();
}

export function ensureArray<T>(value: T | T[]) {
  return Array.isArray(value) ? value : [value];
}
