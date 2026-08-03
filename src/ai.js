const SIZE = 15;
const EMPTY = 0;
const WIN_SCORE = 10_000_000;
const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]];

function isWinningMove(board, index, color) {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;
    for (const sign of [-1, 1]) {
      for (let step = 1; step < 5; step += 1) {
        const r = row + dr * step * sign;
        const c = col + dc * step * sign;
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE || board[r * SIZE + c] !== color) break;
        count += 1;
      }
    }
    if (count >= 5) return true;
  }
  return false;
}

function nearbyCandidates(board, radius = 2) {
  if (!board.some(Boolean)) return [Math.floor((SIZE * SIZE) / 2)];
  const result = new Set();
  board.forEach((stone, index) => {
    if (!stone) return;
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    for (let dr = -radius; dr <= radius; dr += 1) {
      for (let dc = -radius; dc <= radius; dc += 1) {
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
  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;
    let open = 0;
    for (const sign of [-1, 1]) {
      for (let step = 1; step <= 4; step += 1) {
        const r = row + dr * step * sign;
        const c = col + dc * step * sign;
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) break;
        const value = board[r * SIZE + c];
        if (value === color) count += 1;
        else {
          if (value === EMPTY) open += 1;
          break;
        }
      }
    }
    const weights = [0, 2, 12, 80, 700, 100000];
    total += weights[Math.min(count, 5)] * (open === 2 ? 1.7 : open === 1 ? 1 : .2);
  }
  const centerDistance = Math.abs(row - 7) + Math.abs(col - 7);
  return total + Math.max(0, 14 - centerDistance) * .35;
}

function immediateWinningMoves(board, color, candidates = nearbyCandidates(board)) {
  const wins = [];
  for (const index of candidates) {
    board[index] = color;
    const winsHere = isWinningMove(board, index, color);
    board[index] = EMPTY;
    if (winsHere) wins.push(index);
  }
  return wins;
}

function centerTieBreak(a, b) {
  const distance = (index) => Math.abs(Math.floor(index / SIZE) - 7) + Math.abs((index % SIZE) - 7);
  return distance(a.index) - distance(b.index) || a.index - b.index;
}

function legacyHardMove(board, aiColor, humanColor) {
  const candidates = nearbyCandidates(board);
  const scored = candidates.map((index) => {
    board[index] = aiColor;
    const wins = isWinningMove(board, index, aiColor);
    board[index] = humanColor;
    const blocksWin = isWinningMove(board, index, humanColor);
    board[index] = EMPTY;
    const score = wins
      ? 1_000_000
      : blocksWin
        ? 850_000
        : directionalPotential(board, index, aiColor) * 1.15 + directionalPotential(board, index, humanColor);
    return { index, score };
  }).sort((a, b) => b.score - a.score || centerTieBreak(a, b));

  const top = scored.slice(0, Math.min(14, scored.length));
  for (const move of top) {
    if (move.score >= 850_000) continue;
    board[move.index] = aiColor;
    const replies = nearbyCandidates(board);
    let danger = 0;
    for (const reply of replies) {
      board[reply] = humanColor;
      const immediate = isWinningMove(board, reply, humanColor);
      board[reply] = EMPTY;
      danger = Math.max(danger, immediate ? 500_000 : directionalPotential(board, reply, humanColor));
    }
    board[move.index] = EMPTY;
    move.score -= danger * .72;
  }
  top.sort((a, b) => b.score - a.score || centerTieBreak(a, b));
  return top[0]?.index ?? candidates[0];
}

function orderedMoves(board, color, opponentColor, limit) {
  const candidates = nearbyCandidates(board);
  const moves = candidates.map((index) => {
    board[index] = color;
    const wins = isWinningMove(board, index, color);
    board[index] = opponentColor;
    const blocksWin = isWinningMove(board, index, opponentColor);
    board[index] = EMPTY;
    const attack = directionalPotential(board, index, color);
    const defense = directionalPotential(board, index, opponentColor);
    const score = wins ? WIN_SCORE : blocksWin ? WIN_SCORE * .86 : attack * 1.28 + defense * 1.08;
    return { index, score, wins };
  });
  moves.sort((a, b) => b.score - a.score || centerTieBreak(a, b));
  return moves.slice(0, Math.min(limit, moves.length));
}

function tacticalProfile(board, color, opponentColor, nextTurn) {
  const candidates = nearbyCandidates(board);
  const wins = immediateWinningMoves(board, color, candidates).length;
  if (wins) {
    const tempo = nextTurn === color ? 1 : .62;
    return (4_500_000 + Math.min(wins, 3) * 650_000) * tempo;
  }
  const ranked = orderedMoves(board, color, opponentColor, 4);
  const weights = [1, .42, .2, .1];
  return ranked.reduce((sum, move, index) => sum + move.score * weights[index], 0);
}

function evaluatePosition(board, aiColor, humanColor, nextTurn) {
  const attack = tacticalProfile(board, aiColor, humanColor, nextTurn);
  const defense = tacticalProfile(board, humanColor, aiColor, nextTurn);
  return attack - defense * 1.06;
}

function minimax(board, turnColor, aiColor, humanColor, depth, alpha, beta, limits, ply) {
  if (depth <= 0) return evaluatePosition(board, aiColor, humanColor, turnColor);
  const opponentColor = turnColor === aiColor ? humanColor : aiColor;
  const limit = limits[Math.min(ply, limits.length - 1)];
  const moves = orderedMoves(board, turnColor, opponentColor, limit);
  if (!moves.length) return evaluatePosition(board, aiColor, humanColor, turnColor);

  if (turnColor === aiColor) {
    let best = -Infinity;
    for (const move of moves) {
      board[move.index] = turnColor;
      const score = move.wins
        ? WIN_SCORE - ply
        : minimax(board, opponentColor, aiColor, humanColor, depth - 1, alpha, beta, limits, ply + 1);
      board[move.index] = EMPTY;
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    board[move.index] = turnColor;
    const score = move.wins
      ? -WIN_SCORE + ply
      : minimax(board, opponentColor, aiColor, humanColor, depth - 1, alpha, beta, limits, ply + 1);
    board[move.index] = EMPTY;
    best = Math.min(best, score);
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function searchedMove(board, aiColor, humanColor, difficulty) {
  const candidates = nearbyCandidates(board);
  const wins = immediateWinningMoves(board, aiColor, candidates);
  if (wins.length) return orderedMoves(board, aiColor, humanColor, candidates.length).find((move) => wins.includes(move.index))?.index ?? wins[0];

  const blocks = immediateWinningMoves(board, humanColor, candidates);
  if (blocks.length === 1) return blocks[0];

  // Two distinct winning points cannot both be stopped on the next turn.
  // Detect these forks explicitly so the shallower medium search never misses one.
  if (!blocks.length) {
    const forks = orderedMoves(board, aiColor, humanColor, candidates.length).filter((move) => {
      board[move.index] = aiColor;
      const followUpWins = immediateWinningMoves(board, aiColor).length;
      board[move.index] = EMPTY;
      return followUpWins >= 2;
    });
    if (forks.length) return forks[0].index;
  }

  const settings = difficulty === "hard"
    ? { depth: 3, limits: [14, 10, 8, 6] }
    : { depth: 2, limits: [12, 10, 7] };
  const rootMoves = orderedMoves(board, aiColor, humanColor, settings.limits[0]);
  let bestMove = rootMoves[0]?.index ?? candidates[0];
  let bestScore = -Infinity;

  for (const move of rootMoves) {
    board[move.index] = aiColor;
    const score = move.wins
      ? WIN_SCORE
      : minimax(board, humanColor, aiColor, humanColor, settings.depth - 1, -Infinity, Infinity, settings.limits, 1);
    board[move.index] = EMPTY;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move.index;
    }
  }
  return bestMove;
}

export function chooseAiMove(board, aiColor, humanColor, difficulty = "medium") {
  if (!Array.isArray(board) || board.length !== SIZE * SIZE) throw new Error("Invalid Gomoku board");
  if (!board.includes(EMPTY)) return -1;
  if (difficulty === "easy") return legacyHardMove(board, aiColor, humanColor);
  return searchedMove(board, aiColor, humanColor, difficulty === "hard" ? "hard" : "medium");
}
