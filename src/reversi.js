export const REVERSI_SIZE = 8;
export const DARK = 1;
export const LIGHT = 2;
const DIRECTIONS = [-1, 1, -8, 8, -9, -7, 7, 9];

export function createReversiBoard() {
  const board = Array(64).fill(0);
  board[27] = LIGHT; board[28] = DARK;
  board[35] = DARK; board[36] = LIGHT;
  return board;
}

const row = (index) => Math.floor(index / 8);
const col = (index) => index % 8;
const opponent = (color) => color === DARK ? LIGHT : DARK;

function ray(board, index, direction, color) {
  const captured = [];
  let current = index;
  while (true) {
    const next = current + direction;
    if (next < 0 || next >= 64 || Math.abs(row(next) - row(current)) > 1 || Math.abs(col(next) - col(current)) > 1) return [];
    if (board[next] === opponent(color)) captured.push(next);
    else return board[next] === color && captured.length ? captured : [];
    current = next;
  }
}

export function reversiFlips(board, index, color) {
  if (board[index]) return [];
  return DIRECTIONS.flatMap((direction) => ray(board, index, direction, color));
}

export function reversiLegalMoves(board, color) {
  return board.map((value, index) => !value && reversiFlips(board, index, color).length ? index : -1).filter((index) => index >= 0);
}

export function applyReversiMove(board, index, color) {
  const flips = reversiFlips(board, index, color);
  if (!flips.length) return null;
  const next = [...board];
  next[index] = color;
  flips.forEach((target) => { next[target] = color; });
  return { board: next, flips };
}

export function reversiWinner(board) {
  const dark = board.filter((piece) => piece === DARK).length;
  const light = board.filter((piece) => piece === LIGHT).length;
  return dark === light ? 0 : dark > light ? DARK : LIGHT;
}

const WEIGHTS = [120,-25,20,5,5,20,-25,120,-25,-45,-5,-5,-5,-5,-45,-25,20,-5,15,3,3,15,-5,20,5,-5,3,3,3,3,-5,5,5,-5,3,3,3,3,-5,5,20,-5,15,3,3,15,-5,20,-25,-45,-5,-5,-5,-5,-45,-25,120,-25,20,5,5,20,-25,120];

function evaluate(board, color) {
  let score = 0;
  board.forEach((piece, index) => { if (piece) score += (piece === color ? 1 : -1) * WEIGHTS[index]; });
  score += (reversiLegalMoves(board, color).length - reversiLegalMoves(board, opponent(color)).length) * 6;
  return score;
}

function search(board, turn, aiColor, depth, alpha, beta) {
  const moves = reversiLegalMoves(board, turn);
  const otherMoves = reversiLegalMoves(board, opponent(turn));
  if (!depth || (!moves.length && !otherMoves.length)) return evaluate(board, aiColor);
  if (!moves.length) return search(board, opponent(turn), aiColor, depth - 1, alpha, beta);
  const maximizing = turn === aiColor;
  let best = maximizing ? -Infinity : Infinity;
  for (const move of moves.sort((a,b) => WEIGHTS[b] - WEIGHTS[a])) {
    const next = applyReversiMove(board, move, turn).board;
    const value = search(next, opponent(turn), aiColor, depth - 1, alpha, beta);
    best = maximizing ? Math.max(best, value) : Math.min(best, value);
    if (maximizing) alpha = Math.max(alpha, best); else beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

export function chooseReversiMove(board, color, difficulty = "medium") {
  const depth = { easy: 2, medium: 4, hard: 6 }[difficulty] || 4;
  let bestMove = null, bestScore = -Infinity;
  for (const move of reversiLegalMoves(board, color)) {
    const score = search(applyReversiMove(board, move, color).board, opponent(color), color, depth - 1, -Infinity, Infinity);
    if (score > bestScore) { bestScore = score; bestMove = move; }
  }
  return bestMove;
}
