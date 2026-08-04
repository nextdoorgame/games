export const CHECKER_COLORS = ["red", "blue", "gold"];
const DIRECTIONS = [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];

function validCoord(q, r) {
  const s = -q-r;
  if (Math.max(Math.abs(q),Math.abs(r),Math.abs(s)) <= 4) return true;
  const arms = [
    q >= 5 && q <= 8 && r <= -1 && r >= -4 && s >= -4 && s <= -1,
    r >= 5 && r <= 8 && q <= -1 && q >= -4 && s >= -4 && s <= -1,
    s >= 5 && s <= 8 && q <= -1 && q >= -4 && r >= -4 && r <= -1,
    q <= -5 && q >= -8 && r >= 1 && r <= 4 && s >= 1 && s <= 4,
    r <= -5 && r >= -8 && q >= 1 && q <= 4 && s >= 1 && s <= 4,
    s <= -5 && s >= -8 && q >= 1 && q <= 4 && r >= 1 && r <= 4
  ];
  return arms.some(Boolean);
}

export const CHECKER_HOLES = (() => {
  const holes=[];
  for(let q=-8;q<=8;q++) for(let r=-8;r<=8;r++) if(validCoord(q,r)) holes.push({q,r,key:`${q},${r}`});
  return holes;
})();
const HOLE_SET = new Set(CHECKER_HOLES.map((hole)=>hole.key));

const camps = [
  CHECKER_HOLES.filter(({r})=>r<=-5),
  CHECKER_HOLES.filter(({q})=>q<=-5),
  CHECKER_HOLES.filter(({q,r})=>-q-r<=-5)
];
const targets = [
  CHECKER_HOLES.filter(({r})=>r>=5),
  CHECKER_HOLES.filter(({q})=>q>=5),
  CHECKER_HOLES.filter(({q,r})=>-q-r>=5)
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
