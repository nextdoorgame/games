export const XIANGQI_ROWS = 10;
export const XIANGQI_COLS = 9;
export const RED = 1;
export const XIANGQI_BLACK = 2;

const VALUES = { K: 100000, R: 900, C: 450, N: 400, B: 200, A: 200, P: 100 };
const LABELS = {
  rK: "帥", rA: "仕", rB: "相", rN: "馬", rR: "車", rC: "炮", rP: "兵",
  bK: "將", bA: "士", bB: "象", bN: "馬", bR: "車", bC: "砲", bP: "卒"
};

const sideCode = (color) => color === RED ? "r" : "b";
export const otherXiangqiColor = (color) => color === RED ? XIANGQI_BLACK : RED;
export const xiangqiPieceColor = (piece) => piece?.[0] === "r" ? RED : piece?.[0] === "b" ? XIANGQI_BLACK : 0;
export const xiangqiPieceLabel = (piece) => LABELS[piece] || "";
const rowOf = (index) => Math.floor(index / XIANGQI_COLS);
const colOf = (index) => index % XIANGQI_COLS;
const at = (row, col) => row * XIANGQI_COLS + col;
const inside = (row, col) => row >= 0 && row < XIANGQI_ROWS && col >= 0 && col < XIANGQI_COLS;

export function createInitialXiangqiBoard() {
  const board = Array(XIANGQI_ROWS * XIANGQI_COLS).fill(null);
  const back = ["R", "N", "B", "A", "K", "A", "B", "N", "R"];
  back.forEach((type, col) => { board[at(0, col)] = `b${type}`; board[at(9, col)] = `r${type}`; });
  board[at(2, 1)] = "bC"; board[at(2, 7)] = "bC";
  board[at(7, 1)] = "rC"; board[at(7, 7)] = "rC";
  for (const col of [0, 2, 4, 6, 8]) { board[at(3, col)] = "bP"; board[at(6, col)] = "rP"; }
  return board;
}

function inPalace(color, row, col) {
  return col >= 3 && col <= 5 && (color === RED ? row >= 7 && row <= 9 : row >= 0 && row <= 2);
}

function pushIfAvailable(board, moves, from, row, col, color) {
  if (!inside(row, col)) return;
  const target = board[at(row, col)];
  if (!target || xiangqiPieceColor(target) !== color) moves.push({ from, to: at(row, col) });
}

function pseudoMovesFor(board, from) {
  const piece = board[from];
  if (!piece) return [];
  const color = xiangqiPieceColor(piece);
  const type = piece[1];
  const row = rowOf(from);
  const col = colOf(from);
  const moves = [];

  if (type === "K") {
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const r = row + dr, c = col + dc;
      if (inPalace(color, r, c)) pushIfAvailable(board, moves, from, r, c, color);
    }
    for (const direction of [-1, 1]) {
      for (let r = row + direction; r >= 0 && r < XIANGQI_ROWS; r += direction) {
        const target = board[at(r, col)];
        if (!target) continue;
        if (target[1] === "K" && xiangqiPieceColor(target) !== color) moves.push({ from, to: at(r, col) });
        break;
      }
    }
  } else if (type === "A") {
    for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const r = row + dr, c = col + dc;
      if (inPalace(color, r, c)) pushIfAvailable(board, moves, from, r, c, color);
    }
  } else if (type === "B") {
    for (const [dr, dc] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) {
      const r = row + dr, c = col + dc;
      if (!inside(r, c) || board[at(row + dr / 2, col + dc / 2)]) continue;
      if ((color === RED && r < 5) || (color === XIANGQI_BLACK && r > 4)) continue;
      pushIfAvailable(board, moves, from, r, c, color);
    }
  } else if (type === "N") {
    for (const [dr, dc, lr, lc] of [[-2,-1,-1,0],[-2,1,-1,0],[2,-1,1,0],[2,1,1,0],[-1,-2,0,-1],[1,-2,0,-1],[-1,2,0,1],[1,2,0,1]]) {
      if (!board[at(row + lr, col + lc)]) pushIfAvailable(board, moves, from, row + dr, col + dc, color);
    }
  } else if (type === "R" || type === "C") {
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let screened = false;
      for (let r = row + dr, c = col + dc; inside(r, c); r += dr, c += dc) {
        const target = board[at(r, c)];
        if (type === "R") {
          if (!target) moves.push({ from, to: at(r, c) });
          else { if (xiangqiPieceColor(target) !== color) moves.push({ from, to: at(r, c) }); break; }
        } else if (!screened) {
          if (!target) moves.push({ from, to: at(r, c) });
          else screened = true;
        } else if (target) {
          if (xiangqiPieceColor(target) !== color) moves.push({ from, to: at(r, c) });
          break;
        }
      }
    }
  } else if (type === "P") {
    const forward = color === RED ? -1 : 1;
    pushIfAvailable(board, moves, from, row + forward, col, color);
    const crossed = color === RED ? row <= 4 : row >= 5;
    if (crossed) {
      pushIfAvailable(board, moves, from, row, col - 1, color);
      pushIfAvailable(board, moves, from, row, col + 1, color);
    }
  }
  return moves;
}

export function applyXiangqiMove(board, move) {
  const next = [...board];
  next[move.to] = next[move.from];
  next[move.from] = null;
  return next;
}

export function isXiangqiInCheck(board, color) {
  const king = board.findIndex((piece) => piece === `${sideCode(color)}K`);
  if (king < 0) return true;
  const opponent = otherXiangqiColor(color);
  for (let from = 0; from < board.length; from += 1) {
    if (xiangqiPieceColor(board[from]) !== opponent) continue;
    if (pseudoMovesFor(board, from).some((move) => move.to === king)) return true;
  }
  return false;
}

export function getXiangqiLegalMoves(board, color) {
  const moves = [];
  for (let from = 0; from < board.length; from += 1) {
    if (xiangqiPieceColor(board[from]) !== color) continue;
    for (const move of pseudoMovesFor(board, from)) {
      if (!isXiangqiInCheck(applyXiangqiMove(board, move), color)) moves.push(move);
    }
  }
  return moves;
}

export function getXiangqiMovesFrom(board, color, from) {
  return getXiangqiLegalMoves(board, color).filter((move) => move.from === from);
}

export function getXiangqiWinner(board, turn) {
  if (!board.includes("rK")) return XIANGQI_BLACK;
  if (!board.includes("bK")) return RED;
  return getXiangqiLegalMoves(board, turn).length ? 0 : otherXiangqiColor(turn);
}

function scoreBoard(board, aiColor) {
  let score = 0;
  for (const piece of board) {
    if (!piece) continue;
    const value = VALUES[piece[1]] || 0;
    score += xiangqiPieceColor(piece) === aiColor ? value : -value;
  }
  return score;
}

function orderedMoves(board, color) {
  return getXiangqiLegalMoves(board, color).sort((a, b) => (VALUES[board[b.to]?.[1]] || 0) - (VALUES[board[a.to]?.[1]] || 0));
}

function minimax(board, turn, aiColor, depth, alpha, beta, deadline) {
  if (Date.now() >= deadline) throw new Error("AI_TIMEOUT");
  const winner = getXiangqiWinner(board, turn);
  if (winner) return winner === aiColor ? 999999 + depth : -999999 - depth;
  if (depth === 0) return scoreBoard(board, aiColor);
  const maximizing = turn === aiColor;
  let best = maximizing ? -Infinity : Infinity;
  for (const move of orderedMoves(board, turn)) {
    const value = minimax(applyXiangqiMove(board, move), otherXiangqiColor(turn), aiColor, depth - 1, alpha, beta, deadline);
    best = maximizing ? Math.max(best, value) : Math.min(best, value);
    if (maximizing) alpha = Math.max(alpha, best); else beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

export function chooseXiangqiMove(board, aiColor, difficulty = "medium") {
  const settings = { easy: [2, 600], medium: [3, 1800], hard: [4, 9000] }[difficulty] || [3, 1800];
  const [maxDepth, timeMs] = settings;
  const deadline = Date.now() + timeMs;
  const moves = orderedMoves(board, aiColor);
  let bestMove = moves[0] || null;
  let reachedDepth = 0;
  let nodes = 0;
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    try {
      let bestScore = -Infinity;
      let candidate = bestMove;
      for (const move of moves) {
        nodes += 1;
        const score = minimax(applyXiangqiMove(board, move), otherXiangqiColor(aiColor), aiColor, depth - 1, -Infinity, Infinity, deadline);
        if (score > bestScore) { bestScore = score; candidate = move; }
      }
      bestMove = candidate;
      reachedDepth = depth;
    } catch (error) {
      if (error.message !== "AI_TIMEOUT") throw error;
      break;
    }
  }
  return { move: bestMove, depth: reachedDepth, nodes };
}
