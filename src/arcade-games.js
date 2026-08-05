export const ARCADE_WIDTH = 800;
export const ARCADE_HEIGHT = 500;
const VOLLEY_COUNTDOWN_FRAMES = 180;
const VOLLEY_PLAYER_Y = 332;
const VOLLEY_SERVE_HEIGHT = 80;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createVolleyballState() {
  const game = {
    type: "volleyball",
    players: [{ x: 145, y: VOLLEY_PLAYER_Y, vx: 0, vy: 0, score: 0, attackFrames: 0, diveFrames: 0 }, { x: 655, y: VOLLEY_PLAYER_Y, vx: 0, vy: 0, score: 0, attackFrames: 0, diveFrames: 0 }],
    ball: { x: 145, y: VOLLEY_PLAYER_Y - VOLLEY_SERVE_HEIGHT, vx: 0, vy: 0 },
    winner: null,
    serving: 0,
    roundDelay: 0,
    countdown: VOLLEY_COUNTDOWN_FRAMES,
    frame: 0
  };
  resetVolleyRound(game, 0);
  return game;
}

function resetVolleyRound(game, serving) {
  game.serving = serving;
  game.players[0].x = 145; game.players[0].y = VOLLEY_PLAYER_Y; game.players[0].vx = 0; game.players[0].vy = 0;
  game.players[1].x = 655; game.players[1].y = VOLLEY_PLAYER_Y; game.players[1].vx = 0; game.players[1].vy = 0;
  game.players.forEach((player) => { player.attackFrames = 0; player.diveFrames = 0; player.actionHeld = false; player.diveDirection = 0; });
  const server = game.players[serving];
  game.ball = { x: server.x, y: server.y - VOLLEY_SERVE_HEIGHT, vx: 0, vy: 0 };
  game.roundDelay = 0;
  game.countdown = VOLLEY_COUNTDOWN_FRAMES;
  game.lastSpike = null;
}

function predictedVolleyLandingX(ball) {
  let x = ball.x, y = ball.y, vx = ball.vx, vy = ball.vy;
  for (let frame = 0; frame < 180 && y < 390; frame += 1) {
    vy += .24; x += vx; y += vy;
    if (x < 20 || x > 780) { x = clamp(x, 20, 780); vx *= -.92; }
    if (Math.abs(x - 400) < 15 && y > 215) { x = x < 400 ? 384 : 416; vx = (x < 400 ? -1 : 1) * Math.max(2.5, Math.abs(vx)); }
  }
  return x;
}

function volleyAi(game) {
  if (game.frame % 18 !== 0 && game.aiInput) return game.aiInput;
  const ball = game.ball, player = game.players[1];
  const landing = predictedVolleyLandingX(ball);
  const target = landing > 405 ? clamp(landing, 455, 745) : 635;
  const attack = Math.abs(ball.x - player.x) < 58 && ball.y < player.y + 12;
  game.aiInput = {
    left: player.x > target + 10,
    right: player.x < target - 10,
    up: ball.x > 420 && Math.abs(ball.x - player.x) < 70 && ball.y > 205 && ball.y < 325,
    down: attack && ball.x < 535,
    action: attack
  };
  return game.aiInput;
}

function updateVolleyPlayer(game, index, input) {
  const player = game.players[index];
  const minX = index === 0 ? 30 : 430, maxX = index === 0 ? 370 : 770;
  const grounded = player.y >= VOLLEY_PLAYER_Y - 1;
  const actionPressed = Boolean(input.action) && !player.actionHeld;
  player.actionHeld = Boolean(input.action);
  if (actionPressed && !grounded) player.attackFrames = 10;
  if (actionPressed && grounded && (input.left || input.right)) {
    player.diveFrames = 16;
    player.diveDirection = input.left ? -1 : 1;
    player.vy = -3.1;
  }
  if (player.diveFrames > 0) {
    player.diveFrames -= 1;
    player.vx = player.diveDirection * (2.8 + player.diveFrames * .26);
  } else player.vx = input.left ? -4.5 : input.right ? 4.5 : player.vx * .72;
  player.x = clamp(player.x + player.vx, minX, maxX);
  if (input.up && grounded && player.diveFrames <= 0) player.vy = -11.2;
  player.vy += .57; player.y += player.vy;
  if (player.y > 332) { player.y = 332; player.vy = 0; }
  if (player.attackFrames > 0) player.attackFrames -= 1;
}

function collideVolleyPlayer(game, index, input) {
  const player = game.players[index], ball = game.ball;
  const px = player.x, py = player.y + 22;
  const dx = ball.x - px, dy = ball.y - py;
  const distance = Math.hypot(dx, dy);
  if (distance >= 55 || distance === 0) return;
  const airborne = player.y < VOLLEY_PLAYER_Y - 5;
  if (player.attackFrames > 0 && airborne) {
    const facing = index === 0 ? 1 : -1;
    const forward = index === 0 ? input.right : input.left;
    const backward = index === 0 ? input.left : input.right;
    let shot;
    if (input.down && forward) shot = { vx: facing * 8.8, vy: 5.6, kind: "forward-down", label: "強力斜下殺" };
    else if (input.down && backward) shot = { vx: -facing * 6.7, vy: 4.8, kind: "reverse-down", label: "反向斜下殺" };
    else if (input.down) shot = { vx: facing * 3.8, vy: 8.2, kind: "down", label: "近網直下殺" };
    else if (input.up && forward) shot = { vx: facing * 7.2, vy: -5.6, kind: "forward-up", label: "前上方高球" };
    else if (input.up) shot = { vx: facing * 5.1, vy: -7.2, kind: "up", label: "斜上高球" };
    else if (forward) shot = { vx: facing * 9.1, vy: -.7, kind: "flat", label: "前方平殺" };
    else if (backward) shot = { vx: -facing * 7.4, vy: -.9, kind: "reverse", label: "反向平殺" };
    else shot = { vx: facing * 7.3, vy: 2.9, kind: "angled", label: "斜角殺球" };
    const incomingBoost = clamp(Math.abs(ball.vy) * .16, 0, 1.8);
    ball.vx = shot.vx + Math.sign(shot.vx) * incomingBoost;
    ball.vy = shot.vy < 0 ? shot.vy - incomingBoost * .45 : shot.vy + incomingBoost * .55;
    ball.x = px + Math.sign(shot.vx || facing) * 48;
    ball.y = player.y - 18;
    game.lastSpike = { player: index, kind: shot.kind, label: shot.label, frame: game.frame };
    player.attackFrames = 0;
    return;
  }
  const impactOffset = clamp(dx / 55, -1, 1);
  ball.vx = impactOffset * 6.8 + player.vx * .42;
  if (Math.abs(ball.vx) < .8) ball.vx = (index === 0 ? 1 : -1) * .8;
  ball.vy = -clamp(Math.abs(ball.vy) * .92 + 1.8, 6.6, 10.8);
  ball.x = px + dx / distance * 56;
  ball.y = py + dy / distance * 56;
}

export function updateVolleyball(game, firstInput, secondInput, useAi = false) {
  if (game.winner !== null) return game;
  game.frame += 1;
  if (game.roundDelay) {
    game.roundDelay -= 1;
    if (game.roundDelay <= 0) resetVolleyRound(game, game.serving);
    return game;
  }
  if (game.countdown > 0) {
    game.countdown -= 1;
    const server = game.players[game.serving];
    game.ball.x = server.x;
    game.ball.y = server.y - VOLLEY_SERVE_HEIGHT;
    if (game.countdown <= 0) {
      game.ball.vx = game.serving === 0 ? 2.6 : -2.6;
      game.ball.vy = -5.2;
    }
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
