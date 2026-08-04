export const GO_SIZE = 13;
const other = (color) => color === 1 ? 2 : 1;
const neighbors = (index) => {
  const row = Math.floor(index / GO_SIZE), col = index % GO_SIZE;
  return [[row-1,col],[row+1,col],[row,col-1],[row,col+1]].filter(([r,c]) => r>=0&&r<GO_SIZE&&c>=0&&c<GO_SIZE).map(([r,c]) => r*GO_SIZE+c);
};
const hash = (board) => board.join("");

function group(board, start) {
  const color = board[start], stones = new Set([start]), liberties = new Set(), queue = [start];
  while (queue.length) {
    const index = queue.pop();
    neighbors(index).forEach((next) => {
      if (!board[next]) liberties.add(next);
      else if (board[next] === color && !stones.has(next)) { stones.add(next); queue.push(next); }
    });
  }
  return { stones: [...stones], liberties: [...liberties] };
}

export function createGoState() {
  return { board: Array(GO_SIZE * GO_SIZE).fill(0), turn: 1, captures: [0,0], passes: 0, previousHash: null, winner: 0, scores: null, lastMove: null };
}

export function applyGoMove(state, index) {
  if (state.winner || (index !== null && state.board[index])) return state;
  if (index === null) {
    const next = { ...state, turn: other(state.turn), passes: state.passes + 1, previousHash: hash(state.board), lastMove: null };
    if (next.passes >= 2) { next.scores = scoreGo(next.board); next.winner = next.scores[0] === next.scores[1] ? 3 : next.scores[0] > next.scores[1] ? 1 : 2; }
    return next;
  }
  const board = [...state.board];
  board[index] = state.turn;
  let captured = 0;
  neighbors(index).filter((next) => board[next] === other(state.turn)).forEach((next) => {
    const target = group(board, next);
    if (!target.liberties.length) { target.stones.forEach((stone) => { board[stone] = 0; }); captured += target.stones.length; }
  });
  if (!group(board, index).liberties.length || hash(board) === state.previousHash) return state;
  const captures = [...state.captures];
  captures[state.turn - 1] += captured;
  return { ...state, board, captures, turn: other(state.turn), passes: 0, previousHash: hash(state.board), lastMove: index };
}

export function goLegalMoves(state) {
  return state.board.map((value,index) => value ? -1 : applyGoMove(state,index) === state ? -1 : index).filter((index) => index >= 0);
}

export function scoreGo(board) {
  const scores = [board.filter((x) => x === 1).length, board.filter((x) => x === 2).length + 6.5];
  const seen = new Set();
  board.forEach((value,start) => {
    if (value || seen.has(start)) return;
    const area = [], borders = new Set(), queue = [start]; seen.add(start);
    while (queue.length) { const index = queue.pop(); area.push(index); neighbors(index).forEach((next) => { if (!board[next] && !seen.has(next)) { seen.add(next); queue.push(next); } else if (board[next]) borders.add(board[next]); }); }
    if (borders.size === 1) scores[[...borders][0]-1] += area.length;
  });
  return scores;
}

export function chooseGoMove(state, difficulty = "medium") {
  const moves = goLegalMoves(state);
  if (!moves.length) return null;
  const before = state.captures[state.turn-1];
  const center = (GO_SIZE-1)/2;
  return moves.map((move) => {
    const next = applyGoMove(state,move), [r,c] = [Math.floor(move/GO_SIZE),move%GO_SIZE];
    const capture = next.captures[state.turn-1]-before;
    const shape = neighbors(move).filter((n) => state.board[n] === state.turn).length;
    const score = capture*20 + shape*(difficulty==="hard"?2:1) - Math.abs(r-center)*.05 - Math.abs(c-center)*.05 + Math.random();
    return {move,score};
  }).sort((a,b)=>b.score-a.score)[0].move;
}
