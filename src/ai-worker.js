const SIZE = 15;
const RAPFI_BASE = new URL("../vendor/rapfi/", self.location.href).href;
const RAPFI_SCRIPT = new URL("rapfi-single-simd128.js", RAPFI_BASE).href;

const LEVELS = {
  easy: { timeMs: 500, maxDepth: 24 },
  medium: { timeMs: 1500, maxDepth: 48 },
  hard: { timeMs: 3500, maxDepth: 100 }
};

let rapfiPromise = null;
let pendingSearch = null;
let searchStats = null;

function receiveStdout(rawOutput) {
  const output = String(rawOutput || "").trim();
  if (!output || output === "OK" || !pendingSearch) return;

  const info = output.match(/^INFO\s+(DEPTH|SELDEPTH|NODES|TOTALNODES|TOTALTIME)\s+(.+)$/i);
  if (info) {
    const key = info[1].toLowerCase();
    searchStats[key] = Number(info[2]) || 0;
    return;
  }

  if (output.startsWith("ERROR")) {
    const reject = pendingSearch.reject;
    pendingSearch = null;
    reject(new Error(output));
    return;
  }

  const move = output.match(/^(\d+),(\d+)(?:\s|$)/);
  if (!move) return;
  const resolve = pendingSearch.resolve;
  pendingSearch = null;
  resolve({ col: Number(move[1]), row: Number(move[2]), ...searchStats });
}

async function initializeRapfi() {
  if (!rapfiPromise) {
    rapfiPromise = (async () => {
      self.importScripts(RAPFI_SCRIPT);
      if (typeof self.Rapfi !== "function") throw new Error("Rapfi factory did not load");
      return self.Rapfi({
        locateFile: (filename) => new URL(filename, RAPFI_BASE).href,
        onReceiveStdout: receiveStdout,
        onReceiveStderr: () => {},
        onExit: () => {},
        setStatus: () => {},
        wasmMemory: new WebAssembly.Memory({ initial: 1024, maximum: 8192 })
      });
    })();
  }
  return rapfiPromise;
}

function boardCommand(board) {
  const stones = [];
  board.forEach((color, index) => {
    if (!color) return;
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    stones.push(`${col},${row},${color}`);
  });
  return `BOARD${stones.length ? ` ${stones.join(" ")}` : ""} DONE`;
}

async function searchWithRapfi(board, difficulty) {
  const level = LEVELS[difficulty] || LEVELS.medium;
  const engine = await initializeRapfi();
  const started = performance.now();
  searchStats = {};

  engine.sendCommand("START 15");
  engine.sendCommand("RELOADCONFIG config.toml");
  engine.sendCommand("INFO RULE 0");
  engine.sendCommand("INFO THREAD_NUM 1");
  engine.sendCommand("INFO HASH_SIZE 32768");
  engine.sendCommand("INFO CAUTION_FACTOR 3");
  engine.sendCommand("INFO STRENGTH 100");
  engine.sendCommand(`INFO TIMEOUT_TURN ${level.timeMs}`);
  engine.sendCommand("INFO TIMEOUT_MATCH 9999999");
  engine.sendCommand("INFO TIME_LEFT 9999999");
  engine.sendCommand(`INFO MAX_DEPTH ${level.maxDepth}`);
  engine.sendCommand("INFO MAX_NODE 0");
  engine.sendCommand("INFO SHOW_DETAIL 2");
  engine.sendCommand("INFO PONDERING 0");

  const resultPromise = new Promise((resolve, reject) => {
    pendingSearch = { resolve, reject };
  });
  engine.sendCommand(boardCommand(board));
  const result = await resultPromise;
  const index = result.row * SIZE + result.col;
  if (!Number.isInteger(index) || index < 0 || index >= board.length || board[index] !== 0) {
    throw new Error("Rapfi returned an invalid move");
  }
  return {
    index,
    engine: "rapfi",
    depth: result.depth || result.seldepth || 0,
    nodes: result.totalnodes || result.nodes || 0,
    elapsedMs: performance.now() - started
  };
}

async function searchWithFallback(board, aiColor, humanColor, difficulty, reason) {
  const { analyzeAiMove } = await import("./ai.js");
  return {
    ...analyzeAiMove(board, aiColor, humanColor, difficulty),
    engine: "fallback",
    reason: String(reason?.message || reason || "Rapfi unavailable")
  };
}

self.addEventListener("message", async (event) => {
  const { board, aiColor, humanColor, difficulty } = event.data;
  try {
    self.postMessage(await searchWithRapfi(board, difficulty));
  } catch (error) {
    self.postMessage(await searchWithFallback(board, aiColor, humanColor, difficulty, error));
  }
});
