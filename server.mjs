import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { applyXiangqiMove, createInitialXiangqiBoard, getXiangqiLegalMoves, getXiangqiWinner, otherXiangqiColor } from "./src/xiangqi.js";

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

const players = new Map();
const invites = new Map();
const games = new Map();
const rooms = new Map();
const ROOM_GAME_TYPES = new Set(["gomoku", "xiangqi", "reversi", "checkers", "mahjong", "bigtwo", "banqi", "chess", "go", "blackjack", "pickred", "ninetynine", "tetris", "volleyball", "racing"]);
const ROOM_PLAYER_LIMITS = {
  gomoku: [2], xiangqi: [2], reversi: [2], checkers: [2, 3], mahjong: [1, 2, 3, 4], bigtwo: [3, 4, 5],
  banqi: [2], chess: [2], go: [2], blackjack: [3, 4, 5], pickred: [3, 4, 5], ninetynine: [3, 4, 5], tetris: [2], volleyball: [2], racing: [2]
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
    "access-control-allow-headers": "content-type"
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
    if (total > 20_000) throw new Error("Request too large");
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
    if (invite.createdAt < inviteCutoff || invite.status === "declined") invites.delete(id);
  }
  const roomCutoff = Date.now() - 2 * 60 * 60_000;
  for (const [id, room] of rooms) if (room.updatedAt < roomCutoff) rooms.delete(id);
}

function publicRoom(room) {
  return { id: room.id, gameType: room.gameType, name: room.name, maxPlayers: room.maxPlayers, aiFill: room.aiFill, status: room.status, players: room.players, createdAt: room.createdAt, updatedAt: room.updatedAt };
}

function safeTetrisSnapshot(value) {
  if (!value || !Array.isArray(value.board) || value.board.length !== 20) return null;
  const board = value.board.map((row) => Array.isArray(row) && row.length === 10 ? row.map((cell) => Math.max(0, Math.min(7, Number(cell) || 0))) : null);
  if (board.some((row) => !row)) return null;
  return {
    board,
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
    if (JSON.stringify(value).length > 15_000) return null;
    return structuredClone(value);
  } catch { return null; }
}

function activeGameFor(playerId) {
  return [...games.values()]
    .filter((game) => game.matchStatus === "active" && game.players.some((player) => player.id === playerId))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
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
  if (req.method === "GET" && url.pathname === "/api/rooms") {
    cleanupLobby();
    const gameType = ROOM_GAME_TYPES.has(url.searchParams.get("gameType")) ? url.searchParams.get("gameType") : "gomoku";
    return sendJson(res, 200, { gameType, rooms: [...rooms.values()].filter((room) => room.gameType === gameType).sort((a, b) => b.updatedAt - a.updatedAt).map(publicRoom) });
  }

  if (req.method === "POST" && url.pathname === "/api/rooms") {
    const body = await readJson(req);
    const gameType = ROOM_GAME_TYPES.has(body.gameType) ? body.gameType : "gomoku";
    const allowed = ROOM_PLAYER_LIMITS[gameType];
    const maxPlayers = allowed.includes(Number(body.maxPlayers)) ? Number(body.maxPlayers) : allowed.at(-1);
    const hostId = String(body.hostId || "").trim();
    const hostName = String(body.hostName || "棋手").trim().slice(0, 16);
    if (!hostId) return sendJson(res, 400, { error: "缺少房主資料" });
    const room = { id: randomUUID(), gameType, name: String(body.name || `${hostName}的房間`).trim().slice(0, 16), maxPlayers, aiFill: Boolean(body.aiFill), status: "waiting", players: [{ id: hostId, name: hostName }], snapshots: gameType === "tetris" ? new Map() : null, arcadeInputs: ["volleyball", "racing"].includes(gameType) ? new Map() : null, arcadeSnapshot: null, createdAt: Date.now(), updatedAt: Date.now() };
    rooms.set(room.id, room);
    return sendJson(res, 201, publicRoom(room));
  }

  const roomJoinMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/join$/);
  if (req.method === "POST" && roomJoinMatch) {
    const room = rooms.get(roomJoinMatch[1]);
    if (!room) return sendJson(res, 404, { error: "房間已關閉" });
    const body = await readJson(req);
    const playerId = String(body.playerId || "").trim();
    const playerName = String(body.playerName || "棋手").trim().slice(0, 16);
    if (!playerId) return sendJson(res, 400, { error: "缺少玩家資料" });
    if (!room.players.some((player) => player.id === playerId)) {
      if (room.players.length >= room.maxPlayers) return sendJson(res, 409, { error: "房間已滿" });
      room.players.push({ id: playerId, name: playerName });
    }
    room.status = room.players.length >= room.maxPlayers ? "full" : "waiting";
    room.updatedAt = Date.now();
    return sendJson(res, 200, publicRoom(room));
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
    return sendJson(res, 200, { room: publicRoom(room), snapshots: [...room.snapshots.entries()].map(([id, state]) => ({ playerId: id, state })) });
  }

  const arcadeRoomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/arcade$/);
  if (req.method === "POST" && arcadeRoomMatch) {
    const room = rooms.get(arcadeRoomMatch[1]);
    if (!room || !["volleyball", "racing"].includes(room.gameType)) return sendJson(res, 404, { error: "街機遊戲房間已關閉" });
    const body = await readJson(req);
    const playerId = String(body.playerId || "").trim();
    if (!room.players.some((player) => player.id === playerId)) return sendJson(res, 403, { error: "你不在這個房間中" });
    room.arcadeInputs ||= new Map();
    room.arcadeInputs.set(playerId, safeArcadeInput(body.input));
    if (room.players[0]?.id === playerId && body.state) {
      const snapshot = safeArcadeSnapshot(body.state, room.gameType);
      if (!snapshot) return sendJson(res, 400, { error: "遊戲狀態格式不正確" });
      room.arcadeSnapshot = snapshot;
    }
    room.updatedAt = Date.now();
    return sendJson(res, 200, { room: publicRoom(room), snapshot: room.arcadeSnapshot, inputs: [...room.arcadeInputs.entries()].map(([id, input]) => ({ playerId: id, input })) });
  }

  if (req.method === "GET" && url.pathname === "/api/lobby") {
    const playerId = url.searchParams.get("playerId")?.trim();
    const name = url.searchParams.get("name")?.trim().slice(0, 16);
    if (!playerId || !name) return sendJson(res, 400, { error: "缺少玩家資料" });
    players.set(playerId, { id: playerId, name, seenAt: Date.now() });
    cleanupLobby();
    const incomingInvites = [...invites.values()].filter((invite) => invite.toId === playerId && invite.status === "pending");
    const outgoingInvites = [...invites.values()].filter((invite) => invite.fromId === playerId && invite.status === "pending");
    const activeGame = activeGameFor(playerId);
    return sendJson(res, 200, {
      players: [...players.values()].map(({ id, name: playerName }) => ({ id, name: playerName })),
      onlineCount: players.size,
      incomingInvites,
      outgoingInvites,
      activeGame: activeGame?.id || null
    });
  }

  if (req.method === "POST" && url.pathname === "/api/invite") {
    const body = await readJson(req);
    const bestOf = Number(body.bestOf) === 5 ? 5 : 3;
    const inviterColor = body.inviterColor === "white" ? WHITE : BLACK;
    const gameType = body.gameType === "xiangqi" ? "xiangqi" : "gomoku";
    const turnTimeMinutes = TURN_TIME_OPTIONS.has(Number(body.turnTimeMinutes)) ? Number(body.turnTimeMinutes) : 3;
    const from = players.get(body.fromId);
    const to = players.get(body.toId);
    if (!from || !to) return sendJson(res, 404, { error: "對方已離開大廳" });
    if (from.id === to.id) return sendJson(res, 400, { error: "不能邀請自己" });
    if (activeGameFor(from.id) || activeGameFor(to.id)) return sendJson(res, 409, { error: "其中一位玩家正在對局中" });
    const existing = [...invites.values()].find((invite) => invite.fromId === from.id && invite.toId === to.id && invite.gameType === gameType && invite.status === "pending");
    if (existing) return sendJson(res, 200, { invite: existing });
    const invite = { id: randomUUID(), fromId: from.id, fromName: from.name, toId: to.id, gameType, bestOf, inviterColor, turnTimeMinutes, status: "pending", createdAt: Date.now() };
    invites.set(invite.id, invite);
    return sendJson(res, 201, { invite });
  }

  if (req.method === "POST" && url.pathname === "/api/invite/respond") {
    const body = await readJson(req);
    const invite = invites.get(body.inviteId);
    if (!invite) return sendJson(res, 404, { error: "邀請已失效" });
    if (invite.toId !== body.playerId) return sendJson(res, 403, { error: "無法回覆這個邀請" });
    if (invite.status === "accepted" && invite.gameId && games.has(invite.gameId)) {
      return sendJson(res, 200, { accepted: true, gameId: invite.gameId });
    }
    if (invite.status !== "pending") return sendJson(res, 404, { error: "邀請已失效" });
    if (!body.accept) {
      invite.status = "declined";
      return sendJson(res, 200, { accepted: false });
    }
    const from = players.get(invite.fromId);
    const to = players.get(invite.toId);
    if (!from || !to) return sendJson(res, 404, { error: "其中一位玩家已離線" });
    const inviterIsBlack = invite.inviterColor !== WHITE;
    const game = {
      id: randomUUID(),
      gameType: invite.gameType === "xiangqi" ? "xiangqi" : "gomoku",
      board: initialBoard(invite.gameType),
      moves: [],
      players: [
        { id: from.id, name: from.name, color: inviterIsBlack ? BLACK : WHITE },
        { id: to.id, name: to.name, color: inviterIsBlack ? WHITE : BLACK }
      ],
      turn: BLACK,
      status: "playing",
      winner: 0,
      winLine: [],
      bestOf: invite.bestOf === 5 ? 5 : 3,
      targetWins: invite.bestOf === 5 ? 3 : 2,
      round: 1,
      scores: { [from.id]: 0, [to.id]: 0 },
      seriesWinnerId: null,
      rematchRequests: [],
      matchStatus: "active",
      rematchDeclinedBy: null,
      messages: [],
      turnTimeMinutes: invite.turnTimeMinutes || 3,
      turnTimeMs: (invite.turnTimeMinutes || 3) * 60_000,
      turnStartedAt: Date.now(),
      revision: 0,
      updatedAt: Date.now()
    };
    games.set(game.id, game);
    invite.status = "accepted";
    invite.gameId = game.id;
    return sendJson(res, 201, { accepted: true, gameId: game.id });
  }

  const gameMatch = url.pathname.match(/^\/api\/game\/([^/]+)$/);
  if (req.method === "GET" && gameMatch) {
    const game = games.get(gameMatch[1]);
    const playerId = url.searchParams.get("playerId");
    if (!game) return sendJson(res, 404, { error: "找不到這場對局" });
    if (!game.players.some((player) => player.id === playerId)) return sendJson(res, 403, { error: "你不在這場對局中" });
    applyExpiredTurn(game);
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
            "access-control-allow-headers": "content-type",
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
