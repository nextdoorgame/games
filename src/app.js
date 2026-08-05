import { shouldApplyOnlineSnapshot } from "./game-sync.js";
import { deviceId, playerId } from "./player-identity.js?v=neighbor-8";
import { chooseAiMove } from "./ai.js?v=platform-1";
import { applyXiangqiMove, createInitialXiangqiBoard, getXiangqiMovesFrom, getXiangqiWinner, otherXiangqiColor, xiangqiPieceColor, xiangqiPieceLabel } from "./xiangqi.js?v=platform-1";
import { authHeaders, changePassword, currentAccount, finishRewardGame, login, logout, register, restoreSession, startRewardGame } from "./account.js?v=neighbor-1";

const SIZE = 19;
const BLACK = 1;
const WHITE = 2;
const EMPTY = 0;
const configuredApiBase = String(window.GOMOKU_CONFIG?.apiBaseUrl || "").trim().replace(/\/$/, "");
const API_BASE = configuredApiBase;
const ONLINE_AVAILABLE = Boolean(API_BASE);
const ONLINE_GAME_META = {
  gomoku: { name: "五子棋", players: [2] }, xiangqi: { name: "中國象棋", players: [2] }, reversi: { name: "黑白棋", players: [2] },
  checkers: { name: "中國跳棋", players: [2, 3] }, mahjong: { name: "麻將", players: [2, 3, 4] }, bigtwo: { name: "大老二", players: [3, 4, 5] },
  banqi: { name: "暗棋", players: [2] }, chess: { name: "西洋棋", players: [2] }, go: { name: "圍棋", players: [2] },
  blackjack: { name: "二十一點", players: [3, 4, 5] }, pickred: { name: "撿紅點", players: [3, 4, 5] }, ninetynine: { name: "九九", players: [3, 4, 5] },
  tetris: { name: "俄羅斯方塊", players: [2] }, volleyball: { name: "皮卡丘排球", players: [2] }, racing: { name: "賽車障礙", players: [2] }, brickbreaker: { name: "隔壁打磚塊", players: [2] }
};
const DUEL_INVITE_GAMES = new Set(["gomoku", "xiangqi"]);

const els = {
  views: [...document.querySelectorAll(".view")],
  gameView: document.querySelector("#gameView"),
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
  onlineSeriesDialog: document.querySelector("#onlineSeriesDialog"),
  roundEndDialog: document.querySelector("#roundEndDialog"),
  nameDialog: document.querySelector("#nameDialog"),
  nameInput: document.querySelector("#nameInput"),
  inviterName: document.querySelector("#inviterName"),
  inviterSeriesLabel: document.querySelector("#inviterSeriesLabel"),
  onlineOpponentName: document.querySelector("#onlineOpponentName"),
  onlineInviteGameSelect: document.querySelector("#onlineInviteGameSelect"),
  onlineInvitePlayerCount: document.querySelector("#onlineInvitePlayerCount"),
  onlineInvitePlayerFieldset: document.querySelector("#onlineInvitePlayerFieldset"),
  onlineSeriesFieldset: document.querySelector("#onlineSeriesFieldset"),
  onlineFirstMoveFieldset: document.querySelector("#onlineFirstMoveFieldset"),
  onlineTurnTimeFieldset: document.querySelector("#onlineTurnTimeFieldset"),
  onlineInviteHint: document.querySelector("#onlineInviteHint"),
  onlineInviteRoomPassword: document.querySelector("#onlineInviteRoomPassword"),
  inviteGameName: document.querySelector("#inviteGameName"),
  invitePasswordField: document.querySelector("#invitePasswordField"),
  invitePasswordInput: document.querySelector("#invitePasswordInput"),
  singleDialogTitle: document.querySelector("#singleDialogTitle"),
  singleDialogDescription: document.querySelector("#singleDialogDescription"),
  singleColorLegend: document.querySelector("#singleColorLegend"),
  singleFirstColor: document.querySelector("#singleFirstColor"),
  singleSecondColor: document.querySelector("#singleSecondColor"),
  engineNote: document.querySelector("#engineNote"),
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
  seriesFormat: document.querySelector("#seriesFormat"),
  roundLabel: document.querySelector("#roundLabel"),
  mySeriesScore: document.querySelector("#mySeriesScore"),
  opponentSeriesScore: document.querySelector("#opponentSeriesScore"),
  turnTimer: document.querySelector("#turnTimer"),
  turnTimerLabel: document.querySelector("#turnTimerLabel"),
  turnTimerHint: document.querySelector("#turnTimerHint"),
  turnCountdown: document.querySelector("#turnCountdown"),
  roundEndIcon: document.querySelector("#roundEndIcon"),
  roundEndTitle: document.querySelector("#roundEndTitle"),
  roundEndMessage: document.querySelector("#roundEndMessage"),
  roundMyName: document.querySelector("#roundMyName"),
  roundMyScore: document.querySelector("#roundMyScore"),
  roundOpponentScore: document.querySelector("#roundOpponentScore"),
  roundOpponentName: document.querySelector("#roundOpponentName"),
  nextColorMessage: document.querySelector("#nextColorMessage"),
  endSeries: document.querySelector("#endSeries"),
  continueSeries: document.querySelector("#continueSeries"),
  gameStatus: document.querySelector("#gameStatus"),
  onlineChat: document.querySelector("#onlineChat"),
  chatMessages: document.querySelector("#chatMessages"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  sendChat: document.querySelector("#sendChat"),
  undoMove: document.querySelector("#undoMove"),
  restartGame: document.querySelector("#restartGame"),
  recordList: document.querySelector("#recordList")
};
Object.assign(els, {
  authDialog: document.querySelector("#authDialog"), accountDialog: document.querySelector("#accountDialog"), walletBalance: document.querySelector("#walletBalance"),
  lobbyLoginButton: document.querySelector("#lobbyLoginButton"), authError: document.querySelector("#authError"), submitAuth: document.querySelector("#submitAuth"),
  loginFields: document.querySelector("#loginFields"), registerFields: document.querySelector("#registerFields"), onlineWagerField: document.querySelector("#onlineWagerField")
});

let playerName = localStorage.getItem("gomoku-player-name") || `棋手 ${String(Math.floor(Math.random() * 9000) + 1000)}`;

let activeView = "home";
let gameMode = null;
let game = null;
let aiTimer = null;
let aiWorker = null;
let aiRequest = 0;
let lobbyTimer = null;
let onlineTimer = null;
let onlineClockTimer = null;
let currentInvite = null;
let isRespondingInvite = false;
let pendingInvitePlayer = null;
let pendingInviteButton = null;
let pendingInvites = new Set();
let toastTimer = null;
let isFetchingLobby = false;
let isFetchingOnlineGame = false;
let recordedGameKey = "";
let series = null;
let roundDialogKey = "";
let onlineMatchClosedHandled = false;
let renderedChatKey = "";
let lastAutomaticMoveKey = "";
let pendingSingleGameType = "gomoku";
let preferredOnlineGameType = "gomoku";
let lastActiveRoomSignal = "";

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

function formatCoins(value) { return new Intl.NumberFormat("zh-TW").format(Number(value) || 0); }

function syncAccountUi(detail = {}) {
  const account = currentAccount();
  if (account) {
    playerName = account.displayName;
    localStorage.setItem("gomoku-player-name", playerName);
    els.walletBalance.textContent = formatCoins(account.balance);
    els.lobbyLoginButton.textContent = `${account.displayName}・${formatCoins(account.balance)} 幣`;
    document.querySelector("#accountDisplayName").textContent = account.displayName;
    document.querySelector("#accountUsername").textContent = account.username;
    document.querySelector("#accountBalance").textContent = formatCoins(account.balance);
    document.querySelector("#accountDailyStatus").textContent = account.dailyClaimedToday ? "今日 +1,000 已領取" : "今日活動尚未完成";
  } else {
    els.walletBalance.textContent = "登入領取";
    els.lobbyLoginButton.textContent = "登入固定名稱";
  }
  updateIdentity();
  if (detail.reward) showToast(`戰勝 AI，獲得 +${formatCoins(detail.reward)} 織音幣`);
  else if (detail.bonus) showToast(`每日活動獎勵 +${formatCoins(detail.bonus)} 織音幣`);
  else if (detail.error) showToast(detail.error);
}

function openAccountUi() {
  if (currentAccount()) { syncAccountUi(); els.accountDialog.showModal(); }
  else { showAuthMode("login"); els.authDialog.showModal(); }
}

function showAuthMode(mode) {
  const registering = mode === "register";
  els.loginFields.hidden = registering;
  els.registerFields.hidden = !registering;
  document.querySelector("#showLoginTab").classList.toggle("active", !registering);
  document.querySelector("#showRegisterTab").classList.toggle("active", registering);
  els.submitAuth.textContent = registering ? "建立帳號並領取 100,000 →" : "登入 →";
  els.submitAuth.dataset.mode = registering ? "register" : "login";
  els.authError.textContent = "";
}

async function submitAuthForm() {
  els.submitAuth.disabled = true;
  els.authError.textContent = "";
  try {
    if (els.submitAuth.dataset.mode === "register") await register({ username: document.querySelector("#registerUsername").value, password: document.querySelector("#registerPassword").value, displayName: document.querySelector("#registerDisplayName").value });
    else await login({ username: document.querySelector("#loginUsername").value, password: document.querySelector("#loginPassword").value });
    els.authDialog.close();
    syncAccountUi();
    fetchLobby();
  } catch (error) { els.authError.textContent = error.message; }
  finally { els.submitAuth.disabled = false; }
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

function cancelAiMove() {
  window.clearTimeout(aiTimer);
  aiTimer = null;
  aiRequest += 1;
  if (aiWorker) aiWorker.terminate();
  aiWorker = null;
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
  }
  if (ONLINE_AVAILABLE && name !== "game") startLobbyPolling();
  if (name === "records") renderRecords();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderStaticLobby() {
  els.onlineCount.textContent = "0";
  els.lobbyCount.textContent = "0";
  els.playerList.innerHTML = `<div class="empty-state"><div><b>線上服務尚未設定</b><span>GitHub Pages 已可執行單人模式。若要開啟大廳，請在 config.js 填入已部署後端的 HTTPS 網址。</span></div></div>`;
}

function resetGameState(mode, options = {}) {
  cancelAiMove();
  els.board.removeAttribute("data-ai-engine");
  els.board.removeAttribute("data-ai-depth");
  recordedGameKey = "";
  gameMode = mode;
  const gameType = options.gameType || "gomoku";
  game = {
    gameType,
    board: gameType === "xiangqi" ? createInitialXiangqiBoard() : Array(SIZE * SIZE).fill(EMPTY),
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
  if (game.gameType === "xiangqi") renderXiangqiBoard();
  else renderGomokuBoard();
  renderGamePanel();
}

function renderGomokuBoard() {
  const lastIndex = game.moves.at(-1)?.index ?? -1;
  const winIndexes = new Set(game.winLine || []);
  els.board.className = "board";
  els.board.setAttribute("aria-label", "十九路五子棋棋盤");
  if (els.board.children.length !== SIZE * SIZE || els.board.dataset.gameType !== "gomoku") {
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < SIZE * SIZE; index += 1) {
      const row = Math.floor(index / SIZE);
      const col = index % SIZE;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "intersection";
      button.style.left = `${(col / (SIZE - 1)) * 100}%`;
      button.style.top = `${(row / (SIZE - 1)) * 100}%`;
      button.dataset.index = String(index);
      button.dataset.stone = String(EMPTY);
      button.setAttribute("role", "gridcell");
      fragment.append(button);
    }
    els.board.replaceChildren(fragment);
    els.board.dataset.gameType = "gomoku";
  }

  game.board.forEach((stone, index) => {
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const button = els.board.children[index];
    button.className = `intersection${stone ? " occupied" : ""}${lastIndex === index ? " last" : ""}${winIndexes.has(index) ? " win" : ""}`;
    button.setAttribute("aria-label", `${String.fromCharCode(65 + col)}${row + 1}${stone === BLACK ? " 黑棋" : stone === WHITE ? " 白棋" : " 空位"}`);
    if (Number(button.dataset.stone) !== stone) {
      button.dataset.stone = String(stone);
      button.replaceChildren();
      if (stone) {
        const piece = document.createElement("span");
        piece.className = `game-stone ${stone === BLACK ? "black" : "white"} new`;
        button.append(piece);
      }
    }
  });
}

function renderXiangqiBoard() {
  const lastIndex = game.moves.at(-1)?.to ?? -1;
  const legalTargets = new Set((game.legalMoves || []).map((move) => move.to));
  els.board.className = "board xiangqi-board";
  els.board.setAttribute("aria-label", "中國象棋棋盤，九路十行");
  if (els.board.children.length !== 90 || els.board.dataset.gameType !== "xiangqi") {
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 90; index += 1) {
      const row = Math.floor(index / 9);
      const col = index % 9;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "intersection";
      button.style.left = `${(col / 8) * 100}%`;
      button.style.top = `${(row / 9) * 100}%`;
      button.dataset.index = String(index);
      button.setAttribute("role", "gridcell");
      fragment.append(button);
    }
    els.board.replaceChildren(fragment);
    els.board.dataset.gameType = "xiangqi";
  }
  game.board.forEach((piece, index) => {
    const button = els.board.children[index];
    const color = xiangqiPieceColor(piece);
    const selected = game.selectedIndex === index;
    const legal = legalTargets.has(index);
    button.className = `intersection${piece ? " occupied" : ""}${selected ? " selected" : ""}${legal ? ` legal${piece ? " capture" : ""}` : ""}${lastIndex === index ? " last" : ""}`;
    button.setAttribute("aria-label", `${String.fromCharCode(65 + (index % 9))}${Math.floor(index / 9) + 1}${piece ? ` ${color === BLACK ? "紅方" : "黑方"}${xiangqiPieceLabel(piece)}` : " 空位"}`);
    if (button.dataset.piece !== (piece || "")) {
      button.dataset.piece = piece || "";
      button.replaceChildren();
      if (piece) {
        const token = document.createElement("span");
        token.className = `xiangqi-piece ${color === BLACK ? "red" : "black"}`;
        token.textContent = xiangqiPieceLabel(piece);
        button.append(token);
      }
    }
  });
}

function playerColor() {
  if (gameMode === "single") return game.playerColor;
  if (gameMode === "online") return game.myColor;
  return BLACK;
}

function renderGamePanel() {
  if (!game) return;
  const isXiangqi = game.gameType === "xiangqi";
  const myColor = playerColor();
  const myTurn = game.status === "playing" && game.turn === myColor;
  const colorName = isXiangqi ? (game.turn === BLACK ? "紅方" : "黑方") : (game.turn === BLACK ? "黑棋" : "白棋");
  els.moveCount.textContent = String(game.moves.length);
  els.turnPill.classList.toggle("waiting", !myTurn && game.status === "playing");
  els.turnPill.classList.toggle("finished", game.status !== "playing");
  els.turnPill.querySelector("i").style.background = isXiangqi ? (game.turn === BLACK ? "#b94136" : "#222") : (game.turn === BLACK ? "#222" : "#eee");
  els.turnPill.querySelector("span").textContent = game.status !== "playing" ? "本局已結束" : myTurn ? "輪到你了" : `${colorName}思考中`;
  els.meRow.classList.toggle("active", myTurn);
  els.opponentRow.classList.toggle("active", !myTurn && game.status === "playing");
  renderSeriesPanel();

  const myStone = els.meRow.querySelector(".stone-icon");
  const opponentStone = els.opponentRow.querySelector(".stone-icon");
  if (isXiangqi) {
    myStone.className = `stone-icon xiangqi-icon ${myColor === BLACK ? "red" : "black"}`;
    myStone.textContent = myColor === BLACK ? "帥" : "將";
    opponentStone.className = `stone-icon xiangqi-icon ${myColor === BLACK ? "black" : "red"}`;
    opponentStone.textContent = myColor === BLACK ? "將" : "帥";
  } else {
    myStone.textContent = "";
    opponentStone.textContent = "";
    myStone.className = `stone-icon ${myColor === BLACK ? "black-stone" : "white-stone"}`;
    opponentStone.className = `stone-icon ${myColor === BLACK ? "white-stone" : "black-stone"}`;
  }

  if (game.status === "playing") {
    if (isXiangqi) els.gameStatus.textContent = myTurn ? `輪到你執${myColor === BLACK ? "紅" : "黑"}方，請選擇棋子。` : gameMode === "single" ? "象棋 AI 正在分析棋局…" : "等待對手走棋，棋局會自動同步。";
    else els.gameStatus.textContent = myTurn ? `輪到你執${myColor === BLACK ? "黑" : "白"}棋，請選擇交叉點落子。` : gameMode === "single" ? "AI 正在分析棋局…" : "等待對手落子，棋局會自動同步。";
  } else if (game.winner === EMPTY) {
    els.gameStatus.textContent = "棋盤已滿，本局和棋。";
  } else {
    els.gameStatus.textContent = game.winner === myColor ? (isXiangqi ? "漂亮！你將死對手，贏得本局。" : "漂亮！你率先連成五子，贏得本局。") : (isXiangqi ? "對手將死你的主帥，本局結束。" : "對手率先連成五子，本局結束。");
  }

  els.undoMove.hidden = gameMode !== "single";
  els.undoMove.disabled = gameMode !== "single" || game.status !== "playing" || game.moves.length <= (game.playerColor === WHITE ? 1 : 0);
  els.restartGame.hidden = gameMode !== "single";
  els.turnTimer.hidden = !["single", "online"].includes(gameMode);
  els.onlineChat.hidden = gameMode !== "online";
  renderTurnClock();
}

function renderSeriesPanel() {
  if (!game) return;
  const bestOf = gameMode === "single" ? series?.bestOf || 3 : game.bestOf || 3;
  const round = gameMode === "single" ? series?.round || 1 : game.round || 1;
  const myScore = gameMode === "single" ? series?.myWins || 0 : game.scores?.[playerId] || 0;
  const opponent = gameMode === "online" ? game.players?.find((item) => item.id !== playerId) : null;
  const opponentScore = gameMode === "single" ? series?.opponentWins || 0 : game.scores?.[opponent?.id] || 0;
  els.seriesFormat.textContent = bestOf === 5 ? "五戰三勝" : "三戰兩勝";
  els.roundLabel.textContent = `第 ${round} 局・每局交換先後手`;
  els.mySeriesScore.textContent = String(myScore);
  els.opponentSeriesScore.textContent = String(opponentScore);
}

function renderTurnClock() {
  if (!game) return;
  if (gameMode === "single") {
    els.turnTimerLabel.textContent = "你的思考時間";
    els.turnTimerHint.textContent = "單人模式沒有時間限制";
    els.turnCountdown.textContent = "無限";
    els.turnTimer.classList.remove("warning");
    return;
  }
  if (gameMode !== "online" || !game.turnTimeMs) return;
  els.turnTimerHint.textContent = "逾時將自動隨機落子";
  if (game.status !== "playing") {
    els.turnTimerLabel.textContent = "本局已結束";
    els.turnCountdown.textContent = "00:00";
    els.turnTimer.classList.remove("warning");
    return;
  }
  const turnPlayer = game.players?.find((player) => player.color === game.turn);
  const serverNow = Date.now() + (game.clockOffsetMs || 0);
  const remainingMs = Math.max(0, game.turnStartedAt + game.turnTimeMs - serverNow);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  els.turnTimerLabel.textContent = turnPlayer?.id === playerId ? "你的下棋時間" : `${turnPlayer?.name || "對手"}的下棋時間`;
  els.turnCountdown.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  els.turnTimer.classList.toggle("warning", remainingSeconds <= 15);
}

function renderOnlineChat(messages = []) {
  const latestId = messages.at(-1)?.id || "empty";
  const key = `${messages.length}:${latestId}`;
  if (key === renderedChatKey) return;
  renderedChatKey = key;
  if (!messages.length) {
    els.chatMessages.innerHTML = `<p class="chat-empty">還沒有訊息，打聲招呼吧！</p>`;
    return;
  }
  els.chatMessages.replaceChildren(...messages.map((message) => {
    const item = document.createElement("article");
    item.className = `chat-message${message.playerId === playerId ? " mine" : ""}`;
    const meta = document.createElement("small");
    const time = new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt));
    meta.textContent = `${message.playerId === playerId ? "你" : message.name}・${time}`;
    const copy = document.createElement("p");
    copy.textContent = message.text;
    item.append(meta, copy);
    return item;
  }));
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
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
  } else if (game.moves.length === SIZE * SIZE) {
    game.status = "finished";
  } else {
    game.turn = color === BLACK ? WHITE : BLACK;
  }
  return true;
}

function placeLocalXiangqiMove(move, color) {
  if (!move || game.status !== "playing") return false;
  const piece = game.board[move.from];
  const captured = game.board[move.to];
  game.board = applyXiangqiMove(game.board, move);
  game.moves.push({ ...move, piece, captured, color });
  game.selectedIndex = null;
  game.legalMoves = [];
  const nextTurn = otherXiangqiColor(color);
  game.winner = getXiangqiWinner(game.board, nextTurn);
  if (game.winner) game.status = "finished";
  else game.turn = nextTurn;
  return true;
}

function handleXiangqiClick(index) {
  const myColor = playerColor();
  if (game.turn !== myColor) return;
  const selectedMove = (game.legalMoves || []).find((move) => move.to === index);
  if (selectedMove) {
    if (gameMode === "single") {
      placeLocalXiangqiMove(selectedMove, game.playerColor);
      renderBoard();
      if (game.status === "playing") scheduleAiMove(); else settleSingleRound();
    } else if (gameMode === "online") makeOnlineMove(selectedMove);
    return;
  }
  if (xiangqiPieceColor(game.board[index]) === myColor) {
    game.selectedIndex = index;
    game.legalMoves = getXiangqiMovesFrom(game.board, myColor, index);
  } else {
    game.selectedIndex = null;
    game.legalMoves = [];
  }
  renderBoard();
}

function handleBoardClick(event) {
  const button = event.target.closest(".intersection");
  if (!button || !game || game.status !== "playing") return;
  const index = Number(button.dataset.index);
  if (game.gameType === "xiangqi") {
    handleXiangqiClick(index);
    return;
  }
  if (gameMode === "single") {
    if (game.turn !== game.playerColor || !placeLocalStone(index, game.playerColor)) return;
    renderBoard();
    if (game.status === "playing") scheduleAiMove();
    else settleSingleRound();
  } else if (gameMode === "online" && game.turn === game.myColor) {
    makeOnlineMove(index);
  }
}

function scheduleAiMove() {
  if (game?.gameType === "xiangqi") {
    scheduleXiangqiAiMove();
    return;
  }
  cancelAiMove();
  const requestId = aiRequest;
  aiTimer = window.setTimeout(() => {
    if (gameMode !== "single" || game.status !== "playing" || game.turn !== game.aiColor) return;
    const expectedMoveCount = game.moves.length;
    const difficulty = game.difficulty;
    const thinkLabels = { easy: "4 秒", medium: "8 秒", hard: "15 秒全力" };
    els.gameStatus.textContent = `Rapfi 正在進行 ${thinkLabels[difficulty]}搜尋…`;

    const finishMove = (index) => {
      if (requestId !== aiRequest || gameMode !== "single" || game.status !== "playing" || game.turn !== game.aiColor || game.moves.length !== expectedMoveCount) return;
      if (!Number.isInteger(index) || index < 0 || game.board[index] !== EMPTY) return;
      placeLocalStone(index, game.aiColor);
      renderBoard();
      if (game.status !== "playing") settleSingleRound();
    };

    const worker = new Worker(new URL("./ai-worker.js?v=board-19-1", import.meta.url));
    aiWorker = worker;
    worker.addEventListener("message", (event) => {
      worker.terminate();
      if (aiWorker === worker) aiWorker = null;
      els.board.dataset.aiEngine = event.data.engine || "unknown";
      els.board.dataset.aiDepth = String(event.data.depth || 0);
      if (event.data.engine !== "rapfi") showToast("Rapfi 無法載入，已切換備援 AI");
      finishMove(event.data.index);
    }, { once: true });
    worker.addEventListener("error", (event) => {
      event.preventDefault();
      worker.terminate();
      if (aiWorker === worker) aiWorker = null;
      if (requestId !== aiRequest || !game) return;
      const fallback = chooseAiMove([...game.board], game.aiColor, game.playerColor, difficulty);
      finishMove(fallback);
    }, { once: true });
    worker.postMessage({ board: [...game.board], aiColor: game.aiColor, humanColor: game.playerColor, difficulty });
  }, 260);
}

function scheduleXiangqiAiMove() {
  cancelAiMove();
  const requestId = aiRequest;
  aiTimer = window.setTimeout(() => {
    if (gameMode !== "single" || game.status !== "playing" || game.turn !== game.aiColor) return;
    const expectedMoveCount = game.moves.length;
    els.gameStatus.textContent = "象棋 AI 正在推演局面…";
    const worker = new Worker(new URL("./xiangqi-worker.js?v=platform-1", import.meta.url), { type: "module" });
    aiWorker = worker;
    worker.addEventListener("message", (event) => {
      worker.terminate();
      if (aiWorker === worker) aiWorker = null;
      if (requestId !== aiRequest || gameMode !== "single" || game.status !== "playing" || game.moves.length !== expectedMoveCount) return;
      els.board.dataset.aiEngine = event.data.engine || "xiangqi-alpha-beta";
      els.board.dataset.aiDepth = String(event.data.depth || 0);
      if (!event.data.move || !placeLocalXiangqiMove(event.data.move, game.aiColor)) return;
      renderBoard();
      if (game.status !== "playing") settleSingleRound();
    }, { once: true });
    worker.addEventListener("error", () => {
      worker.terminate();
      if (aiWorker === worker) aiWorker = null;
      showToast("象棋 AI 暫時無法完成運算，請重新開始");
    }, { once: true });
    worker.postMessage({ board: [...game.board], aiColor: game.aiColor, difficulty: game.difficulty });
  }, 260);
}

function openSingleSetup(gameType) {
  pendingSingleGameType = gameType === "xiangqi" ? "xiangqi" : "gomoku";
  const xiangqi = pendingSingleGameType === "xiangqi";
  els.singleDialogTitle.textContent = xiangqi ? "設定中國象棋挑戰" : "設定五子棋挑戰";
  els.singleDialogDescription.textContent = "選擇 AI 強度、系列賽制與第一局執棋顏色，之後每局會交換先後手。";
  els.singleColorLegend.textContent = xiangqi ? "第一局執棋方" : "第一局執棋顏色";
  els.singleFirstColor.innerHTML = xiangqi ? '<i class="mini-stone xiangqi-icon red">帥</i>紅方先手' : '<i class="mini-stone black-stone"></i>黑棋先手';
  els.singleSecondColor.innerHTML = xiangqi ? '<i class="mini-stone xiangqi-icon black">將</i>黑方後手' : '<i class="mini-stone white-stone"></i>白棋後手';
  els.engineNote.hidden = xiangqi;
  const details = xiangqi ? ["基礎搜尋 2 層", "進階搜尋 3 層", "深入搜尋 4 層"] : ["Mix9sVQ 搜尋 4 秒", "Mix9sVQ 搜尋 8 秒", "Mix9sVQ 全力 15 秒"];
  els.singleDialog.querySelectorAll(".difficulty-grid small").forEach((item, index) => { item.textContent = details[index]; });
  els.singleDialog.showModal();
}

function startSingleGame() {
  const form = els.singleDialog.querySelector("form");
  const data = new FormData(form);
  const difficulty = data.get("difficulty") || "medium";
  const color = data.get("color") === "white" ? WHITE : BLACK;
  const bestOf = Number(data.get("bestOf")) === 5 ? 5 : 3;
  const gameType = pendingSingleGameType;
  series = { mode: "single", gameType, bestOf, target: Math.ceil(bestOf / 2), round: 1, myWins: 0, opponentWins: 0, draws: 0, initialPlayerColor: color };
  const labels = { easy: "初級", medium: "進階", hard: "困難" };
  els.gameModeLabel.textContent = gameType === "xiangqi" ? "CHINESE CHESS" : "GOMOKU";
  els.gameTitle.textContent = gameType === "xiangqi" ? `中國象棋・${labels[difficulty]} AI` : `五子棋・${labels[difficulty]} AI`;
  els.opponentName.textContent = gameType === "xiangqi" ? (difficulty === "easy" ? "象棋學徒 AI" : difficulty === "hard" ? "象棋棋聖 AI" : "象棋棋手 AI") : (difficulty === "easy" ? "Rapfi 戰術家" : difficulty === "hard" ? "Rapfi 棋聖" : "Rapfi 棋手");
  els.opponentTag.textContent = labels[difficulty];
  els.singleDialog.close();
  startSingleRound(difficulty);
}

function startSingleRound(difficulty = game?.difficulty || "medium") {
  const playerColor = series.round % 2 === 1 ? series.initialPlayerColor : series.initialPlayerColor === BLACK ? WHITE : BLACK;
  resetGameState("single", { gameType: series.gameType, difficulty, playerColor, aiColor: playerColor === BLACK ? WHITE : BLACK, roundSettled: false, selectedIndex: null, legalMoves: [] });
  roundDialogKey = "";
  els.gameView?.classList?.toggle?.("xiangqi-theme", series.gameType === "xiangqi");
  showView("game");
  renderBoard();
  startRewardGame(series.gameType);
  if (game.aiColor === BLACK) scheduleAiMove();
}

function settleSingleRound() {
  if (gameMode !== "single" || game.status === "playing" || game.roundSettled) return;
  game.roundSettled = true;
  if (game.winner === game.playerColor) series.myWins += 1;
  else if (game.winner === game.aiColor) series.opponentWins += 1;
  else series.draws += 1;
  finishRewardGame(game.winner === game.playerColor ? "win" : game.winner === game.aiColor ? "loss" : "draw");
  saveCurrentRecord();
  renderGamePanel();
  showRoundEndDialog();
}

function undoSingleMove() {
  if (gameMode !== "single" || !game.moves.length) return;
  cancelAiMove();
  const minimum = game.playerColor === WHITE ? 1 : 0;
  if (game.moves.length <= minimum) return;

  const removeCount = game.turn === game.aiColor && game.status === "playing" ? 1 : 2;
  for (let i = 0; i < removeCount && game.moves.length > minimum; i += 1) {
    const move = game.moves.pop();
    if (game.gameType === "xiangqi") {
      game.board[move.from] = move.piece;
      game.board[move.to] = move.captured || null;
    } else game.board[move.index] = EMPTY;
  }
  game.status = "playing";
  game.winner = EMPTY;
  game.winLine = [];
  game.selectedIndex = null;
  game.legalMoves = [];
  game.turn = game.moves.length % 2 === 0 ? BLACK : WHITE;
  recordedGameKey = "";
  renderBoard();
}

function restartSingle() {
  if (gameMode !== "single") return;
  const { gameType, difficulty, playerColor, aiColor } = game;
  resetGameState("single", { gameType, difficulty, playerColor, aiColor, roundSettled: false, selectedIndex: null, legalMoves: [] });
  startRewardGame(gameType);
  renderBoard();
  if (aiColor === BLACK) scheduleAiMove();
}

async function api(path, options = {}) {
  if (!ONLINE_AVAILABLE) throw new Error("線上服務尚未設定，單人模式仍可正常遊玩");
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...authHeaders(), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "連線發生問題");
  return data;
}

async function fetchLobby() {
  if (isFetchingLobby) return;
  isFetchingLobby = true;
  try {
    const data = await api(`/api/lobby?playerId=${encodeURIComponent(playerId)}&deviceId=${encodeURIComponent(deviceId)}&name=${encodeURIComponent(playerName)}`);
    els.onlineCount.textContent = String(Math.max(0, data.onlineCount - 1));
    els.lobbyCount.textContent = String(Math.max(0, data.onlineCount - 1));
    renderPlayers(data.players);
    window.dispatchEvent(new CustomEvent("neighbor-online-players", { detail: data.players }));
    pendingInvites = new Set(data.outgoingInvites.map((invite) => invite.toId));
    if (data.activeGame && gameMode !== "online") {
      await startOnlineGame(data.activeGame);
    } else if (data.incomingInvites.length && !currentInvite && !els.inviteDialog.open) {
      currentInvite = data.incomingInvites[0];
      els.inviterName.textContent = currentInvite.fromName;
      const meta = ONLINE_GAME_META[currentInvite.gameType] || ONLINE_GAME_META.gomoku;
      const inviteIsXiangqi = currentInvite.gameType === "xiangqi";
      els.inviteGameName.textContent = meta.name;
      if (DUEL_INVITE_GAMES.has(currentInvite.gameType)) {
        const inviterIsBlack = currentInvite.inviterColor !== WHITE;
        const firstRoundLabel = inviteIsXiangqi ? (inviterIsBlack ? "對方執紅先手・你執黑後手" : "你執紅先手・對方執黑後手") : (inviterIsBlack ? "對方執黑先手・你執白後手" : "你執黑先手・對方執白後手");
        els.inviterSeriesLabel.textContent = `${currentInvite.bestOf === 5 ? "五戰三勝" : "三戰兩勝"}・${firstRoundLabel}・每步 ${currentInvite.turnTimeMinutes || 3} 分鐘${currentInvite.wager ? `・下注 ${formatCoins(currentInvite.wager)} 織音幣` : ""}`;
      } else els.inviterSeriesLabel.textContent = `${currentInvite.maxPlayers || 2} 人房・接受後進入房間等待房主開局${currentInvite.wager ? `・下注 ${formatCoins(currentInvite.wager)} 織音幣` : ""}`;
      els.invitePasswordField.hidden = !currentInvite.hasPassword;
      els.invitePasswordInput.value = "";
      els.inviteDialog.showModal();
    } else if (data.activeRoom) {
      const signal = `${data.activeRoom.id}:${data.activeRoom.status}:${data.activeRoom.launchAt || 0}`;
      if (signal !== lastActiveRoomSignal) {
        lastActiveRoomSignal = signal;
        window.NEIGHBOR_PENDING_ROOM = data.activeRoom;
        window.dispatchEvent(new CustomEvent("neighbor-room-invite-accepted", { detail: data.activeRoom }));
      }
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
    button.addEventListener("click", () => prepareOnlineInvite(player, button));
    row.append(avatar, copy, button);
    return row;
  }));
}

function prepareOnlineInvite(player, button) {
  pendingInvitePlayer = player;
  pendingInviteButton = button;
  els.onlineOpponentName.textContent = player.name;
  els.onlineInviteRoomPassword.value = "";
  configureInviteGame(window.NEIGHBOR_SELECTED_ROOM_GAME || preferredOnlineGameType);
  els.onlineSeriesDialog.showModal();
}

function configureInviteGame(gameType) {
  const normalized = ONLINE_GAME_META[gameType] ? gameType : "gomoku";
  const meta = ONLINE_GAME_META[normalized];
  preferredOnlineGameType = normalized;
  els.onlineInviteGameSelect.value = normalized;
  els.onlineInvitePlayerCount.replaceChildren(...meta.players.map((count) => {
    const option = document.createElement("option"); option.value = count; option.textContent = `${count} 人`; return option;
  }));
  const isDuel = DUEL_INVITE_GAMES.has(normalized);
  els.onlineInvitePlayerFieldset.hidden = meta.players.length === 1;
  els.onlineSeriesFieldset.hidden = !isDuel;
  els.onlineFirstMoveFieldset.hidden = !isDuel;
  els.onlineTurnTimeFieldset.hidden = !isDuel;
  els.onlineInviteHint.textContent = isDuel ? "時間用完仍未落子時，伺服器會隨機替該玩家下一步。" : "接受邀請後會進入同一個房間；房主開局時，全房會一起倒數 5 秒。";
  els.onlineWagerField.hidden = Number(els.onlineInvitePlayerCount.value) !== 2;
}

async function sendInvite(player, button, gameType, maxPlayers, bestOf, inviterColor, turnTimeMinutes, password, wager) {
  button.disabled = true;
  button.textContent = "送出中…";
  try {
    await api("/api/invite", { method: "POST", body: JSON.stringify({ fromId: playerId, fromName: playerName, toId: player.id, gameType, maxPlayers, bestOf, inviterColor, turnTimeMinutes, password, wager }) });
    pendingInvites.add(player.id);
    button.textContent = "等待回覆";
    els.onlineSeriesDialog.close();
    showToast(`已邀請 ${player.name} 加入${ONLINE_GAME_META[gameType]?.name || "遊戲"}`);
  } catch (error) {
    button.disabled = false;
    button.textContent = "邀請對戰";
    showToast(error.message);
  }
}

async function respondInvite(accept) {
  if (!currentInvite || isRespondingInvite) return;
  const invite = currentInvite;
  isRespondingInvite = true;
  const acceptButton = document.querySelector("#acceptInvite");
  const declineButton = document.querySelector("#declineInvite");
  acceptButton.disabled = true;
  declineButton.disabled = true;
  try {
    const data = await api("/api/invite/respond", { method: "POST", body: JSON.stringify({ inviteId: invite.id, playerId, accept, password: accept ? els.invitePasswordInput.value : "" }) });
    currentInvite = null;
    els.inviteDialog.close();
    if (accept && data.gameId) await startOnlineGame(data.gameId);
    else if (accept && data.room) {
      lastActiveRoomSignal = `${data.room.id}:${data.room.status}:${data.room.launchAt || 0}`;
      window.NEIGHBOR_PENDING_ROOM = data.room;
      window.dispatchEvent(new CustomEvent("neighbor-room-invite-accepted", { detail: data.room }));
    }
    else showToast("已婉拒這次邀請");
  } catch (error) {
    showToast(error.message);
    if (accept && invite.hasPassword) { els.invitePasswordInput.focus(); els.invitePasswordInput.select(); }
  } finally {
    isRespondingInvite = false;
    acceptButton.disabled = false;
    declineButton.disabled = false;
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
  onlineMatchClosedHandled = false;
  renderedChatKey = "";
  lastAutomaticMoveKey = "";
  roundDialogKey = "";
  showView("game");
  await fetchOnlineGame(gameId);
  window.clearInterval(onlineTimer);
  onlineTimer = window.setInterval(() => fetchOnlineGame(gameId), 800);
  window.clearInterval(onlineClockTimer);
  onlineClockTimer = window.setInterval(renderTurnClock, 250);
}

async function fetchOnlineGame(gameId) {
  if (isFetchingOnlineGame) return;
  isFetchingOnlineGame = true;
  try {
    const data = await api(`/api/game/${encodeURIComponent(gameId)}?playerId=${encodeURIComponent(playerId)}`);
    applyOnlineGameData(data);
  } catch (error) {
    window.clearInterval(onlineTimer);
    showToast(error.message);
  } finally {
    isFetchingOnlineGame = false;
  }
}

function applyOnlineGameData(data) {
  if (!shouldApplyOnlineSnapshot(gameMode === "online" ? game : null, data)) return false;
  const previousMoveCount = gameMode === "online" ? game?.moves?.length || 0 : 0;
  const me = data.players.find((player) => player.id === playerId);
  const opponent = data.players.find((player) => player.id !== playerId);
  game = {
    ...data,
    myColor: me.color,
    board: data.board,
    moves: data.moves,
    winLine: data.winLine || [],
    clockOffsetMs: Number(data.serverTime) - Date.now(),
    selectedIndex: null,
    legalMoves: []
  };
  const isXiangqi = data.gameType === "xiangqi";
  els.gameView.classList.toggle("xiangqi-theme", isXiangqi);
  els.gameModeLabel.textContent = isXiangqi ? "CHINESE CHESS ONLINE" : "GOMOKU ONLINE";
  els.gameTitle.textContent = isXiangqi ? "中國象棋・線上對戰" : "五子棋・線上對戰";
  els.opponentName.textContent = opponent.name;
  renderOnlineChat(data.messages || []);
  renderBoard();
  const latestMove = game.moves.at(-1);
  const automaticKey = latestMove?.automatic ? `${game.round}:${game.moves.length}:${latestMove.index ?? `${latestMove.from}-${latestMove.to}`}` : "";
  if (game.moves.length > previousMoveCount && automaticKey && automaticKey !== lastAutomaticMoveKey) {
    lastAutomaticMoveKey = automaticKey;
    showToast(`${latestMove.color === game.myColor ? "你" : "對手"}逾時，系統已隨機落子`);
  }

  if (game.status === "playing") {
    roundDialogKey = "";
    if (els.roundEndDialog.open) els.roundEndDialog.close();
    return true;
  }

  saveCurrentRecord();
  if (game.matchStatus === "closed") {
    if (!onlineMatchClosedHandled) {
      onlineMatchClosedHandled = true;
      if (els.roundEndDialog.open) els.roundEndDialog.close();
      showToast(game.rematchDeclinedBy === playerId ? "系列賽已結束" : "對手已結束系列賽");
      window.clearInterval(onlineTimer);
    }
    return true;
  }
  if (!game.rematchRequests?.includes(playerId)) showRoundEndDialog();
  else els.gameStatus.textContent = "已同意繼續，等待對手確認…";
  return true;
}

async function makeOnlineMove(move) {
  if (!game?.id) return;
  try {
    const payload = game.gameType === "xiangqi" ? { playerId, from: move.from, to: move.to } : { playerId, index: move };
    const data = await api(`/api/game/${encodeURIComponent(game.id)}/move`, { method: "POST", body: JSON.stringify(payload) });
    applyOnlineGameData(data);
  } catch (error) {
    showToast(error.message);
    fetchOnlineGame(game.id);
  }
}

async function sendChatMessage(event) {
  event.preventDefault();
  if (gameMode !== "online" || !game?.id) return;
  const text = els.chatInput.value.trim();
  if (!text) return;
  els.sendChat.disabled = true;
  try {
    const data = await api(`/api/game/${encodeURIComponent(game.id)}/chat`, { method: "POST", body: JSON.stringify({ playerId, text }) });
    els.chatInput.value = "";
    applyOnlineGameData(data);
  } catch (error) {
    showToast(error.message);
  } finally {
    els.sendChat.disabled = false;
    els.chatInput.focus();
  }
}

function showRoundEndDialog() {
  if (!game || game.status === "playing") return;
  const key = gameMode === "online" ? `${game.id}:${game.round}` : `single:${series.round}:${game.moves.length}:${game.winner}`;
  if (roundDialogKey === key || els.roundEndDialog.open) return;
  roundDialogKey = key;

  const mine = playerColor();
  const wonRound = game.winner === mine;
  const draw = game.winner === EMPTY;
  const opponent = gameMode === "online" ? game.players.find((item) => item.id !== playerId) : null;
  const myScore = gameMode === "single" ? series.myWins : game.scores?.[playerId] || 0;
  const opponentScore = gameMode === "single" ? series.opponentWins : game.scores?.[opponent.id] || 0;
  const target = gameMode === "single" ? series.target : game.targetWins;
  const seriesComplete = myScore >= target || opponentScore >= target;
  const nextColor = game.gameType === "xiangqi" ? (mine === BLACK ? "黑方" : "紅方") : (mine === BLACK ? "白棋" : "黑棋");

  els.roundEndIcon.textContent = draw ? "＝" : wonRound ? "勝" : "●";
  els.roundEndTitle.textContent = seriesComplete ? (myScore >= target ? "你贏得系列賽！" : "系列賽結束") : draw ? "本局和棋" : wonRound ? "你贏下這一局！" : "對手贏下這一局";
  els.roundEndMessage.textContent = seriesComplete ? `系列賽最終比分 ${myScore}：${opponentScore}` : `目前比分 ${myScore}：${opponentScore}，要繼續下一局嗎？`;
  els.roundMyName.textContent = "你";
  els.roundOpponentName.textContent = opponent?.name || els.opponentName.textContent;
  els.roundMyScore.textContent = String(myScore);
  els.roundOpponentScore.textContent = String(opponentScore);
  els.nextColorMessage.textContent = seriesComplete ? `再開一個系列賽時，你將改執${nextColor}。` : `下一局你將改執${nextColor}，雙方交換先後手。`;
  els.continueSeries.textContent = seriesComplete ? "再來一個系列賽" : "繼續下一局";
  els.roundEndDialog.showModal();
}

async function continueCurrentSeries() {
  if (!game || game.status === "playing") return;
  els.continueSeries.disabled = true;
  if (gameMode === "single") {
    const complete = series.myWins >= series.target || series.opponentWins >= series.target;
    const difficulty = game.difficulty;
    if (complete) {
      series.myWins = 0;
      series.opponentWins = 0;
      series.draws = 0;
      series.round = 1;
      series.initialPlayerColor = game.playerColor === BLACK ? WHITE : BLACK;
    } else {
      series.round += 1;
    }
    els.roundEndDialog.close();
    els.continueSeries.disabled = false;
    startSingleRound(difficulty);
    return;
  }

  try {
    const data = await api(`/api/game/${encodeURIComponent(game.id)}/rematch`, { method: "POST", body: JSON.stringify({ playerId, accept: true }) });
    els.roundEndDialog.close();
    applyOnlineGameData(data);
    if (data.status !== "playing") showToast("已同意繼續，等待對手確認");
  } catch (error) {
    showToast(error.message);
  } finally {
    els.continueSeries.disabled = false;
  }
}

async function endCurrentSeries() {
  if (els.roundEndDialog.open) els.roundEndDialog.close();
  if (gameMode === "online" && game?.id && game.matchStatus !== "closed") {
    try {
      await api(`/api/game/${encodeURIComponent(game.id)}/rematch`, { method: "POST", body: JSON.stringify({ playerId, accept: false }) });
    } catch { /* Returning to the lobby remains safe if the match already closed. */ }
  }
  cancelAiMove();
  window.clearInterval(onlineTimer);
  window.clearInterval(onlineClockTimer);
  const destination = gameMode === "online" ? "lobby" : "home";
  gameMode = null;
  game = null;
  series = null;
  showView(destination);
}

async function leaveCurrentGame() {
  cancelAiMove();
  window.clearInterval(onlineTimer);
  window.clearInterval(onlineClockTimer);
  if (gameMode === "online" && game?.status === "playing") {
    try {
      await api(`/api/game/${encodeURIComponent(game.id)}/resign`, { method: "POST", body: JSON.stringify({ playerId }) });
    } catch { /* The lobby remains usable if a stale game already ended. */ }
  } else if (gameMode === "online" && game?.id && game.matchStatus !== "closed") {
    try {
      await api(`/api/game/${encodeURIComponent(game.id)}/rematch`, { method: "POST", body: JSON.stringify({ playerId, accept: false }) });
    } catch { /* The lobby remains usable if the match already closed. */ }
  }
  const destination = gameMode === "online" ? "lobby" : "home";
  gameMode = null;
  game = null;
  series = null;
  if (els.roundEndDialog.open) els.roundEndDialog.close();
  showView(destination);
}

function stopLobbyPolling() {
  window.clearInterval(lobbyTimer);
  lobbyTimer = null;
}

function startLobbyPolling() {
  if (!ONLINE_AVAILABLE || lobbyTimer || gameMode === "online") return;
  fetchLobby();
  lobbyTimer = window.setInterval(fetchLobby, 1200);
}

function saveCurrentRecord() {
  if (!game || game.status === "playing") return;
  const lastMove = game.moves.at(-1);
  const lastMoveKey = lastMove?.index ?? `${lastMove?.from ?? "start"}-${lastMove?.to ?? "start"}`;
  const key = gameMode === "online" ? `${game.id}-${game.round || 1}` : `${series?.round || 1}-${game.moves.length}-${lastMoveKey}-${game.winner}`;
  if (recordedGameKey === key) return;
  recordedGameKey = key;
  const mine = playerColor();
  const records = JSON.parse(localStorage.getItem("gomoku-records") || "[]");
  records.unshift({
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    mode: gameMode,
    gameType: game.gameType || "gomoku",
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
    item.querySelector("strong").textContent = `${record.gameType === "xiangqi" ? "中國象棋" : "五子棋"}・對戰 ${record.opponent}`;
    item.querySelector("p").textContent = `${record.mode === "single" ? "單人模式" : "線上對戰"}・${record.moves} 手・${date}`;
    return item;
  }));
}

document.addEventListener("click", (event) => {
  const viewTrigger = event.target.closest("[data-view]");
  if (viewTrigger) {
    event.preventDefault();
    if (viewTrigger.dataset.preferredGame) preferredOnlineGameType = viewTrigger.dataset.preferredGame;
    showView(viewTrigger.dataset.view);
  }
});

document.querySelectorAll(".game-solo-button").forEach((button) => button.addEventListener("click", () => openSingleSetup(button.dataset.gameType)));
document.querySelector("#startSingle").addEventListener("click", startSingleGame);
els.onlineInviteGameSelect.replaceChildren(...Object.entries(ONLINE_GAME_META).map(([value, meta]) => {
  const option = document.createElement("option"); option.value = value; option.textContent = meta.name; return option;
}));
els.onlineInviteGameSelect.addEventListener("change", () => configureInviteGame(els.onlineInviteGameSelect.value));
els.onlineInvitePlayerCount.addEventListener("change", () => { els.onlineWagerField.hidden = Number(els.onlineInvitePlayerCount.value) !== 2; });
configureInviteGame("gomoku");
document.querySelector("#confirmOnlineInvite").addEventListener("click", () => {
  if (!pendingInvitePlayer || !pendingInviteButton) return;
  const data = new FormData(els.onlineSeriesDialog.querySelector("form"));
  const gameType = ONLINE_GAME_META[data.get("gameType")] ? data.get("gameType") : "gomoku";
  const allowedPlayers = ONLINE_GAME_META[gameType].players;
  const maxPlayers = allowedPlayers.includes(Number(data.get("maxPlayers"))) ? Number(data.get("maxPlayers")) : allowedPlayers.at(-1);
  const bestOf = Number(data.get("bestOf")) === 5 ? 5 : 3;
  const inviterColor = data.get("inviterColor") === "white" ? "white" : "black";
  const turnTimeMinutes = [1, 3, 5, 10].includes(Number(data.get("turnTimeMinutes"))) ? Number(data.get("turnTimeMinutes")) : 3;
  const password = String(data.get("password") || "").trim().slice(0, 32);
  const wager = maxPlayers === 2 ? Math.min(5000, Math.max(0, Number(data.get("wager")) || 0)) : 0;
  sendInvite(pendingInvitePlayer, pendingInviteButton, gameType, maxPlayers, bestOf, inviterColor, turnTimeMinutes, password, wager);
});
document.querySelector("#editName").addEventListener("click", openAccountUi);
document.querySelector("#walletButton").addEventListener("click", openAccountUi);
els.lobbyLoginButton.addEventListener("click", openAccountUi);
document.querySelector("#showLoginTab").addEventListener("click", () => showAuthMode("login"));
document.querySelector("#showRegisterTab").addEventListener("click", () => showAuthMode("register"));
els.submitAuth.addEventListener("click", submitAuthForm);
document.querySelector("#loginPassword").addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); submitAuthForm(); } });
document.querySelector("#registerPassword").addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); submitAuthForm(); } });
document.querySelector("#changePasswordButton").addEventListener("click", async () => {
  const button = document.querySelector("#changePasswordButton");
  const error = document.querySelector("#passwordError");
  button.disabled = true; error.textContent = "";
  try { await changePassword(document.querySelector("#currentPassword").value, document.querySelector("#newPassword").value); error.textContent = "密碼已更新"; document.querySelector("#currentPassword").value = ""; document.querySelector("#newPassword").value = ""; }
  catch (cause) { error.textContent = cause.message; }
  finally { button.disabled = false; }
});
document.querySelector("#logoutButton").addEventListener("click", () => { logout(); els.accountDialog.close(); showToast("已登出，仍可使用訪客模式遊玩"); });
window.addEventListener("neighbor-account-change", (event) => syncAccountUi(event.detail));
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
els.invitePasswordInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); respondInvite(true); } });
document.querySelector("#leaveGame").addEventListener("click", leaveCurrentGame);
els.refreshLobby.addEventListener("click", fetchLobby);
els.board.addEventListener("click", handleBoardClick);
els.chatForm.addEventListener("submit", sendChatMessage);
els.undoMove.addEventListener("click", undoSingleMove);
els.restartGame.addEventListener("click", restartSingle);
els.continueSeries.addEventListener("click", continueCurrentSeries);
els.endSeries.addEventListener("click", endCurrentSeries);
els.roundEndDialog.addEventListener("cancel", (event) => event.preventDefault());
window.addEventListener("beforeunload", () => { window.clearInterval(lobbyTimer); window.clearInterval(onlineTimer); window.clearInterval(onlineClockTimer); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden || gameMode === "online") return;
  startLobbyPolling();
  fetchLobby();
});

updateIdentity();
updateHostingStatus();
showView("home");
restoreSession().then(() => syncAccountUi());
window.GOMOKU_ONLINE = { startGame: startOnlineGame };
