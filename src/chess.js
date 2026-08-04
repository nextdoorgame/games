const BACK = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
export const CHESS_SYMBOLS = {
  white: { king: "♔", queen: "♕", rook: "♖", bishop: "♗", knight: "♘", pawn: "♙" },
  black: { king: "♚", queen: "♛", rook: "♜", bishop: "♝", knight: "♞", pawn: "♟" }
};
const other = (color) => color === "white" ? "black" : "white";
const rc = (index) => [Math.floor(index / 8), index % 8];
const at = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1;

export function createChessState() {
  const board = Array(64).fill(null);
  BACK.forEach((type, col) => {
    board[col] = { color: "black", type, moved: false };
    board[8 + col] = { color: "black", type: "pawn", moved: false };
    board[48 + col] = { color: "white", type: "pawn", moved: false };
    board[56 + col] = { color: "white", type, moved: false };
  });
  return { board, turn: "white", enPassant: null, winner: null, draw: false, lastMove: null };
}

function rayMoves(board, from, directions) {
  const piece = board[from];
  const [r, c] = rc(from);
  const moves = [];
  directions.forEach(([dr, dc]) => {
    for (let step = 1; step < 8; step += 1) {
      const to = at(r + dr * step, c + dc * step);
      if (to < 0) break;
      if (!board[to]) moves.push(to);
      else { if (board[to].color !== piece.color) moves.push(to); break; }
    }
  });
  return moves;
}

function pseudoMoves(state, from, attacksOnly = false) {
  const { board } = state;
  const piece = board[from];
  if (!piece) return [];
  const [r, c] = rc(from);
  if (piece.type === "pawn") {
    const dir = piece.color === "white" ? -1 : 1;
    const captures = [at(r + dir, c - 1), at(r + dir, c + 1)].filter((to) => to >= 0 && (attacksOnly || board[to]?.color === other(piece.color) || to === state.enPassant));
    if (attacksOnly) return captures;
    const moves = [...captures];
    const one = at(r + dir, c);
    if (one >= 0 && !board[one]) {
      moves.push(one);
      const two = at(r + dir * 2, c);
      if (!piece.moved && two >= 0 && !board[two]) moves.push(two);
    }
    return moves;
  }
  if (piece.type === "knight") return [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].map(([dr,dc]) => at(r+dr,c+dc)).filter((to) => to >= 0 && board[to]?.color !== piece.color);
  if (piece.type === "bishop") return rayMoves(board, from, [[1,1],[1,-1],[-1,1],[-1,-1]]);
  if (piece.type === "rook") return rayMoves(board, from, [[1,0],[-1,0],[0,1],[0,-1]]);
  if (piece.type === "queen") return rayMoves(board, from, [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]);
  const moves = [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]].map(([dr,dc]) => at(r+dr,c+dc)).filter((to) => to >= 0 && board[to]?.color !== piece.color);
  if (!attacksOnly && !piece.moved && !isChessCheck(state, piece.color)) {
    for (const rookCol of [0, 7]) {
      const rookIndex = at(r, rookCol), rook = board[rookIndex];
      const direction = rookCol === 0 ? -1 : 1;
      const between = rookCol === 0 ? [c-1,c-2,c-3] : [c+1,c+2];
      if (rook?.type === "rook" && rook.color === piece.color && !rook.moved && between.every((col) => !board[at(r,col)]) && !isSquareAttacked(state, at(r,c+direction), other(piece.color))) moves.push(at(r,c+direction*2));
    }
  }
  return moves;
}

function isSquareAttacked(state, square, byColor) {
  return state.board.some((piece, index) => piece?.color === byColor && pseudoMoves(state, index, true).includes(square));
}

export function isChessCheck(state, color) {
  const king = state.board.findIndex((piece) => piece?.color === color && piece.type === "king");
  return king < 0 || isSquareAttacked(state, king, other(color));
}

function moveBoard(state, from, to) {
  const board = state.board.map((piece) => piece ? { ...piece } : null);
  const piece = board[from];
  if (piece.type === "pawn" && to === state.enPassant && !board[to]) board[to + (piece.color === "white" ? 8 : -8)] = null;
  if (piece.type === "king" && Math.abs(to - from) === 2) {
    const rookFrom = to > from ? from + 3 : from - 4;
    const rookTo = to > from ? from + 1 : from - 1;
    board[rookTo] = { ...board[rookFrom], moved: true };
    board[rookFrom] = null;
  }
  board[to] = { ...piece, moved: true };
  board[from] = null;
  if (piece.type === "pawn" && [0,7].includes(rc(to)[0])) board[to].type = "queen";
  return board;
}

export function chessLegalMoves(state, from) {
  const piece = state.board[from];
  if (!piece || piece.color !== state.turn) return [];
  return pseudoMoves(state, from).filter((to) => !isChessCheck({ ...state, board: moveBoard(state, from, to), enPassant: null }, piece.color));
}

export function allChessMoves(state, color = state.turn) {
  const scoped = { ...state, turn: color };
  return scoped.board.flatMap((piece, from) => piece?.color === color ? chessLegalMoves(scoped, from).map((to) => ({ from, to })) : []);
}

export function applyChessMove(state, move) {
  if (!chessLegalMoves(state, move.from).includes(move.to)) return state;
  const piece = state.board[move.from], captured = state.board[move.to];
  const next = { ...state, board: moveBoard(state, move.from, move.to), turn: other(state.turn), enPassant: null, lastMove: { ...move, captured }, winner: null, draw: false };
  if (piece.type === "pawn" && Math.abs(move.to - move.from) === 16) next.enPassant = (move.to + move.from) / 2;
  const replies = allChessMoves(next);
  if (!replies.length) {
    if (isChessCheck(next, next.turn)) next.winner = other(next.turn);
    else next.draw = true;
  }
  return next;
}

const VALUE = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 100 };
export function chooseChessMove(state, difficulty = "medium") {
  const moves = allChessMoves(state);
  if (!moves.length) return null;
  const scored = moves.map((move) => {
    const captured = state.board[move.to];
    const next = applyChessMove(state, move);
    let score = (captured ? VALUE[captured.type] * 10 : 0) + (isChessCheck(next, next.turn) ? 3 : 0) + Math.random();
    if (difficulty !== "easy") {
      const reply = allChessMoves(next).reduce((best, item) => Math.max(best, next.board[item.to] ? VALUE[next.board[item.to].type] : 0), 0);
      score -= reply * (difficulty === "hard" ? 3 : 1.5);
    }
    return { move, score };
  });
  return scored.sort((a,b) => b.score - a.score)[0].move;
}
