const SIZE = 15;
const BLACK = 1;
const WHITE = 2;
const EMPTY = 0;
const configuredApiBase = String(window.GOMOKU_CONFIG?.apiBaseUrl || "").trim().replace(/\/$/, "");
const API_BASE = configuredApiBase;
const ONLINE_AVAILABLE = Boolean(API_BASE);

const els = {
  views: [...document.querySelectorAll(".view")],
  navItems: [...document.querySelectorAll(".nav-item")],
  profileName: document.querySelector("#profileName"),
  profileAvatar: document.querySelector("#profileAvatar"),
  lobbyName: document.querySelector("#lobbyName"),
  lobbyAvatar: document.querySelector("#lobbyAvatar"),
  lobbyCount: document.querySelector("#lobbyCount"),
  onlineCount: document.querySelector("#onlineCount"),
  playerList: document.querySelector("#playerList"),
  refreshLobby: document.querySelector("#refreshLobby"),
  toast: document.querySelector("#toast"),
  singleDialog: document.querySelector("#singleDialog"),
  inviteDialog: document.querySelector("#inviteDialog"),
  nameDialog: document.querySelector("#nameDialog"),
  nameInput: document.querySelector("#nameInput"),
  inviterName: document.querySelector("#inviterName"),
  board: document.querySelector("#board"),
  gameModeLabel: document.querySelector("#gameModeLabel"),
  gameTitle: document.querySelector("#gameTitle"),
  turnPill: document.querySelector("#turnPill"),
  opponentRow: document.querySelector("#opponentRow"),
  meRow: document.querySelector("#meRow"),
  opponentName: document.querySelector("#opponentName"),
  opponentTag: document.querySelector("#opponentTag"),
  gamePlayerName: document.querySelector("#gamePlayerName"),
  moveCount: document.querySelector("#moveCount"),
  gameStatus: document.querySelector("#gameStatus"),
  undoMove: document.querySelector("#undoMove"),
  restartGame: document.querySelector("#restartGame"),
  recordList: document.querySelector("#recordList")
};

const playerId = sessionStorage.getItem("gomoku-player-id") || crypto.randomUUID();
sessionStorage.setItem("gomoku-player-id", playerId);
let playerName = localStorage.getItem("gomoku-player-name") || `棋手 ${String(Math.floor(Math.random() * 9000) + 1000)}`;

let activeView = "home";
let gameMode = null;
let game = null;
let aiTimer = null;
let lobbyTimer = null;
let onlineTimer = null;
let currentInvite = null;
let pendingInvites = new Set();
let toastTimer = null;
let isFetchingLobby = false;
let recordedGameKey = "";

function initials(name) {
  return [...name.trim()].slice(0, 1).join("") || "棋";
}

function updateIdentity() {
  els.profileName.textContent = playerName;
  els.lobbyName.textContent = playerName;
  els.gamePlayerName.textContent = playerName;
  els.profileAvatar.textContent = initials(playerName);
  els.lobbyAvatar.textContent = initials(playerName);
}

function updateHostingStatus() {
  if (ONLINE_AVAILABLE) return;
  document.querySelector("#serverStatusTitle").textContent = "GitHub Pages 模式";
  document.querySelector("#serverStatusText").textContent = "單人遊戲可直接使用";
  document.querySelector("#onlineModeDescription").textContent = "前端已部署完成；設定外部 API 網址後即可啟用線上大廳與即時對局。";
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = window.setTimeout(() => els.toast.classList.remove("show"), 2800);
}

function showView(name) {
  activeView = name;
  els.views.forEach((view) => view.classList.toggle("active", view.id === `${name}View`));
  els.navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === name));
  stopLobbyPolling();
  if (name === "lobby") {
    if (!ONLINE_AVAILABLE) {
      renderStaticLobby();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    fetchLobby();
    lobbyTimer = window.setInterval(fetchLobby, 1200);
  }
  if (name === "records") renderRecords();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderStaticLobby() {
  els.onlineCount.textContent = "0";
  els.lobbyCount.textContent = "0";
  els.playerList.innerHTML = `<div class="empty-state"><div><b>線上服務尚未設定</b><span>GitHub Pages 已可執行單人模式。若要開啟大廳，請在 config.js 填入已部署後端的 HTTPS 網址。</span></div></div>`;
}

function resetGameState(mode, options = {}) {
  window.clearTimeout(aiTimer);
  recordedGameKey = "";
  gameMode = mode;
  game = {
    board: Array(SIZE * SIZE).fill(EMPTY),
    moves: [],
    turn: BLACK,
    winner: EMPTY,
    winLine: [],
    status: "playing",
    ...options
  };
}

function renderBoard() {
  if (!game) return;
  const lastIndex = game.moves.at(-1)?.index ?? -1;
  const winIndexes = new Set(game.winLine || []);
  const fragment = document.createDocumentFragment();

  game.board.forEach((stone, index) => {
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `intersection${stone ? " occupied" : ""}${lastIndex === index ? " last" : ""}${winIndexes.has(index) ? " win" : ""}`;
    button.style.left = `${(col / (SIZE - 1)) * 100}%`;
    button.style.top = `${(row / (SIZE - 1)) * 100}%`;
    button.dataset.index = String(index);
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `${String.fromCharCode(65 + col)}${row + 1}${stone === BLACK ? " 黑棋" : stone === WHITE ? " 白棋" : " 空位"}`);
    if (stone) {
      const piece = document.createElement("span");
      piece.className = `game-stone ${stone === BLACK ? "black" : "white"}`;
      button.append(piece);
    }
    fragment.append(button);
  });
  els.board.replaceChildren(fragment);
  renderGamePanel();
}

function playerColor() {
  if (gameMode === "single") return game.playerColor;
  if (gameMode === "online") return game.myColor;
  return BLACK;
}

function renderGamePanel() {
  if (!game) return;
  const myColor = playerColor();
  const myTurn = game.status === "playing" && game.turn === myColor;
  const colorName = game.turn === BLACK ? "黑棋" : "白棋";
  els.moveCount.textContent = String(game.moves.length);
  els.turnPill.classList.toggle("waiting", !myTurn && game.status === "playing");
  els.turnPill.classList.toggle("finished", game.status !== "playing");
  els.turnPill.querySelector("i").style.background = game.turn === BLACK ? "#222" : "#eee";
  els.turnPill.querySelector("span").textContent = game.status !== "playing" ? "本局已結束" : myTurn ? "輪到你了" : `${colorName}思考中`;
  els.meRow.classList.toggle("active", myTurn);
  els.opponentRow.classList.toggle("active", !myTurn && game.status === "playing");

  const myStone = els.meRow.querySelector(".stone-icon");
  const opponentStone = els.opponentRow.querySelector(".stone-icon");
  myStone.className = `stone-icon ${myColor === BLACK ? "black-stone" : "white-stone"}`;
  opponentStone.className = `stone-icon ${myColor === BLACK ? "white-stone" : "black-stone"}`;

  if (game.status === "playing") {
    els.gameStatus.textContent = myTurn ? `輪到你執${myColor === BLACK ? "黑" : "白"}棋，請選擇交叉點落子。` : gameMode === "single" ? "AI 正在分析棋局…" : "等待對手落子，棋局會自動同步。";
  } else if (game.winner === EMPTY) {
    els.gameStatus.textContent = "棋盤已滿，本局和棋。";
  } else {
    els.gameStatus.textContent = game.winner === myColor ? "漂亮！你率先連成五子，贏得本局。" : "對手率先連成五子，本局結束。";
  }

  els.undoMove.hidden = gameMode !== "single";
  els.undoMove.disabled = gameMode !== "single" || game.moves.length <= (game.playerColor === WHITE ? 1 : 0);
  els.restartGame.hidden = gameMode !== "single";
}

function getWinningLine(board, index, color) {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dr, dc] of directions) {
    const line = [index];
    for (const sign of [-1, 1]) {
      for (let step = 1; step < 5; step += 1) {
        const r = row + dr * step * sign;
        const c = col + dc * step * sign;
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE || board[r * SIZE + c] !== color) break;
        sign < 0 ? line.unshift(r * SIZE + c) : line.push(r * SIZE + c);
      }
    }
    if (line.length >= 5) return line;
  }
  return [];
}

function placeLocalStone(index, color) {
  if (game.board[index] !== EMPTY || game.status !== "playing") return false;
  game.board[index] = color;
  game.moves.push({ index, color });
  const line = getWinningLine(game.board, index, color);
  if (line.length) {
    game.winner = color;
    game.winLine = line;
    game.status = "finished";
    saveCurrentRecord();
  } else if (game.moves.length === SIZE * SIZE) {
    game.status = "finished";
    saveCurrentRecord();
  } else {
    game.turn = color === BLACK ? WHITE : BLACK;
  }
  return true;
}

function handleBoardClick(event) {
  const button = event.target.closest(".intersection");
  if (!button || !game || game.status !== "playing") return;
  const index = Number(button.dataset.index);
  if (gameMode === "single") {
    if (game.turn !== game.playerColor || !placeLocalStone(index, game.playerColor)) return;
    renderBoard();
    if (game.status === "playing") scheduleAiMove();
  } else if (gameMode === "online" && game.turn === game.myColor) {
    makeOnlineMove(index);
  }
}

function nearbyCandidates(board) {
  const occupied = board.some(Boolean);
  if (!occupied) return [Math.floor((SIZE * SIZE) / 2)];
  const result = new Set();
  board.forEach((stone, index) => {
    if (!stone) return;
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    for (let dr = -2; dr <= 2; dr += 1) {
      for (let dc = -2; dc <= 2; dc += 1) {
        const r = row + dr;
        const c = col + dc;
        if (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r * SIZE + c] === EMPTY) result.add(r * SIZE + c);
      }
    }
  });
  return [...result];
}

function directionalPotential(board, index, color) {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  let total = 0;
  for (const [dr, dc] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    let count = 1;
    let open = 0;
    for (const sign of [-1, 1]) {
      for (let step = 1; step <= 4; step += 1) {
        const r = row + dr * step * sign;
        const c = col + dc * step * sign;
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) break;
        const value = board[r * SIZE + c];
        if (value === color) count += 1;
        else { if (value === EMPTY) open += 1; break; }
      }
    }
    const weights = [0, 2, 12, 80, 700, 100000];
    total += weights[Math.min(count, 5)] * (open === 2 ? 1.7 : open === 1 ? 1 : .2);
  }
  const centerDistance = Math.abs(row - 7) + Math.abs(col - 7);
  return total + Math.max(0, 14 - centerDistance) * .35;
}

function bestAiMove(difficulty) {
  const aiColor = game.aiColor;
  const humanColor = game.playerColor;
  const candidates = nearbyCandidates(game.board);
  if (difficulty === "easy") return candidates[Math.floor(Math.random() * candidates.length)];

  const scored = candidates.map((index) => {
    game.board[index] = aiColor;
    const wins = getWinningLine(game.board, index, aiColor).length > 0;
    game.board[index] = humanColor;
    const blocksWin = getWinningLine(game.board, index, humanColor).length > 0;
    game.board[index] = EMPTY;
    let score = wins ? 1_000_000 : blocksWin ? 850_000 : directionalPotential(game.board, index, aiColor) * 1.15 + directionalPotential(game.board, index, humanColor);
    return { index, score };
  }).sort((a, b) => b.score - a.score);

  if (difficulty === "medium") {
    const pool = scored.slice(0, Math.min(4, scored.length));
    return pool[Math.floor(Math.random() * pool.length)].index;
  }

  const top = scored.slice(0, Math.min(14, scored.length));
  for (const move of top) {
    if (move.score >= 850_000) continue;
    game.board[move.index] = aiColor;
    const replies = nearbyCandidates(game.board);
    let danger = 0;
    for (const reply of replies) {
      game.board[reply] = humanColor;
      const immediate = getWinningLine(game.board, reply, humanColor).length > 0;
      game.board[reply] = EMPTY;
      danger = Math.max(danger, immediate ? 500_000 : directionalPotential(game.board, reply, humanColor));
    }
    game.board[move.index] = EMPTY;
    move.score -= danger * .72;
  }
  top.sort((a, b) => b.score - a.score);
  return top[0].index;
}

function scheduleAiMove() {
  window.clearTimeout(aiTimer);
  aiTimer = window.setTimeout(() => {
    if (gameMode !== "single" || game.status !== "playing" || game.turn !== game.aiColor) return;
    const index = bestAiMove(game.difficulty);
    placeLocalStone(index, game.aiColor);
    renderBoard();
  }, game.difficulty === "hard" ? 620 : 430);
}

function startSingleGame() {
  const form = els.singleDialog.querySelector("form");
  const data = new FormData(form);
  const difficulty = data.get("difficulty") || "medium";
  const color = data.get("color") === "white" ? WHITE : BLACK;
  resetGameState("single", { difficulty, playerColor: color, aiColor: color === BLACK ? WHITE : BLACK });
  const labels = { easy: "輕鬆", medium: "普通", hard: "困難" };
  els.gameModeLabel.textContent = "SINGLE MATCH";
  els.gameTitle.textContent = `挑戰 ${labels[difficulty]} AI`;
  els.opponentName.textContent = difficulty === "easy" ? "小棋手 AI" : difficulty === "hard" ? "棋聖 AI" : "思考者 AI";
  els.opponentTag.textContent = labels[difficulty];
  els.singleDialog.close();
  showView("game");
  renderBoard();
  if (game.aiColor === BLACK) scheduleAiMove();
}

function undoSingleMove() {
  if (gameMode !== "single" || !game.moves.length) return;
  window.clearTimeout(aiTimer);
  const minimum = game.playerColor === WHITE ? 1 : 0;
  if (game.moves.length <= minimum) return;

  const removeCount = game.turn === game.aiColor && game.status === "playing" ? 1 : 2;
  for (let i = 0; i < removeCount && game.moves.length > minimum; i += 1) {
    const move = game.moves.pop();
    game.board[move.index] = EMPTY;
  }
  game.status = "playing";
  game.winner = EMPTY;
  game.winLine = [];
  game.turn = game.moves.length % 2 === 0 ? BLACK : WHITE;
  recordedGameKey = "";
  renderBoard();
}

function restartSingle() {
  if (gameMode !== "single") return;
  const { difficulty, playerColor, aiColor } = game;
  resetGameState("single", { difficulty, playerColor, aiColor });
  renderBoard();
  if (aiColor === BLACK) scheduleAiMove();
}

async function api(path, options = {}) {
  if (!ONLINE_AVAILABLE) throw new Error("線上服務尚未設定，單人模式仍可正常遊玩");
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "連線發生問題");
  return data;
}

async function fetchLobby() {
  if (isFetchingLobby) return;
  isFetchingLobby = true;
  try {
    const data = await api(`/api/lobby?playerId=${encodeURIComponent(playerId)}&name=${encodeURIComponent(playerName)}`);
    els.onlineCount.textContent = String(data.onlineCount);
    els.lobbyCount.textContent = String(Math.max(0, data.onlineCount - 1));
    renderPlayers(data.players);
    pendingInvites = new Set(data.outgoingInvites.map((invite) => invite.toId));
    if (data.activeGame && gameMode !== "online") {
      await startOnlineGame(data.activeGame);
    } else if (data.incomingInvites.length && !currentInvite && !els.inviteDialog.open) {
      currentInvite = data.incomingInvites[0];
      els.inviterName.textContent = currentInvite.fromName;
      els.inviteDialog.showModal();
    }
  } catch (error) {
    if (activeView === "lobby") showToast(error.message);
  } finally {
    isFetchingLobby = false;
  }
}

function renderPlayers(players) {
  const opponents = players.filter((player) => player.id !== playerId);
  if (!opponents.length) {
    els.playerList.innerHTML = `<div class="empty-state"><div><b>等待其他棋手加入</b><span>開啟另一個瀏覽器或無痕視窗，就能測試即時邀請。</span></div></div>`;
    return;
  }
  els.playerList.replaceChildren(...opponents.map((player) => {
    const row = document.createElement("div");
    row.className = "player-item";
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = initials(player.name);
    const copy = document.createElement("div");
    copy.innerHTML = `<strong></strong><small>● 在線・可邀請</small>`;
    copy.querySelector("strong").textContent = player.name;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = pendingInvites.has(player.id) ? "等待回覆" : "邀請對戰";
    button.disabled = pendingInvites.has(player.id);
    button.addEventListener("click", () => sendInvite(player, button));
    row.append(avatar, copy, button);
    return row;
  }));
}

async function sendInvite(player, button) {
  button.disabled = true;
  button.textContent = "送出中…";
  try {
    await api("/api/invite", { method: "POST", body: JSON.stringify({ fromId: playerId, fromName: playerName, toId: player.id }) });
    pendingInvites.add(player.id);
    button.textContent = "等待回覆";
    showToast(`已邀請 ${player.name} 對戰`);
  } catch (error) {
    button.disabled = false;
    button.textContent = "邀請對戰";
    showToast(error.message);
  }
}

async function respondInvite(accept) {
  if (!currentInvite) return;
  const invite = currentInvite;
  currentInvite = null;
  els.inviteDialog.close();
  try {
    const data = await api("/api/invite/respond", { method: "POST", body: JSON.stringify({ inviteId: invite.id, playerId, accept }) });
    if (accept) await startOnlineGame(data.gameId);
    else showToast("已婉拒這次邀請");
  } catch (error) {
    showToast(error.message);
  }
}

async function startOnlineGame(gameId) {
  stopLobbyPolling();
  gameMode = "online";
  els.gameModeLabel.textContent = "ONLINE MATCH";
  els.gameTitle.textContent = "線上一對一對戰";
  els.opponentTag.textContent = "在線";
  els.undoMove.hidden = true;
  els.restartGame.hidden = true;
  showView("game");
  await fetchOnlineGame(gameId);
  window.clearInterval(onlineTimer);
  onlineTimer = window.setInterval(() => fetchOnlineGame(gameId), 800);
}

async function fetchOnlineGame(gameId) {
  try {
    const data = await api(`/api/game/${encodeURIComponent(gameId)}?playerId=${encodeURIComponent(playerId)}`);
    const me = data.players.find((player) => player.id === playerId);
    const opponent = data.players.find((player) => player.id !== playerId);
    game = {
      ...data,
      myColor: me.color,
      board: data.board,
      moves: data.moves,
      winLine: data.winLine || []
    };
    els.opponentName.textContent = opponent.name;
    renderBoard();
    if (game.status !== "playing") {
      window.clearInterval(onlineTimer);
      saveCurrentRecord();
    }
  } catch (error) {
    window.clearInterval(onlineTimer);
    showToast(error.message);
  }
}

async function makeOnlineMove(index) {
  if (!game?.id) return;
  try {
    const data = await api(`/api/game/${encodeURIComponent(game.id)}/move`, { method: "POST", body: JSON.stringify({ playerId, index }) });
    game = { ...game, ...data };
    renderBoard();
  } catch (error) {
    showToast(error.message);
  }
}

async function leaveCurrentGame() {
  window.clearTimeout(aiTimer);
  window.clearInterval(onlineTimer);
  if (gameMode === "online" && game?.status === "playing") {
    try {
      await api(`/api/game/${encodeURIComponent(game.id)}/resign`, { method: "POST", body: JSON.stringify({ playerId }) });
    } catch { /* The lobby remains usable if a stale game already ended. */ }
  }
  const destination = gameMode === "online" ? "lobby" : "home";
  gameMode = null;
  game = null;
  showView(destination);
}

function stopLobbyPolling() {
  window.clearInterval(lobbyTimer);
  lobbyTimer = null;
}

function saveCurrentRecord() {
  if (!game || game.status === "playing") return;
  const key = gameMode === "online" ? game.id : `${game.moves.length}-${game.moves.at(-1)?.index}-${game.winner}`;
  if (recordedGameKey === key) return;
  recordedGameKey = key;
  const mine = playerColor();
  const records = JSON.parse(localStorage.getItem("gomoku-records") || "[]");
  records.unshift({
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    mode: gameMode,
    opponent: gameMode === "single" ? els.opponentName.textContent : els.opponentName.textContent,
    moves: game.moves.length,
    result: game.winner === EMPTY ? "draw" : game.winner === mine ? "win" : "loss"
  });
  localStorage.setItem("gomoku-records", JSON.stringify(records.slice(0, 20)));
}

function renderRecords() {
  const records = JSON.parse(localStorage.getItem("gomoku-records") || "[]");
  if (!records.length) {
    els.recordList.innerHTML = `<div class="empty-state panel"><div><b>還沒有對戰紀錄</b><span>完成第一盤棋後，紀錄就會出現在這裡。</span></div></div>`;
    return;
  }
  const resultLabel = { win: "勝利", loss: "惜敗", draw: "和棋" };
  els.recordList.replaceChildren(...records.map((record) => {
    const item = document.createElement("article");
    item.className = "record-item";
    const date = new Intl.DateTimeFormat("zh-TW", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(record.date));
    item.innerHTML = `<div><strong></strong><p></p></div><span class="record-result ${record.result}">${resultLabel[record.result]}</span>`;
    item.querySelector("strong").textContent = `對戰 ${record.opponent}`;
    item.querySelector("p").textContent = `${record.mode === "single" ? "單人模式" : "線上對戰"}・${record.moves} 手・${date}`;
    return item;
  }));
}

document.addEventListener("click", (event) => {
  const viewTrigger = event.target.closest("[data-view]");
  if (viewTrigger) {
    event.preventDefault();
    showView(viewTrigger.dataset.view);
  }
});

document.querySelector("#openSingleSetup").addEventListener("click", () => els.singleDialog.showModal());
document.querySelector("#startSingle").addEventListener("click", startSingleGame);
document.querySelector("#editName").addEventListener("click", () => { els.nameInput.value = playerName; els.nameDialog.showModal(); els.nameInput.focus(); });
document.querySelector("#saveName").addEventListener("click", () => {
  const next = els.nameInput.value.trim();
  if (!next) { els.nameInput.focus(); return; }
  playerName = next.slice(0, 16);
  localStorage.setItem("gomoku-player-name", playerName);
  updateIdentity();
  els.nameDialog.close();
  if (activeView === "lobby") fetchLobby();
});
els.nameInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); document.querySelector("#saveName").click(); } });
document.querySelector("#acceptInvite").addEventListener("click", () => respondInvite(true));
document.querySelector("#declineInvite").addEventListener("click", () => respondInvite(false));
document.querySelector("#leaveGame").addEventListener("click", leaveCurrentGame);
els.refreshLobby.addEventListener("click", fetchLobby);
els.board.addEventListener("click", handleBoardClick);
els.undoMove.addEventListener("click", undoSingleMove);
els.restartGame.addEventListener("click", restartSingle);
window.addEventListener("beforeunload", () => { window.clearInterval(lobbyTimer); window.clearInterval(onlineTimer); });

updateIdentity();
updateHostingStatus();
showView("home");
