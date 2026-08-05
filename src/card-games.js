const SUITS = ["♦", "♣", "♥", "♠"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function createCardDeck() {
  const cards = [];
  RANKS.forEach((rank, value) => SUITS.forEach((suit, suitValue) => cards.push({ id: `${rank}${suit}`, rank, suit, value: value + 1, suitValue })));
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function blackjackScore(hand) {
  let total = 0, aces = 0;
  hand.forEach((card) => { if (card.rank === "A") { total += 11; aces += 1; } else total += ["J","Q","K"].includes(card.rank) ? 10 : Number(card.rank); });
  while (total > 21 && aces) { total -= 10; aces -= 1; }
  return { total, soft: aces > 0 };
}

export function createBlackjackState(players = 3) {
  const deck = createCardDeck(), hands = Array.from({ length: players }, () => []), dealer = [];
  for (let round = 0; round < 2; round += 1) { hands.forEach((hand) => hand.push(deck.pop())); dealer.push(deck.pop()); }
  return { deck, hands, dealer, statuses: Array(players).fill("playing"), turn: 0, phase: "players", results: null, winner: null };
}

export function hitBlackjack(state, player) {
  if (state.phase !== "players" || state.turn !== player || state.statuses[player] !== "playing" || !state.deck.length) return state;
  const next = { ...state, deck: [...state.deck], hands: state.hands.map((hand) => [...hand]), statuses: [...state.statuses] };
  next.hands[player].push(next.deck.pop());
  const score = blackjackScore(next.hands[player]).total;
  if (score >= 21) next.statuses[player] = score === 21 ? "stand" : "bust";
  return next;
}

export function standBlackjack(state, player) {
  if (state.phase !== "players" || state.turn !== player) return state;
  const next = { ...state, statuses: [...state.statuses] };
  if (next.statuses[player] === "playing") next.statuses[player] = "stand";
  next.turn += 1;
  if (next.turn >= next.hands.length) next.phase = "dealer";
  return next;
}

export function settleBlackjack(state) {
  if (state.phase !== "dealer") return state;
  const next = { ...state, deck: [...state.deck], dealer: [...state.dealer] };
  while (blackjackScore(next.dealer).total < 17 && next.deck.length) next.dealer.push(next.deck.pop());
  const dealer = blackjackScore(next.dealer).total;
  next.results = next.hands.map((hand) => {
    const score = blackjackScore(hand).total;
    if (score > 21) return "lose";
    if (dealer > 21 || score > dealer) return "win";
    if (score === dealer) return "push";
    return "lose";
  });
  next.phase = "finished";
  const winners = next.results.map((result,index) => result === "win" ? index : -1).filter((index) => index >= 0);
  next.winner = winners.length ? winners : dealer <= 21 ? ["dealer"] : [];
  return next;
}

export function runBlackjackAiTurn(state) {
  let next = state;
  const player = next.turn;
  while (next.phase === "players" && blackjackScore(next.hands[player]).total < 17) next = hitBlackjack(next, player);
  return standBlackjack(next, player);
}

function equalDeal(deck, players, reserved = 0) {
  const hands = Array.from({ length: players }, () => []), usable = deck.length - reserved, count = Math.floor(usable / players);
  for (let round = 0; round < count; round += 1) hands.forEach((hand) => hand.push(deck.pop()));
  return hands;
}

export function pickRedValue(card) {
  if (!["♦","♥"].includes(card.suit)) return 0;
  if (card.rank === "A") return 20;
  if (["J","Q","K"].includes(card.rank)) return 10;
  return Number(card.rank);
}

export function pickRedMatches(card, table) {
  return table.filter((target) => {
    if (["J","Q","K"].includes(card.rank)) return target.rank === card.rank;
    const value = card.rank === "A" ? 1 : Number(card.rank);
    const targetValue = target.rank === "A" ? 1 : Number(target.rank);
    return Number.isFinite(targetValue) && value + targetValue === 10;
  });
}

export function createPickRedState(players = 3) {
  const deck = createCardDeck(), table = Array.from({ length: 4 }, () => deck.pop()), hands = equalDeal(deck, players);
  return { hands, table, captures: Array.from({ length: players }, () => []), turn: 0, winner: null, scores: null, leftover: deck };
}

export function playPickRed(state, player, cardId, targetId = null) {
  if (state.winner !== null || state.turn !== player) return state;
  const hand = state.hands[player], card = hand.find((item) => item.id === cardId);
  if (!card) return state;
  const matches = pickRedMatches(card, state.table);
  const target = matches.find((item) => item.id === targetId) || (matches.length === 1 ? matches[0] : null);
  if (matches.length > 1 && !target) return state;
  const next = { ...state, hands: state.hands.map((items) => [...items]), table: [...state.table], captures: state.captures.map((items) => [...items]) };
  next.hands[player] = next.hands[player].filter((item) => item.id !== cardId);
  if (target) { next.table = next.table.filter((item) => item.id !== target.id); next.captures[player].push(card, target); }
  else next.table.push(card);
  if (next.hands.every((items) => !items.length)) {
    next.scores = next.captures.map((items) => items.reduce((sum,item) => sum + pickRedValue(item),0));
    const high = Math.max(...next.scores); next.winner = next.scores.findIndex((score) => score === high);
  } else next.turn = (player + 1) % next.hands.length;
  return next;
}

export function choosePickRedPlay(state, player) {
  const choices = state.hands[player].flatMap((card) => {
    const matches = pickRedMatches(card,state.table);
    return matches.length ? matches.map((target) => ({ cardId: card.id, targetId: target.id, score: pickRedValue(card)+pickRedValue(target) })) : [{ cardId: card.id, targetId: null, score: -pickRedValue(card) }];
  });
  return choices.sort((a,b) => b.score-a.score)[0];
}

export function ninetyNineOptions(card, total) {
  let options;
  if (card.rank === "A") options = [1,11];
  else if (card.rank === "4" || card.rank === "J") options = [0];
  else if (card.rank === "10") options = [10,-10];
  else if (card.rank === "Q") options = [20,-20];
  else if (card.rank === "K") return total <= 99 ? [{ total: 99, effect: "set" }] : [];
  else options = [Number(card.rank)];
  return options.map((amount) => ({ total: total + amount, effect: card.rank === "4" ? "reverse" : card.rank === "J" ? "skip" : "add", amount })).filter((option) => option.total >= 0 && option.total <= 99);
}

export function createNinetyNineState(players = 3) {
  const deck = createCardDeck(), hands = Array.from({length:players},()=>[]);
  for (let round=0;round<5;round+=1) hands.forEach((hand)=>hand.push(deck.pop()));
  return { deck, hands, total: 0, turn: 0, direction: 1, alive: Array(players).fill(true), winner: null, lastPlay: null };
}

function nextAlive(state, from, steps = 1) {
  let current = from;
  while (steps > 0) { current = (current + state.direction + state.hands.length) % state.hands.length; if (state.alive[current]) steps -= 1; }
  return current;
}

export function legalNinetyNinePlays(state, player = state.turn) {
  return state.hands[player].flatMap((card) => ninetyNineOptions(card,state.total).map((option) => ({ cardId:card.id,...option })));
}

export function playNinetyNine(state, player, cardId, amount) {
  if (state.winner !== null || state.turn !== player) return state;
  const card = state.hands[player].find((item)=>item.id===cardId), options = card ? ninetyNineOptions(card,state.total) : [];
  if (!options.length) return state;
  const option = options.find((item) => item.amount === amount) || options.sort((a,b)=>a.total-b.total)[0];
  const next = { ...state, deck:[...state.deck], hands:state.hands.map((items)=>[...items]), alive:[...state.alive], total:option.total, lastPlay:{player,card,option} };
  next.hands[player]=next.hands[player].filter((item)=>item.id!==cardId);
  if(next.deck.length) next.hands[player].push(next.deck.pop());
  if(option.effect==="reverse") next.direction*=-1;
  next.turn=nextAlive(next,player,option.effect==="skip"?2:1);
  let guard=0;
  while(!legalNinetyNinePlays(next,next.turn).length&&next.alive.filter(Boolean).length>1&&guard<next.alive.length){next.alive[next.turn]=false;next.turn=nextAlive(next,next.turn);guard+=1;}
  if(next.alive.filter(Boolean).length===1) next.winner=next.alive.findIndex(Boolean);
  return next;
}

export function chooseNinetyNinePlay(state, player) {
  const plays=legalNinetyNinePlays(state,player);
  return plays.sort((a,b)=>a.total-b.total)[0]||null;
}
