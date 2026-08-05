const STORAGE_KEY = "gomoku-player-id";
const DEVICE_KEY = "neighbor-device-id";
const LEASE_PREFIX = "neighbor-player-lease:";
const LEASE_TTL = 6_000;
const instanceId = crypto.randomUUID();
let playerId = sessionStorage.getItem(STORAGE_KEY) || crypto.randomUUID();
const deviceId = localStorage.getItem(DEVICE_KEY) || crypto.randomUUID();
localStorage.setItem(DEVICE_KEY, deviceId);

function readLease(id) {
  try { return JSON.parse(localStorage.getItem(`${LEASE_PREFIX}${id}`) || "null"); }
  catch { return null; }
}

function writeLease(id) {
  localStorage.setItem(`${LEASE_PREFIX}${id}`, JSON.stringify({ instanceId, seenAt: Date.now() }));
}

async function claim(id) {
  const existing = readLease(id);
  if (existing && existing.instanceId !== instanceId && Date.now() - existing.seenAt < LEASE_TTL) return false;
  writeLease(id);
  await new Promise((resolve) => setTimeout(resolve, 80 + Math.floor(Math.random() * 40)));
  return readLease(id)?.instanceId === instanceId;
}

if (!await claim(playerId)) {
  playerId = crypto.randomUUID();
  writeLease(playerId);
}

sessionStorage.setItem(STORAGE_KEY, playerId);
document.documentElement.dataset.playerId = playerId;
const heartbeat = window.setInterval(() => writeLease(playerId), 2_000);

function releaseIdentity() {
  window.clearInterval(heartbeat);
  if (readLease(playerId)?.instanceId === instanceId) localStorage.removeItem(`${LEASE_PREFIX}${playerId}`);
}
window.addEventListener("pagehide", releaseIdentity, { once: true });

export { deviceId, playerId };
