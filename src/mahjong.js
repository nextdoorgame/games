const SUITS=["萬","筒","條"];
const HONORS=["東","南","西","北","中","發","白"];

export function createMahjongWall(){
  const tiles=[];
  SUITS.forEach((suit)=>{for(let rank=1;rank<=9;rank++)for(let copy=0;copy<4;copy++)tiles.push({id:`${suit}${rank}-${copy}`,suit,rank,label:`${rank}${suit}`});});
  HONORS.forEach((label,index)=>{for(let copy=0;copy<4;copy++)tiles.push({id:`${label}-${copy}`,suit:"字",rank:index+1,label});});
  for(let i=tiles.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[tiles[i],tiles[j]]=[tiles[j],tiles[i]];}
  return tiles;
}

export const tileOrder=(tile)=>(tile.suit==="萬"?0:tile.suit==="筒"?20:tile.suit==="條"?40:60)+tile.rank;
export const sortMahjongHand=(hand)=>[...hand].sort((a,b)=>tileOrder(a)-tileOrder(b));

function key(tile){return `${tile.suit}${tile.rank}`;}
function canMeld(counts){
  const entries=[...counts.entries()].filter(([,count])=>count);
  if(!entries.length) return true;
  const [first,count]=entries[0];
  const next=new Map(counts);
  if(count>=3){next.set(first,count-3);if(canMeld(next))return true;}
  const suit=first[0],rank=Number(first.slice(1));
  if(suit!=="字"&&rank<=7){const k2=`${suit}${rank+1}`,k3=`${suit}${rank+2}`;if((next.get(k2)||0)>0&&(next.get(k3)||0)>0){next.set(first,count-1);next.set(k2,next.get(k2)-1);next.set(k3,next.get(k3)-1);if(canMeld(next))return true;}}
  return false;
}

export function isMahjongWin(hand){
  if(hand.length%3!==2)return false;
  const counts=new Map();hand.forEach((tile)=>counts.set(key(tile),(counts.get(key(tile))||0)+1));
  for(const [pair,count] of counts){if(count<2)continue;const rest=new Map(counts);rest.set(pair,count-2);if(canMeld(rest))return true;}
  return false;
}

export function dealMahjong(playerCount=4){
  const wall=createMahjongWall();const hands=Array.from({length:playerCount},()=>[]);
  for(let round=0;round<13;round++)for(let player=0;player<playerCount;player++)hands[player].push(wall.pop());
  hands[0].push(wall.pop());
  return {wall,hands:hands.map(sortMahjongHand),turn:0,drawn:true,discards:Array.from({length:playerCount},()=>[]),openMelds:Array.from({length:playerCount},()=>[]),pendingDiscard:null,winner:null};
}

export function mahjongDiscardScore(hand,index){
  const tile=hand[index];let score=0;
  hand.forEach((other,i)=>{if(i===index)return;if(key(other)===key(tile))score+=5;if(other.suit===tile.suit&&Math.abs(other.rank-tile.rank)<=2)score+=2;});
  if(tile.suit==="字")score-=1;
  return score;
}

export function chooseMahjongDiscard(hand){
  let pick=0,best=Infinity;
  hand.forEach((tile,index)=>{const score=mahjongDiscardScore(hand,index)+Math.random()*.2;if(score<best){best=score;pick=index;}});return pick;
}

export function drawMahjong(state,player){
  if(state.winner!==null||state.turn!==player||state.drawn||!state.wall.length)return state;
  const next={...state,wall:[...state.wall],hands:state.hands.map((hand)=>[...hand])};
  next.hands[player].push(next.wall.pop());next.hands[player]=sortMahjongHand(next.hands[player]);next.drawn=true;
  if(isMahjongWin(next.hands[player]))next.winner=player;
  return next;
}

export function discardMahjong(state,player,index){
  if(state.winner!==null||state.turn!==player||!state.drawn||!state.hands[player][index])return state;
  const next={...state,hands:state.hands.map((hand)=>[...hand]),discards:state.discards.map((pile)=>[...pile])};
  const [tile]=next.hands[player].splice(index,1);next.discards[player].push(tile);next.turn=(player+1)%next.hands.length;next.drawn=false;next.pendingDiscard={player,tile};
  return next;
}

export function mahjongChiOptions(state, player) {
  const pending = state.pendingDiscard;
  if (!pending || player !== (pending.player + 1) % state.hands.length || pending.tile.suit === "字") return [];
  const tile = pending.tile, hand = state.hands[player] || [], options = [], seen = new Set();
  [[tile.rank - 2, tile.rank - 1], [tile.rank - 1, tile.rank + 1], [tile.rank + 1, tile.rank + 2]].forEach((ranks) => {
    if (ranks.some((rank) => rank < 1 || rank > 9)) return;
    const choices = ranks.map((rank) => hand.filter((item) => item.suit === tile.suit && item.rank === rank));
    if (choices.some((list) => !list.length)) return;
    choices[0].forEach((first) => choices[1].forEach((second) => {
      const ids = [first.id, second.id].sort(); const token = ids.join(",");
      if (!seen.has(token)) { seen.add(token); options.push({ ids, tiles: [first, tile, second].sort((a, b) => a.rank - b.rank) }); }
    }));
  });
  return options;
}

export function passMahjongClaim(state, player) {
  if (!state.pendingDiscard || state.turn !== player) return state;
  return { ...state, pendingDiscard: null };
}

export function claimMahjongChi(state, player, ids) {
  const option = mahjongChiOptions(state, player).find((item) => item.ids.join(",") === [...ids].sort().join(","));
  if (!option || state.winner !== null) return state;
  const pending = state.pendingDiscard;
  const next = { ...state, hands: state.hands.map((hand) => [...hand]), discards: state.discards.map((pile) => [...pile]), openMelds: state.openMelds.map((melds) => [...melds]) };
  next.hands[player] = sortMahjongHand(next.hands[player].filter((tile) => !option.ids.includes(tile.id)));
  next.discards[pending.player].pop();
  next.openMelds[player].push(option.tiles);
  next.pendingDiscard = null; next.turn = player; next.drawn = true;
  return next;
}
