import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { applyXiangqiMove, createInitialXiangqiBoard, getXiangqiLegalMoves, getXiangqiWinner, otherXiangqiColor } from "./src/xiangqi.js";
import { accountFromRequest, accountLedger, beginAiGame, canAffordWager, changeAccountPassword, finishAiGame, loginAccount, registerAccount, restoreAccount, safeWager, settleWager } from "./account-store.mjs";

const defaultRoot = process.cwd();
const BOARD_SIZE = 19;
const BLACK = 1;
const WHITE = 2;
// Background tabs and mobile browsers throttle timers aggressively. Keep players
// visible long enough for an invitation to be accepted even when the lobby tab
// is not currently focused.
const PLAYER_TTL = 60_000;
const INVITE_TTL = 5 * 60_000;
const TURN_TIME_OPTIONS = new Set([1, 3, 5, 10]);
const MAX_CHAT_LENGTH = 200;
const MAX_CHAT_MESSAGES = 100;
const MAX_ROOM_PASSWORD_LENGTH = 32;

const players = new Map();
const invites = new Map();
const games = new Map();
const rooms = new Map();
const ROOM_GAME_TYPES = new Set(["gomoku", "xiangqi", "reversi", "checkers", "mahjong", "bigtwo", "banqi", "chess", "go", "blackjack", "pickred", "ninetynine", "tetris", "volleyball", "racing", "brickbreaker"]);
const DUEL_ROOM_TYPES = new Set(["gomoku", "xiangqi"]);
const TABLE_ROOM_TYPES = new Set(["reversi", "checkers", "mahjong", "bigtwo", "banqi", "chess", "go", "blackjack", "pickred", "ninetynine"]);
const ROOM_PLAYER_LIMITS = {
  gomoku: [2], xiangqi: [2], reversi: [2], checkers: [2, 3], mahjong: [1, 2, 3, 4], bigtwo: [3, 4, 5],
  banqi: [2], chess: [2], go: [2], blackjack: [3, 4, 5], pickred: [3, 4, 5], ninetynine: [3, 4, 5], tetris: [2], volleyball: [2], racing: [2], brickbreaker: [2]
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".data": "application/octet-stream",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": process.env.ALLOWED_ORIGIN || "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization"
  });
  res.end(JSON.stringify(body));
}

function safePath(urlPath, rootDir) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = normalize(cleanPath === "/" ? "/index.html" : cleanPath);
  if (normalized.includes("..")) return null;
  return join(rootDir, normalized);
}

async function readJson(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 120_000) throw new Error("Request too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function cleanupLobby() {
  const cutoff = Date.now() - PLAYER_TTL;
  for (const [id, player] of players) {
    if (player.seenAt < cutoff) players.delete(id);
  }
  const inviteCutoff = Date.now() - INVITE_TTL;
  for (const [id, invite] of invites) {
    if (invite.createdAt < inviteCutoff || invite.status === "declined") {
      const abandonedRoom = rooms.get(invite.roomId);
      const hasOtherPendingInvite = [...invites.values()].some((other) => other.id !== id && other.roomId === invite.roomId && other.status === "pending");
      if (invite.status === "pending" && abandonedRoom?.players.length === 1 && !hasOtherPendingInvite) rooms.delete(invite.roomId);
      invites.delete(id);
    }
  }
  const roomCutoff = Date.now() - 2 * 60 * 60_000;
  for (const [id, room] of rooms) if (room.updatedAt < roomCutoff) rooms.delete(id);
}

function publicRoom(room) {
  return {
    id: room.id,
    gameType: room.gameType,
    name: room.name,
    maxPlayers: room.maxPlayers,
    aiFill: room.aiFill,
    status: room.status,
    players: room.players.map(({ id, name }) => ({ id, name })),
    hostId: room.players[0]?.id || null,
    gameId: room.gameId || null,
    launchAt: room.launchAt || null,
    launchConfig: room.launchConfig || null,
    hasPassword: Boolean(room.passwordHash),
    wager: room.wager || 0,
    wagerResult: room.wagerResult || null,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt
  };
}

function normalizeRoomPassword(value) {
  return String(value || "").trim().slice(0, MAX_ROOM_PASSWORD_LENGTH);
}

function createPasswordRecord(value) {
  const password = normalizeRoomPassword(value);
  if (!password) return { passwordSalt: null, passwordHash: null };
  const passwordSalt = randomBytes(16).toString("hex");
  return { passwordSalt, passwordHash: scryptSync(password, passwordSalt, 32).toString("hex") };
}

function verifyRoomPassword(room, value) {
  if (!room.passwordHash || !room.passwordSalt) return true;
  const password = normalizeRoomPassword(value);
  if (!password) return false;
  const expected = Buffer.from(room.passwordHash, "hex");
  const actual = scryptSync(password, room.passwordSalt, 32);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function createRoomRecord({ gameType, name, maxPlayers, host, matchConfig = null, password = "", wager = 0 }) {
  const passwordRecord = createPasswordRecord(password);
  return {
    id: randomUUID(), gameType, name, maxPlayers, aiFill: false,
    status: maxPlayers === 1 ? "full" : "waiting", players: [host],
    snapshots: gameType === "tetris" ? new Map() : null,
    arcadeInputs: ["volleyball", "racing", "brickbreaker"].includes(gameType) ? new Map() : null,
    arcadeActionUntil: ["volleyball", "racing", "brickbreaker"].includes(gameType) ? new Map() : null,
    arcadeSnapshot: null, tableState: null, tableRevision: 0,
    matchConfig, wager: maxPlayers === 2 ? safeWager(wager) : 0, wagerSettled: false, wagerResult: null,
    ...passwordRecord, launchAt: null, launchConfig: null, gameId: null,
    createdAt: Date.now(), updatedAt: Date.now()
  };
}

function roomWagerReady(room) {
  if (!room.wager) return { ready: true };
  if (room.players.length !== 2 || room.players.some((player) => !player.accountId)) return { ready: false, error: "織音幣對戰需要兩位玩家都先登入" };
  if (room.players.some((player) => !canAffordWager(player.accountId, room.wager))) return { ready: false, error: "有玩家的織音幣餘額不足" };
  return { ready: true };
}

async function settleRoomWager(room, winnerSeat) {
  if (!room?.wager || room.wagerSettled || !Number.isInteger(winnerSeat) || winnerSeat < 0 || winnerSeat > 1) return;
  const winner = room.players[winnerSeat];
  const loser = room.players[winnerSeat === 0 ? 1 : 0];
  try {
    await settleWager(winner.accountId, loser.accountId, room.wager, { roomId: room.id, gameType: room.gameType });
    room.wagerResult = { status: "settled", winnerName: winner.name, amount: room.wager };
  } catch (error) {
    room.wagerResult = { status: "failed", message: error.message };
  }
  room.wagerSettled = true;
  room.updatedAt = Date.now();
}

async function settleDuelRoom(game) {
  if (!game?.seriesWinnerId) return;
  const room = [...rooms.values()].find((candidate) => candidate.gameId === game.id);
  if (!room) return;
  const winnerSeat = room.players.findIndex((player) => player.id === game.seriesWinnerId);
  await settleRoomWager(room, winnerSeat);
}

function tableWinnerSeat(state, gameType) {
  if (!state) return null;
  if (gameType === "chess") return state.winner === "white" ? 0 : state.winner === "black" ? 1 : null;
  if (gameType === "reversi" && state.finished && Array.isArray(state.board)) {
    const dark = state.board.filter((piece) => piece === 1).length;
    const light = state.board.filter((piece) => piece === 2).length;
    return dark === light ? null : dark > light ? 0 : 1;
  }
  if (gameType === "go") return [1, 2].includes(Number(state.winner)) ? Number(state.winner) - 1 : null;
  if (gameType === "checkers") return Number(state.winner) > 0 ? Number(state.winner) - 1 : null;
  return Number.isInteger(state.winner) && state.winner >= 0 ? state.winner : null;
}

function roomCanStart(room) {
  if (room.players.length >= room.maxPlayers) return true;
  return room.maxPlayers >= 3 && room.players.length >= 2 && room.aiFill;
}

function safeLaunchConfig(value, room) {
  const difficulty = ["easy", "medium", "hard"].includes(value?.difficulty) ? value.difficulty : "medium";
  const speed = ["slow", "normal", "fast", "extreme"].includes(value?.speed) ? value.speed : "normal";
  const arcadeMode = room.gameType === "brickbreaker" && ["coop", "versus"].includes(value?.arcadeMode) ? value.arcadeMode : room.gameType === "brickbreaker" ? "coop" : "classic";
  return { players: room.maxPlayers, difficulty, speed, arcadeMode };
}

function ensureRoomLaunched(room) {
  if (room.status !== "starting" || !room.launchAt || Date.now() < room.launchAt) return room;
  if (DUEL_ROOM_TYPES.has(room.gameType) && !room.gameId) {
    const match = room.matchConfig || {};
    const game = createOnlineMatch({
      gameType: room.gameType,
      playerOne: room.players[0],
      playerTwo: room.players[1],
      playerOneColor: match.inviterColor === "white" ? WHITE : BLACK,
      bestOf: match.bestOf,
      turnTimeMinutes: match.turnTimeMinutes
    });
    room.gameId = game.id;
  }
  room.status = "playing";
  room.updatedAt = Date.now();
  return room;
}

function activeRoomFor(playerId) {
  return [...rooms.values()]
    .filter((room) => room.players.some((player) => player.id === playerId))
    .map(ensureRoomLaunched)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
}

function clearRoomInvites(roomId) {
  for (const [inviteId, invite] of invites) if (invite.roomId === roomId) invites.delete(inviteId);
}

async function leaveRoom(room, playerId) {
  const seat = room?.players.findIndex((player) => player.id === playerId) ?? -1;
  if (!room || seat < 0) return false;

  // Once a synchronized match has begun, seat numbers are part of its state.
  // Closing that room releases every participant and avoids shifting a player
  // into another seat halfway through a board, card, or arcade game.
  if (["starting", "playing"].includes(room.status)) {
    const opponentSeat = room.players.length === 2 ? (seat === 0 ? 1 : 0) : -1;
    if (opponentSeat >= 0) await settleRoomWager(room, opponentSeat);
    const linkedGame = room.gameId ? games.get(room.gameId) : null;
    if (linkedGame && linkedGame.matchStatus !== "closed") {
      const opponent = linkedGame.players.find((player) => player.id !== playerId);
      if (linkedGame.status === "playing" && opponent) {
        linkedGame.status = "finished";
        linkedGame.winner = opponent.color;
      }
      linkedGame.matchStatus = "closed";
      linkedGame.rematchDeclinedBy = playerId;
      linkedGame.turnStartedAt = null;
      linkedGame.revision += 1;
      linkedGame.updatedAt = Date.now();
    }
    clearRoomInvites(room.id);
    rooms.delete(room.id);
    return true;
  }

  room.players.splice(seat, 1);
  room.aiFill = false;
  room.launchAt = null;
  room.launchConfig = null;
  room.updatedAt = Date.now();
  if (!room.players.length) {
    clearRoomInvites(room.id);
    rooms.delete(room.id);
  } else {
    room.status = room.players.length >= room.maxPlayers ? "full" : "waiting";
    for (const [inviteId, invite] of invites) {
      if (invite.roomId === room.id && (invite.fromId === playerId || invite.toId === playerId)) invites.delete(inviteId);
    }
  }
  return true;
}

function safeTetrisSnapshot(value) {
  if (!value || !Array.isArray(value.board) || value.board.length !== 20) return null;
  const board = value.board.map((row) => Array.isArray(row) && row.length === 10 ? row.map((cell) => Math.max(0, Math.min(7, Number(cell) || 0))) : null);
  if (board.some((row) => !row)) return null;
  const next = Array.isArray(value.next) && value.next.length === 4
    ? value.next.map((row) => Array.isArray(row) && row.length === 4 ? row.map((cell) => Math.max(0, Math.min(7, Number(cell) || 0))) : null)
    : Array.from({ length: 4 }, () => Array(4).fill(0));
  if (next.some((row) => !row)) return null;
  return {
    board,
    next,
    score: Math.max(0, Math.min(10_000_000, Number(value.score) || 0)),
    lines: Math.max(0, Math.min(100_000, Number(value.lines) || 0)),
    gameOver: Boolean(value.gameOver),
    paused: Boolean(value.paused),
    updatedAt: Date.now()
  };
}

function safeArcadeInput(value) {
  return { left: Boolean(value?.left), right: Boolean(value?.right), up: Boolean(value?.up), down: Boolean(value?.down), action: Boolean(value?.action) };
}

function safeArcadeSnapshot(value, gameType) {
  if (!value || value.type !== gameType || !Array.isArray(value.players) || value.players.length !== 2) return null;
  try {
    if (JSON.stringify(value).length > 50_000) return null;
    return structuredClone(value);
  } catch { return null; }
}

function safeTableSnapshot(value, gameType) {
  if (!value || value.game !== gameType) return null;
  try {
    if (JSON.stringify(value).length > 95_000) return null;
    return structuredClone(value);
  } catch { return null; }
}

function tableTurnSeat(state, gameType) {
  if (gameType === "reversi" || gameType === "go") return Number(state.turn) - 1;
  if (gameType === "chess") return state.turn === "white" ? 0 : state.turn === "black" ? 1 : -1;
  return Number(state.turn);
}

function activeGameFor(playerId) {
  return [...games.values()]
    .filter((game) => game.matchStatus === "active" && game.players.some((player) => player.id === playerId))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

function createOnlineMatch({ gameType = "gomoku", playerOne, playerTwo, playerOneColor = BLACK, bestOf = 3, turnTimeMinutes = 3 }) {
  const normalizedBestOf = bestOf === 5 ? 5 : 3;
  const game = {
    id: randomUUID(),
    gameType: gameType === "xiangqi" ? "xiangqi" : "gomoku",
    board: initialBoard(gameType),
    moves: [],
    players: [
      { id: playerOne.id, name: playerOne.name, color: playerOneColor },
      { id: playerTwo.id, name: playerTwo.name, color: playerOneColor === BLACK ? WHITE : BLACK }
    ],
    turn: BLACK,
    status: "playing",
    winner: 0,
    winLine: [],
    bestOf: normalizedBestOf,
    targetWins: normalizedBestOf === 5 ? 3 : 2,
    round: 1,
    scores: { [playerOne.id]: 0, [playerTwo.id]: 0 },
    seriesWinnerId: null,
    rematchRequests: [],
    matchStatus: "active",
    rematchDeclinedBy: null,
    messages: [],
    turnTimeMinutes,
    turnTimeMs: turnTimeMinutes * 60_000,
    turnStartedAt: Date.now(),
    revision: 0,
    updatedAt: Date.now()
  };
  games.set(game.id, game);
  return game;
}

function winningLine(board, index, color) {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  for (const [dr, dc] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const line = [index];
    for (const sign of [-1, 1]) {
      for (let step = 1; step < 5; step += 1) {
        const r = row + dr * step * sign;
        const c = col + dc * step * sign;
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r * BOARD_SIZE + c] !== color) break;
        sign < 0 ? line.unshift(r * BOARD_SIZE + c) : line.push(r * BOARD_SIZE + c);
      }
    }
    if (line.length >= 5) return line;
  }
  return [];
}

function initialBoard(gameType) {
  return gameType === "xiangqi" ? createInitialXiangqiBoard() : Array(BOARD_SIZE * BOARD_SIZE).fill(0);
}

function applyGameMove(game, move, color, { automatic = false, now = Date.now() } = {}) {
  if (game.gameType === "xiangqi") {
    const captured = game.board[move.to];
    game.board = applyXiangqiMove(game.board, move);
    game.moves.push({ ...move, piece: game.board[move.to], captured, color, automatic });
    game.winLine = [];
    const nextTurn = otherXiangqiColor(color);
    game.winner = getXiangqiWinner(game.board, nextTurn);
    if (game.winner) game.status = "finished";
    else game.turn = nextTurn;
  } else {
    const index = Number(move);
    game.board[index] = color;
    game.moves.push({ index, color, automatic });
    game.winLine = winningLine(game.board, index, color);
    if (game.winLine.length) {
      game.status = "finished";
      game.winner = color;
    } else if (game.moves.length === BOARD_SIZE * BOARD_SIZE) {
      game.status = "finished";
    } else {
      game.turn = color === BLACK ? WHITE : BLACK;
    }
  }
  if (game.status === "finished" && game.winner) {
    const winner = game.players.find((player) => player.color === game.winner);
    if (winner) {
      game.scores[winner.id] += 1;
      if (game.scores[winner.id] >= game.targetWins) game.seriesWinnerId = winner.id;
    }
  }
  game.revision += 1;
  game.updatedAt = now;
  game.turnStartedAt = game.status === "playing" ? now : null;
}

export function applyExpiredTurn(game, now = Date.now(), random = Math.random) {
  if (game.status !== "playing" || !game.turnTimeMs || !game.turnStartedAt) return false;
  if (now < game.turnStartedAt + game.turnTimeMs) return false;
  const choices = game.gameType === "xiangqi"
    ? getXiangqiLegalMoves(game.board, game.turn)
    : game.board.map((stone, index) => stone ? null : index).filter((index) => index !== null);
  if (!choices.length) return false;
  const randomIndex = Math.min(choices.length - 1, Math.floor(random() * choices.length));
  applyGameMove(game, choices[randomIndex], game.turn, { automatic: true, now });
  return true;
}

function publicGame(game) {
  return {
    id: game.id,
    gameType: game.gameType,
    boardSize: game.gameType === "xiangqi" ? { rows: 10, cols: 9 } : BOARD_SIZE,
    board: game.board,
    moves: game.moves,
    players: game.players,
    turn: game.turn,
    status: game.status,
    winner: game.winner,
    winLine: game.winLine,
    bestOf: game.bestOf,
    targetWins: game.targetWins,
    round: game.round,
    scores: game.scores,
    seriesWinnerId: game.seriesWinnerId,
    rematchRequests: game.rematchRequests,
    matchStatus: game.matchStatus,
    rematchDeclinedBy: game.rematchDeclinedBy,
    messages: game.messages,
    turnTimeMinutes: game.turnTimeMinutes,
    turnTimeMs: game.turnTimeMs,
    turnStartedAt: game.turnStartedAt,
    revision: game.revision,
    updatedAt: game.updatedAt,
    serverTime: Date.now()
  };
}

function resetRound(game, restartSeries) {
  game.players.forEach((player) => {
    player.color = player.color === BLACK ? WHITE : BLACK;
  });
  if (restartSeries) {
    game.scores = Object.fromEntries(game.players.map((player) => [player.id, 0]));
    game.round = 1;
    game.seriesWinnerId = null;
  } else {
    game.round += 1;
  }
  game.board = initialBoard(game.gameType);
  game.moves = [];
  game.turn = BLACK;
  game.status = "playing";
  game.winner = 0;
  game.winLine = [];
  game.rematchRequests = [];
  game.rematchDeclinedBy = null;
  game.revision += 1;
  game.updatedAt = Date.now();
  game.turnStartedAt = game.updatedAt;
}

async function handleApi(req, res, url) {
  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    try {
      const body = await readJson(req);
      return sendJson(res, 201, await registerAccount(body));
    } catch (error) { return sendJson(res, 400, { error: error.message }); }
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    try {
      const body = await readJson(req);
      return sendJson(res, 200, await loginAccount(body));
    } catch (error) { return sendJson(res, 401, { error: error.message }); }
  }

  if (req.method === "GET" && url.pathname === "/api/auth/me") {
    try { return sendJson(res, 200, { account: await restoreAccount(req) }); }
    catch (error) { return sendJson(res, 401, { error: error.message }); }
  }

  if (req.method === "POST" && url.pathname === "/api/auth/change-password") {
    const account = await accountFromRequest(req);
    if (!account) return sendJson(res, 401, { error: "請先登入" });
    try {
      const body = await readJson(req);
      return sendJson(res, 200, { account: await changeAccountPassword(account, body.currentPassword, body.newPassword) });
    } catch (error) { return sendJson(res, 400, { error: error.message }); }
  }

  if (req.method === "GET" && url.pathname === "/api/account/ledger") {
    const account = await accountFromRequest(req);
    if (!account) return sendJson(res, 401, { error: "請先登入" });
    return sendJson(res, 200, await accountLedger(account));
  }

  if (req.method === "POST" && url.pathname === "/api/account/game-start") {
    const account = await accountFromRequest(req);
    if (!account) return sendJson(res, 401, { error: "請先登入後領取遊戲獎勵" });
    const body = await readJson(req);
    return sendJson(res, 201, await beginAiGame(account, body.gameType));
  }

  if (req.method === "POST" && url.pathname === "/api/account/game-result") {
    const account = await accountFromRequest(req);
    if (!account) return sendJson(res, 401, { error: "請先登入" });
    try {
      const body = await readJson(req);
      return sendJson(res, 200, await finishAiGame(account, body.gameId, body.result));
    } catch (error) { return sendJson(res, 400, { error: error.message }); }
  }

  if (req.method === "GET" && url.pathname === "/api/rooms") {
    cleanupLobby();
    const gameType = ROOM_GAME_TYPES.has(url.searchParams.get("gameType")) ? url.searchParams.get("gameType") : "gomoku";
    return sendJson(res, 200, { gameType, rooms: [...rooms.values()].filter((room) => room.gameType === gameType).map(ensureRoomLaunched).sort((a, b) => b.updatedAt - a.updatedAt).map(publicRoom) });
  }

  if (req.method === "POST" && url.pathname === "/api/rooms") {
    const body = await readJson(req);
    const account = await accountFromRequest(req);
    const gameType = ROOM_GAME_TYPES.has(body.gameType) ? body.gameType : "gomoku";
    const allowed = ROOM_PLAYER_LIMITS[gameType];
    const maxPlayers = allowed.includes(Number(body.maxPlayers)) ? Number(body.maxPlayers) : allowed.at(-1);
    const hostId = String(body.hostId || "").trim();
    const hostDeviceId = String(body.hostDeviceId || "").trim();
    const hostName = String(body.hostName || "棋手").trim().slice(0, 16);
    if (!hostId) return sendJson(res, 400, { error: "缺少房主資料" });
    const wager = maxPlayers === 2 ? safeWager(body.wager) : 0;
    if (wager && !account) return sendJson(res, 401, { error: "下注房需要房主先登入" });
    if (wager && !canAffordWager(account.id, wager)) return sendJson(res, 409, { error: "織音幣餘額不足" });
    const room = createRoomRecord({
      gameType,
      name: String(body.name || `${hostName}的房間`).trim().slice(0, 16),
      maxPlayers,
      host: { id: hostId, deviceId: hostDeviceId, name: account?.displayName || hostName, accountId: account?.id || null },
      password: body.password,
      wager
    });
    rooms.set(room.id, room);
    return sendJson(res, 201, publicRoom(room));
  }

  if (req.method === "POST" && url.pathname === "/api/rooms/leave-active") {
    const body = await readJson(req);
    const playerId = String(body.playerId || "").trim();
    if (!playerId) return sendJson(res, 400, { error: "缺少玩家資料" });
    const room = activeRoomFor(playerId);
    if (room) await leaveRoom(room, playerId);
    return sendJson(res, 200, { left: Boolean(room), roomId: room?.id || null });
  }

  const roomLeaveMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/leave$/);
  if (req.method === "POST" && roomLeaveMatch) {
    const body = await readJson(req);
    const playerId = String(body.playerId || "").trim();
    if (!playerId) return sendJson(res, 400, { error: "缺少玩家資料" });
    const room = rooms.get(roomLeaveMatch[1]);
    if (room) await leaveRoom(room, playerId);
    return sendJson(res, 200, { left: Boolean(room), roomId: room?.id || null });
  }

  const roomDetailMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)$/);
  if (req.method === "GET" && roomDetailMatch) {
    const room = rooms.get(roomDetailMatch[1]);
    if (!room) return sendJson(res, 404, { error: "房間已關閉" });
    ensureRoomLaunched(room);
    return sendJson(res, 200, publicRoom(room));
  }

  const roomJoinMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/join$/);
  if (req.method === "POST" && roomJoinMatch) {
    const room = rooms.get(roomJoinMatch[1]);
    if (!room) return sendJson(res, 404, { error: "房間已關閉" });
    const body = await readJson(req);
    const playerId = String(body.playerId || "").trim();
    const deviceId = String(body.deviceId || "").trim();
    const account = await accountFromRequest(req);
    const playerName = account?.displayName || String(body.playerName || "棋手").trim().slice(0, 16);
    if (!playerId) return sendJson(res, 400, { error: "缺少玩家資料" });
    ensureRoomLaunched(room);
    const existingPlayer = room.players.find((player) => player.id === playerId || deviceId && player.deviceId === deviceId);
    if (existingPlayer) {
      existingPlayer.id = playerId;
      existingPlayer.deviceId = deviceId;
      existingPlayer.name = playerName;
      existingPlayer.accountId = account?.id || existingPlayer.accountId || null;
    } else {
      if (!verifyRoomPassword(room, body.password)) return sendJson(res, 401, { error: "房間密碼不正確" });
      if (["starting", "playing"].includes(room.status)) return sendJson(res, 409, { error: "這個房間已經開始遊戲" });
      if (room.aiFill) return sendJson(res, 409, { error: "剩餘座位已由 AI 補滿" });
      if (room.players.length >= room.maxPlayers) return sendJson(res, 409, { error: "房間已滿" });
      if (room.wager && !account) return sendJson(res, 401, { error: "下注房需要先登入才能加入" });
      if (room.wager && !canAffordWager(account.id, room.wager)) return sendJson(res, 409, { error: "織音幣餘額不足" });
      room.players.push({ id: playerId, deviceId, name: playerName, accountId: account?.id || null });
    }
    room.status = room.players.length >= room.maxPlayers ? "full" : room.aiFill ? "ready" : "waiting";
    room.updatedAt = Date.now();
    return sendJson(res, 200, publicRoom(room));
  }

  const roomAiFillMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/ai-fill$/);
  if (req.method === "POST" && roomAiFillMatch) {
    const room = rooms.get(roomAiFillMatch[1]);
    if (!room) return sendJson(res, 404, { error: "房間已關閉" });
    const body = await readJson(req);
    const playerId = String(body.playerId || "").trim();
    if (!room.players.some((player) => player.id === playerId)) return sendJson(res, 403, { error: "你不在這個房間中" });
    if (["starting", "playing"].includes(room.status)) return sendJson(res, 409, { error: "遊戲已經開始，不能變更 AI 座位" });
    if (room.maxPlayers < 3) return sendJson(res, 400, { error: "這個房間沒有可補的多人座位" });
    if (room.players.length < 2) return sendJson(res, 409, { error: "請先等第二位真人玩家加入" });
    room.aiFill = Boolean(body.aiFill) && room.players.length < room.maxPlayers;
    room.status = room.players.length >= room.maxPlayers ? "full" : room.aiFill ? "ready" : "waiting";
    room.updatedAt = Date.now();
    return sendJson(res, 200, publicRoom(room));
  }

  const roomStartMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/start$/);
  if (req.method === "POST" && roomStartMatch) {
    const room = rooms.get(roomStartMatch[1]);
    if (!room) return sendJson(res, 404, { error: "房間已關閉" });
    const body = await readJson(req);
    const playerId = String(body.playerId || "").trim();
    if (room.players[0]?.id !== playerId) return sendJson(res, 403, { error: "只有房主可以開始遊戲" });
    ensureRoomLaunched(room);
    if (room.status === "starting" || room.status === "playing") return sendJson(res, 200, publicRoom(room));
    if (!roomCanStart(room)) return sendJson(res, 409, { error: "請等待玩家到齊，或先使用 AI 補滿空位" });
    const wagerState = roomWagerReady(room);
    if (!wagerState.ready) return sendJson(res, 409, { error: wagerState.error });
    room.launchConfig = safeLaunchConfig(body.config, room);
    room.launchAt = Date.now() + 5_000;
    room.status = "starting";
    room.updatedAt = Date.now();
    return sendJson(res, 200, publicRoom(room));
  }

  const tableRoomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/table$/);
  if (req.method === "POST" && tableRoomMatch) {
    const room = rooms.get(tableRoomMatch[1]);
    if (!room || !TABLE_ROOM_TYPES.has(room.gameType)) return sendJson(res, 404, { error: "多人牌局房間已關閉" });
    const body = await readJson(req);
    const playerId = String(body.playerId || "").trim();
    const seat = room.players.findIndex((player) => player.id === playerId);
    if (seat < 0) return sendJson(res, 403, { error: "你不在這個房間中" });
    if (body.state) {
      const snapshot = safeTableSnapshot(body.state, room.gameType);
      if (!snapshot) return sendJson(res, 400, { error: "牌局資料格式不正確" });
      const expectedRevision = Math.max(0, Number(body.revision) || 0);
      if (body.initialize) {
        if (seat !== 0) return sendJson(res, 403, { error: "只有房主可以建立或重開牌局" });
      } else {
        if (!room.tableState) return sendJson(res, 409, { error: "等待房主建立牌局" });
        if (expectedRevision !== room.tableRevision) return sendJson(res, 409, { error: "牌局狀態已更新，正在重新同步" });
        const currentTurn = tableTurnSeat(room.tableState, room.gameType);
        const actorAllowed = Number.isInteger(currentTurn) && currentTurn >= room.players.length ? seat === 0 : currentTurn === seat;
        if (!actorAllowed) return sendJson(res, 403, { error: "目前不是你的回合" });
      }
      room.tableState = snapshot;
      room.tableRevision += 1;
      room.status = "playing";
      room.updatedAt = Date.now();
      const winnerSeat = tableWinnerSeat(snapshot, room.gameType);
      if (winnerSeat !== null) await settleRoomWager(room, winnerSeat);
      else if (room.wager && (snapshot.finished || snapshot.draw || snapshot.winner === 3)) {
        room.wagerSettled = true;
        room.wagerResult = { status: "draw", amount: 0 };
      }
    }
    return sendJson(res, 200, { room: publicRoom(room), state: room.tableState, revision: room.tableRevision });
  }

  const tetrisRoomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/tetris$/);
  if (req.method === "POST" && tetrisRoomMatch) {
    const room = rooms.get(tetrisRoomMatch[1]);
    if (!room || room.gameType !== "tetris") return sendJson(res, 404, { error: "俄羅斯方塊房間已關閉" });
    const body = await readJson(req);
    const playerId = String(body.playerId || "").trim();
    if (!room.players.some((player) => player.id === playerId)) return sendJson(res, 403, { error: "你不在這個房間中" });
    const snapshot = safeTetrisSnapshot(body.state);
    if (!snapshot) return sendJson(res, 400, { error: "棋盤資料格式不正確" });
    room.snapshots ||= new Map();
    room.snapshots.set(playerId, snapshot);
    room.updatedAt = Date.now();
    if (room.snapshots.size === 2 && [...room.snapshots.values()].every((item) => item.gameOver)) {
      const scores = room.players.map((player) => room.snapshots.get(player.id)?.score || 0);
      if (scores[0] !== scores[1]) await settleRoomWager(room, scores[0] > scores[1] ? 0 : 1);
      else if (room.wager) { room.wagerSettled = true; room.wagerResult = { status: "draw", amount: 0 }; }
    }
    return sendJson(res, 200, { room: publicRoom(room), snapshots: [...room.snapshots.entries()].map(([id, state]) => ({ playerId: id, state })) });
  }

  const arcadeRoomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/arcade$/);
  if (req.method === "POST" && arcadeRoomMatch) {
    const room = rooms.get(arcadeRoomMatch[1]);
    if (!room || !["volleyball", "racing", "brickbreaker"].includes(room.gameType)) return sendJson(res, 404, { error: "街機遊戲房間已關閉" });
    const body = await readJson(req);
    const playerId = String(body.playerId || "").trim();
    if (!room.players.some((player) => player.id === playerId)) return sendJson(res, 403, { error: "你不在這個房間中" });
    room.arcadeInputs ||= new Map();
    room.arcadeActionUntil ||= new Map();
    const input = safeArcadeInput(body.input);
    room.arcadeInputs.set(playerId, input);
    if (input.action) room.arcadeActionUntil.set(playerId, Date.now() + 250);
    if (room.players[0]?.id === playerId && body.state) {
      const snapshot = safeArcadeSnapshot(body.state, room.gameType);
      if (!snapshot) return sendJson(res, 400, { error: "遊戲狀態格式不正確" });
      room.arcadeSnapshot = snapshot;
      if (Number.isInteger(snapshot.winner) && snapshot.winner >= 0) await settleRoomWager(room, snapshot.winner);
    }
    room.updatedAt = Date.now();
    return sendJson(res, 200, { room: publicRoom(room), snapshot: room.arcadeSnapshot, inputs: [...room.arcadeInputs.entries()].map(([id, playerInput]) => ({ playerId: id, input: { ...playerInput, action: playerInput.action || (room.arcadeActionUntil.get(id) || 0) > Date.now() } })) });
  }

  if (req.method === "GET" && url.pathname === "/api/lobby") {
    const playerId = url.searchParams.get("playerId")?.trim();
    const deviceId = url.searchParams.get("deviceId")?.trim() || "";
    const account = await accountFromRequest(req);
    const name = account?.displayName || url.searchParams.get("name")?.trim().slice(0, 16);
    if (!playerId || !name) return sendJson(res, 400, { error: "缺少玩家資料" });
    if (deviceId) for (const [id, player] of players) if (id !== playerId && player.deviceId === deviceId) players.delete(id);
    players.set(playerId, { id: playerId, deviceId, name, accountId: account?.id || null, seenAt: Date.now() });
    cleanupLobby();
    for (const room of rooms.values()) ensureRoomLaunched(room);
    const incomingInvites = [...invites.values()].filter((invite) => invite.toId === playerId && invite.status === "pending");
    const outgoingInvites = [...invites.values()].filter((invite) => invite.fromId === playerId && invite.status === "pending");
    const activeGame = activeGameFor(playerId);
    const activeRoom = activeRoomFor(playerId);
    return sendJson(res, 200, {
      players: [...players.values()].map(({ id, name: playerName }) => ({ id, name: playerName })),
      onlineCount: players.size,
      incomingInvites,
      outgoingInvites,
      activeGame: activeGame?.id || null,
      activeRoom: activeRoom ? publicRoom(activeRoom) : null
    });
  }

  if (req.method === "POST" && url.pathname === "/api/invite") {
    const body = await readJson(req);
    const account = await accountFromRequest(req);
    const bestOf = Number(body.bestOf) === 5 ? 5 : 3;
    const inviterColor = body.inviterColor === "white" ? WHITE : BLACK;
    const gameType = ROOM_GAME_TYPES.has(body.gameType) ? body.gameType : "gomoku";
    const allowedPlayers = ROOM_PLAYER_LIMITS[gameType].filter((count) => count >= 2);
    const requestedPlayers = Number(body.maxPlayers);
    const maxPlayers = allowedPlayers.includes(requestedPlayers) ? requestedPlayers : allowedPlayers.at(-1);
    const turnTimeMinutes = TURN_TIME_OPTIONS.has(Number(body.turnTimeMinutes)) ? Number(body.turnTimeMinutes) : 3;
    const roomPassword = normalizeRoomPassword(body.password);
    const wager = maxPlayers === 2 ? safeWager(body.wager) : 0;
    const from = players.get(body.fromId);
    const to = players.get(body.toId);
    if (!from || !to) return sendJson(res, 404, { error: "對方已離開大廳" });
    if (wager && (!account || from.accountId !== account.id)) return sendJson(res, 401, { error: "下注邀請需要先登入" });
    if (wager && !canAffordWager(account.id, wager)) return sendJson(res, 409, { error: "織音幣餘額不足" });
    if (from.id === to.id) return sendJson(res, 400, { error: "不能邀請自己" });
    if (activeGameFor(from.id) || activeGameFor(to.id)) return sendJson(res, 409, { error: "其中一位玩家正在對局中" });
    const existing = [...invites.values()].find((invite) => invite.fromId === from.id && invite.toId === to.id && invite.gameType === gameType && invite.status === "pending");
    if (existing) return sendJson(res, 200, { invite: existing });
    let room = [...rooms.values()].filter((candidate) => candidate.gameType === gameType && candidate.maxPlayers === maxPlayers && candidate.wager === wager && candidate.players[0]?.id === from.id && candidate.players.length < candidate.maxPlayers && !candidate.aiFill && ["waiting", "ready"].includes(candidate.status) && Boolean(candidate.passwordHash) === Boolean(roomPassword) && verifyRoomPassword(candidate, roomPassword)).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (!room || maxPlayers === 2 && [...invites.values()].some((pending) => pending.roomId === room.id && pending.status === "pending")) {
      room = createRoomRecord({
        gameType,
        name: `${from.name}的${gameType === "gomoku" ? "五子棋" : gameType === "xiangqi" ? "象棋" : "邀請局"}`.slice(0, 16),
        maxPlayers,
        host: { id: from.id, deviceId: from.deviceId || "", name: from.name, accountId: from.accountId || null },
        matchConfig: DUEL_ROOM_TYPES.has(gameType) ? { bestOf, inviterColor: inviterColor === WHITE ? "white" : "black", turnTimeMinutes } : null,
        password: roomPassword,
        wager
      });
      rooms.set(room.id, room);
    }
    const invite = { id: randomUUID(), fromId: from.id, fromName: from.name, toId: to.id, gameType, maxPlayers, bestOf, inviterColor, turnTimeMinutes, wager, roomId: room.id, hasPassword: Boolean(room.passwordHash), status: "pending", createdAt: Date.now() };
    invites.set(invite.id, invite);
    return sendJson(res, 201, { invite });
  }

  if (req.method === "POST" && url.pathname === "/api/invite/respond") {
    const body = await readJson(req);
    const account = await accountFromRequest(req);
    const invite = invites.get(body.inviteId);
    if (!invite) return sendJson(res, 404, { error: "邀請已失效" });
    if (invite.toId !== body.playerId) return sendJson(res, 403, { error: "無法回覆這個邀請" });
    if (invite.status === "accepted") {
      const acceptedRoom = rooms.get(invite.roomId);
      if (acceptedRoom) return sendJson(res, 200, { accepted: true, room: publicRoom(ensureRoomLaunched(acceptedRoom)) });
      if (invite.gameId && games.has(invite.gameId)) return sendJson(res, 200, { accepted: true, gameId: invite.gameId });
    }
    if (invite.status !== "pending") return sendJson(res, 404, { error: "邀請已失效" });
    if (!body.accept) {
      invite.status = "declined";
      const declinedRoom = rooms.get(invite.roomId);
      const hasOtherPendingInvite = [...invites.values()].some((other) => other.id !== invite.id && other.roomId === invite.roomId && other.status === "pending");
      if (declinedRoom?.players.length === 1 && !hasOtherPendingInvite) rooms.delete(invite.roomId);
      return sendJson(res, 200, { accepted: false });
    }
    const from = players.get(invite.fromId);
    const to = players.get(invite.toId);
    if (!from || !to) return sendJson(res, 404, { error: "其中一位玩家已離線" });
    const room = rooms.get(invite.roomId);
    if (!room) return sendJson(res, 404, { error: "邀請房間已失效，請重新邀請" });
    if (!room.players.some((player) => player.id === to.id)) {
      if (!verifyRoomPassword(room, body.password)) return sendJson(res, 401, { error: "房間密碼不正確" });
      if (room.players.length >= room.maxPlayers) return sendJson(res, 409, { error: "邀請房間已滿" });
      if (room.wager && (!account || to.accountId !== account.id)) return sendJson(res, 401, { error: "下注邀請需要先登入才能接受" });
      if (room.wager && !canAffordWager(account.id, room.wager)) return sendJson(res, 409, { error: "織音幣餘額不足" });
      room.players.push({ id: to.id, deviceId: to.deviceId || "", name: to.name, accountId: account?.id || null });
    }
    room.status = room.players.length >= room.maxPlayers ? "full" : "waiting";
    room.updatedAt = Date.now();
    invite.status = "accepted";
    return sendJson(res, 201, { accepted: true, room: publicRoom(room) });
  }

  const gameMatch = url.pathname.match(/^\/api\/game\/([^/]+)$/);
  if (req.method === "GET" && gameMatch) {
    const game = games.get(gameMatch[1]);
    const playerId = url.searchParams.get("playerId");
    if (!game) return sendJson(res, 404, { error: "找不到這場對局" });
    if (!game.players.some((player) => player.id === playerId)) return sendJson(res, 403, { error: "你不在這場對局中" });
    applyExpiredTurn(game);
    await settleDuelRoom(game);
    return sendJson(res, 200, publicGame(game));
  }

  const moveMatch = url.pathname.match(/^\/api\/game\/([^/]+)\/move$/);
  if (req.method === "POST" && moveMatch) {
    const game = games.get(moveMatch[1]);
    if (!game) return sendJson(res, 404, { error: "找不到這場對局" });
    const body = await readJson(req);
    const player = game.players.find((item) => item.id === body.playerId);
    if (!player) return sendJson(res, 403, { error: "你不在這場對局中" });
    const timedOut = applyExpiredTurn(game);
    if (timedOut) return sendJson(res, 409, { error: "下棋時間已到，系統已自動替你落子" });
    if (game.status !== "playing") return sendJson(res, 409, { error: "這場對局已經結束" });
    if (player.color !== game.turn) return sendJson(res, 409, { error: "還沒輪到你" });
    if (game.gameType === "xiangqi") {
      const from = Number(body.from);
      const to = Number(body.to);
      const move = getXiangqiLegalMoves(game.board, player.color).find((candidate) => candidate.from === from && candidate.to === to);
      if (!move) return sendJson(res, 400, { error: "這一步不符合象棋規則" });
      applyGameMove(game, move, player.color);
    } else {
      const index = Number(body.index);
      if (!Number.isInteger(index) || index < 0 || index >= BOARD_SIZE * BOARD_SIZE || game.board[index]) return sendJson(res, 400, { error: "這個位置不能落子" });
      applyGameMove(game, index, player.color);
    }
    await settleDuelRoom(game);
    return sendJson(res, 200, publicGame(game));
  }

  const chatMatch = url.pathname.match(/^\/api\/game\/([^/]+)\/chat$/);
  if (req.method === "POST" && chatMatch) {
    const game = games.get(chatMatch[1]);
    if (!game) return sendJson(res, 404, { error: "找不到這場對局" });
    const body = await readJson(req);
    const player = game.players.find((item) => item.id === body.playerId);
    const text = String(body.text || "").trim().slice(0, MAX_CHAT_LENGTH);
    if (!player) return sendJson(res, 403, { error: "你不在這場對局中" });
    if (game.matchStatus !== "active") return sendJson(res, 409, { error: "這場對戰已經結束" });
    if (!text) return sendJson(res, 400, { error: "請輸入訊息" });
    game.messages.push({ id: randomUUID(), playerId: player.id, name: player.name, text, createdAt: Date.now() });
    game.messages = game.messages.slice(-MAX_CHAT_MESSAGES);
    game.revision += 1;
    game.updatedAt = Date.now();
    return sendJson(res, 201, publicGame(game));
  }

  const rematchMatch = url.pathname.match(/^\/api\/game\/([^/]+)\/rematch$/);
  if (req.method === "POST" && rematchMatch) {
    const game = games.get(rematchMatch[1]);
    if (!game) return sendJson(res, 404, { error: "找不到這場對局" });
    const body = await readJson(req);
    const player = game.players.find((item) => item.id === body.playerId);
    if (!player) return sendJson(res, 403, { error: "你不在這場對局中" });
    if (game.status !== "finished") return sendJson(res, 409, { error: "本局尚未結束" });
    if (game.matchStatus === "closed") return sendJson(res, 409, { error: "系列賽已經結束" });
    if (!body.accept) {
      game.matchStatus = "closed";
      game.rematchDeclinedBy = player.id;
      game.revision += 1;
      game.updatedAt = Date.now();
      game.turnStartedAt = null;
      return sendJson(res, 200, publicGame(game));
    }
    if (!game.rematchRequests.includes(player.id)) game.rematchRequests.push(player.id);
    if (game.rematchRequests.length === game.players.length) resetRound(game, Boolean(game.seriesWinnerId));
    else {
      game.revision += 1;
      game.updatedAt = Date.now();
    }
    return sendJson(res, 200, publicGame(game));
  }

  const resignMatch = url.pathname.match(/^\/api\/game\/([^/]+)\/resign$/);
  if (req.method === "POST" && resignMatch) {
    const game = games.get(resignMatch[1]);
    if (!game) return sendJson(res, 404, { error: "找不到這場對局" });
    const body = await readJson(req);
    const player = game.players.find((item) => item.id === body.playerId);
    if (!player) return sendJson(res, 403, { error: "你不在這場對局中" });
    if (game.status === "playing") {
      game.status = "finished";
      game.winner = player.color === BLACK ? WHITE : BLACK;
      game.matchStatus = "closed";
      game.rematchDeclinedBy = player.id;
      game.revision += 1;
      game.updatedAt = Date.now();
      game.turnStartedAt = null;
      const room = [...rooms.values()].find((candidate) => candidate.gameId === game.id);
      if (room) await settleRoomWager(room, room.players.findIndex((item) => item.id !== player.id));
    }
    return sendJson(res, 200, publicGame(game));
  }

  return false;
}

export function startStaticServer({ preferredPort = 5173, host = "127.0.0.1", rootDir = defaultRoot } = {}) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${host}:${server.address()?.port || preferredPort}`);
      if (url.pathname.startsWith("/api/")) {
        if (req.method === "OPTIONS") {
          res.writeHead(204, {
            "access-control-allow-origin": process.env.ALLOWED_ORIGIN || "*",
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-headers": "content-type, authorization",
            "access-control-max-age": "86400"
          });
          res.end();
          return;
        }
        const handled = await handleApi(req, res, url);
        if (handled !== false) return;
        return sendJson(res, 404, { error: "找不到 API" });
      }

      const filePath = safePath(req.url || "/", rootDir);
      if (!filePath) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const body = await readFile(filePath);
      res.writeHead(200, {
        "content-type": contentTypes[extname(filePath)] || "application/octet-stream",
        "cache-control": "no-store"
      });
      res.end(body);
    } catch (error) {
      if (req.url?.startsWith("/api/")) return sendJson(res, 500, { error: error.message || "伺服器錯誤" });
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
    }
  });

  return new Promise((resolve, reject) => {
    const listen = (port) => {
      const onError = (error) => {
        if (error.code === "EADDRINUSE" && port !== 0) return listen(0);
        reject(error);
      };
      server.once("error", onError);
      server.listen(port, host, () => {
        server.off("error", onError);
        const address = server.address();
        const portNumber = typeof address === "object" && address ? address.port : preferredPort;
        resolve({ server, port: portNumber, url: `http://${host}:${portNumber}` });
      });
    };
    listen(preferredPort);
  });
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT || 5173);
  startStaticServer({ preferredPort: port, host: process.env.HOST || "127.0.0.1" })
    .then(({ url }) => console.log(`Family games platform running at ${url}`))
    .catch((error) => { console.error(error); process.exit(1); });
}
