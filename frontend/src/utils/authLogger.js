const REDACT_LENGTH = 10;

function redactToken(token) {
  if (!token || typeof token !== "string") return null;
  if (token.length <= REDACT_LENGTH * 2) return `${token.slice(0, 4)}...`;
  return `${token.slice(0, REDACT_LENGTH)}...${token.slice(-REDACT_LENGTH)}`;
}

function log(message, meta = {}) {
  if (typeof window !== "undefined") {
    console.log("[AUTH]", message, meta);
  }
}

export function logTokenStored(token) {
  log("TOKEN STORED", { token: redactToken(token) });
}

export function logTokenFetched(token) {
  log("TOKEN FETCHED", { token: redactToken(token) });
}

export function logTokenHit(token) {
  log("TOKEN HIT", { token: redactToken(token) });
}

export function logTokenMiss() {
  log("TOKEN MISS");
}

export function logTokenExpired() {
  log("TOKEN EXPIRED");
}

export function logSocketTokenAttached(token) {
  if (token) {
    log("SOCKET TOKEN ATTACHED", { token: redactToken(token) });
  } else {
    log("SOCKET TOKEN MISSING");
  }
}

export function logUserAuthenticated(user) {
  log("USER AUTHENTICATED", {
    userId: user?.id,
    email: user?.email || null
  });
}

export function logUserLoggedOut() {
  log("USER LOGGED OUT");
}

export function log401Detected(url, reason) {
  log("401 DETECTED", { url, reason });
}

export function dispatchAuthLogout(reason) {
  if (typeof window !== "undefined") {
    const event = new CustomEvent("auth:logout", {
      detail: { reason }
    });
    window.dispatchEvent(event);
  }
}

export function onAuthLogout(handler) {
  if (typeof window !== "undefined") {
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }
  return () => {};
}
