import { ARCADE_HEIGHT, ARCADE_WIDTH } from "./arcade-games.js?v=neighbor-8";

const brickBreakerBackground = new Image();
brickBreakerBackground.src = new URL("../assets/brickbreaker-arcade-room.png", import.meta.url).href;

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
  if (game.lastSpike && game.frame - game.lastSpike.frame < 42) {
    const opacity = 1 - (game.frame - game.lastSpike.frame) / 42;
    ctx.save(); ctx.globalAlpha = opacity; ctx.strokeStyle = "#ffe369"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(game.ball.x - game.ball.vx * 6, game.ball.y - game.ball.vy * 6); ctx.lineTo(game.ball.x, game.ball.y); ctx.stroke(); ctx.restore();
    pixelText(ctx, game.lastSpike.label, 400, 102, 20, "center", "#fff3a5");
  }
  pixelText(ctx, String(game.players[0].score).padStart(2, "0"), 65, 42, 34, "center", "#ffdf48"); pixelText(ctx, String(game.players[1].score).padStart(2, "0"), 735, 42, 34, "center", "#ffdf48");
  pixelText(ctx, "先得 7 分", 400, 34, 16, "center", "#fff8df");
  if (game.countdown > 0) {
    const count = Math.max(1, Math.ceil(game.countdown / 60));
    ctx.fillStyle = "rgba(24,30,26,.42)"; ctx.fillRect(310, 155, 180, 130);
    pixelText(ctx, String(count), 400, 207, 66, "center", "#ffe369");
    pixelText(ctx, `玩家 ${game.serving + 1} 準備開球`, 400, 265, 16, "center", "#fff");
  }
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
  if (game.countdown > 0) {
    const count = Math.max(1, Math.ceil(game.countdown / 60));
    ctx.fillStyle = "rgba(18,24,26,.66)"; ctx.fillRect(285, 165, 230, 145);
    pixelText(ctx, String(count), 400, 217, 70, "center", "#ffe267");
    pixelText(ctx, "準備出發", 400, 281, 19, "center", "#fff");
  }
  if (game.winner !== null) { ctx.fillStyle = "rgba(18,24,26,.78)"; ctx.fillRect(195, 185, 410, 120); pixelText(ctx, game.winner === -1 ? "平手！" : `玩家 ${game.winner + 1} 獲勝`, 400, 229, 34, "center", "#ffe267"); pixelText(ctx, "避開障礙，再跑一局", 400, 271, 15, "center", "#fff"); }
}

const POWER_LABELS = { long: "長", slow: "慢", multi: "3", fire: "火", shield: "盾", heal: "+" };

function drawBrickBackground(ctx) {
  if (brickBreakerBackground.complete && brickBreakerBackground.naturalWidth) {
    const sourceHeight = brickBreakerBackground.naturalWidth / (ARCADE_WIDTH / ARCADE_HEIGHT);
    const sourceY = Math.max(0, (brickBreakerBackground.naturalHeight - sourceHeight) / 2);
    ctx.drawImage(brickBreakerBackground, 0, sourceY, brickBreakerBackground.naturalWidth, sourceHeight, 0, 0, ARCADE_WIDTH, ARCADE_HEIGHT);
  } else {
    ctx.fillStyle = "#07152b"; ctx.fillRect(0, 0, ARCADE_WIDTH, ARCADE_HEIGHT);
  }
  ctx.fillStyle = "rgba(2,10,24,.22)"; ctx.fillRect(0, 0, ARCADE_WIDTH, ARCADE_HEIGHT);
}

function drawBrickPaddle(ctx, paddle, label) {
  const x = Math.round(paddle.x - paddle.width / 2), y = Math.round(paddle.y - paddle.height / 2);
  ctx.fillStyle = "#18233a"; ctx.fillRect(x - 4, y - 4, paddle.width + 8, paddle.height + 8);
  ctx.fillStyle = paddle.color; ctx.fillRect(x, y, paddle.width, paddle.height);
  ctx.fillStyle = "rgba(255,255,255,.72)"; ctx.fillRect(x + 8, y + 3, Math.max(8, paddle.width - 16), 3);
  pixelText(ctx, label, paddle.x, y - 14, 14, "center", paddle.color === "#d94a3c" ? "#ff8377" : "#75a9ff");
  if (paddle.shield) { ctx.strokeStyle = "#7ee6dc"; ctx.lineWidth = 3; ctx.strokeRect(x - 9, y - 12, paddle.width + 18, paddle.height + 20); }
}

function drawBrickWorld(ctx, world, game) {
  if (game.mode === "versus") { ctx.strokeStyle = "rgba(246,236,207,.42)"; ctx.lineWidth = 2; ctx.strokeRect(world.offsetX + 7, 70, world.width - 14, 410); }
  world.bricks.forEach((brick) => {
    ctx.fillStyle = "#111a28"; ctx.fillRect(brick.x - 2, brick.y - 2, brick.width + 4, brick.height + 4);
    ctx.fillStyle = brick.hp < brick.maxHp ? "#8a8f93" : brick.color; ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
    ctx.fillStyle = "rgba(255,255,255,.34)"; ctx.fillRect(brick.x + 3, brick.y + 3, brick.width - 6, 3);
    if (brick.power) pixelText(ctx, POWER_LABELS[brick.power], brick.x + brick.width / 2, brick.y + brick.height / 2 + 1, 12, "center", "#fff5b8");
  });
  if (world.boss) {
    const boss = world.boss;
    ctx.fillStyle = "#141824"; ctx.fillRect(boss.x - 6, boss.y - 6, boss.width + 12, boss.height + 12);
    ctx.fillStyle = boss.color; ctx.fillRect(boss.x, boss.y, boss.width, boss.height);
    ctx.fillStyle = "#f0c34c"; ctx.fillRect(boss.x + 18, boss.y + 17, 24, 19); ctx.fillRect(boss.x + boss.width - 42, boss.y + 17, 24, 19);
    ctx.fillStyle = "#2a1b1a"; ctx.fillRect(boss.x + boss.width * .28, boss.y + 48, boss.width * .44, 10);
    ctx.fillStyle = "#251f1f"; ctx.fillRect(boss.x, boss.y - 18, boss.width, 9);
    ctx.fillStyle = "#e24b43"; ctx.fillRect(boss.x, boss.y - 18, boss.width * (boss.hp / boss.maxHp), 9);
    pixelText(ctx, "隔壁大魔磚", boss.x + boss.width / 2, boss.y + 38, 19, "center", "#fff1c4");
  }
  world.drops.forEach((drop) => {
    ctx.fillStyle = "#e8f4d8"; ctx.fillRect(drop.x - 12, drop.y - 12, 24, 24);
    ctx.strokeStyle = "#315b49"; ctx.lineWidth = 3; ctx.strokeRect(drop.x - 12, drop.y - 12, 24, 24);
    pixelText(ctx, POWER_LABELS[drop.type], drop.x, drop.y + 1, 13, "center", "#315b49");
  });
  world.balls.forEach((ball) => {
    ctx.fillStyle = ball.fireFrames > 0 ? "#ff733e" : "#fff6dd";
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ball.fireFrames > 0 ? "#ffe05c" : "#293044"; ctx.lineWidth = 2; ctx.stroke();
    if (ball.fireFrames > 0) { ctx.fillStyle = "rgba(255,111,55,.5)"; ctx.fillRect(ball.x - ball.vx * 3, ball.y - ball.vy * 3, 8, 8); }
  });
}

export function drawBrickBreaker(canvas, game) {
  const ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, ARCADE_WIDTH, ARCADE_HEIGHT);
  drawBrickBackground(ctx);
  ctx.fillStyle = "rgba(3,11,28,.9)"; ctx.fillRect(0, 0, ARCADE_WIDTH, 65);
  pixelText(ctx, game.stageLabel, 28, 25, 17, "left", "#ffe15f");
  pixelText(ctx, `分數 ${String(game.score).padStart(6, "0")}`, 255, 25, 16, "center", "#fff2d2");
  pixelText(ctx, `COMBO x${String(game.combo).padStart(2, "0")}`, 480, 25, 16, "center", "#77db72");
  const lives = game.mode === "versus" ? `P1 ${game.players[0].lives}  P2 ${game.players[1].lives}` : `生命 ${"♥".repeat(Math.max(0, game.lives))}`;
  pixelText(ctx, lives, 772, 25, 17, "right", "#ff7165");
  game.worlds.forEach((world) => drawBrickWorld(ctx, world, game));
  if (game.mode === "classic") drawBrickPaddle(ctx, game.players[0], "P1");
  else { drawBrickPaddle(ctx, game.players[0], "P1"); drawBrickPaddle(ctx, game.players[1], "P2"); }
  if (game.mode === "versus") { ctx.fillStyle = "rgba(248,238,210,.72)"; ctx.fillRect(398, 66, 4, 434); }
  if (game.countdown > 0) {
    const count = Math.max(1, Math.ceil(game.countdown / 60));
    ctx.fillStyle = "rgba(5,10,20,.76)"; ctx.fillRect(285, 165, 230, 145);
    pixelText(ctx, String(count), 400, 217, 70, "center", "#ffe267");
    pixelText(ctx, "準備開球", 400, 281, 19, "center", "#fff");
  }
  if (game.event && game.frame - game.event.frame < 150) pixelText(ctx, game.message, 400, 300, 24, "center", "#fff3a5");
  if (game.winner !== null) {
    ctx.fillStyle = "rgba(5,10,20,.82)"; ctx.fillRect(185, 188, 430, 120);
    const message = game.winner === -1 ? (game.mode === "versus" ? "雙方平手！" : "生命用盡") : `玩家 ${game.winner + 1} 獲勝`;
    pixelText(ctx, message, 400, 229, 34, "center", "#ffe267");
    pixelText(ctx, "按重新開始再挑戰一次", 400, 275, 15, "center", "#fff");
  }
}
