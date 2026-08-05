export const BRICK_BREAKER_MODES = {
  classic: { label: "單人經典", players: 1 },
  coop: { label: "雙板合作", players: 2 },
  versus: { label: "左右對戰", players: 2 }
};

const WIDTH = 800;
const HEIGHT = 500;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const BRICK_COLORS = ["#d94a3c", "#e8b63f", "#69ad62", "#3d7fd6", "#8359b6"];
const POWER_TYPES = ["long", "slow", "multi", "fire", "shield", "heal"];

function createPaddle(x, color) {
  return { x, y: 455, width: 112, baseWidth: 112, height: 15, color, lives: 3, score: 0, combo: 0, maxCombo: 0, longFrames: 0, shield: 0 };
}

function createBall(x, y = 425, vx = 4.1, vy = -5.1, owner = 0) {
  return { x, y, vx, vy, radius: 8, stuck: false, fireFrames: 0, owner };
}

function createBricks(width, offsetX, level, versus = false) {
  const columns = versus ? 7 : 12;
  const rows = Math.min(7, 4 + Math.floor((level - 1) / 2));
  const gap = 5;
  const margin = versus ? 20 : 55;
  const brickWidth = (width - margin * 2 - gap * (columns - 1)) / columns;
  const bricks = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      if (level > 1 && (row + col + level) % 11 === 0) continue;
      const hp = level >= 4 && (row * 3 + col + level) % 8 === 0 ? 2 : 1;
      bricks.push({
        x: offsetX + margin + col * (brickWidth + gap),
        y: 86 + row * 28,
        width: brickWidth,
        height: 21,
        hp,
        maxHp: hp,
        color: BRICK_COLORS[row % BRICK_COLORS.length],
        power: (row * columns + col + level) % 13 === 0 ? POWER_TYPES[(row + col + level) % POWER_TYPES.length] : null
      });
    }
  }
  return bricks;
}

function createWorld({ width = WIDTH, offsetX = 0, level = 1, owner = null, versus = false } = {}) {
  return {
    width,
    offsetX,
    owner,
    balls: [createBall(offsetX + width / 2, 420, owner === 1 ? -4.1 : 4.1, -5.1, owner || 0)],
    bricks: createBricks(width, offsetX, level, versus),
    drops: [],
    clearDelay: 0,
    boss: null
  };
}

function createBoss(world, level) {
  return {
    x: world.offsetX + world.width / 2 - Math.min(145, world.width * .34),
    y: 92,
    width: Math.min(290, world.width * .68),
    height: 70,
    hp: 18 + level * 4,
    maxHp: 18 + level * 4,
    color: "#a53c36",
    boss: true,
    phase: 0
  };
}

function startLevel(game, level) {
  game.level = level;
  game.stageLabel = level % 3 === 0 ? `關卡 ${String(level).padStart(2, "0")}・BOSS` : `關卡 ${String(level).padStart(2, "0")}`;
  if (game.mode === "versus") {
    game.worlds = [createWorld({ width: 400, offsetX: 0, level, owner: 0, versus: true }), createWorld({ width: 400, offsetX: 400, level, owner: 1, versus: true })];
  } else {
    game.worlds = [createWorld({ level })];
    if (level % 3 === 0) {
      game.worlds[0].bricks = [];
      game.worlds[0].boss = createBoss(game.worlds[0], level);
    }
  }
}

export function createBrickBreakerState(mode = "classic") {
  const normalized = BRICK_BREAKER_MODES[mode] ? mode : "classic";
  const game = {
    type: "brickbreaker",
    mode: normalized,
    players: [createPaddle(normalized === "classic" ? 400 : 205, "#3d7fd6"), createPaddle(normalized === "classic" ? 600 : 595, "#d94a3c")],
    worlds: [],
    level: 1,
    stageLabel: "關卡 01",
    lives: 3,
    score: 0,
    combo: 0,
    maxCombo: 0,
    frame: 0,
    countdown: 300,
    winner: null,
    message: "準備發球",
    event: null,
    stars: 0
  };
  startLevel(game, 1);
  return game;
}

function paddleBounds(game, world, playerIndex) {
  if (game.mode === "coop") return playerIndex === 0 ? [world.offsetX + 35, world.offsetX + world.width / 2 - 20] : [world.offsetX + world.width / 2 + 20, world.offsetX + world.width - 35];
  return [world.offsetX + 25, world.offsetX + world.width - 25];
}

function updatePaddle(game, world, playerIndex, input = {}) {
  const paddle = game.players[playerIndex];
  const [min, max] = paddleBounds(game, world, playerIndex);
  const speed = input.action ? 8.2 : 6.2;
  paddle.x = clamp(paddle.x + (input.left ? -speed : input.right ? speed : 0), min + paddle.width / 2, max - paddle.width / 2);
  if (paddle.longFrames > 0) paddle.longFrames -= 1;
  paddle.width += ((paddle.longFrames > 0 ? 162 : paddle.baseWidth) - paddle.width) * .12;
}

function hitPaddle(ball, paddle) {
  if (ball.vy <= 0) return false;
  const top = paddle.y - paddle.height / 2;
  if (ball.y + ball.radius < top || ball.y - ball.radius > top + paddle.height + 8 || Math.abs(ball.x - paddle.x) > paddle.width / 2 + ball.radius) return false;
  const angle = clamp((ball.x - paddle.x) / (paddle.width / 2), -1, 1);
  const speed = clamp(Math.hypot(ball.vx, ball.vy) + .08, 5.8, 10.5);
  ball.vx = speed * angle * .88;
  ball.vy = -Math.sqrt(Math.max(12, speed * speed - ball.vx * ball.vx));
  ball.y = top - ball.radius - 1;
  return true;
}

function applyPower(game, world, playerIndex, type) {
  const player = game.players[playerIndex];
  if (type === "long") player.longFrames = 720;
  else if (type === "slow") world.balls.forEach((ball) => { ball.vx *= .75; ball.vy *= .75; });
  else if (type === "multi" && world.balls.length < 5) {
    const source = world.balls[0];
    world.balls.push(createBall(source.x, source.y, -source.vx || -4, source.vy, source.owner), createBall(source.x, source.y, source.vx * .65 || 3, source.vy * 1.05, source.owner));
  } else if (type === "fire") world.balls.forEach((ball) => { ball.fireFrames = 540; });
  else if (type === "shield") player.shield = Math.min(2, player.shield + 1);
  else if (type === "heal") {
    if (game.mode === "versus") player.lives = Math.min(5, player.lives + 1);
    else game.lives = Math.min(5, game.lives + 1);
  }
  game.event = { type, frame: game.frame };
  game.message = { long: "板子加長！", slow: "球速降低！", multi: "三倍球！", fire: "火焰穿透球！", shield: "護盾就位！", heal: "恢復生命！" }[type];
}

function brickCollision(game, world, ball, ownerIndex) {
  const targets = world.boss && world.boss.hp > 0 ? [world.boss] : world.bricks;
  for (let index = 0; index < targets.length; index += 1) {
    const brick = targets[index];
    if (brick.hp <= 0 || ball.x + ball.radius < brick.x || ball.x - ball.radius > brick.x + brick.width || ball.y + ball.radius < brick.y || ball.y - ball.radius > brick.y + brick.height) continue;
    brick.hp -= 1;
    const player = game.players[ownerIndex];
    player.score += brick.boss ? 250 : 100 * Math.max(1, player.combo + 1);
    player.combo += 1;
    player.maxCombo = Math.max(player.maxCombo, player.combo);
    game.score = game.players.reduce((sum, item) => sum + item.score, 0);
    game.combo = game.players.reduce((sum, item) => Math.max(sum, item.combo), 0);
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    if (brick.hp <= 0 && brick.power && world.drops.length < 5) world.drops.push({ x: brick.x + brick.width / 2, y: brick.y + brick.height / 2, vy: 2.4, type: brick.power });
    if (ball.fireFrames <= 0) ball.vy *= -1;
    if (!brick.boss && brick.hp <= 0) world.bricks.splice(index, 1);
    if (brick.boss && brick.hp <= 0) world.boss = null;
    return true;
  }
  return false;
}

function loseBall(game, world, ballIndex, ownerIndex) {
  const player = game.players[ownerIndex];
  if (player.shield > 0) {
    player.shield -= 1;
    world.balls[ballIndex] = createBall(player.x, 420, ownerIndex === 1 ? -4 : 4, -5.1, ownerIndex);
    game.message = "護盾救回一球！";
    return;
  }
  world.balls.splice(ballIndex, 1);
  player.combo = 0;
  game.combo = 0;
  if (world.balls.length) return;
  if (game.mode === "versus") {
    player.lives -= 1;
    if (player.lives <= 0) game.winner = ownerIndex === 0 ? 1 : 0;
  } else {
    game.lives -= 1;
    game.players.forEach((item) => { item.lives = game.lives; });
    if (game.lives <= 0) game.winner = -1;
  }
  if (game.winner === null) world.balls.push(createBall(player.x, 420, ownerIndex === 1 ? -4 : 4, -5.1, ownerIndex));
}

function updateWorld(game, world, ownerIndex, paddles) {
  if (world.boss) {
    world.boss.phase += .018;
    world.boss.x = world.offsetX + (world.width - world.boss.width) / 2 + Math.sin(world.boss.phase) * Math.min(120, world.width * .16);
  }
  for (let index = world.balls.length - 1; index >= 0; index -= 1) {
    const ball = world.balls[index];
    if (ball.fireFrames > 0) ball.fireFrames -= 1;
    ball.x += ball.vx; ball.y += ball.vy;
    if (ball.x - ball.radius <= world.offsetX || ball.x + ball.radius >= world.offsetX + world.width) { ball.x = clamp(ball.x, world.offsetX + ball.radius, world.offsetX + world.width - ball.radius); ball.vx *= -1; }
    if (ball.y - ball.radius <= 64) { ball.y = 64 + ball.radius; ball.vy = Math.abs(ball.vy); }
    for (const paddleIndex of paddles) if (hitPaddle(ball, game.players[paddleIndex])) { ball.owner = paddleIndex; break; }
    brickCollision(game, world, ball, ball.owner ?? ownerIndex);
    if (ball.y - ball.radius > HEIGHT) loseBall(game, world, index, ball.owner ?? ownerIndex);
  }
  world.drops.forEach((drop) => { drop.y += drop.vy; });
  for (let index = world.drops.length - 1; index >= 0; index -= 1) {
    const drop = world.drops[index];
    const catcher = paddles.find((playerIndex) => {
      const paddle = game.players[playerIndex];
      return drop.y > paddle.y - 18 && drop.y < paddle.y + 18 && Math.abs(drop.x - paddle.x) < paddle.width / 2 + 12;
    });
    if (catcher !== undefined) { applyPower(game, world, catcher, drop.type); world.drops.splice(index, 1); }
    else if (drop.y > HEIGHT + 20) world.drops.splice(index, 1);
  }
}

function worldCleared(world) {
  return !world.bricks.length && !world.boss;
}

export function updateBrickBreaker(game, firstInput = {}, secondInput = {}, useAi = false) {
  if (game.winner !== null) return game;
  game.frame += 1;
  if (game.countdown > 0) {
    game.countdown -= 1;
    return game;
  }
  const second = useAi ? brickBreakerAi(game) : secondInput;
  if (game.mode === "versus") {
    updatePaddle(game, game.worlds[0], 0, firstInput);
    updatePaddle(game, game.worlds[1], 1, second);
    updateWorld(game, game.worlds[0], 0, [0]);
    updateWorld(game, game.worlds[1], 1, [1]);
    const cleared = game.worlds.map(worldCleared);
    if (cleared[0] || cleared[1]) game.winner = cleared[0] && cleared[1] ? -1 : cleared[0] ? 0 : 1;
  } else {
    const world = game.worlds[0];
    updatePaddle(game, world, 0, firstInput);
    if (game.mode === "coop") updatePaddle(game, world, 1, second);
    updateWorld(game, world, 0, game.mode === "coop" ? [0, 1] : [0]);
    if (worldCleared(world)) {
      world.clearDelay += 1;
      if (world.clearDelay === 1) {
        game.stars = game.lives >= 3 ? 3 : game.lives === 2 ? 2 : 1;
        game.message = `${game.stageLabel} 完成・${"★".repeat(game.stars)}${"☆".repeat(3 - game.stars)}`;
      }
      if (world.clearDelay > 105) startLevel(game, game.level + 1);
    }
  }
  if (game.event && game.frame - game.event.frame > 150) game.event = null;
  return game;
}

export function brickBreakerAi(game) {
  const world = game.mode === "versus" ? game.worlds[1] : game.worlds[0];
  const paddle = game.players[1];
  const ball = [...world.balls].sort((a, b) => b.y - a.y)[0];
  if (!ball) return {};
  return { left: paddle.x > ball.x + 8, right: paddle.x < ball.x - 8, action: Math.abs(paddle.x - ball.x) > 120 };
}
