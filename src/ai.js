const SIZE = 19;
const EMPTY = 0;
const WIN_SCORE = 100_000_000;
const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]];

const LEVELS = {
  easy: {
    tacticalDepth: 8,
    positionalDepth: 6,
    timeMs: 1800,
    limits: [12, 9, 7, 5, 4, 3]
  },
  medium: {
    tacticalDepth: 14,
    positionalDepth: 8,
    timeMs: 3500,
    limits: [14, 10, 8, 6, 5, 4, 3, 2]
  },
  hard: {
    tacticalDepth: 24,
    positionalDepth: 10,
    timeMs: 6000,
    limits: [16, 12, 9, 7, 5, 4, 3, 3, 2, 2]
  }
};

class SearchTimeout extends Error {}

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
    const weights = [0, 3, 20, 180, 3500, WIN_SCORE];
    total += weights[Math.min(count, 5)] * (open === 2 ? 2.1 : open === 1 ? 1 : .15);
  }
  const center = (SIZE - 1) / 2;
  const centerDistance = Math.abs(row - center) + Math.abs(col - center);
  return total + Math.max(0, SIZE - 1 - centerDistance) * .45;
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
  const center = (SIZE - 1) / 2;
  const distance = (index) => Math.abs(Math.floor(index / SIZE) - center) + Math.abs((index % SIZE) - center);
  return distance(a.index) - distance(b.index) || a.index - b.index;
}

function orderedMoves(board, color, opponentColor, limit = Infinity, preferredMove = -1) {
  const moves = nearbyCandidates(board).map((index) => {
    board[index] = color;
    const wins = isWinningMove(board, index, color);
    board[index] = opponentColor;
    const blocksWin = isWinningMove(board, index, opponentColor);
    board[index] = EMPTY;
    const attack = directionalPotential(board, index, color);
    const defense = directionalPotential(board, index, opponentColor);
    const preferred = index === preferredMove ? WIN_SCORE * 2 : 0;
    const score = preferred + (wins ? WIN_SCORE : blocksWin ? WIN_SCORE * .9 : attack * 1.35 + defense * 1.16);
    return { index, score, wins, blocksWin };
  });
  moves.sort((a, b) => b.score - a.score || centerTieBreak(a, b));
  return moves.slice(0, Math.min(limit, moves.length));
}

function checkDeadline(context) {
  context.nodes += 1;
  if ((context.nodes & 127) === 0 && performance.now() >= context.deadline) throw new SearchTimeout();
}

// Searches only continuous forcing sequences. This makes a 20-ply tactical scan
// practical in a browser while still exploring every required defensive reply.
function forcingWin(board, attacker, defender, depth, context) {
  checkDeadline(context);
  if (depth <= 0) return false;

  const defenderWins = immediateWinningMoves(board, defender);
  if (defenderWins.length) return false;

  const candidates = orderedMoves(board, attacker, defender, depth >= 12 ? 12 : 16);
  for (const move of candidates) {
    board[move.index] = attacker;
    try {
      if (move.wins) return true;
      const threats = immediateWinningMoves(board, attacker);
      if (threats.length >= 2) return true;
      if (threats.length !== 1 || depth < 2) continue;

      const forcedReply = threats[0];
      board[forcedReply] = defender;
      try {
        if (forcingWin(board, attacker, defender, depth - 2, context)) return true;
      } finally {
        board[forcedReply] = EMPTY;
      }
    } finally {
      board[move.index] = EMPTY;
    }
  }
  return false;
}

function findForcingMove(board, aiColor, humanColor, depth, context) {
  const candidates = orderedMoves(board, aiColor, humanColor, 18);
  for (const move of candidates) {
    checkDeadline(context);
    board[move.index] = aiColor;
    try {
      if (move.wins) return move.index;
      const threats = immediateWinningMoves(board, aiColor);
      if (threats.length >= 2) return move.index;
      if (threats.length !== 1 || depth < 2) continue;

      const forcedReply = threats[0];
      board[forcedReply] = humanColor;
      try {
        if (forcingWin(board, aiColor, humanColor, depth - 2, context)) return move.index;
      } finally {
        board[forcedReply] = EMPTY;
      }
    } finally {
      board[move.index] = EMPTY;
    }
  }
  return -1;
}

function tacticalProfile(board, color, opponentColor, nextTurn) {
  const candidates = nearbyCandidates(board);
  const wins = immediateWinningMoves(board, color, candidates).length;
  if (wins) {
    const tempo = nextTurn === color ? 1 : .66;
    return (WIN_SCORE * .52 + Math.min(wins, 3) * WIN_SCORE * .08) * tempo;
  }
  const ranked = orderedMoves(board, color, opponentColor, 5);
  const weights = [1, .46, .24, .13, .07];
  return ranked.reduce((sum, move, index) => sum + move.score * weights[index], 0);
}

function evaluatePosition(board, aiColor, humanColor, nextTurn) {
  const attack = tacticalProfile(board, aiColor, humanColor, nextTurn);
  const defense = tacticalProfile(board, humanColor, aiColor, nextTurn);
  return attack - defense * 1.1;
}

function searchKey(board, turnColor, depth) {
  return `${turnColor}:${depth}:${board.join("")}`;
}

function minimax(board, turnColor, aiColor, humanColor, depth, alpha, beta, settings, ply, context) {
  checkDeadline(context);
  if (depth <= 0) return evaluatePosition(board, aiColor, humanColor, turnColor);

  const key = searchKey(board, turnColor, depth);
  if (context.cache.has(key)) return context.cache.get(key);

  const opponentColor = turnColor === aiColor ? humanColor : aiColor;
  const limit = settings.limits[Math.min(ply, settings.limits.length - 1)];
  const moves = orderedMoves(board, turnColor, opponentColor, limit);
  if (!moves.length) return evaluatePosition(board, aiColor, humanColor, turnColor);

  const maximizing = turnColor === aiColor;
  let best = maximizing ? -Infinity : Infinity;
  let cutoff = false;
  for (const move of moves) {
    board[move.index] = turnColor;
    let score;
    try {
      score = move.wins
        ? (maximizing ? WIN_SCORE - ply : -WIN_SCORE + ply)
        : minimax(board, opponentColor, aiColor, humanColor, depth - 1, alpha, beta, settings, ply + 1, context);
    } finally {
      board[move.index] = EMPTY;
    }

    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) {
      cutoff = true;
      break;
    }
  }
  if (!cutoff) context.cache.set(key, best);
  return best;
}

function searchRoot(board, aiColor, humanColor, depth, settings, context, preferredMove) {
  const moves = orderedMoves(board, aiColor, humanColor, settings.limits[0], preferredMove);
  let bestMove = moves[0]?.index ?? -1;
  let bestScore = -Infinity;
  for (const move of moves) {
    checkDeadline(context);
    board[move.index] = aiColor;
    let score;
    try {
      score = move.wins
        ? WIN_SCORE
        : minimax(board, humanColor, aiColor, humanColor, depth - 1, -Infinity, Infinity, settings, 1, context);
    } finally {
      board[move.index] = EMPTY;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMove = move.index;
    }
  }
  return { index: bestMove, score: bestScore };
}

export function getAiLevel(difficulty = "medium") {
  return { ...(LEVELS[difficulty] || LEVELS.medium) };
}

export function analyzeAiMove(board, aiColor, humanColor, difficulty = "medium", overrides = {}) {
  if (!Array.isArray(board) || board.length !== SIZE * SIZE) throw new Error("Invalid Gomoku board");
  if (!board.includes(EMPTY)) return { index: -1, depth: 0, tacticalDepth: 0, nodes: 0, elapsedMs: 0 };

  const settings = { ...(LEVELS[difficulty] || LEVELS.medium), ...overrides };
  const started = performance.now();
  const context = {
    deadline: started + settings.timeMs,
    nodes: 0,
    cache: new Map()
  };
  const candidates = nearbyCandidates(board);
  if (candidates.length === 1) {
    return { index: candidates[0], depth: settings.positionalDepth, tacticalDepth: settings.tacticalDepth, nodes: 1, elapsedMs: 0 };
  }

  const wins = immediateWinningMoves(board, aiColor, candidates);
  if (wins.length) return { index: wins[0], depth: 1, tacticalDepth: settings.tacticalDepth, nodes: 1, elapsedMs: performance.now() - started };
  const blocks = immediateWinningMoves(board, humanColor, candidates);
  if (blocks.length === 1) return { index: blocks[0], depth: 1, tacticalDepth: settings.tacticalDepth, nodes: 1, elapsedMs: performance.now() - started };

  let bestMove = orderedMoves(board, aiColor, humanColor, 1)[0]?.index ?? candidates[0];
  let completedDepth = 0;
  let timedOut = false;

  try {
    const forcingMove = findForcingMove(board, aiColor, humanColor, settings.tacticalDepth, context);
    if (forcingMove >= 0) {
      return {
        index: forcingMove,
        depth: settings.tacticalDepth,
        tacticalDepth: settings.tacticalDepth,
        nodes: context.nodes,
        elapsedMs: performance.now() - started,
        forced: true
      };
    }

    for (let depth = 1; depth <= settings.positionalDepth; depth += 1) {
      context.cache.clear();
      const result = searchRoot(board, aiColor, humanColor, depth, settings, context, bestMove);
      bestMove = result.index;
      completedDepth = depth;
    }
  } catch (error) {
    if (!(error instanceof SearchTimeout)) throw error;
    timedOut = true;
  }

  return {
    index: bestMove,
    depth: completedDepth,
    tacticalDepth: settings.tacticalDepth,
    nodes: context.nodes,
    elapsedMs: performance.now() - started,
    timedOut
  };
}

export function chooseAiMove(board, aiColor, humanColor, difficulty = "medium", overrides) {
  return analyzeAiMove(board, aiColor, humanColor, difficulty, overrides).index;
}
