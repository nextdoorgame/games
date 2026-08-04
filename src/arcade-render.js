import { ARCADE_HEIGHT, ARCADE_WIDTH } from "./arcade-games.js?v=neighbor-4";

function pixelText(ctx, text, x, y, size = 22, align = "left", color = "#fff") {
  ctx.save(); ctx.font = `700 ${size}px monospace`; ctx.textAlign = align; ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(30,24,17,.55)"; ctx.fillText(text, x + 2, y + 2); ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.restore();
}

function drawCloud(ctx, x, y, scale = 1) {
  ctx.fillStyle = "#f8fbf4";
  [[0, 20, 44, 20], [18, 3, 38, 34], [48, 13, 48, 26], [80, 25, 28, 15]].forEach(([dx, dy, w, h]) => ctx.fillRect(x + dx * scale, y + dy * scale, w * scale, h * scale));
}

function drawMouse(ctx, player, facing, action = false) {
  const x = Math.round(player.x), y = Math.round(player.y); ctx.save();
  if (facing < 0) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
  if (player.invulnerable && Math.floor(player.invulnerable / 5) % 2) ctx.globalAlpha = .35;
  ctx.fillStyle = "#2f291d"; ctx.fillRect(x - 20, y - 16, 12, 22); ctx.fillRect(x + 8, y - 20, 12, 25);
  ctx.fillStyle = "#f4c62d"; ctx.fillRect(x - 18, y - 10, 37, 45); ctx.fillRect(x - 25, y + 4, 52, 35); ctx.fillRect(x - 11, y - 30, 10, 25); ctx.fillRect(x + 9, y - 34, 10, 29);
  ctx.fillStyle = "#29241b"; ctx.fillRect(x - 11, y - 29, 10, 9); ctx.fillRect(x + 9, y - 33, 10, 9); ctx.fillRect(x + 3, y + 1, 5, 7);
  ctx.fillStyle = "#b63f36"; ctx.fillRect(x - 17, y + 9, 9, 8); ctx.fillRect(x + 15, y + 9, 9, 8);
  ctx.fillStyle = "#fff"; ctx.fillRect(x - 9, y - 1, 5, 5); ctx.fillRect(x + 12, y - 1, 5, 5);
  ctx.fillStyle = "#f4c62d"; ctx.fillRect(x + 25, y + 10, 14, 9); ctx.fillRect(x + 35, y - 2, 10, 12); ctx.fillRect(x + 42, y - 14, 14, 11);
  ctx.fillStyle = "#9b6d1f"; ctx.fillRect(x + 39, y - 2, 6, 5);
  ctx.fillStyle = "#d09622"; ctx.fillRect(x - 22, y + 33, 18, 7); ctx.fillRect(x + 9, y + 33, 18, 7);
  if (action) { ctx.fillStyle = "#fff4a1"; ctx.fillRect(x - 34, y - 23, 8, 8); ctx.fillRect(x + 27, y - 29, 8, 8); }
  ctx.restore();
}

function drawVolleyBall(ctx, ball) {
  ctx.save(); ctx.translate(Math.round(ball.x), Math.round(ball.y)); ctx.rotate(Math.atan2(ball.vy, ball.vx));
  ctx.fillStyle = "#f5f1dd"; ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#342c24"; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = "#cc4337"; ctx.beginPath(); ctx.arc(-4, -4, 12, Math.PI * 1.05, Math.PI * 1.65); ctx.lineTo(0, 0); ctx.fill(); ctx.beginPath(); ctx.arc(5, 5, 12, .05, .62); ctx.lineTo(0, 0); ctx.fill(); ctx.restore();
}

export function drawVolleyball(canvas, game) {
  const ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, ARCADE_WIDTH, ARCADE_HEIGHT);
  ctx.fillStyle = "#3caaf2"; ctx.fillRect(0, 0, 800, 260); drawCloud(ctx, 55, 48, 1.05); drawCloud(ctx, 570, 70, .9);
  ctx.fillStyle = "#3c8f69"; ctx.beginPath(); ctx.moveTo(0, 265); ctx.lineTo(135, 185); ctx.lineTo(270, 265); ctx.lineTo(480, 170); ctx.lineTo(680, 265); ctx.lineTo(800, 210); ctx.lineTo(800, 300); ctx.lineTo(0, 300); ctx.fill();
  ctx.fillStyle = "#208eba"; ctx.fillRect(0, 260, 800, 52); ctx.fillStyle = "#83d7e4"; for (let x = 0; x < 800; x += 70) ctx.fillRect(x, 277 + (x % 140 ? 5 : 0), 45, 5);
  ctx.fillStyle = "#e8c77b"; ctx.fillRect(0, 312, 800, 188); ctx.fillStyle = "#f5dc9d"; for (let x = 0; x < 800; x += 35) ctx.fillRect(x, 355 + (x % 70), 12, 4);
  ctx.strokeStyle = "#fff5cf"; ctx.lineWidth = 5; ctx.strokeRect(25, 330, 750, 120);
  ctx.fillStyle = "#5b5145"; ctx.fillRect(393, 208, 14, 184); ctx.fillStyle = "#eee7cf"; ctx.fillRect(386, 212, 28, 8); ctx.fillRect(386, 384, 28, 8);
  ctx.strokeStyle = "rgba(35,48,53,.75)"; ctx.lineWidth = 2; for (let y = 225; y < 380; y += 16) { ctx.beginPath(); ctx.moveTo(356, y); ctx.lineTo(444, y); ctx.stroke(); } for (let x = 356; x <= 444; x += 11) { ctx.beginPath(); ctx.moveTo(x, 220); ctx.lineTo(x, 388); ctx.stroke(); }
  drawMouse(ctx, game.players[0], 1, game.ball.x < 400 && Math.abs(game.ball.x - game.players[0].x) < 80); drawMouse(ctx, game.players[1], -1, game.ball.x > 400 && Math.abs(game.ball.x - game.players[1].x) < 80); drawVolleyBall(ctx, game.ball);
  pixelText(ctx, String(game.players[0].score).padStart(2, "0"), 65, 42, 34, "center", "#ffdf48"); pixelText(ctx, String(game.players[1].score).padStart(2, "0"), 735, 42, 34, "center", "#ffdf48");
  pixelText(ctx, "先得 7 分", 400, 34, 16, "center", "#fff8df");
  if (game.roundDelay && game.winner === null) pixelText(ctx, "得分！", 400, 115, 30, "center", "#fff3aa");
  if (game.winner !== null) { ctx.fillStyle = "rgba(24,30,26,.72)"; ctx.fillRect(190, 175, 420, 115); pixelText(ctx, `玩家 ${game.winner + 1} 獲勝`, 400, 222, 34, "center", "#ffe369"); pixelText(ctx, "按重新開始再來一局", 400, 264, 15, "center", "#fff"); }
}

function drawCar(ctx, player, number) {
  const x = Math.round(player.x), y = Math.round(player.y); ctx.save();
  if (player.invulnerable && Math.floor(player.invulnerable / 5) % 2) ctx.globalAlpha = .3;
  ctx.fillStyle = "#20252a"; ctx.fillRect(x - 26, y - 34, 10, 21); ctx.fillRect(x + 16, y - 34, 10, 21); ctx.fillRect(x - 26, y + 13, 10, 21); ctx.fillRect(x + 16, y + 13, 10, 21);
  ctx.fillStyle = player.color; ctx.fillRect(x - 21, y - 39, 42, 78); ctx.fillStyle = "#f2eee2"; ctx.fillRect(x - 5, y - 39, 10, 78); ctx.fillStyle = "#2a3641"; ctx.fillRect(x - 14, y - 19, 28, 30); ctx.fillStyle = "#9fd2dd"; ctx.fillRect(x - 11, y - 15, 22, 12); ctx.fillStyle = "#ffe267"; ctx.fillRect(x - 17, y - 36, 9, 7); ctx.fillRect(x + 8, y - 36, 9, 7);
  pixelText(ctx, String(number), x, y + 24, 13, "center", "#fff"); ctx.restore();
}

function drawObstacle(ctx, item) {
  const x = item.x, y = item.y;
  if (item.kind === "oil") { ctx.fillStyle = "#151719"; ctx.beginPath(); ctx.ellipse(x, y, 34, 19, .2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#34383b"; ctx.fillRect(x - 8, y - 8, 16, 5); }
  else if (item.kind === "barrier") { ctx.fillStyle = "#e9e3d2"; ctx.fillRect(x - 48, y - 18, 96, 36); ctx.fillStyle = "#d94a3c"; for (let dx = -42; dx < 45; dx += 25) { ctx.beginPath(); ctx.moveTo(x + dx, y - 16); ctx.lineTo(x + dx + 14, y - 16); ctx.lineTo(x + dx - 1, y + 16); ctx.lineTo(x + dx - 15, y + 16); ctx.fill(); } }
  else { ctx.fillStyle = "#ef7d26"; ctx.beginPath(); ctx.moveTo(x, y - 25); ctx.lineTo(x - 18, y + 20); ctx.lineTo(x + 18, y + 20); ctx.fill(); ctx.fillStyle = "#f6eee0"; ctx.fillRect(x - 11, y - 1, 22, 7); ctx.fillStyle = "#bd5a19"; ctx.fillRect(x - 23, y + 18, 46, 8); }
}

export function drawRacing(canvas, game) {
  const ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, 800, 500);
  ctx.fillStyle = "#386d3c"; ctx.fillRect(0, 0, 800, 500); ctx.fillStyle = "#526069"; ctx.fillRect(120, 0, 560, 500); ctx.fillStyle = "#d7d0ba"; ctx.fillRect(112, 0, 8, 500); ctx.fillRect(680, 0, 8, 500);
  ctx.fillStyle = "#f0eee5"; for (const x of [260, 400, 540]) for (let y = -72 + game.laneOffset; y < 520; y += 72) ctx.fillRect(x - 4, y, 8, 37);
  ctx.fillStyle = "#284d2d"; for (let y = -45 + (game.laneOffset * .5); y < 540; y += 95) { ctx.fillRect(34, y, 48, 52); ctx.fillRect(718, y + 28, 48, 52); }
  game.obstacles.forEach((item) => drawObstacle(ctx, item)); drawCar(ctx, game.players[0], 1); drawCar(ctx, game.players[1], 2);
  ctx.fillStyle = "rgba(17,24,27,.88)"; ctx.fillRect(12, 12, 190, 64); ctx.fillRect(598, 12, 190, 64);
  pixelText(ctx, `P1  ${game.players[0].score}`, 26, 35, 19, "left", "#74adff"); pixelText(ctx, `❤ ${game.players[0].lives}`, 26, 59, 15, "left", "#fff");
  pixelText(ctx, `P2  ${game.players[1].score}`, 774, 35, 19, "right", "#ff8275"); pixelText(ctx, `❤ ${game.players[1].lives}`, 774, 59, 15, "right", "#fff");
  pixelText(ctx, `${Math.floor(game.distance)} m`, 400, 34, 24, "center", "#ffe267");
  if (game.winner !== null) { ctx.fillStyle = "rgba(18,24,26,.78)"; ctx.fillRect(195, 185, 410, 120); pixelText(ctx, game.winner === -1 ? "平手！" : `玩家 ${game.winner + 1} 獲勝`, 400, 229, 34, "center", "#ffe267"); pixelText(ctx, "避開障礙，再跑一局", 400, 271, 15, "center", "#fff"); }
}
