const statusEl = document.getElementById('status');
const dbStatusEl = document.getElementById('db-status');
const authStatusEl = document.getElementById('auth-status');
const socketStatusEl = document.getElementById('socket-status');
const detailsEl = document.getElementById('details');
const detailsPanel = document.getElementById('details-panel');
const successScreen = document.getElementById('success-screen');
const statusContainer = document.getElementById('status-container');
const mainCard = document.getElementById('main-card');

const timeout = 8000;

function updateStatusElement(el, success, label, desc) {
  const indicator = el.querySelector('.indicator');
  const labelEl = el.querySelector('.status-label');
  const descEl = el.querySelector('.status-desc');

  if (success) {
    indicator.className = 'indicator active';
    el.classList.remove('failed');
  } else {
    indicator.className = 'indicator error';
    el.classList.add('failed');
  }

  labelEl.textContent = label;
  descEl.textContent = desc;
}

async function checkApiHealth() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch('/healthz', {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    updateStatusElement(statusEl, true, 'Server Status: Active', 'API Gateway is responding normally');
    return { ok: true };
  } catch (error) {
    const msg = error.name === 'AbortError' ? 'Request timed out after 8s' : error.message;
    updateStatusElement(statusEl, false, 'Server Status: Offline', msg);
    return { ok: false, service: 'Server', error: msg };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkDbStatus() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch('/db-health', {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    updateStatusElement(dbStatusEl, true, 'Database Status: Connected', 'MongoDB connection is healthy');
    return { ok: true };
  } catch (error) {
    const msg = error.name === 'AbortError' ? 'Request timed out after 8s' : error.message;
    updateStatusElement(dbStatusEl, false, 'Database Status: Error', msg);
    return { ok: false, service: 'Database', error: msg };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkAuthStatus() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch('/api/auth/health', {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    updateStatusElement(authStatusEl, true, 'Auth Service: Available', 'Authentication infrastructure is functional');
    return { ok: true };
  } catch (error) {
    const msg = error.name === 'AbortError' ? 'Request timed out after 8s' : error.message;
    updateStatusElement(authStatusEl, false, 'Auth Service: Error', msg);
    return { ok: false, service: 'Auth Service', error: msg };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkSocketStatus() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch('/socket-status', {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const data = await res.json();
    if (data.status === 'connected') {
      updateStatusElement(socketStatusEl, true, 'Socket Status: Connected', `Active connections: ${data.activeConnections}`);
      return { ok: true };
    }
    throw new Error('Socket.IO engine reported unhealthy');
  } catch (error) {
    const msg = error.name === 'AbortError' ? 'Request timed out after 8s' : error.message;
    updateStatusElement(socketStatusEl, false, 'Socket Status: Error', msg);
    return { ok: false, service: 'WebSockets', error: msg };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runChecks() {
  const results = await Promise.all([
    checkApiHealth(),
    checkDbStatus(),
    checkAuthStatus(),
    checkSocketStatus()
  ]);

  const failures = results.filter(r => !r.ok);

  if (failures.length === 0) {
    // Show only the gorgeous round green tick!
    statusContainer.style.display = 'none';
    detailsPanel.style.display = 'none';
    successScreen.style.display = 'flex';
    mainCard.style.borderColor = 'rgba(34, 197, 94, 0.4)';
    mainCard.style.boxShadow = '0 30px 100px rgba(0, 0, 0, 0.8), 0 0 60px rgba(34, 197, 94, 0.15)';
  } else {
    // Show detailed status items & diagnostic logs
    successScreen.style.display = 'none';
    statusContainer.style.display = 'flex';
    detailsPanel.style.display = 'block';
    mainCard.style.borderColor = 'rgba(239, 68, 68, 0.25)';
    mainCard.style.boxShadow = '0 30px 100px rgba(0, 0, 0, 0.8), 0 0 60px rgba(239, 68, 68, 0.05)';

    // Build user-friendly diagnostic output
    let errorLogs = '';
    failures.forEach((fail, idx) => {
      errorLogs += `[Error ${idx + 1}] Service: ${fail.service}\nDetails: ${fail.error}\n\n`;
    });
    errorLogs += `Troubleshooting:\n• Verify that MongoDB and Redis instances are running\n• Check server ports and firewalls\n• Inspect the console logs of your app process`;
    detailsEl.textContent = errorLogs;
  }
}

runChecks();
setInterval(runChecks, 15000);
