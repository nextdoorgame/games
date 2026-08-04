const PIECES = [
  ["將", "general", 7, 1], ["士", "guard", 6, 2], ["象", "elephant", 5, 2],
  ["車", "rook", 4, 2], ["馬", "knight", 3, 2], ["包", "cannon", 2, 2], ["卒", "pawn", 1, 5]
];
const RED_NAMES = { general: "帥", guard: "仕", elephant: "相", rook: "俥", knight: "傌", cannon: "炮", pawn: "兵" };

function shuffle(items) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function createBanqiState() {
  const pieces = [];
  for (const color of ["black", "red"]) {
    PIECES.forEach(([blackName, kind, rank, count]) => {
      for (let copy = 0; copy < count; copy += 1) {
        pieces.push({ id: `${color}-${kind}-${copy}`, color, kind, rank, name: color === "red" ? RED_NAMES[kind] : blackName, faceUp: false });
      }
    });
  }
  return { board: shuffle(pieces), turn: 0, playerColors: [null, null], winner: null, lastAction: null };
}

const row = (index) => Math.floor(index / 8);
const col = (index) => index % 8;
const adjacent = (from, to) => Math.abs(row(from) - row(to)) + Math.abs(col(from) - col(to)) === 1;

function canCapture(attacker, defender) {
  if (!defender?.faceUp || attacker.color === defender.color) return false;
  if (attacker.kind === "pawn" && defender.kind === "general") return true;
  if (attacker.kind === "general" && defender.kind === "pawn") return false;
  return attacker.rank >= defender.rank;
}

function cannonScreens(board, from, to) {
  if (row(from) !== row(to) && col(from) !== col(to)) return Infinity;
  const step = row(from) === row(to) ? (to > from ? 1 : -1) : (to > from ? 8 : -8);
  let count = 0;
  for (let index = from + step; index !== to; index += step) if (board[index]) count += 1;
  return count;
}

export function banqiActions(state, player = state.turn) {
  if (state.winner !== null) return [];
  const color = state.playerColors[player];
  const actions = [];
  state.board.forEach((piece, from) => {
    if (!piece) return;
    if (!piece.faceUp) {
      actions.push({ type: "flip", from });
      return;
    }
    if (!color || piece.color !== color) return;
    state.board.forEach((target, to) => {
      if (from === to) return;
      if (piece.kind === "cannon" && target && (!target.faceUp || target.color !== color) && cannonScreens(state.board, from, to) === 1) actions.push({ type: "move", from, to });
      else if (adjacent(from, to) && (!target || canCapture(piece, target))) actions.push({ type: "move", from, to });
    });
  });
  return actions;
}

export function applyBanqiAction(state, action) {
  if (!banqiActions(state).some((item) => item.type === action.type && item.from === action.from && item.to === action.to)) return state;
  const next = { ...state, board: state.board.map((piece) => piece ? { ...piece } : null), playerColors: [...state.playerColors], lastAction: action };
  if (action.type === "flip") {
    next.board[action.from].faceUp = true;
    if (!next.playerColors[0]) {
      next.playerColors[next.turn] = next.board[action.from].color;
      next.playerColors[1 - next.turn] = next.board[action.from].color === "red" ? "black" : "red";
    }
  } else {
    next.board[action.to] = next.board[action.from];
    next.board[action.from] = null;
  }
  const opponentColor = next.playerColors[1 - next.turn];
  if (opponentColor && !next.board.some((piece) => piece?.color === opponentColor)) next.winner = next.turn;
  else next.turn = 1 - next.turn;
  return next;
}

export function chooseBanqiAction(state) {
  const actions = banqiActions(state);
  const captures = actions.filter((action) => action.type === "move" && state.board[action.to]);
  if (captures.length) return captures.sort((a, b) => state.board[b.to].rank - state.board[a.to].rank)[0];
  const flips = actions.filter((action) => action.type === "flip");
  return (flips.length ? flips : actions)[Math.floor(Math.random() * (flips.length || actions.length))] || null;
}
