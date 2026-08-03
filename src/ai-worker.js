import { analyzeAiMove } from "./ai.js";

self.addEventListener("message", (event) => {
  const { board, aiColor, humanColor, difficulty } = event.data;
  const result = analyzeAiMove(board, aiColor, humanColor, difficulty);
  self.postMessage(result);
});
