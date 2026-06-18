const statusEl = document.getElementById('status');
const dbStatusEl = document.getElementById('db-status');
const authStatusEl = document.getElementById('auth-status');
const socketStatusEl = document.getElementById('socket-status');
const detailsEl = document.getElementById('details');
const timeout = 8000;

function formatError(message) {
  return message ? message.replace(/\n/g, '<br>') : 'Unknown error';
}

async function checkApiHealth() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const startTime = performance.now();
    const res = await fetch('/healthz', {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    const duration = Math.round(performance.now() - startTime);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    statusEl.innerHTML = '<div class="indicator active"></div><div class="status-content"><div class="status-label">✓ Server Status: Active</div><div class="status-desc">Backend is running and responding</div></div>';
    detailsEl.innerHTML = `<strong>API Response (${duration}ms):</strong><br><br>${JSON.stringify(data, null, 2)}<br><br><strong>Endpoint:</strong> /healthz<br><strong>Status:</strong> ${res.status} ${res.statusText}`;
  } catch (error) {
    statusEl.innerHTML = '<div class="indicator" style="background:#ef4444"></div><div class="status-content"><div class="status-label">✗ Server Status: Error</div><div class="status-desc">Backend API is not responding</div></div>';
    const msg = error.name === 'AbortError' ? 'Request timeout (no response after 8s)' : error.message;
    detailsEl.innerHTML = `<strong>API Error:</strong><br>${formatError(msg)}<br><br><strong>Troubleshooting:</strong><br>• Check if backend server is running<br>• Check network/firewall settings<br>• Review backend logs for errors`;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkDbStatus() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const startTime = performance.now();
    const res = await fetch('/db-health', {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    const duration = Math.round(performance.now() - startTime);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    dbStatusEl.innerHTML = '<div class="indicator active"></div><div class="status-content"><div class="status-label">✓ Database Status: Connected</div><div class="status-desc">MongoDB is reachable and healthy</div></div>';
    detailsEl.innerHTML += `<br><br><strong>DB Ping (${duration}ms):</strong><br>${JSON.stringify(data, null, 2)}`;
  } catch (error) {
    dbStatusEl.innerHTML = '<div class="indicator" style="background:#ef4444"></div><div class="status-content"><div class="status-label">✗ Database Status: Error</div><div class="status-desc">MongoDB connection failed</div></div>';
    const msg = error.name === 'AbortError' ? 'Request timeout (no response after 8s)' : error.message;
    detailsEl.innerHTML += `<br><br><strong>DB Error:</strong><br>${formatError(msg)}`;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkAuthStatus() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const startTime = performance.now();
    const res = await fetch('/api/auth/health', {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    const duration = Math.round(performance.now() - startTime);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    authStatusEl.innerHTML = '<div class="indicator active"></div><div class="status-content"><div class="status-label">✓ Auth Service: Available</div><div class="status-desc">Authentication endpoint is functional</div></div>';
    detailsEl.innerHTML += `<br><br><strong>Auth Endpoint (${duration}ms):</strong> ${res.status} ${res.statusText}`;
  } catch (error) {
    authStatusEl.innerHTML = '<div class="indicator" style="background:#ef4444"></div><div class="status-content"><div class="status-label">✗ Auth Service: Error</div><div class="status-desc">Authentication endpoint is not reachable</div></div>';
    const msg = error.name === 'AbortError' ? 'Request timeout (no response after 8s)' : error.message;
    detailsEl.innerHTML += `<br><br><strong>Auth Error:</strong><br>${formatError(msg)}`;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkSocketStatus() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const startTime = performance.now();
    const res = await fetch('/socket-status', { 
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    const duration = Math.round(performance.now() - startTime);
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.status === 'connected') {
      socketStatusEl.innerHTML = '<div class="indicator active"></div><div class="status-content"><div class="status-label">✓ Socket Status: Connected</div><div class="status-desc">WebSocket server is active (' + data.activeConnections + ' connections)</div></div>';
    } else {
      socketStatusEl.innerHTML = '<div class="indicator" style="background:#ef4444"></div><div class="status-content"><div class="status-label">✗ Socket Status: Disconnected</div><div class="status-desc">WebSocket server is not responding</div></div>';
    }

    detailsEl.innerHTML += `<br><br><strong>Socket Check (${duration}ms):</strong> ${data.status}`;
  } catch (error) {
    socketStatusEl.innerHTML = '<div class="indicator" style="background:#ef4444"></div><div class="status-content"><div class="status-label">✗ Socket Status: Error</div><div class="status-desc">Cannot verify WebSocket connections</div></div>';
    const msg = error.name === 'AbortError' ? 'Request timeout (no response after 8s)' : error.message;
    detailsEl.innerHTML += `<br><br><strong>Socket Error:</strong><br>${formatError(msg)}`;
  } finally {
    clearTimeout(timeoutId);
  }
}

function resetDetails() {
  detailsEl.innerHTML = 'Initializing...';
}

async function runChecks() {
  resetDetails();
  await Promise.all([checkApiHealth(), checkDbStatus(), checkAuthStatus(), checkSocketStatus()]);
}

runChecks();
setInterval(runChecks, 30000);
