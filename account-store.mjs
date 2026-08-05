import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

const STARTING_BALANCE = 100_000;
const DAILY_BONUS = 1_000;
const AI_WIN_BONUS = 2_000;
const MAX_WAGER = 5_000;
const dataPath = process.env.ACCOUNT_DATA_PATH || join(process.cwd(), "data", "accounts.json");
const sessions = new Map();
let database = { accounts: [] };
let loaded = false;

function taipeiDay() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function passwordRecord(password) {
  const salt = randomBytes(16).toString("hex");
  return { passwordSalt: salt, passwordHash: scryptSync(password, salt, 32).toString("hex") };
}

function verifyPassword(account, password) {
  const expected = Buffer.from(account.passwordHash, "hex");
  const actual = scryptSync(password, account.passwordSalt, 32);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDisplayName(value) {
  return String(value || "").trim().slice(0, 16);
}

function publicAccount(account, bonus = 0) {
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    balance: account.balance,
    dailyClaimedToday: account.lastDailyBonusDay === taipeiDay(),
    bonus
  };
}

function addLedger(account, amount, reason, metadata = {}) {
  account.balance += amount;
  account.ledger ||= [];
  account.ledger.unshift({ id: randomUUID(), amount, reason, metadata, createdAt: Date.now(), balance: account.balance });
  account.ledger = account.ledger.slice(0, 100);
}

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const parsed = JSON.parse(await readFile(dataPath, "utf8"));
    if (Array.isArray(parsed.accounts)) database = parsed;
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Unable to read account data:", error.message);
  }
}

async function persist() {
  await mkdir(dirname(dataPath), { recursive: true });
  const tempPath = `${dataPath}.${randomBytes(6).toString("hex")}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(database, null, 2)}\n`, { mode: 0o600 });
  await rename(tempPath, dataPath);
}

function issueSession(accountId) {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, { accountId, expiresAt: Date.now() + 30 * 24 * 60 * 60_000 });
  return token;
}

function validateCredentials(username, password, displayName = null) {
  if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username)) throw new Error("帳號需為 3–24 位英數字，可使用 . _ -");
  if (String(password || "").length < 8 || String(password || "").length > 72) throw new Error("密碼需為 8–72 個字元");
  if (displayName !== null && (displayName.length < 1 || displayName.length > 16)) throw new Error("玩家名稱需為 1–16 個字元");
}

async function claimDaily(account, source) {
  const day = taipeiDay();
  if (account.lastDailyBonusDay === day) return 0;
  account.lastDailyBonusDay = day;
  addLedger(account, DAILY_BONUS, "daily_activity", { source, day });
  await persist();
  return DAILY_BONUS;
}

export async function registerAccount({ username, password, displayName }) {
  await load();
  const normalized = normalizeUsername(username);
  const name = normalizeDisplayName(displayName);
  validateCredentials(String(username || "").trim(), password, name);
  if (database.accounts.some((item) => item.usernameKey === normalized)) throw new Error("這個帳號已經有人使用");
  const account = {
    id: randomUUID(), username: String(username).trim(), usernameKey: normalized, displayName: name,
    ...passwordRecord(password), balance: STARTING_BALANCE, lastDailyBonusDay: taipeiDay(), ledger: [], aiGames: {},
    createdAt: Date.now(), updatedAt: Date.now()
  };
  database.accounts.push(account);
  await persist();
  return { token: issueSession(account.id), account: publicAccount(account) };
}

export async function loginAccount({ username, password }) {
  await load();
  const account = database.accounts.find((item) => item.usernameKey === normalizeUsername(username));
  if (!account || !verifyPassword(account, String(password || ""))) throw new Error("帳號或密碼不正確");
  const bonus = await claimDaily(account, "login");
  account.updatedAt = Date.now();
  return { token: issueSession(account.id), account: publicAccount(account, bonus) };
}

export async function accountFromRequest(req) {
  await load();
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  return database.accounts.find((item) => item.id === session.accountId) || null;
}

export async function restoreAccount(req) {
  const account = await accountFromRequest(req);
  if (!account) throw new Error("登入已失效，請重新登入");
  const bonus = await claimDaily(account, "login");
  return publicAccount(account, bonus);
}

export async function changeAccountPassword(account, currentPassword, newPassword) {
  validateCredentials(account.username, newPassword);
  if (!verifyPassword(account, String(currentPassword || ""))) throw new Error("目前密碼不正確");
  Object.assign(account, passwordRecord(newPassword), { updatedAt: Date.now() });
  await persist();
  return publicAccount(account);
}

export async function beginAiGame(account, gameType) {
  const bonus = await claimDaily(account, "game");
  const gameId = randomUUID();
  account.aiGames ||= {};
  account.aiGames[gameId] = { gameType: String(gameType || "game").slice(0, 24), settled: false, createdAt: Date.now() };
  const entries = Object.entries(account.aiGames).sort((a, b) => b[1].createdAt - a[1].createdAt).slice(0, 50);
  account.aiGames = Object.fromEntries(entries);
  await persist();
  return { gameId, account: publicAccount(account, bonus) };
}

export async function finishAiGame(account, gameId, result) {
  const game = account.aiGames?.[String(gameId || "")];
  if (!game) throw new Error("找不到這場單人遊戲");
  if (game.settled) return { reward: 0, account: publicAccount(account) };
  game.settled = true;
  game.result = ["win", "loss", "draw"].includes(result) ? result : "loss";
  game.finishedAt = Date.now();
  const reward = game.result === "win" ? AI_WIN_BONUS : 0;
  if (reward) addLedger(account, reward, "ai_win", { gameType: game.gameType, gameId });
  await persist();
  return { reward, account: publicAccount(account, reward) };
}

export function safeWager(value) {
  const amount = Number(value) || 0;
  return Number.isInteger(amount) && amount >= 0 && amount <= MAX_WAGER ? amount : 0;
}

export function canAffordWager(accountId, amount) {
  const account = database.accounts.find((item) => item.id === accountId);
  return Boolean(account && account.balance >= amount);
}

export async function settleWager(winnerId, loserId, amount, metadata = {}) {
  await load();
  const wager = safeWager(amount);
  const winner = database.accounts.find((item) => item.id === winnerId);
  const loser = database.accounts.find((item) => item.id === loserId);
  if (!wager || !winner || !loser) throw new Error("下注帳號資料不完整");
  if (loser.balance < wager) throw new Error("敗方織音幣餘額不足，無法結算");
  addLedger(loser, -wager, "player_wager_loss", metadata);
  addLedger(winner, wager, "player_wager_win", metadata);
  await persist();
  return { winner: publicAccount(winner), loser: publicAccount(loser) };
}

export async function accountLedger(account) {
  return { account: publicAccount(account), ledger: account.ledger || [] };
}

export const ECONOMY = { STARTING_BALANCE, DAILY_BONUS, AI_WIN_BONUS, MAX_WAGER };
