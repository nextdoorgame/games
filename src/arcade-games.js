export const ARCADE_WIDTH = 800;
export const ARCADE_HEIGHT = 500;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createVolleyballState() {
  return {
    type: "volleyball",
    players: [{ x: 145, y: 332, vx: 0, vy: 0, score: 0 }, { x: 655, y: 332, vx: 0, vy: 0, score: 0 }],
    ball: { x: 240, y: 120, vx: 2.8, vy: -4.8 },
    winner: null,
    serving: 0,
    roundDelay: 0,
    countdown: 180,
    frame: 0
  };
}

function resetVolleyRound(game, serving) {
  game.serving = serving;
  game.players[0].x = 145; game.players[0].y = 332; game.players[0].vx = 0; game.players[0].vy = 0;
  game.players[1].x = 655; game.players[1].y = 332; game.players[1].vx = 0; game.players[1].vy = 0;
  game.ball = { x: serving === 0 ? 230 : 570, y: 120, vx: serving === 0 ? 3 : -3, vy: -5.2 };
  game.roundDelay = 0;
}

function volleyAi(game) {
  if (game.frame % 18 !== 0 && game.aiInput) return game.aiInput;
  const ball = game.ball, player = game.players[1];
  const target = ball.x > 405 ? clamp(ball.x + ball.vx * 5, 455, 745) : 635;
  game.aiInput = {
    left: player.x > target + 10,
    right: player.x < target - 10,
    up: ball.x > 420 && Math.abs(ball.x - player.x) < 70 && ball.y > 205 && ball.y < 325,
    action: Math.abs(ball.x - player.x) < 58 && ball.y < player.y + 12
  };
  return game.aiInput;
}

function updateVolleyPlayer(game, index, input) {
  const player = game.players[index];
  const minX = index === 0 ? 30 : 430, maxX = index === 0 ? 370 : 770;
  player.vx = input.left ? -4.5 : input.right ? 4.5 : player.vx * .72;
  player.x = clamp(player.x + player.vx, minX, maxX);
  if (input.up && player.y >= 331) player.vy = -11.2;
  player.vy += .57; player.y += player.vy;
  if (player.y > 332) { player.y = 332; player.vy = 0; }
}

function collideVolleyPlayer(game, index, input) {
  const player = game.players[index], ball = game.ball;
  const px = player.x, py = player.y + 22;
  const dx = ball.x - px, dy = ball.y - py;
  const distance = Math.hypot(dx, dy);
  if (distance >= 55 || distance === 0) return;
  const strength = input.action ? 7.6 : 6.1;
  ball.vx = dx / distance * strength + player.vx * .35;
  ball.vy = Math.min(-4.6, dy / distance * strength - (input.action ? 2.8 : .8));
  ball.x = px + dx / distance * 56;
  ball.y = py + dy / distance * 56;
}

export function updateVolleyball(game, firstInput, secondInput, useAi = false) {
  if (game.winner !== null) return game;
  game.frame += 1;
  if (game.countdown > 0) { game.countdown -= 1; return game; }
  if (game.roundDelay) {
    game.roundDelay -= 1;
    if (game.roundDelay <= 0) resetVolleyRound(game, game.serving);
    return game;
  }
  const inputs = [firstInput || {}, useAi ? volleyAi(game) : secondInput || {}];
  updateVolleyPlayer(game, 0, inputs[0]); updateVolleyPlayer(game, 1, inputs[1]);
  game.ball.vy += .24; game.ball.x += game.ball.vx; game.ball.y += game.ball.vy;
  if (game.ball.x < 20 || game.ball.x > 780) { game.ball.x = clamp(game.ball.x, 20, 780); game.ball.vx *= -.92; }
  if (game.ball.y < 18) { game.ball.y = 18; game.ball.vy = Math.abs(game.ball.vy); }
  const nearNet = Math.abs(game.ball.x - 400) < 15 && game.ball.y > 215;
  if (nearNet) {
    game.ball.x = game.ball.x < 400 ? 384 : 416;
    game.ball.vx = (game.ball.x < 400 ? -1 : 1) * Math.max(2.5, Math.abs(game.ball.vx));
  }
  collideVolleyPlayer(game, 0, inputs[0]); collideVolleyPlayer(game, 1, inputs[1]);
  if (game.ball.y >= 390) {
    const scorer = game.ball.x < 400 ? 1 : 0;
    game.players[scorer].score += 1; game.serving = scorer; game.roundDelay = 48;
    if (game.players[scorer].score >= 7) game.winner = scorer;
  }
  return game;
}

export function createRacingState() {
  return {
    type: "racing",
    players: [{ x: 315, y: 405, color: "#2e72d2", lives: 3, score: 0 }, { x: 485, y: 405, color: "#d94b3c", lives: 3, score: 0 }],
    obstacles: [], distance: 0, speed: 5.2, laneOffset: 0, spawn: 18, frame: 0, winner: null
  };
}

const racingLanes = [210, 305, 400, 495, 590];

function racingAi(game) {
  const player = game.players[1];
  const danger = game.obstacles.filter((item) => item.y > 250 && item.y < 455).sort((a, b) => b.y - a.y)[0];
  let target = racingLanes[3];
  if (danger && Math.abs(danger.x - player.x) < 60) {
    const safe = racingLanes.filter((lane) => !game.obstacles.some((item) => item.y > 210 && item.y < 470 && Math.abs(item.x - lane) < 58));
    if (safe.length) target = safe.sort((a, b) => Math.abs(a - player.x) - Math.abs(b - player.x))[0];
  }
  return { left: player.x > target + 8, right: player.x < target - 8, up: true };
}

function updateRacePlayer(game, player, input, playerIndex) {
  if (player.lives <= 0) return;
  const movement = input.left ? -5.2 : input.right ? 5.2 : 0;
  player.x = clamp(player.x + movement, 165, 635);
  player.y = clamp(player.y + (input.up ? -1.2 : input.down ? 2.4 : .3), 330, 445);
  if (player.invulnerable > 0) player.invulnerable -= 1;
  for (const obstacle of game.obstacles) {
    if (player.invulnerable || obstacle.hitPlayers?.includes(playerIndex)) continue;
    if (Math.abs(player.x - obstacle.x) < (obstacle.kind === "barrier" ? 54 : 36) && Math.abs(player.y - obstacle.y) < 42) {
      player.lives -= 1; player.score = Math.max(0, player.score - 150); player.invulnerable = 90;
      obstacle.hitPlayers ||= []; obstacle.hitPlayers.push(playerIndex);
    }
  }
  player.score = Math.max(player.score, Math.floor(game.distance));
}

export function updateRacing(game, firstInput, secondInput, useAi = false) {
  if (game.winner !== null) return game;
  game.frame += 1;
  game.speed = clamp(5.2 + game.distance / 900, 5.2, 10);
  game.distance += game.speed * .055; game.laneOffset = (game.laneOffset + game.speed) % 72;
  game.spawn -= 1;
  if (game.spawn <= 0) {
    const kinds = ["cone", "cone", "oil", "barrier"];
    game.obstacles.push({ x: racingLanes[Math.floor(Math.random() * racingLanes.length)], y: -55, kind: kinds[Math.floor(Math.random() * kinds.length)] });
    game.spawn = Math.max(25, 55 - Math.floor(game.speed * 2.3));
  }
  game.obstacles.forEach((item) => { item.y += game.speed; });
  game.obstacles = game.obstacles.filter((item) => item.y < 565);
  updateRacePlayer(game, game.players[0], firstInput || {}, 0);
  updateRacePlayer(game, game.players[1], useAi ? racingAi(game) : secondInput || {}, 1);
  if (game.players.some((player) => player.lives <= 0) || game.distance >= 2000) {
    const [a, b] = game.players; game.winner = a.lives === b.lives ? (a.score === b.score ? -1 : a.score > b.score ? 0 : 1) : a.lives > b.lives ? 0 : 1;
  }
  return game;
}
