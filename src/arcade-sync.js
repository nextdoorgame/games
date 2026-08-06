function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function smoothNetworkValue(current, authoritative, { weight = 0.18, snap = 90, deadZone = 2 } = {}) {
  const local = finite(current);
  const remote = finite(authoritative, local);
  const delta = remote - local;
  if (Math.abs(delta) <= deadZone) return local;
  if (Math.abs(delta) >= snap) return remote;
  return local + delta * weight;
}

function reconcilePlayer(predicted = {}, authoritative = {}, localPlayer = false) {
  if (localPlayer) {
    // The guest owns the feel of player 2 on their device. Keep locally
    // predicted movement so an older host snapshot cannot pull the sprite
    // backwards; scores, lives, power-ups and other outcomes remain authoritative.
    const next = { ...authoritative };
    for (const key of ["x", "y", "vx", "vy", "attackFrames", "attackBuffer", "diveFrames", "diveHitFrames", "diveDirection", "actionHeld"]) {
      if (predicted[key] !== undefined) next[key] = predicted[key];
    }
    return next;
  }
  const positionOptions = localPlayer
    ? { weight: 1, snap: 0, deadZone: 0 }
    : { weight: 0.42, snap: 48, deadZone: 1 };
  return {
    ...authoritative,
    x: smoothNetworkValue(predicted.x, authoritative.x, positionOptions),
    y: smoothNetworkValue(predicted.y, authoritative.y, positionOptions),
    vx: smoothNetworkValue(predicted.vx, authoritative.vx, { weight: 0.35, snap: 5, deadZone: .2 }),
    vy: smoothNetworkValue(predicted.vy, authoritative.vy, { weight: 0.35, snap: 5, deadZone: .2 })
  };
}

function reconcileBall(predicted = {}, authoritative = {}, frameLag = 0) {
  const projected = {
    ...authoritative,
    x: finite(authoritative.x) + finite(authoritative.vx) * frameLag,
    y: finite(authoritative.y) + finite(authoritative.vy) * frameLag
  };
  return {
    ...projected,
    x: smoothNetworkValue(predicted.x, projected.x, { weight: 0.48, snap: 42, deadZone: .75 }),
    y: smoothNetworkValue(predicted.y, projected.y, { weight: 0.48, snap: 42, deadZone: .75 }),
    vx: smoothNetworkValue(predicted.vx, projected.vx, { weight: 0.4, snap: 6, deadZone: .25 }),
    vy: smoothNetworkValue(predicted.vy, projected.vy, { weight: 0.4, snap: 6, deadZone: .25 })
  };
}

function reconcileRacingObstacles(predicted = [], authoritative = [], frameLag = 0, speed = 0) {
  const byId = new Map(predicted.map((item) => [item.id, item]));
  return authoritative.map((item) => {
    const local = byId.get(item.id);
    const projectedY = finite(item.y) + finite(speed) * frameLag;
    if (!local) return { ...item, y: projectedY };
    return {
      ...item,
      x: smoothNetworkValue(local.x, item.x, { weight: .4, snap: 45, deadZone: 1 }),
      y: smoothNetworkValue(local.y, projectedY, { weight: .45, snap: 55, deadZone: 2 })
    };
  });
}

function reconcileBrickWorld(predicted = {}, authoritative = {}) {
  const balls = (authoritative.balls || []).map((ball, index) => reconcileBall(predicted.balls?.[index], ball));
  const drops = (authoritative.drops || []).map((drop, index) => {
    const local = predicted.drops?.[index];
    if (!local || local.type !== drop.type) return { ...drop };
    return { ...drop, x: smoothNetworkValue(local.x, drop.x, { weight: .12, snap: 70, deadZone: 4 }), y: smoothNetworkValue(local.y, drop.y, { weight: .1, snap: 90, deadZone: 6 }) };
  });
  const boss = authoritative.boss && predicted.boss
    ? { ...authoritative.boss, x: smoothNetworkValue(predicted.boss.x, authoritative.boss.x, { weight: .12, snap: 90, deadZone: 4 }) }
    : authoritative.boss;
  return { ...authoritative, balls, drops, boss };
}

export function reconcileArcadeGuest(predicted, authoritative, gameType) {
  if (!predicted || !authoritative || predicted.type !== gameType || authoritative.type !== gameType) return authoritative || predicted;
  const frameLag = Math.max(0, Math.min(12, finite(predicted.frame) - finite(authoritative.frame)));
  const next = {
    ...predicted,
    ...authoritative,
    frame: Math.max(finite(predicted.frame), finite(authoritative.frame)),
    countdown: Math.min(finite(predicted.countdown, Infinity), finite(authoritative.countdown, Infinity)),
    players: authoritative.players.map((player, index) => reconcilePlayer(predicted.players?.[index], player, index === 1))
  };

  if (gameType === "volleyball") {
    next.ball = reconcileBall(predicted.ball, authoritative.ball, frameLag);
  } else if (gameType === "racing") {
    next.distance = Math.max(finite(predicted.distance), finite(authoritative.distance));
    next.laneOffset = predicted.laneOffset;
    next.obstacles = reconcileRacingObstacles(predicted.obstacles, authoritative.obstacles, frameLag, authoritative.speed);
  } else if (gameType === "brickbreaker") {
    next.worlds = authoritative.worlds.map((world, index) => reconcileBrickWorld(predicted.worlds?.[index], world));
  }
  return next;
}
