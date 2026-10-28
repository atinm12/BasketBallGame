// Buzzer Beater — top-down basketball shooting game.
// All game positions are in feet on a regulation 94 x 50 ft court.

const FT = 11;            // pixels per foot
const MARGIN = 24;        // out-of-bounds border in pixels
const COURT_W = 94;
const COURT_H = 50;
const HALF_X = COURT_W / 2;

const HOOP = { x: 5.25, y: 25 };
const ARC_R = 23.75;      // three-point arc radius
const CORNER = 22;        // corner three distance
const CORNER_X = HOOP.x + Math.sqrt(ARC_R ** 2 - CORNER ** 2);

const ZONES = {
  2: { points: 2, duration: 3.0, color: '#5fd17a' },
  3: { points: 3, duration: 1.5, color: '#4fb3ff' },
  4: { points: 4, duration: 0.5, color: '#ff6bd5' },
};

const TARGET = 0.9;       // target line on the meter
const MAKE_MIN = 0.85;    // make window: 85%-95% inclusive (+/- 5% of target)
const MAKE_MAX = 0.95;
const ROUND_SECONDS = 60;
const PLAYER_R = 1.3;

const canvas = document.getElementById('court');
canvas.width = COURT_W * FT + MARGIN * 2;
canvas.height = COURT_H * FT + MARGIN * 2;
const ctx = canvas.getContext('2d');

const el = {
  score: document.getElementById('score'),
  time: document.getElementById('time'),
  high: document.getElementById('high'),
  start: document.getElementById('start-screen'),
  over: document.getElementById('over-screen'),
  finalScore: document.getElementById('final-score'),
  finalHigh: document.getElementById('final-high'),
};

const game = {
  state: 'READY',         // READY | MOVE | METER | FLIGHT | OVER
  score: 0,
  high: 0,                // session high score (resets on reload)
  timeLeft: ROUND_SECONDS,
  player: { x: 30, y: 25 },
  mouse: { x: 30, y: 25 },
  meter: null,
  ball: null,
  flash: null,
  effects: [],
};

// ---------- helpers ----------

const px = ft => MARGIN + ft * FT;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function getZone(x, y) {
  if (x > HALF_X) return ZONES[4];
  const dx = x - HOOP.x;
  const dy = y - HOOP.y;
  if (x <= CORNER_X) return Math.abs(dy) >= CORNER ? ZONES[3] : ZONES[2];
  return Math.hypot(dx, dy) >= ARC_R ? ZONES[3] : ZONES[2];
}

function facingAngle(p) {
  return Math.atan2(HOOP.y - p.y, HOOP.x - p.x);
}

function handPosition(p) {
  const a = facingAngle(p);
  return {
    x: p.x + Math.cos(a) * 1.1 - Math.sin(a) * 0.7,
    y: p.y + Math.sin(a) * 1.1 + Math.cos(a) * 0.7,
  };
}

function mouseToFeet(e) {
  const r = canvas.getBoundingClientRect();
  const cx = (e.clientX - r.left) * (canvas.width / r.width);
  const cy = (e.clientY - r.top) * (canvas.height / r.height);
  return { x: (cx - MARGIN) / FT, y: (cy - MARGIN) / FT };
}

// ---------- round flow ----------

function startRound() {
  game.state = 'MOVE';
  game.score = 0;
  game.timeLeft = ROUND_SECONDS;
  game.meter = null;
  game.ball = null;
  game.flash = null;
  game.effects = [];
  el.start.classList.add('hidden');
  el.over.classList.add('hidden');
}

function endRound() {
  game.state = 'OVER';
  game.meter = null;
  game.ball = null;
  game.high = Math.max(game.high, game.score);

  el.finalScore.textContent = game.score;
  el.finalHigh.textContent = game.high;
  el.over.classList.remove('hidden');
}

function startMeter() {
  game.state = 'METER';
  game.meter = {
    zone: getZone(game.player.x, game.player.y),
    start: performance.now(),
    stopped: null,
  };
}

function shoot(fill) {
  const m = game.meter;
  m.stopped = fill;
  const off = fill - TARGET;
  const made = fill >= MAKE_MIN && fill <= MAKE_MAX;
  if (made) game.score += m.zone.points;

  const start = handPosition(game.player);
  const dist = Math.hypot(HOOP.x - start.x, HOOP.y - start.y);
  let end = { x: HOOP.x, y: HOOP.y };
  if (!made) {
    // Early shots clank off the front rim, late shots off the back
    const a = Math.atan2(start.y - HOOP.y, start.x - HOOP.x) + (Math.random() - 0.5) * 0.8;
    const r = off < 0 ? 0.85 : -0.85;
    end = { x: HOOP.x + Math.cos(a) * r, y: HOOP.y + Math.sin(a) * r };
  }

  game.ball = {
    sx: start.x, sy: start.y, ex: end.x, ey: end.y,
    t: 0,
    dur: 0.45 + dist * 0.011,
    peak: clamp(dist / 20, 0.4, 1.6),
    made, points: m.zone.points,
  };
  game.state = 'FLIGHT';
}

function landBall() {
  const b = game.ball;
  if (b.made) {
    game.flash = { text: `MAKE +${b.points}`, color: '#ffd23f', t: 0 };
    game.effects.push({ type: 'drop', t: 0, dur: 0.35 });
  } else {
    game.flash = { text: 'MISS', color: '#ff5a4f', t: 0 };
    // Bounce away from the rim
    const a = Math.atan2(b.ey - HOOP.y, b.ex - HOOP.x) + (Math.random() - 0.5) * 1.2;
    game.effects.push({
      type: 'bounce', t: 0, dur: 0.6,
      x: b.ex, y: b.ey, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9,
    });
  }
  game.ball = null;
  game.meter = null;
  game.state = 'MOVE';
}

// ---------- input ----------

canvas.addEventListener('mousemove', e => {
  const p = mouseToFeet(e);
  game.mouse.x = p.x;
  game.mouse.y = p.y;
});

canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  if (game.state === 'MOVE') {
    startMeter();
  } else if (game.state === 'METER') {
    const fill = (performance.now() - game.meter.start) / (game.meter.zone.duration * 1000);
    shoot(Math.min(fill, 1));
  }
});

document.getElementById('start-btn').addEventListener('click', startRound);
document.getElementById('again-btn').addEventListener('click', startRound);

// ---------- update ----------

function update(dt, now) {
  const playing = game.state === 'MOVE' || game.state === 'METER' || game.state === 'FLIGHT';
  if (playing) {
    game.timeLeft -= dt;
    if (game.timeLeft <= 0) {
      game.timeLeft = 0;
      endRound();
    }
  }

  if (game.state === 'MOVE') {
    const tx = clamp(game.mouse.x, PLAYER_R, COURT_W - PLAYER_R);
    const ty = clamp(game.mouse.y, PLAYER_R, COURT_H - PLAYER_R);
    const k = Math.min(1, dt * 14);
    game.player.x += (tx - game.player.x) * k;
    game.player.y += (ty - game.player.y) * k;
  } else if (game.state === 'METER') {
    const fill = (now - game.meter.start) / (game.meter.zone.duration * 1000);
    if (fill >= 1) shoot(1);
  } else if (game.state === 'FLIGHT') {
    game.ball.t += dt;
    if (game.ball.t >= game.ball.dur) landBall();
  }

  if (game.flash) {
    game.flash.t += dt;
    if (game.flash.t > 1.2) game.flash = null;
  }
  for (const fx of game.effects) {
    fx.t += dt;
    if (fx.type === 'bounce') {
      fx.x += fx.vx * dt;
      fx.y += fx.vy * dt;
      fx.vx *= 0.96;
      fx.vy *= 0.96;
    }
  }
  game.effects = game.effects.filter(fx => fx.t < fx.dur);
}

// ---------- rendering ----------

function drawCourt() {
  ctx.fillStyle = '#23262e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Hardwood floor with planks
  ctx.fillStyle = '#d8a368';
  ctx.fillRect(px(0), px(0), COURT_W * FT, COURT_H * FT);
  ctx.strokeStyle = 'rgba(90, 50, 20, 0.12)';
  ctx.lineWidth = 1;
  for (let y = 0; y <= COURT_H; y += 1.5) {
    ctx.beginPath();
    ctx.moveTo(px(0), px(y));
    ctx.lineTo(px(COURT_W), px(y));
    ctx.stroke();
    const offset = (y * 7.3) % 12;
    for (let x = offset; x < COURT_W; x += 12) {
      ctx.beginPath();
      ctx.moveTo(px(x), px(y));
      ctx.lineTo(px(x), px(Math.min(y + 1.5, COURT_H)));
      ctx.stroke();
    }
  }

  drawHalf(false);
  drawHalf(true);

  // Center line and circle
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(px(HALF_X), px(0));
  ctx.lineTo(px(HALF_X), px(COURT_H));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px(HALF_X), px(25), 6 * FT, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeRect(px(0), px(0), COURT_W * FT, COURT_H * FT);
}

function drawHalf(mirrored) {
  ctx.save();
  ctx.translate(MARGIN, MARGIN);
  ctx.scale(FT, FT);
  if (mirrored) {
    ctx.translate(COURT_W, 0);
    ctx.scale(-1, 1);
  }
  ctx.lineWidth = 2.5 / FT;
  ctx.strokeStyle = '#fff';

  // Paint
  ctx.fillStyle = mirrored ? 'rgba(170, 60, 40, 0.35)' : 'rgba(170, 60, 40, 0.75)';
  ctx.fillRect(0, 17, 19, 16);
  ctx.strokeRect(0, 17, 19, 16);

  // Free-throw circle (solid outside, dashed inside the key)
  ctx.beginPath();
  ctx.arc(19, 25, 6, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.setLineDash([1, 1]);
  ctx.beginPath();
  ctx.arc(19, 25, 6, Math.PI / 2, Math.PI * 1.5);
  ctx.stroke();
  ctx.setLineDash([]);

  // Restricted area
  ctx.beginPath();
  ctx.arc(HOOP.x, HOOP.y, 4, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  // Three-point line
  const theta = Math.asin(CORNER / ARC_R);
  ctx.beginPath();
  ctx.moveTo(0, HOOP.y - CORNER);
  ctx.lineTo(CORNER_X, HOOP.y - CORNER);
  ctx.arc(HOOP.x, HOOP.y, ARC_R, -theta, theta);
  ctx.lineTo(0, HOOP.y + CORNER);
  ctx.stroke();

  // Backboard and rim (the far hoop is dimmed since it's inactive)
  ctx.globalAlpha = mirrored ? 0.4 : 1;
  ctx.lineWidth = 5 / FT;
  ctx.beginPath();
  ctx.moveTo(4, 22);
  ctx.lineTo(4, 28);
  ctx.stroke();
  ctx.lineWidth = 2 / FT;
  ctx.beginPath();
  ctx.moveTo(4, 25);
  ctx.lineTo(HOOP.x - 0.75, 25);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.arc(HOOP.x, HOOP.y, 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff5a1f';
  ctx.lineWidth = 3.5 / FT;
  ctx.stroke();
  ctx.restore();
}

function drawBall(x, y, height) {
  // Shadow on the floor, ball raised and enlarged by its height
  const r = 0.62 * FT;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(px(x), px(y), r, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  const bx = px(x);
  const by = px(y) - height * 1.2 * FT;
  const br = r * (1 + height * 0.35);
  ctx.fillStyle = '#ef7a1f';
  ctx.beginPath();
  ctx.arc(bx, by, br, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4a2208';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx - br, by);
  ctx.lineTo(bx + br, by);
  ctx.moveTo(bx, by - br);
  ctx.lineTo(bx, by + br);
  ctx.stroke();
}

function drawPlayer() {
  const p = game.player;
  const a = facingAngle(p);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.arc(px(p.x) + 3, px(p.y) + 4, PLAYER_R * FT, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(px(p.x), px(p.y));
  ctx.rotate(a);

  // Shoulders / jersey
  ctx.fillStyle = '#1e4fd8';
  ctx.strokeStyle = '#0d2a7a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.75 * FT, PLAYER_R * FT, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Arms reaching toward the hoop
  ctx.strokeStyle = '#8d5a3b';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0.2 * FT, -1.0 * FT);
  ctx.lineTo(1.0 * FT, -0.4 * FT);
  ctx.moveTo(0.2 * FT, 1.0 * FT);
  ctx.lineTo(1.0 * FT, 0.6 * FT);
  ctx.stroke();

  // Head
  ctx.fillStyle = '#6b4128';
  ctx.beginPath();
  ctx.arc(0, 0, 0.55 * FT, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Ball in hand when not shooting
  if (game.state !== 'FLIGHT') {
    const h = handPosition(p);
    drawBall(h.x, h.y, 0.15);
  }
}

function drawMeter(now) {
  const m = game.meter;
  const fill = m.stopped !== null
    ? m.stopped
    : Math.min(1, (now - m.start) / (m.zone.duration * 1000));

  const W = 24, H = 150;
  let x = px(game.player.x) + PLAYER_R * FT + 18;
  if (x + W > canvas.width - 8) x = px(game.player.x) - PLAYER_R * FT - 18 - W;
  const y = clamp(px(game.player.y) - H / 2, 8, canvas.height - H - 8);

  // Frame
  ctx.fillStyle = 'rgba(15, 17, 22, 0.85)';
  ctx.beginPath();
  ctx.roundRect(x - 4, y - 4, W + 8, H + 8, 6);
  ctx.fill();

  ctx.fillStyle = '#2e333d';
  ctx.fillRect(x, y, W, H);

  // Fill from bottom to top
  ctx.fillStyle = m.zone.color;
  ctx.fillRect(x, y + H * (1 - fill), W, H * fill);

  // Target line at 90%
  const ty = y + H * (1 - TARGET);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - 5, ty - 1.5, W + 10, 3);

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, W, H);
}

function drawFlight() {
  const b = game.ball;
  const p = Math.min(1, b.t / b.dur);
  const x = b.sx + (b.ex - b.sx) * p;
  const y = b.sy + (b.ey - b.sy) * p;
  const h = 4 * p * (1 - p) * b.peak + 0.15 + p * 0.6;
  drawBall(x, y, h);
}

function drawEffects() {
  for (const fx of game.effects) {
    const p = fx.t / fx.dur;
    if (fx.type === 'drop') {
      // Ball sinking through the net
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = '#ef7a1f';
      ctx.beginPath();
      ctx.arc(px(HOOP.x), px(HOOP.y), 0.62 * FT * (1 - p * 0.6), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px(HOOP.x), px(HOOP.y), FT * (1 + p * 2.5), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (fx.type === 'bounce') {
      ctx.globalAlpha = 1 - p * 0.7;
      drawBall(fx.x, fx.y, 0.75 * (1 - p) + Math.abs(Math.sin(p * Math.PI * 2)) * 0.4);
      ctx.globalAlpha = 1;
    }
  }
}

function drawFlash() {
  const f = game.flash;
  const alpha = f.t < 0.9 ? 1 : 1 - (f.t - 0.9) / 0.3;
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const y = px(10) - f.t * 20;
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.strokeText(f.text, px(22), y);
  ctx.fillStyle = f.color;
  ctx.fillText(f.text, px(22), y);
  ctx.globalAlpha = 1;
}

function updateHud() {
  el.score.textContent = game.score;
  el.high.textContent = game.high;
  const secs = Math.ceil(game.timeLeft);
  el.time.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

function render(now) {
  drawCourt();
  drawEffects();
  drawPlayer();
  if (game.state === 'FLIGHT') drawFlight();
  if (game.meter) drawMeter(now);
  if (game.flash) drawFlash();
  updateHud();
}

// ---------- main loop ----------

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt, now);
  render(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
