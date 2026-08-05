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
  const positionOptions = localPlayer
    ? { weight: 0.07, snap: 115, deadZone: 7 }
    : { weight: 0.16, snap: 90, deadZone: 3 };
  return {
    ...authoritative,
    x: smoothNetworkValue(predicted.x, authoritative.x, positionOptions),
    y: smoothNetworkValue(predicted.y, authoritative.y, positionOptions),
    vx: smoothNetworkValue(predicted.vx, authoritative.vx, { weight: 0.14, snap: 7, deadZone: .35 }),
    vy: smoothNetworkValue(predicted.vy, authoritative.vy, { weight: 0.14, snap: 7, deadZone: .35 })
  };
}

function reconcileBall(predicted = {}, authoritative = {}) {
  return {
    ...authoritative,
    x: smoothNetworkValue(predicted.x, authoritative.x, { weight: 0.12, snap: 80, deadZone: 4 }),
    y: smoothNetworkValue(predicted.y, authoritative.y, { weight: 0.12, snap: 80, deadZone: 4 }),
    vx: smoothNetworkValue(predicted.vx, authoritative.vx, { weight: 0.18, snap: 8, deadZone: .45 }),
    vy: smoothNetworkValue(predicted.vy, authoritative.vy, { weight: 0.18, snap: 8, deadZone: .45 })
  };
}

function reconcileRacingObstacles(predicted = [], authoritative = []) {
  const byId = new Map(predicted.map((item) => [item.id, item]));
  return authoritative.map((item) => {
    const local = byId.get(item.id);
    if (!local) return { ...item };
    return {
      ...item,
      x: smoothNetworkValue(local.x, item.x, { weight: .12, snap: 70, deadZone: 4 }),
      y: smoothNetworkValue(local.y, item.y, { weight: .08, snap: 120, deadZone: 10 })
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
  const next = {
    ...predicted,
    ...authoritative,
    frame: Math.max(finite(predicted.frame), finite(authoritative.frame)),
    players: authoritative.players.map((player, index) => reconcilePlayer(predicted.players?.[index], player, index === 1))
  };

  if (gameType === "volleyball") {
    next.ball = reconcileBall(predicted.ball, authoritative.ball);
  } else if (gameType === "racing") {
    next.distance = Math.max(finite(predicted.distance), finite(authoritative.distance));
    next.laneOffset = predicted.laneOffset;
    next.obstacles = reconcileRacingObstacles(predicted.obstacles, authoritative.obstacles);
  } else if (gameType === "brickbreaker") {
    next.worlds = authoritative.worlds.map((world, index) => reconcileBrickWorld(predicted.worlds?.[index], world));
  }
  return next;
}
