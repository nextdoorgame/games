import { DARK, LIGHT, applyReversiMove, chooseReversiMove, createReversiBoard, reversiLegalMoves, reversiWinner } from "./reversi.js?v=neighbor-2";
import { CHECKER_COLORS, CHECKER_HOLES, applyCheckerMove, checkerMoves, checkersWinner, chooseCheckerMove, createCheckersBoard } from "./chinese-checkers.js?v=neighbor-3";
import { dealMahjong, discardMahjong, drawMahjong, isMahjongWin, chooseMahjongDiscard } from "./mahjong.js?v=neighbor-2";
import { dealBigTwo, playBigTwo, passBigTwo, chooseBigTwoPlay } from "./big-two.js?v=neighbor-2";
import { applyBanqiAction, banqiActions, chooseBanqiAction, createBanqiState } from "./banqi.js?v=neighbor-2";
import { CHESS_SYMBOLS, allChessMoves, applyChessMove, chessLegalMoves, chooseChessMove, createChessState, isChessCheck } from "./chess.js?v=neighbor-2";
import { GO_SIZE, applyGoMove, chooseGoMove, createGoState } from "./go.js?v=neighbor-2";
import { blackjackScore, chooseNinetyNinePlay, choosePickRedPlay, createBlackjackState, createNinetyNineState, createPickRedState, hitBlackjack, legalNinetyNinePlays, pickRedMatches, pickRedValue, playNinetyNine, playPickRed, runBlackjackAiTurn, settleBlackjack, standBlackjack } from "./card-games.js?v=neighbor-2";
import { TETRIS_SPEEDS, createTetrisState, dropTetris, moveTetris, rotateTetris, tickTetris, tetrisSnapshot, visibleTetrisBoard } from "./tetris.js?v=neighbor-3";
import { createRacingState, createVolleyballState, updateRacing, updateVolleyball } from "./arcade-games.js?v=neighbor-10";
import { drawBrickBreaker, drawRacing, drawVolleyball } from "./arcade-render.js?v=neighbor-10";
import { BRICK_BREAKER_MODES, createBrickBreakerState, updateBrickBreaker } from "./brick-breaker.js?v=neighbor-2";
import { deviceId as roomDeviceId, playerId as roomPlayerId } from "./player-identity.js?v=neighbor-8";

const GAMES = {
  gomoku: { name: "五子棋", players: [2], mode: "19×19 棋盤" },
  xiangqi: { name: "中國象棋", players: [2], mode: "經典規則" },
  reversi: { name: "黑白棋", players: [2], mode: "8×8 翻子" },
  checkers: { name: "中國跳棋", players: [2, 3], mode: "連跳規則" },
  mahjong: { name: "麻將", players: [1, 2, 3, 4], mode: "家庭自摸版" },
  bigtwo: { name: "大老二", players: [3, 4, 5], mode: "經典牌型" },
  banqi: { name: "暗棋", players: [2], mode: "翻棋吃子" },
  chess: { name: "西洋棋", players: [2], mode: "國際規則" },
  go: { name: "圍棋", players: [2], mode: "13 路棋盤" },
  blackjack: { name: "二十一點", players: [3, 4, 5], mode: "莊家 17 停牌" },
  pickred: { name: "撿紅點", players: [3, 4, 5], mode: "湊十吃牌" },
  ninetynine: { name: "九九", players: [3, 4, 5], mode: "99 點淘汰" },
  tetris: { name: "俄羅斯方塊", players: [2], mode: "雙人同步分屏" },
  volleyball: { name: "皮卡丘排球", players: [2], mode: "像素沙灘對戰" },
  racing: { name: "賽車障礙", players: [2], mode: "雙車障礙競速" },
  brickbreaker: { name: "隔壁打磚塊", players: [2], mode: "單人闖關・雙人合作／對戰" }
};

const GAME_RULES = {
  gomoku: { summary: "在 19×19 棋盤輪流落子，率先連成五子者獲勝。", steps: ["黑棋先手，雙方輪流在空的交叉點落下一子。", "橫、直或斜線連續五枚同色棋子即獲勝。", "棋子落下後不能移動；棋盤填滿且無五連則為和棋。"] },
  xiangqi: { summary: "紅方先行，以將死或困斃對方將帥為目標。", steps: ["車走直線、馬走日、象走田、士守九宮、炮隔子吃棋。", "將與帥不能在同一直線直接照面。", "讓對方將帥無法解除被攻擊狀態即可獲勝。"] },
  reversi: { summary: "夾住對方棋子並翻成自己的顏色。", steps: ["落子後必須至少在一個方向夾住對方棋子。", "被夾住的棋子全部翻成落子方顏色。", "雙方都無合法落點時結束，棋子較多者獲勝。"] },
  checkers: { summary: "使用邊長 5 格的三角營區，率先把 15 枚棋子送到對面。", steps: ["每回合可走到相鄰空位，或跳過相鄰棋子到後方空位。", "一次回合可連續跳躍，但不能停在已有棋子的洞位。", "全部 15 枚棋子進入正對面的目標營區即獲勝。"] },
  mahjong: { summary: "家庭自摸版麻將，湊成四組面子加一對將。", steps: ["使用 136 張牌，不含花牌；每位玩家起手 13 張。", "輪到自己時摸一張牌，再打出一張。", "四組順子或刻子加一對相同牌即可自摸胡牌。"] },
  bigtwo: { summary: "以 3♦ 首攻，率先出完手牌者獲勝。", steps: ["可出單張、對子、三條或合法五張牌型。", "點數由 3 到 2，花色由方塊、梅花、紅心到黑桃。", "必須壓過桌面牌型；無法或不想出牌時可選擇過牌。"] },
  banqi: { summary: "翻開暗棋決定陣營，移動並吃掉對方棋子。", steps: ["第一枚翻開的棋子決定玩家陣營。", "一般棋子每次走一格；炮必須隔一枚棋子才能吃子。", "依階級吃子，兵可吃將而將不能吃兵；消滅對方即獲勝。"] },
  chess: { summary: "白方先行，以將死對方國王為目標。", steps: ["各棋子依西洋棋規則移動，兵首次可前進兩格。", "支援王車易位、吃過路兵與兵升變。", "國王被攻擊且沒有任何合法解圍走法時即為將死。"] },
  go: { summary: "13 路圍棋，包圍地盤並提取無氣棋群。", steps: ["黑方先行，雙方輪流在空交叉點落子。", "完全沒有氣的棋群會被提走；禁止自殺與立即重複劫形。", "雙方連續停著後計算棋子與領地，白方貼 6.5 目。"] },
  blackjack: { summary: "讓手牌接近 21 點但不能超過，並擊敗莊家。", steps: ["A 可算 1 或 11，J、Q、K 算 10 點。", "玩家可選擇補牌或停牌；超過 21 點立即爆牌。", "莊家 16 點以下補牌、17 點以上停牌，較接近 21 點者獲勝。"] },
  pickred: { summary: "從桌面湊成十點吃牌，累積紅色牌分數。", steps: ["輪流從手牌打出一張，能與桌面牌湊成十點時可吃走。", "J、Q、K 依遊戲設定配對同點數牌。", "牌局結束後計算吃到的紅心與方塊牌，分數最高者獲勝。"] },
  ninetynine: { summary: "輪流出牌累加點數，總數不能超過 99。", steps: ["每回合打出一張牌並依牌面效果調整總點數。", "部分牌可指定加減或改變出牌方向。", "無法合法出牌或使總數超過 99 的玩家淘汰，最後存活者獲勝。"] },
  tetris: { summary: "移動與旋轉方塊，完成橫列來消除得分。", steps: ["方向鍵左右移動，↑ 旋轉，↓ 軟降，空白鍵硬降。", "填滿完整橫列後該列會消除並增加分數。", "方塊堆到棋盤頂端即結束；雙人房可同步查看對手進度。"] },
  volleyball: { summary: "移動、跳躍、撲救與有角度的殺球，率先得到 7 分。", steps: ["每球開始前倒數 3 秒，球會放在發球玩家頭頂。", "空中按攻擊鍵殺球；搭配前方是平殺、↓ 是直下殺、前方＋↓ 是強力斜下殺。", "搭配 ↑ 可打斜上高球、搭配後方可反向殺球；站在地面時按方向＋攻擊可向該方向撲救。", "一般碰球會依接觸位置改變水平角度；讓球落在對方場地即可得分。"] },
  racing: { summary: "避開障礙並保留耐久，跑出更高分數。", steps: ["使用方向鍵控制車輛左右與加減速。", "撞上三角錐、油漬或路障會損失耐久與分數。", "抵達終點或有人耐久歸零時，以耐久與分數判定勝負。"] },
  brickbreaker: { summary: "隔壁家特有的闖關打磚塊，支援單人、雙板合作與左右對戰。", steps: ["單人經典共有三條生命、Combo、掉落道具、多關卡、三星評價與每三關一次的 Boss 戰。", "雙板合作時 P1 使用方向鍵、P2 使用 A／D，共用生命並可互相救球。", "左右對戰各自清除半場磚塊，先清空或讓對手生命歸零者獲勝；房間模式可在兩台裝置同步遊玩。", "首版道具包含加長、緩速、三球、火焰穿透、護盾與補血；後續可加入角色專屬技能。", "後續擴充依序規劃 Boss 合作、生存、派對、接力與每日挑戰，再接上金幣、角色、球與板子外觀解鎖。"] }
};

const tabs = document.querySelector("#roomGameTabs");
const roomList = document.querySelector("#roomList");
const roomTitle = document.querySelector("#roomLobbyTitle");
const roomDescription = document.querySelector("#roomLobbyDescription");
const roomLobbyLayout = document.querySelector("#roomLobbyLayout");
const duelInviteLobby = document.querySelector("#duelInviteLobby");
const roomCount = document.querySelector("#roomPlayerCount");
const roomName = document.querySelector("#roomNameInput");
const roomPassword = document.querySelector("#roomPasswordInput");
const roomPasswordDialog = document.querySelector("#roomPasswordDialog");
const roomPasswordTitle = document.querySelector("#roomPasswordTitle");
const joinRoomPassword = document.querySelector("#joinRoomPassword");
const confirmJoinRoom = document.querySelector("#confirmJoinRoom");
const roomOnlinePlayers = document.querySelector("#roomOnlinePlayers");
const roomWaitingDialog = document.querySelector("#roomWaitingDialog");
const waitingRoomTitle = document.querySelector("#waitingRoomTitle");
const waitingRoomStatus = document.querySelector("#waitingRoomStatus");
const waitingRoomCountdown = document.querySelector("#waitingRoomCountdown");
const waitingRoomPlayers = document.querySelector("#waitingRoomPlayers");
const waitingRoomAi = document.querySelector("#waitingRoomAi");
const waitingRoomAiChoice = document.querySelector("#waitingRoomAiChoice");
const waitForHumanPlayers = document.querySelector("#waitForHumanPlayers");
const fillRoomWithAi = document.querySelector("#fillRoomWithAi");
const enterRoomGame = document.querySelector("#enterRoomGame");
const gameRulesDialog = document.querySelector("#gameRulesDialog");
const gameRulesTitle = document.querySelector("#gameRulesTitle");
const gameRulesSummary = document.querySelector("#gameRulesSummary");
const gameRulesList = document.querySelector("#gameRulesList");
const setup = document.querySelector("#casualSetupDialog");
const setupTitle = document.querySelector("#casualSetupTitle");
const setupDescription = document.querySelector("#casualSetupDescription");
const playerOptions = document.querySelector("#casualPlayerOptions");
const boardEl = document.querySelector("#casualBoard");
const titleEl = document.querySelector("#casualTitle");
const subtitleEl = document.querySelector("#casualSubtitle");
const turnEl = document.querySelector("#casualTurn span");
const statusEl = document.querySelector("#casualStatus");
const rulesEl = document.querySelector("#casualRuleNote");
const playersEl = document.querySelector("#casualPlayers");
const primary = document.querySelector("#casualPrimaryAction");
const pass = document.querySelector("#casualPass");
const difficultyFieldset = document.querySelector("#casualDifficultyFieldset");
const speedFieldset = document.querySelector("#casualSpeedFieldset");
const arcadeModeFieldset = document.querySelector("#casualArcadeModeFieldset");
const arcadeModeOptions = document.querySelector("#casualArcadeModeOptions");
let roomGame = "gomoku", pendingGame = "reversi", pendingRoom = null, state = null, aiTimer = null, tetrisTimer = null, tetrisCountdownTimer = null, tetrisSyncTimer = null, arcadeFrame = null, arcadeSyncTimer = null, tableSyncTimer = null, selected = new Set();
let enteringOnlineGameId = null;
let arcadeSyncInFlight = false;
let tableSyncInFlight = false;
let tablePendingCommit = null;
let tableAiQueuedKey = null;
let roomWaitingTimer = null;
let launchingRoomId = null;
let pendingJoinRoom = null;
const arcadeKeys = Object.create(null);
const arcadeTouch = Object.create(null);
const ROOM_API = String(window.GOMOKU_CONFIG?.apiBaseUrl || "").trim().replace(/\/$/, "");
const roomPlayerName = () => localStorage.getItem("gomoku-player-name") || "隔壁棋手";
const ONLINE_TABLE_GAMES = new Set(["reversi", "checkers", "mahjong", "bigtwo", "banqi", "chess", "go", "blackjack", "pickred", "ninetynine"]);

window.addEventListener("neighbor-online-players", (event) => {
  const players = Array.isArray(event.detail) ? event.detail : [];
  roomOnlinePlayers.replaceChildren(...players.map((player) => {
    const badge = document.createElement("span");
    badge.className = player.id === roomPlayerId ? "me" : "";
    badge.textContent = `${player.name}${player.id === roomPlayerId ? "（你）" : ""}`;
    return badge;
  }));
});

function showOnly(id) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === id));
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === (id === "homeView" ? "home" : id === "lobbyView" ? "lobby" : "")));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function toast(message) { const el = document.querySelector("#toast"); el.textContent = message; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 2200); }
function schedule(fn, delay = 500) { clearTimeout(aiTimer); aiTimer = setTimeout(fn, delay); }
function storedRooms() { try { return JSON.parse(localStorage.getItem("neighbor-game-rooms") || "[]"); } catch { return []; } }
function saveRooms(rooms) { localStorage.setItem("neighbor-game-rooms", JSON.stringify(rooms.slice(-40))); }

document.querySelectorAll("#gameFilters button").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("#gameFilters button").forEach((item) => item.classList.toggle("active", item === button));
  document.querySelectorAll(".game-card").forEach((card) => { card.hidden = button.dataset.filter !== "all" && card.dataset.category !== button.dataset.filter; });
}));

function setRoomGame(game) {
  roomGame = GAMES[game] ? game : "gomoku";
  window.NEIGHBOR_SELECTED_ROOM_GAME = roomGame;
  roomTitle.textContent = `${GAMES[roomGame].name}・房間大廳`;
  roomDescription.textContent = "建立房間、加入空桌，或從在線名單直接邀請這款遊戲。";
  duelInviteLobby.hidden = false;
  roomLobbyLayout.hidden = false;
  tabs.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.game === roomGame));
  roomCount.replaceChildren(...GAMES[roomGame].players.map((count) => { const option = document.createElement("option"); option.value = count; option.textContent = `${count} 人`; return option; }));
  renderRooms();
}
async function roomRequest(path, options = {}) {
  const response = await fetch(`${ROOM_API}${path}`, { ...options, headers: { "content-type": "application/json" } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "房間服務暫時無法使用");
  return data;
}

function stopRoomWaiting() {
  if (roomWaitingTimer) clearInterval(roomWaitingTimer);
  roomWaitingTimer = null;
}

function renderWaitingRoom(room) {
  if (!room) return;
  const game = GAMES[room.gameType] || GAMES[roomGame];
  const players = room.players || [];
  const maxPlayers = room.maxPlayers || room.max || game.players.at(-1);
  const aiSeats = room.aiFill ? Math.max(0, maxPlayers - players.length) : 0;
  const isDuel = ["gomoku", "xiangqi"].includes(room.gameType);
  const isHost = players[0]?.id === roomPlayerId;
  const isStarting = room.status === "starting" && room.launchAt;
  const isPlaying = room.status === "playing";
  const readyToStart = players.length >= maxPlayers || maxPlayers >= 3 && players.length >= 2 && room.aiFill;
  const canChooseAi = maxPlayers >= 3 && players.length >= 2 && players.length < maxPlayers;
  pendingRoom = room;
  window.NEIGHBOR_CASUAL_ACTIVE_ROOM_ID = room.id;
  waitingRoomTitle.textContent = `${game.name}・${room.name}`;
  const countdown = isStarting ? Math.max(1, Math.ceil((room.launchAt - Date.now()) / 1000)) : 0;
  waitingRoomStatus.textContent = isStarting ? `全員已同步，${countdown} 秒後自動進入遊戲` : isPlaying ? "遊戲已開始，正在同步進入…" : `${players.length}/${maxPlayers} 位真人已進房`;
  waitingRoomCountdown.hidden = !isStarting;
  waitingRoomCountdown.querySelector("strong").textContent = String(countdown || 5);
  waitingRoomPlayers.replaceChildren(...players.map((player, index) => {
    const item = document.createElement("div");
    item.className = "waiting-room-player";
    item.innerHTML = "<span></span><strong></strong><small></small>";
    item.querySelector("span").textContent = String(index + 1).padStart(2, "0");
    item.querySelector("strong").textContent = player.name;
    item.querySelector("small").textContent = player.id === roomPlayerId ? "你・已就座" : "玩家・已就座";
    return item;
  }));
  waitingRoomAi.textContent = isStarting ? "請把手放到控制鍵上；其他玩家也會在倒數結束後自動進入。" : aiSeats ? `剩餘 ${aiSeats} 個位置會由 AI 補上。` : players.length < maxPlayers ? `正在等待 ${maxPlayers - players.length} 位玩家加入…` : "所有真人玩家都已到齊。";
  waitingRoomAiChoice.hidden = !canChooseAi || isStarting || isPlaying;
  waitForHumanPlayers.classList.toggle("selected", canChooseAi && !room.aiFill);
  fillRoomWithAi.classList.toggle("selected", canChooseAi && room.aiFill);
  waitForHumanPlayers.setAttribute("aria-pressed", String(canChooseAi && !room.aiFill));
  fillRoomWithAi.setAttribute("aria-pressed", String(canChooseAi && room.aiFill));
  enterRoomGame.disabled = !isHost || !readyToStart || isStarting || isPlaying;
  enterRoomGame.textContent = isStarting ? `${countdown} 秒後開始…` : isPlaying ? "正在進入遊戲…" : !isHost ? "等待房主開局…" : !readyToStart ? "等待玩家到齊…" : isDuel ? "開始對局（倒數 5 秒）→" : "設定並開始（倒數 5 秒）→";
}

async function launchRoomGame(room) {
  if (!room || launchingRoomId === room.id) return;
  launchingRoomId = room.id;
  stopRoomWaiting();
  if (roomWaitingDialog.open) roomWaitingDialog.close();
  try {
    if (["gomoku", "xiangqi"].includes(room.gameType)) {
      if (!room.gameId) throw new Error("正在等候伺服器建立對局");
      await window.GOMOKU_ONLINE?.startGame(room.gameId);
    } else {
      const config = room.launchConfig || {};
      startGame(room.gameType, room.maxPlayers, config.difficulty || "medium", config.speed || "normal", room, config.arcadeMode || "classic");
    }
  } catch (error) {
    launchingRoomId = null;
    openRoomWaiting(room);
    toast(error.message);
  }
}

async function refreshWaitingRoom() {
  if (!ROOM_API || !pendingRoom?.id || pendingRoom.id.startsWith("local-")) return;
  try {
    const room = await roomRequest(`/api/rooms/${pendingRoom.id}`);
    if (!roomWaitingDialog.open || pendingRoom?.id !== room.id) return;
    renderWaitingRoom(room);
    if (room.status === "playing") await launchRoomGame(room);
  } catch (error) {
    stopRoomWaiting();
    waitingRoomStatus.textContent = error.message;
  }
}

function openRoomWaiting(room) {
  if (room?.status === "playing" && launchingRoomId === room.id) {
    stopRoomWaiting();
    if (roomWaitingDialog.open) roomWaitingDialog.close();
    return;
  }
  stopRoomWaiting();
  renderWaitingRoom(room);
  if (!roomWaitingDialog.open) roomWaitingDialog.showModal();
  if (room.status === "playing") { launchRoomGame(room); return; }
  if (ROOM_API && !room.id.startsWith("local-")) roomWaitingTimer = setInterval(refreshWaitingRoom, 500);
}

async function renderRooms() {
  let rooms = [];
  try {
    if (ROOM_API) {
      const data = await roomRequest(`/api/rooms?gameType=${encodeURIComponent(roomGame)}`);
      rooms = data.rooms.map((room) => ({ ...room, current: room.players.length, max: room.maxPlayers, ai: room.aiFill, status: room.status === "playing" ? "遊戲中" : room.status === "starting" ? "倒數準備中" : room.status === "full" ? "等待房主開局" : room.status === "ready" ? "可開始・AI 補位" : "等待中" }));
    } else rooms = storedRooms().filter((room) => room.game === roomGame);
  } catch { rooms = storedRooms().filter((room) => room.game === roomGame); }
  if (!rooms.length) { roomList.innerHTML = '<div class="room-empty">目前還沒有房間，成為第一位開桌的人吧。</div>'; return; }
  roomList.replaceChildren(...rooms.map((room) => {
    const row = document.createElement("div"); row.className = "room-row"; row.innerHTML = "<strong></strong><span></span><span></span><span></span><button type=\"button\"></button>";
    row.querySelector("strong").textContent = `${room.hasPassword ? "🔒 " : ""}${room.name}`;
    const isMember = room.players?.some((player) => player.id === roomPlayerId);
    const aiSeats = room.ai ? Math.max(0, room.max - room.current) : 0;
    const spans = row.querySelectorAll("span"); spans[0].textContent = `${room.current}/${room.max}`; spans[1].textContent = `${room.players?.map((player) => player.name).join("、") || GAMES[roomGame].mode}${aiSeats ? ` ＋ ${aiSeats} AI` : ""}`; spans[2].textContent = room.status;
    const button = row.querySelector("button");
    button.textContent = room.status === "playing" && isMember ? "進入遊戲" : room.status === "starting" && isMember ? "查看倒數" : isMember ? "進入房間" : room.ai ? "AI 已補滿" : room.current >= room.max ? "房間已滿" : room.hasPassword ? "輸入密碼" : "加入房間";
    button.disabled = !isMember && (room.ai || room.current >= room.max || ["starting", "playing"].includes(room.status));
    button.addEventListener("click", async () => {
      try {
        if (isMember) { openRoomWaiting(room); return; }
        if (room.hasPassword) { pendingJoinRoom = room; roomPasswordTitle.textContent = `加入「${room.name}」`; joinRoomPassword.value = ""; roomPasswordDialog.showModal(); joinRoomPassword.focus(); return; }
        await joinSelectedRoom(room, "");
      } catch (error) { toast(error.message); }
    });
    return row;
  }));
}

tabs.replaceChildren(...Object.entries(GAMES).map(([key, game]) => { const button = document.createElement("button"); button.type = "button"; button.dataset.game = key; button.textContent = game.name; button.addEventListener("click", () => setRoomGame(key)); return button; }));
document.querySelectorAll(".room-game-button").forEach((button) => button.addEventListener("click", () => setRoomGame(button.dataset.roomGame)));
async function joinSelectedRoom(room, password) {
  let joinedRoom = room;
  if (ROOM_API && !room.id.startsWith("local-")) joinedRoom = await roomRequest(`/api/rooms/${room.id}/join`, { method: "POST", body: JSON.stringify({ playerId: roomPlayerId, deviceId: roomDeviceId, playerName: roomPlayerName(), password }) });
  else if (room.hasPassword && room.password !== password) throw new Error("房間密碼不正確");
  if (roomPasswordDialog.open) roomPasswordDialog.close();
  pendingJoinRoom = null;
  openRoomWaiting(joinedRoom);
  await renderRooms();
}
confirmJoinRoom.addEventListener("click", async () => {
  if (!pendingJoinRoom) return;
  try { await joinSelectedRoom(pendingJoinRoom, joinRoomPassword.value); }
  catch (error) { toast(error.message); joinRoomPassword.focus(); joinRoomPassword.select(); }
});
joinRoomPassword.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); confirmJoinRoom.click(); } });
roomPasswordDialog.addEventListener("close", () => { pendingJoinRoom = null; joinRoomPassword.value = ""; });
document.querySelector("#createRoom").addEventListener("click", async () => {
  const name = (roomName.value.trim() || `${GAMES[roomGame].name}新桌`).slice(0, 16), max = Number(roomCount.value), aiFill = false, password = roomPassword.value.trim().slice(0, 32);
  try {
    let createdRoom = null;
    if (ROOM_API) createdRoom = await roomRequest("/api/rooms", { method: "POST", body: JSON.stringify({ gameType: roomGame, name, maxPlayers: max, aiFill, hostId: roomPlayerId, hostDeviceId: roomDeviceId, hostName: roomPlayerName(), password }) });
    else { const rooms = storedRooms(), localRoom = { id: `local-${crypto.randomUUID()}`, game: roomGame, gameType: roomGame, name, current: 1, max, maxPlayers: max, ai: aiFill, aiFill, hasPassword: Boolean(password), password, status: "等待中", players: [{ id: roomPlayerId, name: roomPlayerName() }] }; rooms.push(localRoom); saveRooms(rooms); createdRoom = localRoom; }
    roomName.value = ""; roomPassword.value = ""; await renderRooms(); toast(`已建立「${name}」${password ? "（已上鎖）" : ""}`);
    if (createdRoom) openRoomWaiting(createdRoom);
  } catch (error) { toast(error.message); }
});
setRoomGame("gomoku");
window.setInterval(() => { if (document.querySelector("#lobbyView").classList.contains("active")) renderRooms(); }, 3000);

roomWaitingDialog.addEventListener("close", stopRoomWaiting);
roomWaitingDialog.addEventListener("cancel", stopRoomWaiting);
async function chooseRoomAiFill(aiFill) {
  if (!pendingRoom || pendingRoom.maxPlayers < 3 || pendingRoom.players.length < 2) return;
  try {
    if (ROOM_API && !pendingRoom.id.startsWith("local-")) {
      const room = await roomRequest(`/api/rooms/${pendingRoom.id}/ai-fill`, { method: "POST", body: JSON.stringify({ playerId: roomPlayerId, aiFill }) });
      renderWaitingRoom(room);
    } else {
      pendingRoom.aiFill = aiFill;
      pendingRoom.ai = aiFill;
      const rooms = storedRooms();
      const savedRoom = rooms.find((room) => room.id === pendingRoom.id);
      if (savedRoom) { savedRoom.aiFill = aiFill; savedRoom.ai = aiFill; saveRooms(rooms); }
      renderWaitingRoom(pendingRoom);
    }
    await renderRooms();
    toast(aiFill ? "AI 會補滿剩餘座位" : "將繼續等待真人玩家");
  } catch (error) { toast(error.message); }
}
waitForHumanPlayers.addEventListener("click", () => chooseRoomAiFill(false));
fillRoomWithAi.addEventListener("click", () => chooseRoomAiFill(true));
enterRoomGame.addEventListener("click", async () => {
  if (!pendingRoom || enterRoomGame.disabled) return;
  if (["gomoku", "xiangqi"].includes(pendingRoom.gameType)) {
    try {
      const room = await roomRequest(`/api/rooms/${pendingRoom.id}/start`, { method: "POST", body: JSON.stringify({ playerId: roomPlayerId, config: {} }) });
      renderWaitingRoom(room);
    } catch (error) { toast(error.message); }
    return;
  }
  stopRoomWaiting(); roomWaitingDialog.close(); openCasualSetup(pendingRoom.gameType);
});

window.addEventListener("neighbor-room-invite-accepted", (event) => {
  const room = event.detail;
  if (!room?.id || !GAMES[room.gameType]) return;
  if (room.status === "playing" && launchingRoomId === room.id) {
    if (roomWaitingDialog.open) roomWaitingDialog.close();
    return;
  }
  setRoomGame(room.gameType);
  openRoomWaiting(room);
});
if (window.NEIGHBOR_PENDING_ROOM) queueMicrotask(() => {
  const room = window.NEIGHBOR_PENDING_ROOM;
  if (room?.id && GAMES[room.gameType]) { setRoomGame(room.gameType); openRoomWaiting(room); }
});

document.querySelectorAll(".game-card").forEach((card) => {
  const game = card.querySelector("[data-game-type]")?.dataset.gameType || card.querySelector("[data-room-game]")?.dataset.roomGame;
  const actions = card.querySelector(".game-card-actions");
  if (!game || !actions || actions.querySelector("[data-rules-game]")) return;
  const button = document.createElement("button");
  button.className = "rules-button"; button.type = "button"; button.dataset.rulesGame = game; button.textContent = "遊戲規則";
  button.setAttribute("aria-label", `查看${GAMES[game].name}遊戲規則`);
  actions.append(button);
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-rules-game]");
  if (!button) return;
  const game = button.dataset.rulesGame, rule = GAME_RULES[game];
  if (!rule) return;
  gameRulesTitle.textContent = `${GAMES[game].name}遊戲規則`;
  gameRulesSummary.textContent = rule.summary;
  gameRulesList.replaceChildren(...rule.steps.map((text) => { const item = document.createElement("li"); item.textContent = text; return item; }));
  gameRulesDialog.showModal();
});

function openCasualSetup(game) {
  pendingGame = game; const meta = GAMES[game]; setupTitle.textContent = `設定${meta.name}遊戲`;
  const descriptions = {
    reversi: "你執黑先手，依難度挑戰 AI。", checkers: "選擇 2 或 3 人桌，其餘座位由 AI 補齊。", mahjong: "選擇真人玩家數，未坐滿的四方座位由 AI 補位。", bigtwo: "選擇 3～5 人牌局，其餘對手由 AI 補位。",
    banqi: "翻開第一枚棋子決定陣營，與 AI 對戰。", chess: "你執白先行，與三級 AI 對弈。", go: "13 路棋盤，你執黑先行。", blackjack: "選擇 3～5 位玩家，其他座位由 AI 補齊。", pickred: "選擇 3～5 人桌，與 AI 湊十吃牌。", ninetynine: "選擇 3～5 人桌，總點數不能超過 99。", tetris: pendingRoom ? "雙人房會同步顯示雙方棋盤；每位玩家可選擇自己的掉落速度。" : "使用方向鍵移動與旋轉、空白鍵快速落下；可自由調整速度。", volleyball: pendingRoom ? "與房內玩家同步進行沙灘排球，先拿到 7 分獲勝。" : "可選擇單人挑戰 AI，或使用同一把鍵盤進行雙人對戰。", racing: pendingRoom ? "與房內玩家同步競速，避開障礙並保住車輛耐久。" : "可選擇單人挑戰 AI，或兩人共享賽道進行障礙競速。", brickbreaker: pendingRoom ? "選擇雙板合作或左右對戰，房內兩位玩家會即時同步操作。" : "單人可闖關、收集道具並挑戰 Boss；雙人可選合作或左右對戰。"
  };
  setupDescription.textContent = descriptions[game] || "選擇遊戲人數與 AI 難度。";
  difficultyFieldset.hidden = game === "tetris" || ["volleyball", "racing", "brickbreaker"].includes(game);
  speedFieldset.hidden = game !== "tetris";
  arcadeModeFieldset.hidden = game !== "brickbreaker";
  const options = pendingRoom ? [pendingRoom.maxPlayers] : game === "tetris" ? [1] : ["volleyball", "racing", "brickbreaker"].includes(game) ? [1, 2] : ["reversi", "banqi", "chess", "go"].includes(game) ? [1] : meta.players;
  playerOptions.replaceChildren(...options.map((count, index) => {
    const label = document.createElement("label");
    const title = game === "tetris" ? (pendingRoom ? "2 人連線對戰" : "1 人挑戰") : ["volleyball", "racing"].includes(game) ? (pendingRoom ? "2 人連線對戰" : count === 1 ? "單人＋AI" : "本機雙人") : game === "brickbreaker" ? (pendingRoom ? "2 人連線" : count === 1 ? "單人闖關" : "本機雙人") : ["reversi", "banqi", "chess", "go"].includes(game) ? "1 人＋AI" : `${count} 人${game === "mahjong" ? "玩家" : "桌"}`;
    const humanCount = pendingRoom?.players?.length || (game === "mahjong" ? count : 1), aiCount = pendingRoom?.aiFill ? Math.max(0, count - humanCount) : 0;
    const detail = pendingRoom ? `${humanCount} 位真人${aiCount ? ` ＋ ${aiCount} 位 AI` : ""}` : game === "tetris" ? "練習消行與速度控制" : ["volleyball", "racing"].includes(game) ? (count === 1 ? "AI 會自動移動與進攻" : "玩家 2 使用 W／A／S／D") : game === "brickbreaker" ? (count === 1 ? "三條生命・道具・Boss" : "P1 方向鍵・P2 A／D") : game === "mahjong" ? `${4 - count} 個 AI 座位` : game === "checkers" ? `${count - 1} 個 AI 座位` : ["bigtwo", "blackjack", "pickred", "ninetynine"].includes(game) ? `${count - 1} 個 AI 座位` : "單人挑戰 AI";
    label.innerHTML = `<input type="radio" name="casualPlayers" value="${count}" ${index === 0 ? "checked" : ""}><span><b>${title}</b><small>${detail}</small></span>`;
    return label;
  }));
  if (game === "brickbreaker") renderBrickBreakerModeOptions(Number(playerOptions.querySelector("input:checked")?.value) || 1);
  setup.showModal();
}
function renderBrickBreakerModeOptions(players) {
  const modes = players === 1 ? [["classic", "單人經典", "闖關、道具、三星與 Boss 戰"]] : [["coop", "雙板合作", "共同救球並共用三條生命"], ["versus", "左右對戰", "先清空自己的磚塊即可獲勝"]];
  arcadeModeOptions.replaceChildren(...modes.map(([value, title, detail], index) => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="radio" name="casualArcadeMode" value="${value}" ${index === 0 ? "checked" : ""}><span><b>${title}</b><small>${detail}</small></span>`;
    return label;
  }));
}
playerOptions.addEventListener("change", () => { if (pendingGame === "brickbreaker") renderBrickBreakerModeOptions(Number(playerOptions.querySelector("input:checked")?.value) || 1); });
document.querySelectorAll(".casual-solo-button").forEach((button) => button.addEventListener("click", () => { pendingRoom = null; window.NEIGHBOR_CASUAL_ACTIVE_ROOM_ID = null; openCasualSetup(button.dataset.gameType); }));
document.querySelector("#startCasual").addEventListener("click", async () => {
  const form = new FormData(setup.querySelector("form"));
  const players = Number(form.get("casualPlayers")) || 1;
  const difficulty = form.get("casualDifficulty") || "medium";
  const speed = form.get("casualSpeed") || "normal";
  const arcadeMode = form.get("casualArcadeMode") || "classic";
  if (pendingRoom && ROOM_API && !pendingRoom.id.startsWith("local-")) {
    try {
      const room = await roomRequest(`/api/rooms/${pendingRoom.id}/start`, { method: "POST", body: JSON.stringify({ playerId: roomPlayerId, config: { players, difficulty, speed, arcadeMode } }) });
      setup.close(); openRoomWaiting(room);
    } catch (error) { toast(error.message); }
    return;
  }
  setup.close(); startGame(pendingGame, players, difficulty, speed, pendingRoom, arcadeMode);
});

function setPlayers(items, active) {
  playersEl.replaceChildren(...items.map((item, index) => { const row = document.createElement("div"); row.className = `casual-player${index === active ? " active" : ""}`; row.style.setProperty("--player-color", item.color || "#777"); row.innerHTML = "<b></b><span></span>"; row.querySelector("b").textContent = item.name; row.querySelector("span").textContent = item.detail || ""; return row; }));
}
function stopGameLoops() { clearInterval(tetrisTimer); clearInterval(tetrisCountdownTimer); clearInterval(tetrisSyncTimer); clearInterval(arcadeSyncTimer); clearInterval(tableSyncTimer); cancelAnimationFrame(arcadeFrame); tetrisTimer = null; tetrisCountdownTimer = null; tetrisSyncTimer = null; arcadeSyncTimer = null; tableSyncTimer = null; arcadeFrame = null; }
function startGame(game, players, difficulty, speed = "normal", room = null, arcadeMode = "classic") {
  clearTimeout(aiTimer); stopGameLoops(); selected.clear(); tableAiQueuedKey = null;
  window.NEIGHBOR_CASUAL_ACTIVE_ROOM_ID = room?.id || null;
  launchingRoomId = room?.id || null;
  const localSeat = room ? Math.max(0, room.players.findIndex((player) => player.id === roomPlayerId)) : 0;
  state = { game, players, difficulty, speed, room, arcadeMode, localSeat, humanSeats: room?.players?.length || 1, roomRevision: 0, roomReady: !room };
  showOnly("casualView"); titleEl.textContent = GAMES[game].name; subtitleEl.textContent = room ? `${room.maxPlayers} 人房・${room.name}` : "隔壁家庭局"; pass.hidden = true; primary.hidden = true;
  ({ reversi: startReversi, checkers: () => startCheckers(players), mahjong: () => startMahjong(room ? room.players.length : players, room ? room.maxPlayers : 4), bigtwo: () => startBigTwo(players), banqi: startBanqi, chess: startChess, go: startGo, blackjack: () => startBlackjack(players), pickred: () => startPickRed(players), ninetynine: () => startNinetyNine(players), tetris: () => startTetris(speed, room), volleyball: () => startArcadeGame("volleyball", players, room), racing: () => startArcadeGame("racing", players, room), brickbreaker: () => startArcadeGame("brickbreaker", players, room, arcadeMode) })[game]?.();
  if (room && ONLINE_TABLE_GAMES.has(game)) startTableRoomSync();
}

function tableSeatName(index, short = false) {
  const human = state?.room?.players?.[index];
  if (human) return human.id === roomPlayerId ? (short ? "你" : `${human.name}（你）`) : human.name;
  return `AI ${index - (state?.humanSeats || 1) + 1}`;
}
function currentTableSeat() {
  if (state?.game === "reversi" || state?.game === "go") return Number(state.turn) - 1;
  if (state?.game === "chess") return state.turn === "white" ? 0 : state.turn === "black" ? 1 : -1;
  return Number(state?.turn);
}
function isHumanTableSeat(index) { return index >= 0 && index < (state?.humanSeats || 1); }
function canControlTableSeat(index = currentTableSeat()) { return state?.room ? state.roomReady && index === state.localSeat && isHumanTableSeat(index) : index === 0; }
function canRunTableAi(index = currentTableSeat()) { return !isHumanTableSeat(index) && (!state?.room || state.localSeat === 0); }
function tableSnapshot() {
  const snapshot = structuredClone(state);
  delete snapshot.room; delete snapshot.roomRevision; delete snapshot.roomReady; delete snapshot.localSeat; delete snapshot.humanSeats; delete snapshot.syncWarningShown;
  return snapshot;
}
function tableContext() {
  return { room: state?.room || null, localSeat: state?.localSeat || 0, humanSeats: state?.humanSeats || 1, roomRevision: state?.roomRevision || 0, roomReady: state?.roomReady ?? !state?.room, difficulty: state?.difficulty || "medium", speed: state?.speed || "normal", arcadeMode: state?.arcadeMode || "classic" };
}
function renderTableGame() {
  ({ reversi: renderReversi, checkers: renderCheckers, mahjong: renderMahjong, bigtwo: renderBigTwo, banqi: renderBanqi, chess: renderChess, go: renderGo, blackjack: renderBlackjack, pickred: renderPickRed, ninetynine: renderNinetyNine })[state?.game]?.();
}
function queueTableAi(fn, delay = 420) {
  if (!canRunTableAi()) return;
  const key = `${state.game}:${state.roomRevision || 0}:${state.turn}`;
  if (tableAiQueuedKey === key) return;
  tableAiQueuedKey = key;
  schedule(() => { tableAiQueuedKey = null; if (canRunTableAi()) fn(); }, delay);
}
async function syncTableRoom({ commit = false, initialize = false } = {}) {
  if (!state?.room || !ONLINE_TABLE_GAMES.has(state.game) || !ROOM_API) return;
  if (tableSyncInFlight) { if (commit) tablePendingCommit = { commit: true, initialize }; return; }
  tableSyncInFlight = true;
  const expectedGame = state.game, roomId = state.room.id;
  try {
    const payload = { playerId: roomPlayerId, revision: state.roomRevision || 0 };
    if (commit) { payload.state = tableSnapshot(); payload.initialize = initialize; }
    const data = await roomRequest(`/api/rooms/${roomId}/table`, { method: "POST", body: JSON.stringify(payload) });
    if (state?.game !== expectedGame || state.room?.id !== roomId) return;
    const shouldApply = data.state && (!state.roomReady || data.revision > (state.roomRevision || 0));
    const preserved = { room: data.room, localSeat: state.localSeat, humanSeats: data.room.players.length, difficulty: state.difficulty, speed: state.speed, arcadeMode: state.arcadeMode };
    if (shouldApply) {
      state = { ...data.state, ...preserved, roomRevision: data.revision, roomReady: true };
      selected.clear(); tableAiQueuedKey = null; renderTableGame(); maybeRunTableAi();
    } else {
      state.room = data.room; state.humanSeats = data.room.players.length; state.roomRevision = data.revision; state.roomReady = Boolean(data.state);
    }
    state.syncWarningShown = false;
  } catch (error) {
    if (!state?.syncWarningShown) { state.syncWarningShown = true; toast(`多人牌局同步暫停：${error.message}`); }
  } finally {
    tableSyncInFlight = false;
    if (tablePendingCommit) { const pending = tablePendingCommit; tablePendingCommit = null; syncTableRoom(pending); }
  }
}
function commitTableState() { if (state?.room) syncTableRoom({ commit: true }); }
function maybeRunTableAi() {
  if (!state || (state.game === "checkers" ? Boolean(state.winner) : state.winner !== null && state.winner !== undefined)) return;
  if (state.game === "checkers") queueTableAi(aiChecker);
  else if (state.game === "mahjong") queueTableAi(aiMahjongTurn, 430);
  else if (state.game === "bigtwo") queueTableAi(aiBigTwo, 500);
  else if (state.game === "blackjack" && state.phase === "players") queueTableAi(aiBlackjackTurn, 420);
  else if (state.game === "pickred") queueTableAi(aiPickRed, 420);
  else if (state.game === "ninetynine") queueTableAi(aiNinetyNine, 420);
}
function startTableRoomSync() {
  state.roomReady = false;
  tablePendingCommit = null;
  if (state.localSeat === 0) syncTableRoom({ commit: true, initialize: true });
  else syncTableRoom();
  tableSyncTimer = setInterval(syncTableRoom, 550);
}

function startReversi() { state = { ...state, board: createReversiBoard(), turn: DARK, finished: false }; rulesEl.textContent = "8×8 棋盤，夾住對方棋子即可翻面；雙方都無合法位置時，以棋子較多者獲勝。"; renderReversi(); }
function renderReversi() {
  const legal = reversiLegalMoves(state.board, state.turn); boardEl.innerHTML = '<div class="reversi-board"></div>'; const grid = boardEl.firstElementChild;
  state.board.forEach((piece, index) => { const button = document.createElement("button"); button.className = `reversi-cell${legal.includes(index) && canControlTableSeat() ? " legal" : ""}`; button.type = "button"; button.ariaLabel = `第 ${Math.floor(index / 8) + 1} 行第 ${index % 8 + 1} 列`; if (piece) { const disc = document.createElement("i"); disc.className = `reversi-piece ${piece === DARK ? "dark" : "light"}`; button.append(disc); } button.addEventListener("click", () => playReversi(index)); grid.append(button); });
  const dark = state.board.filter((x) => x === DARK).length, light = state.board.filter((x) => x === LIGHT).length;
  const names = state.room ? [tableSeatName(0), tableSeatName(1)] : ["你", "AI"];
  setPlayers([{ name: `${names[0]}・黑棋`, detail: dark, color: "#222" }, { name: `${names[1]}・白棋`, detail: light, color: "#ddd" }], state.turn - 1); turnEl.textContent = state.finished ? "本局結束" : canControlTableSeat() ? "輪到你了" : `等待 ${names[state.turn - 1]}`; statusEl.textContent = state.finished ? `黑 ${dark}：白 ${light}，${dark === light ? "和棋" : `${names[reversiWinner(state.board) - 1]} 獲勝`}` : canControlTableSeat() ? "選擇有提示點的格子落子。" : `等待 ${names[state.turn - 1]} 落子。`;
}
function advanceReversi() { const other = state.turn === DARK ? LIGHT : DARK; if (reversiLegalMoves(state.board, other).length) state.turn = other; else if (!reversiLegalMoves(state.board, state.turn).length) state.finished = true; renderReversi(); commitTableState(); if (!state.room && !state.finished && state.turn === LIGHT) schedule(() => { const move = chooseReversiMove(state.board, LIGHT, state.difficulty); if (move !== null) state.board = applyReversiMove(state.board, move, LIGHT).board; advanceReversi(); }); }
function playReversi(index) { if (!canControlTableSeat() || state.finished) return; const result = applyReversiMove(state.board, index, state.turn); if (!result) return; state.board = result.board; advanceReversi(); }

function startCheckers(total) { state = { ...state, total, board: createCheckersBoard(total), turn: 0, selected: null, legal: [], winner: 0 }; rulesEl.textContent = "每個三角營區邊長 5 格；你是玩家 1，其餘座位由 AI 補齊。可走相鄰空位或跨過任一棋子連續跳躍，先把全部棋子移入對面營區者獲勝。"; renderCheckers(); }
function renderCheckers() {
  boardEl.innerHTML = '<div class="checker-board"></div>'; const surface = boardEl.firstElementChild;
  CHECKER_HOLES.forEach((hole) => { const button = document.createElement("button"); button.type = "button"; button.className = `checker-hole${state.selected === hole.key ? " selected" : ""}${state.legal.includes(hole.key) ? " legal" : ""}`; button.style.left = `${50 + (hole.q + hole.r / 2) * 4.7}%`; button.style.top = `${50 + hole.r * 4.45}%`; const owner = state.board[hole.key]; button.ariaLabel = owner ? `玩家 ${owner} 的跳棋，位置 ${hole.key}` : `空位 ${hole.key}`; if (owner) { const piece = document.createElement("i"); piece.className = `checker-piece ${CHECKER_COLORS[owner - 1]}`; button.append(piece); } button.addEventListener("click", () => clickChecker(hole.key)); surface.append(button); });
  setPlayers(Array.from({ length: state.total }, (_, i) => ({ name: state.room ? tableSeatName(i) : i === 0 ? "你" : `AI ${i}`, detail: `${Object.values(state.board).filter((x) => x === i + 1).length} 棋`, color: ["#b94136", "#315b88", "#d5a72d"][i] })), state.turn);
  const turnName = state.room ? tableSeatName(state.turn, true) : state.turn === 0 ? "你" : `AI ${state.turn}`;
  turnEl.textContent = state.winner ? "本局結束" : canControlTableSeat() ? "輪到你了" : `${turnName} 思考`;
  statusEl.textContent = state.winner ? `${state.room ? tableSeatName(state.winner - 1, true) : state.winner === 1 ? "你" : `AI ${state.winner - 1}`} 完成換位，獲得勝利！` : canControlTableSeat() ? "選擇自己的棋子，再選擇綠色目標。" : `等待 ${turnName} 完成這一步。`;
}
function clickChecker(key) { if (state.winner || !canControlTableSeat()) return; if (state.legal.includes(key)) { state.board = applyCheckerMove(state.board, state.selected, key); state.selected = null; state.legal = []; finishCheckerTurn(); return; } if (state.board[key] === state.turn + 1) { state.selected = key; state.legal = checkerMoves(state.board, key); } else { state.selected = null; state.legal = []; } renderCheckers(); }
function finishCheckerTurn() { state.winner = checkersWinner(state.board, state.total); if (!state.winner) state.turn = (state.turn + 1) % state.total; renderCheckers(); commitTableState(); if (!state.winner) queueTableAi(aiChecker, 420); }
function aiChecker() { const move = chooseCheckerMove(state.board, state.turn); if (move) state.board = applyCheckerMove(state.board, move.from, move.to); finishCheckerTurn(); }

function startBanqi() { state = { ...state, ...createBanqiState(), selected: null, legal: [] }; rulesEl.textContent = "4×8 棋盤，第一枚翻棋決定陣營；一般棋子走一格，炮隔一枚棋子吃子，兵可吃將而將不能吃兵。"; renderBanqi(); }
function renderBanqi() {
  boardEl.innerHTML = '<div class="banqi-board"></div>'; const grid = boardEl.firstElementChild;
  state.board.forEach((piece, index) => { const button = document.createElement("button"); button.type = "button"; button.className = `banqi-cell${state.selected === index ? " selected" : ""}${state.legal.includes(index) ? " legal" : ""}${piece?.color === "red" && piece.faceUp ? " red" : ""}${piece && !piece.faceUp ? " facedown" : ""}`; if (piece?.faceUp) button.textContent = piece.name; else if (piece) { const back = document.createElement("i"); back.className = "banqi-back-pattern"; button.append(back); button.ariaLabel = "未翻開的暗棋"; } button.addEventListener("click", () => clickBanqi(index)); grid.append(button); });
  const names = state.room ? [tableSeatName(0), tableSeatName(1)] : ["你", "AI"];
  setPlayers(names.map((name, index) => ({ name, detail: state.playerColors[index] === "red" ? "紅方" : state.playerColors[index] === "black" ? "黑方" : "待翻棋", color: index ? "#222" : "#b94136" })), state.turn); turnEl.textContent = state.winner !== null ? "本局結束" : canControlTableSeat() ? "輪到你了" : `等待 ${names[state.turn]}`; statusEl.textContent = state.winner !== null ? `${names[state.winner]} 吃完對方棋子，獲得勝利！` : canControlTableSeat() ? "翻開暗棋，或選擇己方棋子移動。" : `等待 ${names[state.turn]} 行動。`;
}
function clickBanqi(index) { if (!canControlTableSeat() || state.winner !== null) return; const piece = state.board[index], actions = banqiActions(state); const flip = actions.find((action) => action.type === "flip" && action.from === index); if (flip) { state = { ...applyBanqiAction(state, flip), game: "banqi", ...tableContext() }; renderBanqi(); commitTableState(); if (!state.room && state.winner === null) schedule(aiBanqi); return; } if (state.legal.includes(index)) { state = { ...applyBanqiAction(state, { type: "move", from: state.selected, to: index }), game: "banqi", selected: null, legal: [], ...tableContext() }; renderBanqi(); commitTableState(); if (!state.room && state.winner === null) schedule(aiBanqi); return; } if (piece?.faceUp && piece.color === state.playerColors[state.localSeat || 0]) { state.selected = index; state.legal = actions.filter((action) => action.type === "move" && action.from === index).map((action) => action.to); } else { state.selected = null; state.legal = []; } renderBanqi(); }
function aiBanqi() { const action = chooseBanqiAction(state); if (action) state = { ...applyBanqiAction(state, action), game: "banqi", selected: null, legal: [], ...tableContext() }; renderBanqi(); }

function startChess() { state = { ...state, ...createChessState(), selected: null, legal: [] }; rulesEl.textContent = "你執白先行；支援將軍、將死、王車易位、吃過路兵與兵升變。"; renderChess(); }
function renderChess() {
  boardEl.innerHTML = '<div class="chess-board"></div>'; const grid = boardEl.firstElementChild;
  state.board.forEach((piece, index) => { const button = document.createElement("button"); button.type = "button"; button.className = `chess-cell ${(Math.floor(index / 8) + index % 8) % 2 ? "dark" : "light"}${state.selected === index ? " selected" : ""}${state.legal.includes(index) ? " legal" : ""}`; if (piece) { button.textContent = CHESS_SYMBOLS[piece.color][piece.type]; button.classList.add(piece.color); } button.addEventListener("click", () => clickChess(index)); grid.append(button); });
  const white = state.board.filter((piece) => piece?.color === "white").length, black = state.board.filter((piece) => piece?.color === "black").length;
  const names = state.room ? [tableSeatName(0), tableSeatName(1)] : ["你", "AI"];
  const turnSeat = state.turn === "white" ? 0 : 1;
  setPlayers([{ name: `${names[0]}・白棋`, detail: `${white} 棋`, color: "#eee" }, { name: `${names[1]}・黑棋`, detail: `${black} 棋`, color: "#222" }], turnSeat); turnEl.textContent = state.winner || state.draw ? "本局結束" : canControlTableSeat() ? "輪到你了" : `等待 ${names[turnSeat]}`; statusEl.textContent = state.winner ? `${names[state.winner === "white" ? 0 : 1]} 將死對手！` : state.draw ? "無合法步且未被將軍，本局和棋。" : `${isChessCheck(state, state.turn) ? "將軍！" : ""}${canControlTableSeat() ? `選擇${state.turn === "white" ? "白" : "黑"}棋移動。` : `等待 ${names[turnSeat]} 走棋。`}`;
}
function clickChess(index) { if (!canControlTableSeat() || state.winner || state.draw) return; if (state.legal.includes(index)) { state = { ...applyChessMove(state, { from: state.selected, to: index }), game: "chess", selected: null, legal: [], ...tableContext() }; renderChess(); commitTableState(); if (!state.room && !state.winner && !state.draw) schedule(aiChess); return; } if (state.board[index]?.color === state.turn) { state.selected = index; state.legal = chessLegalMoves(state, index); } else { state.selected = null; state.legal = []; } renderChess(); }
function aiChess() { const move = chooseChessMove(state, state.difficulty); if (move) state = { ...applyChessMove(state, move), game: "chess", selected: null, legal: [], ...tableContext() }; renderChess(); }

function startGo() { state = { ...state, ...createGoState() }; rulesEl.textContent = "13 路圍棋：包圍無氣棋群即可提子，禁止自殺與立即打劫；雙方連續停著後依中國面積法計分，白貼 6.5 目。"; pass.hidden = false; pass.textContent = "停一手"; renderGo(); }
function renderGo() {
  boardEl.innerHTML = '<div class="go-board"></div>'; const grid = boardEl.firstElementChild;
  state.board.forEach((piece, index) => { const button = document.createElement("button"); button.type = "button"; button.className = `go-cell${state.lastMove === index ? " last" : ""}`; button.ariaLabel = `第 ${Math.floor(index / GO_SIZE) + 1} 行第 ${index % GO_SIZE + 1} 列`; if (piece) { const stone = document.createElement("i"); stone.className = piece === 1 ? "black" : "white"; button.append(stone); } button.addEventListener("click", () => playGo(index)); grid.append(button); });
  const names = state.room ? [tableSeatName(0), tableSeatName(1)] : ["你", "AI"];
  setPlayers([{ name: `${names[0]}・黑棋`, detail: `提 ${state.captures[0]} 子`, color: "#222" }, { name: `${names[1]}・白棋`, detail: `提 ${state.captures[1]} 子`, color: "#eee" }], state.turn - 1); turnEl.textContent = state.winner ? "本局結束" : canControlTableSeat() ? "輪到你了" : `等待 ${names[state.turn - 1]}`; statusEl.textContent = state.winner ? state.winner === 3 ? `黑 ${state.scores[0]}：白 ${state.scores[1]}，和棋。` : `黑 ${state.scores[0]}：白 ${state.scores[1]}，${names[state.winner - 1]} 獲勝` : canControlTableSeat() ? "選擇交叉點落子，或停一手。" : `等待 ${names[state.turn - 1]} 落子。`;
}
function playGo(index) { if (!canControlTableSeat() || state.winner) return; const next = applyGoMove(state, index); if (next === state) { toast("此處為自殺、重複劫形或已有棋子"); return; } state = { ...next, game: "go", ...tableContext() }; renderGo(); commitTableState(); if (!state.room) schedule(aiGo); }
function aiGo() { if (state.winner) return; const move = chooseGoMove(state, state.difficulty); state = { ...applyGoMove(state, move), game: "go", ...tableContext() }; renderGo(); }
function passGo() { if (!canControlTableSeat() || state.winner) return; state = { ...applyGoMove(state, null), game: "go", ...tableContext() }; renderGo(); commitTableState(); if (!state.room && !state.winner) schedule(aiGo); }

function startMahjong(humans, total = 4) { state = { ...state, ...dealMahjong(total), humans, total, humanSeats: state.room ? state.humanSeats : humans }; rulesEl.textContent = "家庭自摸版：使用 136 張牌，每家 13 張，湊成四組順子／刻子加一對將即可胡牌；本版不含花牌與搶碰吃。"; primary.hidden = false; primary.textContent = "自摸檢查"; renderMahjong(); }
function canControlMahjongSeat() { return state.room ? canControlTableSeat() : state.turn < state.humans; }
function renderMahjong() { const current = state.turn, local = state.room ? state.localSeat : current < state.humans ? current : 0; boardEl.innerHTML = '<div class="mahjong-table"><div class="mahjong-opponents"></div><div class="mahjong-discards"><div class="wall-count"></div></div><div class="mahjong-hand"></div></div>'; const seats = boardEl.querySelector(".mahjong-opponents"); for (let i = 0; i < state.total; i += 1) { if (i === local) continue; const seat = document.createElement("div"); seat.className = "mahjong-seat"; seat.textContent = `${state.room ? tableSeatName(i) : i < state.humans ? `玩家 ${i + 1}` : `AI ${i - state.humans + 1}`}・${state.hands[i].length} 張`; seats.append(seat); } const discardArea = boardEl.querySelector(".mahjong-discards"); discardArea.querySelector(".wall-count").textContent = `牌牆剩餘 ${state.wall.length} 張`; state.discards.flat().slice(-28).forEach((tile) => discardArea.append(tileButton(tile, false))); const hand = boardEl.querySelector(".mahjong-hand"); state.hands[local].forEach((tile, index) => { const button = tileButton(tile, true); button.disabled = !canControlMahjongSeat(); button.addEventListener("click", () => humanMahjongDiscard(index)); hand.append(button); }); setPlayers(Array.from({ length: state.total }, (_, i) => ({ name: state.room ? tableSeatName(i) : i < state.humans ? `玩家 ${i + 1}` : `AI ${i - state.humans + 1}`, detail: `${state.hands[i].length} 張`, color: ["#b94136", "#315b88", "#d5a72d", "#315b49"][i] })), current); turnEl.textContent = state.winner !== null ? "本局結束" : canControlMahjongSeat() ? "輪到你出牌" : `${state.room ? tableSeatName(current, true) : current < state.humans ? `玩家 ${current + 1}` : `AI ${current - state.humans + 1}`} 思考`; statusEl.textContent = state.winner !== null ? `${state.room ? tableSeatName(state.winner, true) : state.winner < state.humans ? `玩家 ${state.winner + 1}` : `AI ${state.winner - state.humans + 1}`} 自摸胡牌！` : canControlMahjongSeat() ? "選擇一張牌打出。" : "等待目前座位完成摸打。"; }
const MAHJONG_HONORS = { 東: 0x1f000, 南: 0x1f001, 西: 0x1f002, 北: 0x1f003, 中: 0x1f004, 發: 0x1f005, 白: 0x1f006 };
function mahjongGlyph(tile) { const start = tile.suit === "萬" ? 0x1f007 : tile.suit === "條" ? 0x1f010 : tile.suit === "筒" ? 0x1f019 : MAHJONG_HONORS[tile.label]; return String.fromCodePoint(start + (tile.suit === "字" ? 0 : tile.rank - 1)); }
function tileButton(tile, button) { const el = document.createElement(button ? "button" : "i"); el.className = `mahjong-tile suit-${tile.suit}${tile.suit === "字" ? " honor" : ""}`; const face = document.createElement("span"); face.className = "mahjong-glyph"; face.textContent = mahjongGlyph(tile); const caption = document.createElement("small"); caption.textContent = tile.label; el.append(face, caption); el.ariaLabel = `${tile.label}麻將牌`; return el; }
function humanMahjongDiscard(index) { if (state.winner !== null || !canControlMahjongSeat()) return; state = discardMahjong(state, state.turn, index); advanceMahjong(); }
function advanceMahjong() { if (!state.wall.length) { statusEl.textContent = "牌牆用盡，本局流局。"; commitTableState(); return; } state = drawMahjong(state, state.turn); renderMahjong(); commitTableState(); if (state.winner !== null) return; queueTableAi(aiMahjongTurn, 430); }
function aiMahjongTurn() { if (!canRunTableAi()) return; state = discardMahjong(state, state.turn, chooseMahjongDiscard(state.hands[state.turn])); advanceMahjong(); }

function startBigTwo(total) { state = { ...state, ...dealBigTwo(total), total }; rulesEl.textContent = "3♦ 首攻；可出單張、對子、三條或五張牌型。五張牌依序為同花順、鐵支、葫蘆、同花、順子；點數 2 最大。"; primary.hidden = false; primary.textContent = "出牌"; pass.hidden = false; pass.textContent = "過牌"; renderBigTwo(); queueTableAi(aiBigTwo, 500); }
function renderBigTwo() { const local = state.room ? state.localSeat : 0; boardEl.innerHTML = '<div class="bigtwo-table"><div class="bigtwo-opponents"></div><div class="bigtwo-center"></div><div class="bigtwo-hand"></div></div>'; const opponents = boardEl.querySelector(".bigtwo-opponents"); for (let i = 0; i < state.total; i += 1) { if (i === local) continue; const el = document.createElement("div"); el.className = "bigtwo-opponent"; const label = document.createTextNode(state.room ? tableSeatName(i) : `AI ${i}`); const count = document.createElement("b"); count.textContent = state.hands[i].length; el.append(label, count); opponents.append(el); } const center = boardEl.querySelector(".bigtwo-center"); if (state.lastPlay) { const wrap = document.createElement("div"); wrap.className = "playing-cards"; state.lastPlay.cards.forEach((card) => wrap.append(cardButton(card, false))); center.append(wrap); } else center.textContent = "新一輪，自由出牌"; const hand = boardEl.querySelector(".bigtwo-hand"); state.hands[local].forEach((card) => { const button = cardButton(card, true); button.classList.toggle("selected", selected.has(card.id)); button.addEventListener("click", () => { if (!canControlTableSeat()) return; selected.has(card.id) ? selected.delete(card.id) : selected.add(card.id); renderBigTwo(); }); hand.append(button); }); setPlayers(Array.from({ length: state.total }, (_, i) => ({ name: state.room ? tableSeatName(i) : i === 0 ? "你" : `AI ${i}`, detail: `${state.hands[i].length} 張`, color: i === local ? "#b94136" : "#315b49" })), state.turn); turnEl.textContent = state.winner !== null ? "本局結束" : canControlTableSeat() ? "輪到你了" : `${state.room ? tableSeatName(state.turn, true) : `AI ${state.turn}`} 出牌`; statusEl.textContent = state.winner !== null ? `${state.room ? tableSeatName(state.winner, true) : state.winner === 0 ? "你" : `AI ${state.winner}`} 率先出完手牌！` : canControlTableSeat() ? state.lastPlay ? "選牌壓過桌面牌型，或選擇過牌。" : "選擇合法牌型開始新一輪。" : `等待 ${state.room ? tableSeatName(state.turn, true) : `AI ${state.turn}`} 出牌。`; pass.disabled = !canControlTableSeat() || !state.lastPlay || state.leader === local; primary.disabled = !canControlTableSeat(); }
function cardButton(card, button) { const el = document.createElement(button ? "button" : "i"); el.className = `playing-card${["♦", "♥"].includes(card.suit) ? " red" : ""}`; el.textContent = `${card.rank}${card.suit}`; return el; }
function humanBigTwoPlay() { if (state.game !== "bigtwo" || !canControlTableSeat()) return; const next = playBigTwo(state, state.turn, [...selected]); if (next === state) { toast("這組牌型不合法，或無法壓過上一手"); return; } state = next; selected.clear(); renderBigTwo(); commitTableState(); if (state.winner === null) queueTableAi(aiBigTwo, 500); }
function aiBigTwo() { if (state.winner !== null || !canRunTableAi()) return; const move = chooseBigTwoPlay(state, state.turn); state = move ? playBigTwo(state, state.turn, move) : passBigTwo(state, state.turn); renderBigTwo(); commitTableState(); if (state.winner === null) queueTableAi(aiBigTwo, 420); }

function startBlackjack(total) { state = { ...state, ...createBlackjackState(total), total }; rulesEl.textContent = "A 可算 1 或 11，J/Q/K 為 10；玩家不爆 21 且高於莊家即勝，莊家 16 以下補牌、17 起停牌。"; primary.hidden = false; primary.textContent = "補牌"; pass.hidden = false; pass.textContent = "停牌"; renderBlackjack(); }
function renderBlackjack() { const local=state.room?state.localSeat:0; boardEl.innerHTML = '<div class="card-table blackjack-table"><div class="dealer-hand"></div><div class="blackjack-seats"></div><div class="player-card-hand"></div></div>'; const dealer = boardEl.querySelector(".dealer-hand"); dealer.append(Object.assign(document.createElement("strong"), { textContent: state.phase === "finished" ? `莊家 ${blackjackScore(state.dealer).total} 點` : "莊家" })); state.dealer.forEach((card,index) => dealer.append(index === 1 && state.phase !== "finished" ? cardBack() : cardButton(card,false))); const seats = boardEl.querySelector(".blackjack-seats"); for (let i=0;i<state.total;i+=1) { if(i===local)continue;const seat=document.createElement("div"); seat.className="card-seat"; seat.textContent=`${state.room?tableSeatName(i):`AI ${i}`}・${state.phase === "finished" ? blackjackScore(state.hands[i]).total : "?"} 點`; seats.append(seat); } const hand=boardEl.querySelector(".player-card-hand"); state.hands[local].forEach((card)=>hand.append(cardButton(card,false))); setPlayers(Array.from({length:state.total},(_,i)=>({name:state.room?tableSeatName(i):i===0?"你":`AI ${i}`,detail:state.phase === "finished"||i===local?`${blackjackScore(state.hands[i]).total} 點`:`${state.hands[i].length} 張`,color:i===local?"#b94136":"#315b49"})),state.phase==="players"?state.turn:-1); turnEl.textContent=state.phase==="finished"?"本局結束":state.phase==="dealer"?"莊家補牌":canControlTableSeat()?"輪到你了":`${state.room?tableSeatName(state.turn,true):`AI ${state.turn}`} 決定`; statusEl.textContent=state.phase==="finished"?state.results.map((result,i)=>`${state.room?tableSeatName(i,true):i===0?"你":`AI ${i}`}：${result==="win"?"勝":result==="push"?"和":"負"}`).join("　"):canControlTableSeat()?`目前 ${blackjackScore(state.hands[local]).total} 點，選擇補牌或停牌。`:"其他玩家正在依牌面決定。"; primary.disabled=!canControlTableSeat()||state.phase!=="players"; pass.disabled=!canControlTableSeat()||state.phase!=="players"; }
function cardBack(){const el=document.createElement("i");el.className="playing-card card-back";el.textContent="同樂";return el;}
function humanBlackjackHit(){if(state.game!=="blackjack"||!canControlTableSeat())return;const seat=state.turn;state=hitBlackjack(state,seat);renderBlackjack();if(state.statuses[seat]!=="playing")humanBlackjackStand();else commitTableState();}
function humanBlackjackStand(){if(state.game!=="blackjack"||!canControlTableSeat())return;state=standBlackjack(state,state.turn);renderBlackjack();commitTableState();advanceBlackjack();}
function aiBlackjackTurn(){if(state.phase!=="players"||!canRunTableAi())return;state=runBlackjackAiTurn(state);renderBlackjack();commitTableState();advanceBlackjack();}
function advanceBlackjack(){if(state.phase==="dealer"){if(!state.room||state.localSeat===0)schedule(()=>{state=settleBlackjack(state);renderBlackjack();commitTableState();},500);return;}queueTableAi(aiBlackjackTurn,420);}

function startPickRed(total){state={...state,...createPickRedState(total),total,pendingCard:null};rulesEl.textContent="打出手牌與桌面數字牌湊成 10 即可吃牌，J/Q/K 必須同字；紅 A 20 分，其餘紅牌依牌面計分，最高分獲勝。";renderPickRed();}
function renderPickRed(){const local=state.room?state.localSeat:0;boardEl.innerHTML='<div class="card-table pickred-table"><div class="pickred-table-cards"></div><div class="player-card-hand"></div></div>';const table=boardEl.querySelector(".pickred-table-cards"),pending=state.pendingCard?state.hands[local].find((card)=>card.id===state.pendingCard):null,matches=pending?pickRedMatches(pending,state.table).map((card)=>card.id):[];state.table.forEach((card)=>{const button=cardButton(card,true);button.classList.toggle("legal",matches.includes(card.id));button.addEventListener("click",()=>{if(matches.includes(card.id))humanPickRed(state.pendingCard,card.id);});table.append(button);});const hand=boardEl.querySelector(".player-card-hand");state.hands[local].forEach((card)=>{const button=cardButton(card,true);button.disabled=!canControlTableSeat();button.classList.toggle("selected",state.pendingCard===card.id);button.addEventListener("click",()=>selectPickRed(card.id));hand.append(button);});setPlayers(Array.from({length:state.total},(_,i)=>({name:state.room?tableSeatName(i):i===0?"你":`AI ${i}`,detail:`${state.hands[i].length} 張・${state.captures[i].reduce((sum,card)=>sum+pickRedValue(card),0)} 分`,color:i===local?"#b94136":"#315b49"})),state.turn);turnEl.textContent=state.winner!==null?"本局結束":canControlTableSeat()?"輪到你了":`${state.room?tableSeatName(state.turn,true):`AI ${state.turn}`} 出牌`;statusEl.textContent=state.winner!==null?`${state.room?tableSeatName(state.winner,true):state.winner===0?"你":`AI ${state.winner}`} 以 ${state.scores[state.winner]} 分獲勝！`:canControlTableSeat()?(state.pendingCard?"選擇發亮的桌面牌吃走。":"選擇一張手牌；可湊十時會提示目標。"):`等待 ${state.room?tableSeatName(state.turn,true):`AI ${state.turn}`} 找紅點。`;}
function selectPickRed(cardId){if(!canControlTableSeat()||state.winner!==null)return;const card=state.hands[state.turn].find((item)=>item.id===cardId),matches=pickRedMatches(card,state.table);if(matches.length<=1)humanPickRed(cardId,matches[0]?.id||null);else{state.pendingCard=cardId;renderPickRed();}}
function humanPickRed(cardId,targetId){if(!canControlTableSeat())return;state={...playPickRed(state,state.turn,cardId,targetId),game:"pickred",difficulty:state.difficulty,total:state.total,pendingCard:null};renderPickRed();commitTableState();if(state.winner===null)queueTableAi(aiPickRed);}
function aiPickRed(){if(!canRunTableAi())return;const move=choosePickRedPlay(state,state.turn);state={...playPickRed(state,state.turn,move.cardId,move.targetId),game:"pickred",difficulty:state.difficulty,total:state.total,pendingCard:null};renderPickRed();commitTableState();if(state.winner===null)queueTableAi(aiPickRed,350);}

function startNinetyNine(total){state={...state,...createNinetyNineState(total),playerCount:total};rulesEl.textContent="輪流出牌且總點數不可超過 99；A 加 1/11、4 反轉、10 加減 10、J 跳過、Q 加 20、K 直接設為 99，無合法牌者淘汰。";primary.hidden=false;primary.textContent="出牌";renderNinetyNine();}
function renderNinetyNine(){const local=state.room?state.localSeat:0;boardEl.innerHTML='<div class="card-table ninetynine-table"><div class="ninety-total"></div><div class="ninety-last"></div><div class="player-card-hand"></div></div>';boardEl.querySelector(".ninety-total").textContent=state.total;const last=boardEl.querySelector(".ninety-last");last.textContent=state.lastPlay?`${state.lastPlay.card.rank}${state.lastPlay.card.suit}`:"尚未出牌";const hand=boardEl.querySelector(".player-card-hand");state.hands[local].forEach((card)=>{const button=cardButton(card,true);const legal=legalNinetyNinePlays(state,local).some((play)=>play.cardId===card.id);button.disabled=!legal||!canControlTableSeat();button.classList.toggle("selected",selected.has(card.id));button.addEventListener("click",()=>{if(!canControlTableSeat())return;selected.clear();selected.add(card.id);renderNinetyNine();});hand.append(button);});setPlayers(Array.from({length:state.hands.length},(_,i)=>({name:state.room?tableSeatName(i):i===0?"你":`AI ${i}`,detail:state.alive[i]?`${state.hands[i].length} 張`:"已淘汰",color:i===local?"#b94136":"#315b49"})),state.turn);turnEl.textContent=state.winner!==null?"本局結束":canControlTableSeat()?"輪到你了":`${state.room?tableSeatName(state.turn,true):`AI ${state.turn}`} 出牌`;statusEl.textContent=state.winner!==null?`${state.room?tableSeatName(state.winner,true):state.winner===0?"你":`AI ${state.winner}`} 成為最後留在牌桌上的玩家！`:canControlTableSeat()?`目前 ${state.total} 點，選擇不超過 99 的牌。`:`等待 ${state.room?tableSeatName(state.turn,true):`AI ${state.turn}`} 控制點數。`;primary.disabled=!canControlTableSeat()||!selected.size;}
function humanNinetyNine(){if(state.game!=="ninetynine"||!canControlTableSeat()||!selected.size)return;state={...playNinetyNine(state,state.turn,[...selected][0]),game:"ninetynine",difficulty:state.difficulty,totalPlayers:state.total};selected.clear();renderNinetyNine();commitTableState();if(state.winner===null)queueTableAi(aiNinetyNine);}
function aiNinetyNine(){if(!canRunTableAi())return;const move=chooseNinetyNinePlay(state,state.turn);if(move)state={...playNinetyNine(state,state.turn,move.cardId),game:"ninetynine",difficulty:state.difficulty};renderNinetyNine();commitTableState();if(state.winner===null)queueTableAi(aiNinetyNine,350);}

function tetrisCellGrid(board, muted = false) {
  const grid = document.createElement("div");
  grid.className = `tetris-grid${muted ? " opponent-grid" : ""}`;
  for (const row of board) for (const color of row) {
    const cell = document.createElement("i");
    if (color) cell.dataset.color = String(color);
    grid.append(cell);
  }
  return grid;
}

function tetrisSide(label, snapshot, { opponent = false, waiting = false, countdown = 0 } = {}) {
  const side = document.createElement("section");
  side.className = `tetris-side${opponent ? " opponent" : ""}`;
  const header = document.createElement("div");
  header.className = "tetris-side-head";
  header.innerHTML = `<div><span>${opponent ? "OPPONENT" : "PLAYER"}</span><strong></strong></div><div class="tetris-score"><b>${snapshot?.score || 0}</b><small>${snapshot?.lines || 0} 行</small></div>`;
  header.querySelector("strong").textContent = label;
  side.append(header, tetrisCellGrid(snapshot?.board || Array.from({ length: 20 }, () => Array(10).fill(0)), opponent));
  if (waiting) { const overlay = document.createElement("div"); overlay.className = "tetris-waiting"; overlay.innerHTML = "<b>等待對手加入</b><span>房間保持開啟中…</span>"; side.append(overlay); }
  if (countdown > 0) { const overlay = document.createElement("div"); overlay.className = "tetris-waiting start-countdown"; overlay.innerHTML = `<strong>${countdown}</strong><b>準備開始</b><span>方向鍵準備就位</span>`; side.append(overlay); }
  if (snapshot?.gameOver) { const overlay = document.createElement("div"); overlay.className = "tetris-waiting game-over"; overlay.innerHTML = "<b>GAME OVER</b><span>本局已完成</span>"; side.append(overlay); }
  return side;
}

function renderTetris() {
  if (state?.game !== "tetris") return;
  const snapshot = tetrisSnapshot(state.engine);
  const roomPlayers = state.room?.players || [];
  const me = roomPlayers.find((player) => player.id === roomPlayerId);
  const opponent = roomPlayers.find((player) => player.id !== roomPlayerId);
  boardEl.innerHTML = "";
  const arena = document.createElement("div"); arena.className = `tetris-arena${state.room ? " versus" : " single"}`;
  const countdown = state.startCountdownAt ? Math.max(0, Math.ceil((state.startCountdownAt - Date.now()) / 1000)) : 0;
  arena.append(tetrisSide(me?.name || "你", snapshot, { countdown }));
  if (state.room) arena.append(tetrisSide(opponent?.name || "對手", state.opponent, { opponent: true, waiting: !opponent || !state.opponent }));
  const controls = document.createElement("div"); controls.className = "tetris-touch-controls"; controls.innerHTML = '<button type="button" data-tetris="left" aria-label="向左">←</button><button type="button" data-tetris="rotate" aria-label="旋轉">↻</button><button type="button" data-tetris="down" aria-label="向下">↓</button><button type="button" data-tetris="right" aria-label="向右">→</button><button class="wide" type="button" data-tetris="drop">快速落下</button>';
  controls.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => controlTetris(button.dataset.tetris)));
  boardEl.append(arena, controls);
  const speed = TETRIS_SPEEDS[state.speed];
  const opponentName = opponent?.name || "對手";
  setPlayers(state.room ? [{ name: me?.name || "你", detail: `${snapshot.score} 分・${snapshot.lines} 行`, color: "#b94136" }, { name: opponentName, detail: state.opponent ? `${state.opponent.score} 分・${state.opponent.lines} 行` : "等待加入", color: "#315b49" }] : [{ name: "你", detail: `${snapshot.score} 分・${snapshot.lines} 行`, color: "#b94136" }], -1);
  turnEl.textContent = state.engine.gameOver ? "本局結束" : countdown ? "準備開始" : state.engine.paused ? "遊戲暫停" : `${speed.label}速度`;
  if (state.engine.gameOver && state.opponent?.gameOver) statusEl.textContent = snapshot.score === state.opponent.score ? "雙方同分，這局平手！" : snapshot.score > state.opponent.score ? "你以較高分數獲勝！" : `${opponentName} 以較高分數獲勝。`;
  else if (state.engine.gameOver) statusEl.textContent = state.room ? "你的方塊已堆滿，等待對手完成本局。" : `遊戲結束，共消除 ${snapshot.lines} 行、得到 ${snapshot.score} 分。`;
  else if (countdown) statusEl.textContent = `倒數 ${countdown} 秒後開始。`;
  else statusEl.textContent = state.room ? (opponent ? `正在與 ${opponentName} 同步對戰。` : "等待第二位玩家加入，仍可先開始練習。") : "方向鍵移動／旋轉，空白鍵快速落下，P 鍵暫停。";
  primary.textContent = state.engine.paused ? "繼續遊戲" : "暫停遊戲";
}

function controlTetris(action) {
  if (state?.game !== "tetris" || state.engine.gameOver || state.startCountdownAt > Date.now()) return;
  if (action === "left") moveTetris(state.engine, -1);
  else if (action === "right") moveTetris(state.engine, 1);
  else if (action === "rotate") rotateTetris(state.engine);
  else if (action === "down") dropTetris(state.engine, false);
  else if (action === "drop") dropTetris(state.engine, true);
  renderTetris();
}

async function syncTetrisRoom() {
  if (state?.game !== "tetris" || !state.room || !ROOM_API) return;
  try {
    const data = await roomRequest(`/api/rooms/${state.room.id}/tetris`, { method: "POST", body: JSON.stringify({ playerId: roomPlayerId, state: tetrisSnapshot(state.engine) }) });
    if (state?.game !== "tetris" || state.room?.id !== data.room.id) return;
    state.room = data.room;
    state.opponent = data.snapshots.find((item) => item.playerId !== roomPlayerId)?.state || null;
    renderTetris();
  } catch (error) {
    if (!state.syncWarningShown) { state.syncWarningShown = true; toast(`對手同步暫停：${error.message}`); }
  }
}

function startTetris(speed, room) {
  state = { ...state, speed, room, engine: createTetrisState(speed), opponent: null, startCountdownAt: room ? 0 : Date.now() + 5000, syncWarningShown: false };
  rulesEl.textContent = "方向鍵左右移動、↑ 旋轉、↓ 軟降、空白鍵硬降；完整一行會自動消除。雙人模式各自在自己的裝置操作，畫面會同步顯示對手進度。";
  primary.hidden = false; primary.textContent = "暫停遊戲";
  renderTetris();
  if (state.startCountdownAt) tetrisCountdownTimer = setInterval(() => { if (state?.game !== "tetris") return; renderTetris(); if (Date.now() >= state.startCountdownAt) { state.startCountdownAt = 0; clearInterval(tetrisCountdownTimer); tetrisCountdownTimer = null; renderTetris(); } }, 100);
  tetrisTimer = setInterval(() => { if (state?.game !== "tetris" || state.engine.gameOver || state.startCountdownAt > Date.now()) return; tickTetris(state.engine); renderTetris(); }, TETRIS_SPEEDS[speed].interval);
  if (room && ROOM_API) { syncTetrisRoom(); tetrisSyncTimer = setInterval(syncTetrisRoom, 700); }
}

window.addEventListener("keydown", (event) => {
  if (state?.game !== "tetris" || !document.querySelector("#casualView").classList.contains("active") || setup.open) return;
  const action = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "rotate", ArrowDown: "down", " ": "drop" }[event.key];
  if (action) { event.preventDefault(); controlTetris(action); }
  if (event.key.toLowerCase() === "p" && state.startCountdownAt <= Date.now()) { event.preventDefault(); state.engine.paused = !state.engine.paused; renderTetris(); }
});

const isArcadeGame = (game) => ["volleyball", "racing", "brickbreaker"].includes(game);
function arcadeInput(player = 0) {
  if (player === 0) return { left: arcadeKeys.ArrowLeft || arcadeTouch.left, right: arcadeKeys.ArrowRight || arcadeTouch.right, up: arcadeKeys.ArrowUp || arcadeTouch.up, down: arcadeKeys.ArrowDown || arcadeTouch.down, action: arcadeKeys.Space || arcadeTouch.action };
  return { left: arcadeKeys.KeyA, right: arcadeKeys.KeyD, up: arcadeKeys.KeyW, down: arcadeKeys.KeyS, action: arcadeKeys.KeyF || arcadeKeys.Enter };
}

function arcadeCanvasDraw() {
  const canvas = boardEl.querySelector("#arcadeCanvas");
  if (!canvas || !state?.engine) return;
  if (state.game === "volleyball") drawVolleyball(canvas, state.engine);
  else if (state.game === "racing") drawRacing(canvas, state.engine);
  else drawBrickBreaker(canvas, state.engine);
}

function renderArcadeStatus() {
  if (!isArcadeGame(state?.game)) return;
  const [first, second] = state.engine.players;
  const opponent = state.room?.players?.find((player) => player.id !== roomPlayerId);
  const names = state.room ? [state.room.players[0]?.name || "房主", state.room.players[1]?.name || "等待對手"] : ["玩家 1", state.players === 1 ? "AI" : "玩家 2"];
  if (state.game === "brickbreaker") {
    const mode = BRICK_BREAKER_MODES[state.engine.mode];
    const playerRows = [{ name: names[0], detail: `${first.score} 分・最高 ${first.maxCombo} Combo`, color: "#3d7fd6" }];
    if (state.engine.mode !== "classic") playerRows.push({ name: names[1], detail: `${second.score} 分・最高 ${second.maxCombo} Combo`, color: "#d94a3c" });
    setPlayers(playerRows, -1);
    turnEl.textContent = state.engine.winner !== null ? "本局結束" : state.arcadePaused ? "遊戲暫停" : `${mode.label}・${state.engine.stageLabel}`;
    if (state.engine.winner !== null) statusEl.textContent = state.engine.winner === -1 ? (state.engine.mode === "versus" ? "雙方同時清空，這局平手！" : "三條生命用盡，重新開始再挑戰。") : `${names[state.engine.winner]} 獲勝！`;
    else if (state.room && !opponent) statusEl.textContent = "等待第二位玩家加入；房間會保留目前進度。";
    else if (state.engine.event && state.engine.frame - state.engine.event.frame < 150) statusEl.textContent = state.engine.message;
    else statusEl.textContent = state.engine.mode === "classic" ? `生命 ${state.engine.lives}・累積 Combo 並接住掉落道具。` : state.engine.mode === "coop" ? `共用 ${state.engine.lives} 條生命，左右兩板互相救球。` : "先清空自己的半場，或讓對手生命歸零。";
    return;
  }
  const detail = state.game === "volleyball" ? [`${first.score} 分`, `${second.score} 分`] : [`${first.score} 分・❤ ${first.lives}`, `${second.score} 分・❤ ${second.lives}`];
  setPlayers([{ name: names[0], detail: detail[0], color: "#2e72d2" }, { name: names[1], detail: detail[1], color: "#d94b3c" }], -1);
  const countingDown = ["volleyball", "racing", "brickbreaker"].includes(state.game) && state.engine.countdown > 0;
  turnEl.textContent = state.engine.winner !== null ? "本局結束" : countingDown ? "準備開始" : state.arcadePaused ? "遊戲暫停" : state.room && !opponent ? "等待對手" : "比賽進行中";
  if (state.engine.winner !== null) statusEl.textContent = state.engine.winner === -1 ? "本局平手，重新開始再比一次！" : `${state.engine.winner === 0 ? names[0] : names[1]} 獲勝！`;
  else if (countingDown) statusEl.textContent = `倒數 ${Math.max(1, Math.ceil(state.engine.countdown / 60))} 秒後開始。`;
  else if (state.room && !opponent) statusEl.textContent = "等待第二位玩家加入；目前由 AI 陪你暖身。";
  else if (state.game === "volleyball" && state.engine.lastSpike && state.engine.frame - state.engine.lastSpike.frame < 42) statusEl.textContent = `玩家 ${state.engine.lastSpike.player + 1}：${state.engine.lastSpike.label}`;
  else statusEl.textContent = state.game === "volleyball" ? "空中按空白鍵殺球；同時搭配方向鍵可控制平殺、斜上或斜下角度。" : "避開三角錐、油漬與路障，保留最多耐久跑到終點。";
}

function arcadeLoop() {
  if (!isArcadeGame(state?.game)) return;
  if (!state.arcadePaused) {
    const useAi = state.room ? state.room.players.length < 2 : state.players === 1;
    const firstInput = state.onlineRole === "guest" ? state.remoteInput : arcadeInput(0);
    const secondInput = state.onlineRole === "guest" ? arcadeInput(0) : state.room ? state.remoteInput : arcadeInput(1);
    if (state.game === "volleyball") updateVolleyball(state.engine, firstInput, secondInput, useAi);
    else if (state.game === "racing") updateRacing(state.engine, firstInput, secondInput, useAi);
    else updateBrickBreaker(state.engine, firstInput, secondInput, useAi && state.engine.mode !== "classic");
  }
  arcadeCanvasDraw();
  if (state.engine.frame % 10 === 0 || state.engine.winner !== null) renderArcadeStatus();
  arcadeFrame = requestAnimationFrame(arcadeLoop);
}

async function syncArcadeRoom() {
  if (!isArcadeGame(state?.game) || !state.room || !ROOM_API || arcadeSyncInFlight) return;
  arcadeSyncInFlight = true;
  try {
    const payload = { playerId: roomPlayerId, input: arcadeInput(0) };
    if (state.onlineRole === "host") payload.state = state.engine;
    const data = await roomRequest(`/api/rooms/${state.room.id}/arcade`, { method: "POST", body: JSON.stringify(payload) });
    if (!isArcadeGame(state?.game) || state.room?.id !== data.room.id) return;
    state.room = data.room;
    const remote = data.inputs.find((item) => item.playerId !== roomPlayerId);
    state.remoteInput = remote?.input || {};
    if (state.onlineRole === "guest" && data.snapshot) {
      const predicted = state.engine, authoritative = data.snapshot;
      const blend = (current, next, weight = .28) => current + (next - current) * weight;
      authoritative.players[1].x = blend(predicted.players[1].x, authoritative.players[1].x, .22);
      authoritative.players[1].y = blend(predicted.players[1].y, authoritative.players[1].y, .22);
      if (state.game === "volleyball") {
        authoritative.players[1].vx = predicted.players[1].vx;
        authoritative.players[1].vy = predicted.players[1].vy;
        authoritative.ball.x = blend(predicted.ball.x, authoritative.ball.x);
        authoritative.ball.y = blend(predicted.ball.y, authoritative.ball.y);
      }
      state.engine = authoritative;
    }
    state.syncWarningShown = false; renderArcadeStatus();
  } catch (error) {
    if (!state.syncWarningShown) { state.syncWarningShown = true; toast(`對戰同步暫停：${error.message}`); }
  } finally { arcadeSyncInFlight = false; }
}

function startArcadeGame(game, players, room, arcadeMode = "classic") {
  const engine = game === "volleyball" ? createVolleyballState() : game === "racing" ? createRacingState() : createBrickBreakerState(arcadeMode);
  if (room && ["racing", "brickbreaker"].includes(game)) engine.countdown = 0;
  state = { ...state, players, room, arcadeMode, engine, arcadePaused: false, remoteInput: {}, onlineRole: room?.players?.[0]?.id === roomPlayerId ? "host" : room ? "guest" : null, syncWarningShown: false };
  const touchButtons = game === "brickbreaker" ? '<button type="button" data-arcade="left" aria-label="向左">←</button><button type="button" data-arcade="action">衝刺</button><button type="button" data-arcade="right" aria-label="向右">→</button>' : '<button type="button" data-arcade="left" aria-label="向左">←</button><button type="button" data-arcade="up" aria-label="跳躍或加速">↑</button><button type="button" data-arcade="down" aria-label="向下或斜下殺球">↓</button><button type="button" data-arcade="right" aria-label="向右">→</button><button type="button" data-arcade="action">殺球</button>';
  boardEl.innerHTML = `<div class="arcade-stage${game === "brickbreaker" ? " brickbreaker-stage" : ""}"><canvas id="arcadeCanvas" width="800" height="500" aria-label="街機遊戲畫面"></canvas><div class="arcade-touch-controls">${touchButtons}</div></div>`;
  boardEl.querySelectorAll("[data-arcade]").forEach((button) => {
    const key = button.dataset.arcade;
    const press = (event) => { event.preventDefault(); arcadeTouch[key] = true; };
    const release = (event) => { event.preventDefault(); arcadeTouch[key] = false; };
    button.addEventListener("pointerdown", press); button.addEventListener("pointerup", release); button.addEventListener("pointercancel", release); button.addEventListener("pointerleave", release);
  });
  rulesEl.textContent = game === "volleyball" ? "玩家 1：方向鍵移動，空白鍵攻擊；空中搭配前、後、↑、↓ 可改變殺球角度，地面按方向＋攻擊可撲救。玩家 2：W／A／S／D 移動，F 或 Enter 攻擊。前＋↓＋攻擊是強力斜下殺。" : game === "racing" ? "玩家 1 使用方向鍵；本機玩家 2 使用 W、A、S、D。碰撞障礙會失去一點耐久，耐久較多或分數較高者獲勝。" : engine.mode === "classic" ? "使用 ←／→ 移動板子，按住空白鍵可加速追球。共有三條生命，接住道具、累積 Combo，並在每三關挑戰 Boss。" : "P1 使用 ←／→ 移動，空白鍵衝刺；P2 使用 A／D 移動，F 或 Enter 衝刺。合作模式共用生命，對戰模式先清空自己半場。";
  primary.hidden = false; primary.textContent = "暫停遊戲"; pass.hidden = true;
  renderArcadeStatus(); arcadeCanvasDraw(); arcadeFrame = requestAnimationFrame(arcadeLoop);
  if (room && ROOM_API) { syncArcadeRoom(); arcadeSyncTimer = setInterval(syncArcadeRoom, 90); }
}

window.addEventListener("keydown", (event) => {
  if (!isArcadeGame(state?.game) || !document.querySelector("#casualView").classList.contains("active") || setup.open) return;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyA", "KeyD", "KeyW", "KeyS", "KeyF", "Enter"].includes(event.code)) { event.preventDefault(); arcadeKeys[event.code] = true; }
  if (event.code === "KeyP") { event.preventDefault(); state.arcadePaused = !state.arcadePaused; primary.textContent = state.arcadePaused ? "繼續遊戲" : "暫停遊戲"; renderArcadeStatus(); }
});
window.addEventListener("keyup", (event) => { if (arcadeKeys[event.code]) { event.preventDefault(); arcadeKeys[event.code] = false; } });

primary.addEventListener("click",()=>{if(isArcadeGame(state?.game)){state.arcadePaused=!state.arcadePaused;primary.textContent=state.arcadePaused?"繼續遊戲":"暫停遊戲";renderArcadeStatus();}else if(state?.game==="tetris"){if(state.startCountdownAt>Date.now())return;state.engine.paused=!state.engine.paused;renderTetris();}else if(state?.game==="mahjong"&&canControlMahjongSeat()){if(isMahjongWin(state.hands[state.turn])){state.winner=state.turn;renderMahjong();commitTableState();}else toast("目前牌型尚未完成四組面子加一對將");}else if(state?.game==="bigtwo")humanBigTwoPlay();else if(state?.game==="blackjack")humanBlackjackHit();else if(state?.game==="ninetynine")humanNinetyNine();});
pass.addEventListener("click",()=>{if(state?.game==="bigtwo"){if(!canControlTableSeat())return;const next=passBigTwo(state,state.turn);if(next===state){toast("你是本輪領先者，不能過牌");return;}state=next;selected.clear();renderBigTwo();commitTableState();queueTableAi(aiBigTwo,420);}else if(state?.game==="blackjack")humanBlackjackStand();else if(state?.game==="go")passGo();});
document.querySelector("#casualRestart").addEventListener("click",()=>{const count=state.game==="tetris"||isArcadeGame(state.game)?state.players:state.game==="ninetynine"?state.playerCount:state.game==="checkers"||state.game==="bigtwo"||state.game==="blackjack"||state.game==="pickred"?state.total:state.game==="mahjong"?state.humans:1;startGame(state.game,count,state.difficulty,state.speed,state.room,state.arcadeMode);});
