export const CHECKER_COLORS = ["red", "blue", "gold"];
const DIRECTIONS = [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
const TRIANGLE_SIDE = 5;
const CENTER_RADIUS = TRIANGLE_SIDE;
const BOARD_EXTENT = CENTER_RADIUS + TRIANGLE_SIDE;

function validCoord(q, r) {
  const s = -q-r;
  if (Math.max(Math.abs(q),Math.abs(r),Math.abs(s)) <= CENTER_RADIUS) return true;
  const arms = [
    q > CENTER_RADIUS && q <= BOARD_EXTENT && r <= -1 && r >= -TRIANGLE_SIDE && s >= -TRIANGLE_SIDE && s <= -1,
    r > CENTER_RADIUS && r <= BOARD_EXTENT && q <= -1 && q >= -TRIANGLE_SIDE && s >= -TRIANGLE_SIDE && s <= -1,
    s > CENTER_RADIUS && s <= BOARD_EXTENT && q <= -1 && q >= -TRIANGLE_SIDE && r >= -TRIANGLE_SIDE && r <= -1,
    q < -CENTER_RADIUS && q >= -BOARD_EXTENT && r >= 1 && r <= TRIANGLE_SIDE && s >= 1 && s <= TRIANGLE_SIDE,
    r < -CENTER_RADIUS && r >= -BOARD_EXTENT && q >= 1 && q <= TRIANGLE_SIDE && s >= 1 && s <= TRIANGLE_SIDE,
    s < -CENTER_RADIUS && s >= -BOARD_EXTENT && q >= 1 && q <= TRIANGLE_SIDE && r >= 1 && r <= TRIANGLE_SIDE
  ];
  return arms.some(Boolean);
}

export const CHECKER_HOLES = (() => {
  const holes=[];
  for(let q=-BOARD_EXTENT;q<=BOARD_EXTENT;q++) for(let r=-BOARD_EXTENT;r<=BOARD_EXTENT;r++) if(validCoord(q,r)) holes.push({q,r,key:`${q},${r}`});
  return holes;
})();
const HOLE_SET = new Set(CHECKER_HOLES.map((hole)=>hole.key));

const camps = [
  CHECKER_HOLES.filter(({r})=>r < -CENTER_RADIUS),
  CHECKER_HOLES.filter(({q})=>q < -CENTER_RADIUS),
  CHECKER_HOLES.filter(({q,r})=>-q-r < -CENTER_RADIUS)
];
const targets = [
  CHECKER_HOLES.filter(({r})=>r > CENTER_RADIUS),
  CHECKER_HOLES.filter(({q})=>q > CENTER_RADIUS),
  CHECKER_HOLES.filter(({q,r})=>-q-r > CENTER_RADIUS)
];

export function createCheckersBoard(players=2) {
  const board={};
  for(let player=0;player<players;player++) playerCamp(player,players).forEach(({key})=>{board[key]=player+1;});
  return board;
}

function playerCamp(player,players){
  if(players===2) return player===0?camps[0]:targets[0];
  return camps[player];
}

function playerTarget(player,players){
  if(players===2) return player===0?targets[0]:camps[0];
  return targets[player];
}

function neighbors(key, distance=1) {
  const [q,r]=key.split(",").map(Number);
  return DIRECTIONS.map(([dq,dr])=>`${q+dq*distance},${r+dr*distance}`).filter((next)=>HOLE_SET.has(next));
}

export function checkerMoves(board, from) {
  if(!board[from]) return [];
  const results=new Set(neighbors(from).filter((key)=>!board[key]));
  const seen=new Set([from]);
  const visit=(position)=>{
    const [q,r]=position.split(",").map(Number);
    DIRECTIONS.forEach(([dq,dr])=>{
      const middle=`${q+dq},${r+dr}`,landing=`${q+dq*2},${r+dr*2}`;
      if(HOLE_SET.has(landing) && board[middle] && !board[landing] && !seen.has(landing)) { seen.add(landing); results.add(landing); visit(landing); }
    });
  };
  visit(from);
  return [...results];
}

export function applyCheckerMove(board,from,to){
  if(!checkerMoves(board,from).includes(to)) return null;
  const next={...board,[to]:board[from]}; delete next[from]; return next;
}

export function checkersWinner(board,players=2){
  for(let player=0;player<players;player++) if(playerTarget(player,players).every(({key})=>board[key]===player+1)) return player+1;
  return 0;
}

function targetDistance(key,player,players){
  const [q,r]=key.split(",").map(Number); const goals=playerTarget(player,players);
  return Math.min(...goals.map((g)=>Math.max(Math.abs(q-g.q),Math.abs(r-g.r),Math.abs((-q-r)-(-g.q-g.r)))));
}

export function chooseCheckerMove(board,player){
  const players=Math.max(...Object.values(board));
  let best=null,bestScore=-Infinity;
  Object.keys(board).filter((key)=>board[key]===player+1).forEach((from)=>checkerMoves(board,from).forEach((to)=>{
    const score=targetDistance(from,player,players)-targetDistance(to,player,players)+Math.random()*.08;
    if(score>bestScore){bestScore=score;best={from,to};}
  }));
  return best;
}
