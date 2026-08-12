export const POOL_WIDTH = 800;
export const POOL_HEIGHT = 500;
const R = 12;
const pockets = [[48,48],[400,42],[752,48],[48,452],[400,458],[752,452]];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

const colorFor = (number) => number === 8 ? "#23262b" : number < 8 ? ["#f2c92f","#2e74c9","#d83b36","#7c3ea1","#ec8d27","#318d48","#a6212b"][number - 1] : ["#f2c92f","#2e74c9","#d83b36","#7c3ea1","#ec8d27","#318d48","#a6212b"][number - 9];
function rack() {
  const balls = [{ id: 0, number: 0, x: 170, y: 250, vx: 0, vy: 0, pocketed: false }];
  const order = [1,9,2,10,8,3,11,4,12,5,13,6,14,7,15]; let cursor = 0;
  for (let row = 0; row < 5; row += 1) for (let col = 0; col <= row; col += 1) {
    balls.push({ id: order[cursor], number: order[cursor++], x: 580 + row * 21, y: 250 + (col - row / 2) * 25, vx: 0, vy: 0, pocketed: false });
  }
  return balls;
}
export function createPoolState() {
  return { type: "pool", balls: rack(), players: [{ score: 0, group: null }, { score: 0, group: null }], turn: 0, angle: 0, power: 0, actionHeld: false, moving: false, waitingShot: true, countdown: 300, winner: null, message: "輪到玩家 1 開球", frame: 0 };
}
function ballGroup(ball) { return ball.number >= 1 && ball.number <= 7 ? "solid" : ball.number >= 9 ? "stripe" : null; }
function still(game) { return game.balls.every((ball) => ball.pocketed || Math.hypot(ball.vx, ball.vy) < .12); }
function foul(game, message) { const cue = game.balls[0]; cue.x = 170; cue.y = 250; cue.vx = 0; cue.vy = 0; cue.pocketed = false; game.turn = 1 - game.turn; game.waitingShot = true; game.message = message; }
function pocketBall(game, ball) {
  ball.pocketed = true; ball.vx = 0; ball.vy = 0;
  if (ball.number === 0) { game.cuePocketed = true; return; }
  if (ball.number === 8) { const own = game.players[game.turn].group; const remaining = game.balls.some((item) => !item.pocketed && ballGroup(item) === own); game.winner = remaining ? 1 - game.turn : game.turn; game.message = remaining ? "8 號球提早落袋" : "8 號球入袋，勝利！"; return; }
  const group = ballGroup(ball), player = game.players[game.turn];
  if (!player.group) { player.group = group; game.players[1 - game.turn].group = group === "solid" ? "stripe" : "solid"; }
  if (player.group === group) { player.score += 1; game.keepTurn = true; game.message = "漂亮進球，再來一桿！"; } else game.message = "打進對手的球，換手。";
}
function fire(game) { const cue = game.balls[0]; if (!cue || cue.pocketed) return; const power = clamp(game.power, 3.5, 12); cue.vx = Math.cos(game.angle) * power; cue.vy = Math.sin(game.angle) * power; game.power = 0; game.moving = true; game.waitingShot = false; game.keepTurn = false; game.cuePocketed = false; game.message = "球正在滾動…"; }
function aiInput(game) {
  const cue = game.balls[0]; const targets = game.balls.filter((ball) => !ball.pocketed && ball.number && (game.players[1].group ? ballGroup(ball) === game.players[1].group : ball.number !== 8));
  const target = targets.sort((a,b) => Math.hypot(a.x-cue.x,a.y-cue.y)-Math.hypot(b.x-cue.x,b.y-cue.y))[0] || game.balls.find((ball)=>!ball.pocketed && ball.number===8);
  const desired = target ? Math.atan2(target.y - cue.y, target.x - cue.x) : 0;
  const delta = Math.atan2(Math.sin(desired - game.angle), Math.cos(desired - game.angle));
  if (Math.abs(delta) > .07) return { left: delta < 0, right: delta > 0, action: false };
  return { action: game.power < 8.5 };
}
export function updatePool(game, firstInput = {}, secondInput = {}, useAi = false) {
  if (game.winner !== null) return game;
  game.frame += 1; if (game.countdown > 0) { game.countdown -= 1; return game; }
  if (game.moving) {
    game.balls.forEach((ball) => { if (ball.pocketed) return; ball.x += ball.vx; ball.y += ball.vy; ball.vx *= .985; ball.vy *= .985; if (ball.x < 62 || ball.x > 738) { ball.x = clamp(ball.x,62,738); ball.vx *= -.9; } if (ball.y < 62 || ball.y > 438) { ball.y = clamp(ball.y,62,438); ball.vy *= -.9; } for (const [px,py] of pockets) if (Math.hypot(ball.x-px,ball.y-py)<21) pocketBall(game,ball); });
    for (let i=0;i<game.balls.length;i+=1) for(let j=i+1;j<game.balls.length;j+=1) { const a=game.balls[i],b=game.balls[j]; if(a.pocketed||b.pocketed)continue; const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy); if(d && d<R*2){const nx=dx/d,ny=dy/d,rel=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;if(rel>0){a.vx-=rel*nx;a.vy-=rel*ny;b.vx+=rel*nx;b.vy+=rel*ny;}const push=(R*2-d)/2;a.x-=nx*push;a.y-=ny*push;b.x+=nx*push;b.y+=ny*push;}}
    if (still(game) && game.winner === null) { game.moving = false; if (game.cuePocketed) foul(game,"白球落袋，換手"); else if (game.keepTurn) { game.waitingShot=true; game.message="進球成功，繼續出桿"; } else { game.turn=1-game.turn; game.waitingShot=true; game.message=`輪到玩家 ${game.turn+1}`; } }
    return game;
  }
  const input = game.turn === 0 ? firstInput : useAi ? aiInput(game) : secondInput;
  if (Number.isFinite(input.aimAngle)) game.angle = input.aimAngle;
  if (input.left) game.angle -= .045; if (input.right) game.angle += .045;
  if (input.action) { game.power = clamp(game.power + .18, 0, 12); game.actionHeld = true; }
  else if (game.actionHeld) { game.actionHeld = false; fire(game); }
  return game;
}
function cuePrediction(game, cue) {
  const direction = { x: Math.cos(game.angle), y: Math.sin(game.angle) };
  let target = null, targetDistance = Infinity;
  for (const ball of game.balls) {
    if (!ball.number || ball.pocketed) continue;
    const dx = ball.x - cue.x, dy = ball.y - cue.y;
    const forward = dx * direction.x + dy * direction.y;
    const sideways = Math.abs(dx * direction.y - dy * direction.x);
    if (forward > 0 && sideways <= R * 2.1 && forward < targetDistance) { target = ball; targetDistance = forward; }
  }
  const distance = target ? Math.max(0, targetDistance - R * 2) : 250;
  return { direction, contact: { x: cue.x + direction.x * distance, y: cue.y + direction.y * distance }, target };
}
export function drawPool(canvas, game) {
  const ctx=canvas.getContext("2d");ctx.clearRect(0,0,POOL_WIDTH,POOL_HEIGHT);ctx.fillStyle="#5a3720";ctx.fillRect(0,0,800,500);ctx.fillStyle="#c99a55";ctx.fillRect(25,25,750,450);ctx.fillStyle="#174f43";ctx.fillRect(50,50,700,400);ctx.strokeStyle="#e5bd72";ctx.lineWidth=2;ctx.strokeRect(62,62,676,376);pockets.forEach(([x,y])=>{ctx.fillStyle="#191b1c";ctx.beginPath();ctx.arc(x,y,19,0,Math.PI*2);ctx.fill();});game.balls.forEach(ball=>{if(ball.pocketed)return;ctx.save();ctx.translate(ball.x,ball.y);ctx.fillStyle=ball.number===0?"#fff8e7":colorFor(ball.number);ctx.beginPath();ctx.arc(0,0,R,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#24231e";ctx.lineWidth=1.5;ctx.stroke();if(ball.number){ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();ctx.fillStyle="#1f2525";ctx.font="bold 8px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(ball.number,0,1);}ctx.restore();});const cue=game.balls[0];if(game.waitingShot&&game.winner===null&&game.countdown<=0&&cue&&!cue.pocketed){const prediction=cuePrediction(game,cue);ctx.save();ctx.setLineDash([8,7]);ctx.strokeStyle="rgba(255,247,203,.82)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cue.x,cue.y);ctx.lineTo(prediction.contact.x,prediction.contact.y);ctx.stroke();if(prediction.target){ctx.strokeStyle="rgba(255,202,91,.76)";ctx.beginPath();ctx.moveTo(prediction.target.x,prediction.target.y);ctx.lineTo(prediction.target.x+prediction.direction.x*110,prediction.target.y+prediction.direction.y*110);ctx.stroke();}ctx.restore();ctx.strokeStyle="rgba(255,255,255,.9)";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cue.x-Math.cos(game.angle)*78,cue.y-Math.sin(game.angle)*78);ctx.lineTo(cue.x-Math.cos(game.angle)*22,cue.y-Math.sin(game.angle)*22);ctx.stroke();ctx.fillStyle="#fff3c7";ctx.fillRect(305,18,190,14);ctx.fillStyle="#dd7445";ctx.fillRect(305,18,190*(game.power/12),14);}ctx.fillStyle="rgba(11,22,19,.75)";ctx.fillRect(18,14,245,38);ctx.fillRect(537,14,245,38);ctx.fillStyle="#fff9de";ctx.font="bold 16px sans-serif";ctx.fillText(`P1 ${game.players[0].score} (${game.players[0].group||"未定"})`,28,39);ctx.textAlign="right";ctx.fillText(`P2 ${game.players[1].score} (${game.players[1].group||"未定"})`,772,39);ctx.textAlign="center";if(game.countdown>0){ctx.fillStyle="rgba(0,0,0,.58)";ctx.fillRect(290,160,220,140);ctx.fillStyle="#fff2a5";ctx.font="bold 72px monospace";ctx.fillText(Math.max(1,Math.ceil(game.countdown/60)),400,222);ctx.fillStyle="#fff";ctx.font="bold 18px sans-serif";ctx.fillText("準備開球",400,270);}else if(game.winner!==null){ctx.fillStyle="rgba(0,0,0,.66)";ctx.fillRect(235,185,330,110);ctx.fillStyle="#fff2a5";ctx.font="bold 28px sans-serif";ctx.fillText(`玩家 ${game.winner+1} 獲勝`,400,235);}else{ctx.fillStyle="#fff";ctx.font="bold 15px sans-serif";ctx.fillText(game.message,400,486);}}
