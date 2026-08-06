const SUITS=["♦","♣","♥","♠"];
const RANKS=["3","4","5","6","7","8","9","10","J","Q","K","A","2"];
export function createDeck(){const deck=[];RANKS.forEach((rank,r)=>SUITS.forEach((suit,s)=>deck.push({id:`${rank}${suit}`,rank,suit,value:r,suitValue:s})));for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}return deck;}
export const sortCards=(cards)=>[...cards].sort((a,b)=>a.value-b.value||a.suitValue-b.suitValue);
export function dealBigTwo(players=4){const deck=createDeck(),hands=Array.from({length:players},()=>[]);while(deck.length%players){let index=deck.length-1;if(deck[index].rank==="3"&&deck[index].suit==="♣")index--;deck.splice(index,1);}deck.forEach((card,index)=>hands[index%players].push(card));hands.forEach((hand,index)=>hands[index]=sortCards(hand));let turn=0;hands.forEach((hand,index)=>{if(hand.some((card)=>card.rank==="3"&&card.suit==="♣"))turn=index;});return{hands,turn,leader:turn,lastPlay:null,passes:0,winner:null,history:[],firstTrick:true};}
function highest(cards){return [...cards].sort((a,b)=>b.value-a.value||b.suitValue-a.suitValue)[0];}
function straightHigh(values){const unique=[...new Set(values)].sort((a,b)=>a-b);if(unique.length!==5||unique.includes(12))return null;if(unique[4]-unique[0]===4)return unique[4];return null;}
export function classifyBigTwo(cards){
  if(!cards.length)return null;const sorted=sortCards(cards),counts=new Map();sorted.forEach((c)=>counts.set(c.value,(counts.get(c.value)||0)+1));const groups=[...counts.entries()].sort((a,b)=>b[1]-a[1]||b[0]-a[0]);
  if(cards.length===1)return{size:1,type:1,score:highest(cards).value*4+highest(cards).suitValue};
  if(cards.length===2&&groups[0][1]===2)return{size:2,type:1,score:groups[0][0]*4+highest(cards).suitValue};
  if(cards.length===3&&groups[0][1]===3)return{size:3,type:1,score:groups[0][0]};
  if(cards.length!==5)return null;
  const flush=new Set(cards.map((c)=>c.suit)).size===1,straight=straightHigh(cards.map((c)=>c.value));
  if(straight!==null&&flush)return{size:5,type:5,score:straight*4+highest(cards.filter((c)=>c.value===straight)).suitValue};
  if(groups[0][1]===4)return{size:5,type:4,score:groups[0][0]};
  if(groups[0][1]===3&&groups[1][1]===2)return{size:5,type:3,score:groups[0][0]};
  if(flush)return{size:5,type:2,score:highest(cards).value*4+highest(cards).suitValue};
  if(straight!==null)return{size:5,type:1,score:straight*4+highest(cards.filter((c)=>c.value===straight)).suitValue};
  return null;
}
export function canPlayBigTwo(cards,lastPlay,firstTrick=false){const combo=classifyBigTwo(cards);if(!combo)return false;if(firstTrick&&!cards.some((c)=>c.rank==="3"&&c.suit==="♣"))return false;if(!lastPlay)return true;const previous=classifyBigTwo(lastPlay.cards);return combo.size===previous.size&&(combo.type>previous.type||(combo.type===previous.type&&combo.score>previous.score));}
export function playBigTwo(state,player,cardIds){
  if(state.winner!==null||state.turn!==player)return state;const cards=state.hands[player].filter((card)=>cardIds.includes(card.id));if(!canPlayBigTwo(cards,state.lastPlay,state.firstTrick))return state;
  const next={...state,hands:state.hands.map((hand)=>[...hand]),history:[...state.history]};next.hands[player]=next.hands[player].filter((card)=>!cardIds.includes(card.id));next.lastPlay={player,cards};next.history.push(next.lastPlay);next.leader=player;next.passes=0;next.firstTrick=false;if(!next.hands[player].length)next.winner=player;else next.turn=(player+1)%next.hands.length;return next;
}
export function passBigTwo(state,player){if(state.turn!==player||!state.lastPlay||state.leader===player)return state;const next={...state,passes:state.passes+1};next.turn=(player+1)%state.hands.length;if(next.passes>=state.hands.length-1){next.turn=next.leader;next.lastPlay=null;next.passes=0;}return next;}
function combinations(cards,size,start=0,prefix=[],out=[]){if(prefix.length===size){out.push(prefix);return out;}for(let i=start;i<cards.length;i++)combinations(cards,size,i+1,[...prefix,cards[i]],out);return out;}
export function chooseBigTwoPlay(state,player){const hand=state.hands[player];const sizes=state.lastPlay?[state.lastPlay.cards.length]:[1,2,3,5];for(const size of sizes){for(const cards of combinations(hand,size).sort((a,b)=>(classifyBigTwo(a)?.score||0)-(classifyBigTwo(b)?.score||0)))if(canPlayBigTwo(cards,state.lastPlay,state.firstTrick))return cards.map((c)=>c.id);}return null;}
