// UI: the score and time bar above the court (plain HTML, not drawn on the canvas).

const Ui = (() => {
  const el = {
    score: document.getElementById('score'),
    time: document.getElementById('time'),
  };

  function updateHud() {
    el.score.textContent = GameState.score;
    const secs = Math.ceil(GameState.timeLeft);
    el.time.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  }

  return { updateHud };
})();
