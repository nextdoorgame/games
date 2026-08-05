export const TETRIS_ROWS = 20;
export const TETRIS_COLS = 10;

export const TETRIS_SPEEDS = {
  slow: { label: "悠閒", interval: 850 },
  normal: { label: "標準", interval: 560 },
  fast: { label: "快速", interval: 310 },
  extreme: { label: "極速", interval: 150 }
};

const PIECES = {
  I: { color: 1, rotations: [[[0, 1], [1, 1], [2, 1], [3, 1]], [[2, 0], [2, 1], [2, 2], [2, 3]]] },
  J: { color: 2, rotations: [[[0, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [2, 2]], [[1, 0], [1, 1], [0, 2], [1, 2]]] },
  L: { color: 3, rotations: [[[2, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [1, 2], [2, 2]], [[0, 1], [1, 1], [2, 1], [0, 2]], [[0, 0], [1, 0], [1, 1], [1, 2]]] },
  O: { color: 4, rotations: [[[1, 0], [2, 0], [1, 1], [2, 1]]] },
  S: { color: 5, rotations: [[[1, 0], [2, 0], [0, 1], [1, 1]], [[1, 0], [1, 1], [2, 1], [2, 2]]] },
  T: { color: 6, rotations: [[[1, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [1, 2]], [[1, 0], [0, 1], [1, 1], [1, 2]]] },
  Z: { color: 7, rotations: [[[0, 0], [1, 0], [1, 1], [2, 1]], [[2, 0], [1, 1], [2, 1], [1, 2]]] }
};

function shuffledBag() {
  const bag = Object.keys(PIECES);
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function takeNext(state) {
  if (!state.bag.length) state.bag.push(...shuffledBag());
  return state.bag.shift();
}

function cellsFor(piece) {
  return PIECES[piece.type].rotations[piece.rotation].map(([x, y]) => [piece.x + x, piece.y + y]);
}

export function tetrisPiecePreview(type) {
  const preview = Array.from({ length: 4 }, () => Array(4).fill(0));
  const piece = PIECES[type];
  if (!piece) return preview;
  for (const [x, y] of piece.rotations[0]) preview[y][x] = piece.color;
  return preview;
}

function collides(board, piece) {
  return cellsFor(piece).some(([x, y]) => x < 0 || x >= TETRIS_COLS || y >= TETRIS_ROWS || (y >= 0 && board[y][x]));
}

function spawn(state) {
  state.active = { type: state.next, rotation: 0, x: 3, y: -1 };
  state.next = takeNext(state);
  if (collides(state.board, state.active)) state.gameOver = true;
}

export function createTetrisState(speed = "normal") {
  const state = {
    board: Array.from({ length: TETRIS_ROWS }, () => Array(TETRIS_COLS).fill(0)),
    active: null,
    next: null,
    bag: shuffledBag(),
    score: 0,
    lines: 0,
    speed: TETRIS_SPEEDS[speed] ? speed : "normal",
    gameOver: false,
    paused: false,
    revision: 0
  };
  state.next = takeNext(state);
  spawn(state);
  return state;
}

function clearLines(state) {
  const remaining = state.board.filter((row) => row.some((cell) => !cell));
  const cleared = TETRIS_ROWS - remaining.length;
  while (remaining.length < TETRIS_ROWS) remaining.unshift(Array(TETRIS_COLS).fill(0));
  state.board = remaining;
  state.lines += cleared;
  state.score += [0, 100, 300, 500, 800][cleared] || 0;
}

function lockPiece(state) {
  const color = PIECES[state.active.type].color;
  for (const [x, y] of cellsFor(state.active)) {
    if (y < 0) { state.gameOver = true; continue; }
    state.board[y][x] = color;
  }
  clearLines(state);
  state.revision += 1;
  if (!state.gameOver) spawn(state);
}

export function moveTetris(state, dx) {
  if (state.gameOver || state.paused) return false;
  const moved = { ...state.active, x: state.active.x + dx };
  if (collides(state.board, moved)) return false;
  state.active = moved;
  state.revision += 1;
  return true;
}

export function rotateTetris(state) {
  if (state.gameOver || state.paused) return false;
  const rotations = PIECES[state.active.type].rotations.length;
  const rotated = { ...state.active, rotation: (state.active.rotation + 1) % rotations };
  for (const kick of [0, -1, 1, -2, 2]) {
    const candidate = { ...rotated, x: rotated.x + kick };
    if (!collides(state.board, candidate)) {
      state.active = candidate;
      state.revision += 1;
      return true;
    }
  }
  return false;
}

export function dropTetris(state, hard = false) {
  if (state.gameOver || state.paused) return false;
  let distance = 0;
  while (!collides(state.board, { ...state.active, y: state.active.y + 1 })) {
    state.active = { ...state.active, y: state.active.y + 1 };
    distance += 1;
    if (!hard) break;
  }
  if (hard) state.score += distance * 2;
  else if (distance) state.score += 1;
  if (!distance || hard) lockPiece(state);
  state.revision += 1;
  return true;
}

export function tickTetris(state) {
  if (state.gameOver || state.paused) return false;
  if (collides(state.board, { ...state.active, y: state.active.y + 1 })) lockPiece(state);
  else state.active = { ...state.active, y: state.active.y + 1 };
  state.revision += 1;
  return true;
}

export function visibleTetrisBoard(state) {
  const board = state.board.map((row) => [...row]);
  if (state.active && !state.gameOver) {
    const color = PIECES[state.active.type].color;
    for (const [x, y] of cellsFor(state.active)) if (y >= 0 && y < TETRIS_ROWS && x >= 0 && x < TETRIS_COLS) board[y][x] = color;
  }
  return board;
}

export function tetrisSnapshot(state) {
  return { board: visibleTetrisBoard(state), next: tetrisPiecePreview(state.next), score: state.score, lines: state.lines, gameOver: state.gameOver, paused: state.paused, updatedAt: Date.now() };
}
