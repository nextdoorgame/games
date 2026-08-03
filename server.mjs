import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const defaultRoot = process.cwd();
const BOARD_SIZE = 15;
const BLACK = 1;
const WHITE = 2;
const PLAYER_TTL = 10_000;

const players = new Map();
const invites = new Map();
const games = new Map();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
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
  const inviteCutoff = Date.now() - 60_000;
  for (const [id, invite] of invites) {
    if (invite.createdAt < inviteCutoff || invite.status === "declined") invites.delete(id);
  }
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

function publicGame(game) {
  return {
    id: game.id,
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
    updatedAt: game.updatedAt
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
  game.board = Array(BOARD_SIZE * BOARD_SIZE).fill(0);
  game.moves = [];
  game.turn = BLACK;
  game.status = "playing";
  game.winner = 0;
  game.winLine = [];
  game.rematchRequests = [];
  game.rematchDeclinedBy = null;
  game.updatedAt = Date.now();
}

async function handleApi(req, res, url) {
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
    const from = players.get(body.fromId);
    const to = players.get(body.toId);
    if (!from || !to) return sendJson(res, 404, { error: "對方已離開大廳" });
    if (from.id === to.id) return sendJson(res, 400, { error: "不能邀請自己" });
    if (activeGameFor(from.id) || activeGameFor(to.id)) return sendJson(res, 409, { error: "其中一位玩家正在對局中" });
    const existing = [...invites.values()].find((invite) => invite.fromId === from.id && invite.toId === to.id && invite.status === "pending");
    if (existing) return sendJson(res, 200, { invite: existing });
    const invite = { id: randomUUID(), fromId: from.id, fromName: from.name, toId: to.id, bestOf, status: "pending", createdAt: Date.now() };
    invites.set(invite.id, invite);
    return sendJson(res, 201, { invite });
  }

  if (req.method === "POST" && url.pathname === "/api/invite/respond") {
    const body = await readJson(req);
    const invite = invites.get(body.inviteId);
    if (!invite || invite.status !== "pending") return sendJson(res, 404, { error: "邀請已失效" });
    if (invite.toId !== body.playerId) return sendJson(res, 403, { error: "無法回覆這個邀請" });
    if (!body.accept) {
      invite.status = "declined";
      return sendJson(res, 200, { accepted: false });
    }
    const from = players.get(invite.fromId);
    const to = players.get(invite.toId);
    if (!from || !to) return sendJson(res, 404, { error: "其中一位玩家已離線" });
    const inviterIsBlack = Math.random() >= .5;
    const game = {
      id: randomUUID(),
      board: Array(BOARD_SIZE * BOARD_SIZE).fill(0),
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
    return sendJson(res, 200, publicGame(game));
  }

  const moveMatch = url.pathname.match(/^\/api\/game\/([^/]+)\/move$/);
  if (req.method === "POST" && moveMatch) {
    const game = games.get(moveMatch[1]);
    if (!game) return sendJson(res, 404, { error: "找不到這場對局" });
    const body = await readJson(req);
    const player = game.players.find((item) => item.id === body.playerId);
    const index = Number(body.index);
    if (!player) return sendJson(res, 403, { error: "你不在這場對局中" });
    if (game.status !== "playing") return sendJson(res, 409, { error: "這場對局已經結束" });
    if (player.color !== game.turn) return sendJson(res, 409, { error: "還沒輪到你" });
    if (!Number.isInteger(index) || index < 0 || index >= BOARD_SIZE * BOARD_SIZE || game.board[index]) return sendJson(res, 400, { error: "這個位置不能落子" });
    game.board[index] = player.color;
    game.moves.push({ index, color: player.color });
    game.winLine = winningLine(game.board, index, player.color);
    if (game.winLine.length) {
      game.status = "finished";
      game.winner = player.color;
      game.scores[player.id] += 1;
      if (game.scores[player.id] >= game.targetWins) game.seriesWinnerId = player.id;
    } else if (game.moves.length === BOARD_SIZE * BOARD_SIZE) {
      game.status = "finished";
    } else {
      game.turn = player.color === BLACK ? WHITE : BLACK;
    }
    game.updatedAt = Date.now();
    return sendJson(res, 200, publicGame(game));
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
      game.updatedAt = Date.now();
      return sendJson(res, 200, publicGame(game));
    }
    if (!game.rematchRequests.includes(player.id)) game.rematchRequests.push(player.id);
    if (game.rematchRequests.length === game.players.length) resetRound(game, Boolean(game.seriesWinnerId));
    else game.updatedAt = Date.now();
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
      game.updatedAt = Date.now();
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
    .then(({ url }) => console.log(`Gomoku running at ${url}`))
    .catch((error) => { console.error(error); process.exit(1); });
}
