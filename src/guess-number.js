function randomCode() {
  const digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  for (let index = digits.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [digits[index], digits[swap]] = [digits[swap], digits[index]];
  }
  return digits.slice(0, 4).join("");
}

export function scoreGuess(secret, guess) {
  const exact = [...guess].filter((digit, index) => secret[index] === digit).length;
  const misplaced = [...guess].filter((digit, index) => secret.includes(digit) && secret[index] !== digit).length;
  return { exact, misplaced };
}

export function validGuess(value) {
  return /^\d{4}$/.test(value) && new Set(value).size === 4;
}

export function createGuessNumberState(total = 2) {
  return { game: "guess", total, secret: randomCode(), turn: 0, attempts: Array.from({ length: total }, () => []), winner: null, round: 1 };
}

export function submitGuess(state, player, value) {
  const guess = String(value || "").trim();
  if (state.winner !== null || state.turn !== player || !validGuess(guess)) return state;
  const result = scoreGuess(state.secret, guess);
  const attempts = state.attempts.map((list) => [...list]);
  attempts[player].push({ guess, ...result });
  return { ...state, attempts, winner: result.exact === 4 ? player : null, turn: result.exact === 4 ? player : (player + 1) % state.total };
}

export function chooseGuess(state, player) {
  const used = new Set((state.attempts[player] || []).map((item) => item.guess));
  let candidate = "";
  do { candidate = randomCode(); } while (used.has(candidate) && used.size < 5_000);
  return candidate;
}
