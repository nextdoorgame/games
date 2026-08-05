const API_BASE = (window.GOMOKU_CONFIG?.apiBaseUrl || "").replace(/\/$/, "");
const TOKEN_KEY = "neighbor-account-token";
let token = localStorage.getItem(TOKEN_KEY) || "";
let account = null;
let activeSoloGame = null;

function emit(detail = {}) {
  window.dispatchEvent(new CustomEvent("neighbor-account-change", { detail: { account, ...detail } }));
}

async function request(path, options = {}) {
  if (!API_BASE) throw new Error("線上服務尚未設定");
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "連線發生問題");
  return data;
}

function acceptSession(data) {
  token = data.token || token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  account = data.account || null;
  emit({ bonus: account?.bonus || 0 });
  return account;
}

export function authHeaders() {
  return token ? { authorization: `Bearer ${token}` } : {};
}

export function currentAccount() {
  return account;
}

export async function restoreSession() {
  if (!token) { emit(); return null; }
  try {
    const data = await request("/api/auth/me");
    return acceptSession(data);
  } catch {
    token = "";
    account = null;
    localStorage.removeItem(TOKEN_KEY);
    emit();
    return null;
  }
}

export async function register({ username, password, displayName }) {
  const data = await request("/api/auth/register", { method: "POST", body: JSON.stringify({ username, password, displayName }) });
  return acceptSession(data);
}

export async function login({ username, password }) {
  const data = await request("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
  return acceptSession(data);
}

export async function changePassword(currentPassword, newPassword) {
  const data = await request("/api/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
  account = data.account;
  emit();
  return account;
}

export function logout() {
  token = "";
  account = null;
  activeSoloGame = null;
  localStorage.removeItem(TOKEN_KEY);
  emit();
}

export async function startRewardGame(gameType) {
  activeSoloGame = null;
  if (!account) return null;
  try {
    const data = await request("/api/account/game-start", { method: "POST", body: JSON.stringify({ gameType }) });
    account = data.account;
    activeSoloGame = { id: data.gameId, gameType, settled: false };
    emit({ bonus: account?.bonus || 0 });
    return activeSoloGame;
  } catch (error) {
    emit({ error: error.message });
    return null;
  }
}

export async function finishRewardGame(result) {
  if (!account || !activeSoloGame || activeSoloGame.settled) return 0;
  activeSoloGame.settled = true;
  try {
    const data = await request("/api/account/game-result", { method: "POST", body: JSON.stringify({ gameId: activeSoloGame.id, result }) });
    account = data.account;
    emit({ reward: data.reward || 0 });
    return data.reward || 0;
  } catch (error) {
    emit({ error: error.message });
    return 0;
  }
}

export { request as accountRequest };
