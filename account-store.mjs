import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

const STARTING_BALANCE = 100_000;
const DAILY_BONUS = 1_000;
const AI_WIN_BONUS = 2_000;
const MAX_WAGER = 5_000;
const dataPath = process.env.ACCOUNT_DATA_PATH || join(process.cwd(), "data", "accounts.json");
const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const supabaseSecret = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const remoteAccountsEnabled = Boolean(supabaseUrl && supabaseSecret);
const adminUsernameKey = normalizeUsername(process.env.ADMIN_USERNAME || "nextdoorboy");
let remoteAccountsAvailable = remoteAccountsEnabled;
const sessions = new Map();
let database = { accounts: [] };
let loaded = false;
let remoteSeedRequired = false;

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseSecret,
      authorization: `Bearer ${supabaseSecret}`,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function accountFromRemote(row) {
  return {
    id: row.id,
    username: row.username,
    usernameKey: row.username_key,
    displayName: row.display_name,
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
    balance: row.balance,
    lastDailyBonusDay: row.last_daily_bonus_day || null,
    ledger: [],
    aiGames: row.ai_games || {},
    progression: row.stats || {},
    dailyTasks: row.daily_tasks || [],
    achievements: row.achievements || [],
    createdAt: Date.parse(row.created_at) || Date.now(),
    updatedAt: Date.parse(row.updated_at) || Date.now()
  };
}

function accountForRemote(account) {
  return {
    id: account.id,
    username: account.username,
    username_key: account.usernameKey,
    display_name: account.displayName,
    password_salt: account.passwordSalt,
    password_hash: account.passwordHash,
    balance: account.balance,
    last_daily_bonus_day: account.lastDailyBonusDay || null,
    ai_games: account.aiGames || {},
    stats: account.progression || {},
    daily_tasks: account.dailyTasks || [],
    achievements: account.achievements || [],
    created_at: new Date(account.createdAt || Date.now()).toISOString(),
    updated_at: new Date(account.updatedAt || Date.now()).toISOString()
  };
}

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
    level: account.progression?.level || 1,
    xp: account.progression?.xp || 0,
    dailyClaimedToday: account.lastDailyBonusDay === taipeiDay(),
    bonus
  };
}

function levelNeed(level) { return 100 + (level - 1) * 75; }
function taskSet(account) {
  const day = taipeiDay();
  if (account.dailyTasks?.day === day) return account.dailyTasks;
  account.dailyTasks = { day, tasks: [
    { id: "play-3", label: "玩 3 場遊戲", target: 3, progress: 0, reward: 800, xp: 35, claimed: false, type: "games" },
    { id: "win-1", label: "贏得 1 場單人遊戲", target: 1, progress: 0, reward: 1200, xp: 50, claimed: false, type: "wins" },
    { id: "variety-2", label: "遊玩 2 種不同遊戲", target: 2, progress: 0, reward: 1000, xp: 45, claimed: false, type: "variety" }
  ] };
  return account.dailyTasks;
}
function progression(account) { account.progression ||= { xp: 0, level: 1, streak: 0, lastCheckinDay: null, games: 0, wins: 0, gameTypes: [] }; return account.progression; }
function addXp(account, amount) { const p = progression(account); p.xp += amount; let levels = 0; while (p.xp >= levelNeed(p.level)) { p.xp -= levelNeed(p.level); p.level += 1; levels += 1; addLedger(account, 500 * p.level, "level_up", { level: p.level }); } return levels; }
function updateTasks(account, gameType, won) { const p = progression(account), daily = taskSet(account); p.games += 1; if (won) p.wins += 1; p.gameTypes = [...new Set([...(p.gameTypes || []), gameType])].slice(-20); daily.tasks.forEach((task) => { if (task.claimed) return; const value = task.type === "games" ? p.games : task.type === "wins" ? p.wins : new Set(p.gameTypes).size; task.progress = Math.min(task.target, value); }); }
function achievementSet(account) { const p = progression(account); const defs = [{ id:"first-login",label:"初次登入",target:1,reward:500,xp:20,ready:true },{ id:"games-10",label:"遊玩 10 場",target:10,reward:1200,xp:50,ready:p.games>=10 },{ id:"games-100",label:"遊玩 100 場",target:100,reward:5000,xp:200,ready:p.games>=100 },{ id:"coins-10k",label:"累積獲得 10,000 織音幣",target:10000,reward:2000,xp:80,ready:account.balance>=110000 },{ id:"level-5",label:"達到等級 5",target:5,reward:3000,xp:120,ready:p.level>=5 }]; account.achievements ||= []; return defs.map((d)=>({...d,claimed:account.achievements.includes(d.id)})); }

function adminAccount(account) {
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    balance: account.balance,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt
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
  if (remoteAccountsEnabled) {
    try {
      const rows = await supabaseRequest("game_accounts?select=*&order=created_at.asc");
      if (Array.isArray(rows) && rows.length) {
        database = { accounts: rows.map(accountFromRemote) };
        return;
      }
      remoteSeedRequired = true;
    } catch (error) {
      remoteAccountsAvailable = false;
      console.error("Unable to read Supabase account data; using local fallback:", error.message);
    }
  }
  try {
    const parsed = JSON.parse(await readFile(dataPath, "utf8"));
    if (Array.isArray(parsed.accounts)) database = parsed;
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Unable to read account data:", error.message);
  }
  if (remoteSeedRequired && database.accounts.length) await persist();
}

async function persist() {
  if (remoteAccountsAvailable) {
    try {
      await supabaseRequest("game_accounts?on_conflict=id", {
        method: "POST",
        headers: { prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(database.accounts.map(accountForRemote))
      });
      return;
    } catch (error) {
      remoteAccountsAvailable = false;
      console.error("Unable to write Supabase account data; using local fallback:", error.message);
    }
  }
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
  updateTasks(account, game.gameType, game.result === "win");
  await persist();
  return { reward, account: publicAccount(account, reward) };
}

export async function playerProgress(account) { await load(); return { account: publicAccount(account), checkin: { day: taipeiDay(), streak: progression(account).streak || 0, claimed: progression(account).lastCheckinDay === taipeiDay() }, tasks: taskSet(account).tasks, achievements: achievementSet(account), nextLevelXp: levelNeed(progression(account).level) }; }
export async function claimCheckin(account) { const p = progression(account), day = taipeiDay(); if (p.lastCheckinDay === day) throw new Error("今天已完成簽到"); const previous = new Date(`${p.lastCheckinDay || "1970-01-01"}T00:00:00+08:00`), today = new Date(`${day}T00:00:00+08:00`); p.streak = Math.round((today - previous) / 86400000) === 1 ? Math.min(7, p.streak + 1) : 1; p.lastCheckinDay = day; const reward = [1000,1200,1500,1800,2200,2800,4000][p.streak - 1]; addLedger(account,reward,"daily_checkin",{day,streak:p.streak}); addXp(account,50); await persist(); return { reward, account: publicAccount(account), progress: await playerProgress(account) }; }
export async function claimProgressReward(account, type, id) { const list = type === "task" ? taskSet(account).tasks : achievementSet(account); const item = list.find((entry)=>entry.id===id); if (!item || item.claimed || (type === "task" && item.progress < item.target) || (type === "achievement" && !item.ready)) throw new Error("此獎勵目前無法領取"); if (type === "task") item.claimed=true; else account.achievements.push(item.id); addLedger(account,item.reward,`${type}_reward`,{id}); addXp(account,item.xp); await persist(); return playerProgress(account); }

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

export function isAdministrator(account) {
  return Boolean(account && adminUsernameKey && account.usernameKey === adminUsernameKey);
}

export async function listAccountsForAdmin() {
  await load();
  return database.accounts.map(adminAccount).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function adjustAccountBalance(targetId, amount, reason = "admin_adjustment") {
  await load();
  const delta = Number(amount);
  if (!Number.isInteger(delta) || !delta || Math.abs(delta) > 1_000_000) throw new Error("調整金額需為非零整數，單次上限 1,000,000");
  const target = database.accounts.find((item) => item.id === String(targetId || ""));
  if (!target) throw new Error("找不到帳號");
  if (target.balance + delta < 0) throw new Error("調整後織音幣不可小於 0");
  addLedger(target, delta, String(reason || "admin_adjustment").slice(0, 60), { source: "admin" });
  target.updatedAt = Date.now();
  await persist();
  return publicAccount(target);
}

export async function deleteAccountForAdmin(targetId, adminId) {
  await load();
  const index = database.accounts.findIndex((item) => item.id === String(targetId || ""));
  if (index < 0) throw new Error("找不到帳號");
  if (database.accounts[index].id === adminId) throw new Error("不可刪除目前登入的管理員帳號");
  const target = database.accounts[index];
  if (remoteAccountsAvailable) {
    await supabaseRequest(`game_accounts?id=eq.${encodeURIComponent(target.id)}`, { method: "DELETE", headers: { prefer: "return=minimal" } });
  }
  database.accounts.splice(index, 1);
  if (!remoteAccountsAvailable) await persist();
  return adminAccount(target);
}

export const ECONOMY = { STARTING_BALANCE, DAILY_BONUS, AI_WIN_BONUS, MAX_WAGER };
