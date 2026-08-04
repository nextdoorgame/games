import { chooseXiangqiMove } from "./xiangqi.js?v=platform-1";

self.addEventListener("message", (event) => {
  const { board, aiColor, difficulty } = event.data;
  try {
    self.postMessage({ ...chooseXiangqiMove(board, aiColor, difficulty), engine: "xiangqi-alpha-beta" });
  } catch (error) {
    self.postMessage({ move: null, engine: "xiangqi-alpha-beta", error: error.message });
  }
});
