// Game state: whether a round is in progress, the round timer, and the score.

const GameState = (() => {
  let phase = 'PLAYING';    // PLAYING | OVER
  let score = 0;
  let timeLeft = ROUND_SECONDS;

  function startRound() {
    phase = 'PLAYING';
    score = 0;
    timeLeft = ROUND_SECONDS;
  }

  // Counts the clock down. Returns true on the frame the round runs out of time.
  function tick(dt) {
    if (phase !== 'PLAYING') return false;
    timeLeft = Math.max(0, timeLeft - dt);
    if (timeLeft > 0) return false;
    phase = 'OVER';
    return true;
  }

  function addPoints(points) {
    score += points;
  }

  return {
    startRound,
    tick,
    addPoints,
    isPlaying: () => phase === 'PLAYING',
    get phase() { return phase; },
    get score() { return score; },
    get timeLeft() { return timeLeft; },
  };
})();
