const W = 800, H = 500;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createFighterState(players = 1) {
  const monsters = Array.from({ length: players === 1 ? 5 : 9 }, (_, index) => ({ x: 460 + (index % 4) * 64, y: 387 - Math.floor(index / 4) * 10, hp: 42, vx: 0, hit: 0, color: index % 2 ? "#6e8b56" : "#8d5d47" }));
  return { frame: 0, countdown: 180, winner: null, players: [{ x: 180, y: 390, vy: 0, hp: 100, score: 0, attack: 0, special: 0, facing: 1 }, { x: 300, y: 390, vy: 0, hp: 100, score: 0, attack: 0, special: 0, facing: 1 }], monsters, monsterGoal: monsters.length, message: "", arena: "晨光樹林" };
}

function updateHero(hero, input, active = true) {
  if (!active || hero.hp <= 0) return;
  const speed = 4.2;
  if (input.left) { hero.x -= speed; hero.facing = -1; }
  if (input.right) { hero.x += speed; hero.facing = 1; }
  if (input.up && hero.y >= 390) hero.vy = -12;
  if (input.action && hero.attack <= 0) hero.attack = 14;
  if ((input.key4 || input.key5) && hero.special <= 0) { hero.special = 32; hero.attack = 22; }
  hero.x = clamp(hero.x, 45, W - 45);
  hero.vy += .62; hero.y = Math.min(390, hero.y + hero.vy); if (hero.y >= 390) hero.vy = 0;
  hero.attack = Math.max(0, hero.attack - 1); hero.special = Math.max(0, hero.special - 1);
}

export function updateFighter(state, firstInput = {}, secondInput = {}, useAi = true) {
  if (state.winner !== null) return;
  state.frame += 1;
  if (state.countdown > 0) { state.countdown -= 1; return; }
  const heroes = state.players;
  const aiInput = { left: false, right: true, up: state.frame % 150 === 0, action: state.frame % 26 < 4, key4: state.frame % 420 === 0 };
  updateHero(heroes[0], firstInput, true);
  updateHero(heroes[1], useAi ? aiInput : secondInput, true);
  for (const monster of state.monsters) {
    if (monster.hp <= 0) continue;
    const target = heroes.reduce((best, hero) => Math.abs(hero.x - monster.x) < Math.abs(best.x - monster.x) ? hero : best, heroes[0]);
    monster.x += Math.sign(target.x - monster.x) * 1.05;
    monster.x = clamp(monster.x, 32, W - 32);
    if (Math.abs(target.x - monster.x) < 36 && Math.abs(target.y - monster.y) < 48 && state.frame % 38 === 0) target.hp = Math.max(0, target.hp - 5);
    for (const hero of heroes) {
      const reach = hero.special ? 100 : 56;
      if (hero.attack > 0 && Math.abs(hero.x - monster.x) < reach && Math.abs(hero.y - monster.y) < 54 && monster.hit <= 0) {
        monster.hp -= hero.special ? 18 : 9; monster.hit = 13; hero.score += 10; state.message = hero.special ? "旋風技能命中！" : "連擊！";
      }
    }
    monster.hit = Math.max(0, monster.hit - 1);
  }
  const alive = state.monsters.filter((monster) => monster.hp > 0).length;
  if (!alive) state.winner = heroes[0].score >= heroes[1].score ? 0 : 1;
  if (heroes.every((hero) => hero.hp <= 0)) state.winner = -1;
}

function pixelPerson(ctx, hero, color, label) {
  ctx.save(); ctx.translate(hero.x, hero.y); ctx.scale(hero.facing, 1);
  ctx.fillStyle = hero.special ? "#ffd44a" : "rgba(255,255,255,.35)"; if (hero.special) ctx.beginPath(), ctx.arc(0, -25, 36, 0, Math.PI * 2), ctx.fill();
  ctx.fillStyle = "#f5c49d"; ctx.fillRect(-9, -50, 18, 16); ctx.fillStyle = color; ctx.fillRect(-14, -33, 28, 29); ctx.fillStyle = "#42352d"; ctx.fillRect(-16, -58, 32, 8); ctx.fillRect(-15, -4, 10, 13); ctx.fillRect(5, -4, 10, 13);
  if (hero.attack) { ctx.fillStyle = hero.special ? "#ffe16d" : "#fff"; ctx.fillRect(14, -30, hero.special ? 58 : 33, 8); }
  ctx.restore(); ctx.fillStyle = "#fff"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.fillText(label, hero.x, hero.y + 28);
}

export function drawFighter(canvas, state) {
  const ctx = canvas.getContext("2d");
  if (!canvas.dataset.fighterBg) { const bg = new Image(); bg.src = "./assets/forest-arena.png"; bg.onload = () => { canvas.dataset.fighterBg = "ready"; drawFighter(canvas, state); }; canvas._fighterBg = bg; canvas.dataset.fighterBg = "loading"; }
  const image = canvas._fighterBg;
  ctx.clearRect(0, 0, W, H); if (image?.complete) ctx.drawImage(image, 0, 0, W, H); else { ctx.fillStyle = "#86d1ed"; ctx.fillRect(0,0,W,H); }
  ctx.fillStyle = "rgba(39,58,33,.75)"; ctx.fillRect(0,0,W,52); ctx.fillStyle = "#fff"; ctx.font = "bold 15px sans-serif"; ctx.fillText(`怪物 ${state.monsters.filter((m) => m.hp > 0).length} / ${state.monsterGoal}`, W / 2, 32);
  state.monsters.forEach((monster) => { if (monster.hp <= 0) return; ctx.fillStyle = monster.hit ? "#f6e4ba" : monster.color; ctx.fillRect(monster.x - 13, monster.y - 32, 26, 32); ctx.fillStyle = "#4a372c"; ctx.fillRect(monster.x - 17, monster.y - 39, 34, 9); ctx.fillStyle = "#d94a42"; ctx.fillRect(monster.x - 18, monster.y - 51, 36 * Math.max(0, monster.hp) / 42, 4); });
  pixelPerson(ctx, state.players[0], "#3e78c5", "玩家 1"); pixelPerson(ctx, state.players[1], "#d76a53", "玩家 2");
  state.players.forEach((hero, index) => { ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fillRect(18 + index * 254, 15, 210, 12); ctx.fillStyle = index ? "#d94a3c" : "#3d7fd6"; ctx.fillRect(18 + index * 254, 15, 210 * hero.hp / 100, 12); });
  if (state.countdown > 0) { ctx.fillStyle = "rgba(42,48,35,.55)"; ctx.fillRect(0,0,W,H); ctx.fillStyle = "#fff"; ctx.font = "bold 66px sans-serif"; ctx.textAlign = "center"; ctx.fillText(String(Math.max(1, Math.ceil(state.countdown / 60))), W/2, H/2); }
  if (state.winner !== null) { ctx.fillStyle = "rgba(42,48,35,.62)"; ctx.fillRect(0,0,W,H); ctx.fillStyle = "#fff"; ctx.font = "bold 38px sans-serif"; ctx.textAlign = "center"; ctx.fillText(state.winner < 0 ? "再試一次！" : `玩家 ${state.winner + 1} 獲勝！`, W/2, H/2); }
}
