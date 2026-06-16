window.initNeonPinball = function(canvas, onGameOver, onScoreUpdate) {
  const ctx = canvas.getContext('2d');
  const W = 640, H = 480;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = '100%'; canvas.style.height = '100%';
  ctx.scale(dpr, dpr);

  let active = true, score = 0, lives = 3, frame = 0;
  let particles = [], multiplier = 1, multTimer = 0;
  let leftFlipper = false, rightFlipper = false;

  // Flippers
  const FL = { x: W / 2 - 80, y: H - 55, len: 70, angle: 0.42, open: 0.42, closed: -0.18, dir: 1 };
  const FR = { x: W / 2 + 80, y: H - 55, len: 70, angle: Math.PI - 0.42, open: Math.PI - 0.42, closed: Math.PI + 0.18, dir: -1 };

  // Ball
  const ball = { x: W - 28, y: H / 2, vx: -2, vy: -3, r: 10 };
  const GRAVITY = 0.22;

  // Bumpers
  const bumpers = [
    { x: W / 2, y: 130, r: 28, color: '#ff007f', hits: 0 },
    { x: W / 2 - 110, y: 200, r: 22, color: '#00f0ff', hits: 0 },
    { x: W / 2 + 110, y: 200, r: 22, color: '#b026ff', hits: 0 },
    { x: W / 2 - 60, y: 290, r: 18, color: '#ffea00', hits: 0 },
    { x: W / 2 + 60, y: 290, r: 18, color: '#39ff14', hits: 0 },
  ];

  // Walls
  const WALL_L = 58, WALL_R = W - 58;

  // Side launchers
  const targets = [
    { x: 90, y: 130, w: 14, h: 50, color: '#ff007f', lit: 0, value: 100 },
    { x: 90, y: 220, w: 14, h: 50, color: '#00f0ff', lit: 0, value: 150 },
    { x: W - 90, y: 130, w: 14, h: 50, color: '#b026ff', lit: 0, value: 100 },
    { x: W - 90, y: 220, w: 14, h: 50, color: '#ffea00', lit: 0, value: 150 },
  ];

  function emit(x, y, col, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 4;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, alpha: 1, color: col, r: 2 + Math.random() * 3 });
    }
  }

  function flipperTip(f) {
    return { x: f.x + Math.cos(f.angle) * f.len, y: f.y + Math.sin(f.angle) * f.len };
  }

  function closestOnSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    return { x: ax + t * dx, y: ay + t * dy };
  }

  function checkFlipper(f) {
    const tip = flipperTip(f);
    const closest = closestOnSegment(ball.x, ball.y, f.x, f.y, tip.x, tip.y);
    const dx = ball.x - closest.x, dy = ball.y - closest.y;
    const dist = Math.hypot(dx, dy);
    if (dist < ball.r + 7) {
      const nx = dx / dist, ny = dy / dist;
      // Reflect + flipper velocity boost
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;
      const flipV = f.dir * ((f.angle - f.open) / (f.closed - f.open)) * 6;
      ball.vy -= Math.abs(flipV) * 0.8;
      ball.vx += flipV * 0.4;
      // Cap speed
      const spd = Math.hypot(ball.vx, ball.vy);
      if (spd > 14) { ball.vx = ball.vx / spd * 14; ball.vy = ball.vy / spd * 14; }
      ball.x = closest.x + nx * (ball.r + 8);
      ball.y = closest.y + ny * (ball.r + 8);
      if (window.audioManager) window.audioManager.playBlip();
    }
  }

  const keys = {};
  function onKeydown(e) {
    if (e.key === 'ArrowLeft' || e.key === 'z' || e.key === 'Z') leftFlipper = true;
    if (e.key === 'ArrowRight' || e.key === 'x' || e.key === 'X') rightFlipper = true;
    e.preventDefault();
  }
  function onKeyup(e) {
    if (e.key === 'ArrowLeft' || e.key === 'z' || e.key === 'Z') leftFlipper = false;
    if (e.key === 'ArrowRight' || e.key === 'x' || e.key === 'X') rightFlipper = false;
  }
  canvas.addEventListener('touchstart', (e) => {
    const rect = canvas.getBoundingClientRect();
    Array.from(e.touches).forEach(t => {
      const x = (t.clientX - rect.left) * (W / rect.width);
      if (x < W / 2) leftFlipper = true; else rightFlipper = true;
    });
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', () => { leftFlipper = false; rightFlipper = false; });
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('keyup', onKeyup);

  window.destroyNeonPinball = function() {
    active = false;
    window.removeEventListener('keydown', onKeydown);
    window.removeEventListener('keyup', onKeyup);
  };

  function resetBall() {
    ball.x = W - 28; ball.y = H / 3;
    ball.vx = -1.5 - Math.random(); ball.vy = 2 + Math.random();
  }

  function update() {
    frame++;
    if (multTimer > 0) { multTimer--; if (multTimer === 0) multiplier = 1; }

    // Flipper animation
    FL.angle += ((leftFlipper ? FL.closed : FL.open) - FL.angle) * 0.35;
    FR.angle += ((rightFlipper ? FR.closed : FR.open) - FR.angle) * 0.35;

    // Ball physics
    ball.vy += GRAVITY;
    ball.x += ball.vx; ball.y += ball.vy;

    // Wall bounces
    if (ball.x - ball.r < WALL_L) { ball.x = WALL_L + ball.r; ball.vx = Math.abs(ball.vx) * 0.9; }
    if (ball.x + ball.r > WALL_R) { ball.x = WALL_R - ball.r; ball.vx = -Math.abs(ball.vx) * 0.9; }
    if (ball.y - ball.r < 10) { ball.y = 10 + ball.r; ball.vy = Math.abs(ball.vy) * 0.85; }

    // Drain
    if (ball.y > H + 30) {
      lives--;
      emit(ball.x, H - 20, '#ff007f', 20);
      if (window.audioManager) window.audioManager.playExplosion();
      if (lives <= 0) { active = false; if (onGameOver) onGameOver(score); return; }
      resetBall(); multiplier = 1;
    }

    // Bumpers
    bumpers.forEach(b => {
      const dx = ball.x - b.x, dy = ball.y - b.y, dist = Math.hypot(dx, dy);
      if (dist < ball.r + b.r) {
        const nx = dx / dist, ny = dy / dist;
        ball.vx = nx * 8; ball.vy = ny * 8;
        ball.x = b.x + nx * (ball.r + b.r + 1);
        ball.y = b.y + ny * (ball.r + b.r + 1);
        b.hits++; b.flash = 12;
        const pts = 50 * multiplier;
        score += pts; if (onScoreUpdate) onScoreUpdate(score);
        emit(b.x, b.y, b.color, 8);
        if (window.audioManager) window.audioManager.playScore();
        // Every 5 bumper hits → multiplier boost
        if (b.hits % 5 === 0) { multiplier = Math.min(8, multiplier + 1); multTimer = 300; }
      }
      if (b.flash > 0) b.flash--;
    });

    // Side targets
    targets.forEach(t => {
      if (ball.x > t.x - t.w / 2 && ball.x < t.x + t.w / 2 &&
          ball.y > t.y && ball.y < t.y + t.h) {
        ball.vx = -ball.vx * 1.1;
        if (ball.x < W / 2) ball.vx = Math.abs(ball.vx);
        else ball.vx = -Math.abs(ball.vx);
        t.lit = 20;
        const pts = t.value * multiplier;
        score += pts; if (onScoreUpdate) onScoreUpdate(score);
        emit(t.x, t.y + t.h / 2, t.color, 10);
        if (window.audioManager) window.audioManager.playBlip();
      }
      if (t.lit > 0) t.lit--;
    });

    // Flippers
    checkFlipper(FL); checkFlipper(FR);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.alpha -= 0.03;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  function drawFlipper(f, col) {
    const tip = flipperTip(f);
    ctx.save();
    ctx.shadowBlur = 16; ctx.shadowColor = col;
    ctx.strokeStyle = col; ctx.lineWidth = 12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    ctx.restore();
  }

  function render() {
    ctx.fillStyle = '#05050f'; ctx.fillRect(0, 0, W, H);

    // Guide walls
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(WALL_L, 0); ctx.lineTo(WALL_L, H - 90);
    ctx.lineTo(FL.x - 8, FL.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(WALL_R, 0); ctx.lineTo(WALL_R, H - 90);
    ctx.lineTo(FR.x + 8, FR.y); ctx.stroke();

    // Drain zone tint
    ctx.fillStyle = 'rgba(255,0,60,0.04)';
    ctx.fillRect(WALL_L, H - 55, WALL_R - WALL_L, 55);

    // Targets
    targets.forEach(t => {
      ctx.shadowBlur = t.lit > 0 ? 20 : 6; ctx.shadowColor = t.color;
      ctx.fillStyle = t.lit > 0 ? t.color : `rgba(${hexRgb(t.color)},0.3)`;
      ctx.beginPath(); ctx.roundRect(t.x - t.w / 2, t.y, t.w, t.h, 4); ctx.fill();
    });

    // Bumpers
    bumpers.forEach(b => {
      const lit = b.flash > 0;
      ctx.shadowBlur = lit ? 28 : 14; ctx.shadowColor = b.color;
      // Outer ring
      ctx.strokeStyle = b.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
      // Inner fill
      ctx.fillStyle = lit ? b.color : `rgba(${hexRgb(b.color)},0.2)`;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 4, 0, Math.PI * 2); ctx.fill();
    });

    // Flippers
    drawFlipper(FL, '#00f0ff');
    drawFlipper(FR, '#ff007f');

    // Pivot points
    [FL, FR].forEach((f, idx) => {
      ctx.fillStyle = idx === 0 ? '#00f0ff' : '#ff007f';
      ctx.shadowBlur = 8; ctx.shadowColor = ctx.fillStyle;
      ctx.beginPath(); ctx.arc(f.x, f.y, 7, 0, Math.PI * 2); ctx.fill();
    });

    // Ball
    ctx.shadowBlur = 22; ctx.shadowColor = '#fff';
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Particles
    particles.forEach(p => {
      ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.shadowBlur = 7; ctx.shadowColor = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;

    // HUD
    ctx.fillStyle = '#fff'; ctx.font = "bold 20px 'Space Grotesk',sans-serif"; ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${score}`, 12, 26);
    if (multiplier > 1) {
      ctx.fillStyle = '#ffea00'; ctx.shadowBlur = 12; ctx.shadowColor = '#ffea00';
      ctx.font = "bold 16px 'Space Grotesk',sans-serif";
      ctx.fillText(`✕ ${multiplier} MULTI!`, 12, 46);
      ctx.shadowBlur = 0;
    }
    for (let l = 0; l < 3; l++) {
      ctx.globalAlpha = l < lives ? 1 : 0.15; ctx.font = '17px sans-serif';
      ctx.fillText('🔮', 12 + l * 24, H - 10);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'right'; ctx.font = "12px 'Space Grotesk',sans-serif";
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('Z/← LEFT FLIP  X/→ RIGHT FLIP  TOUCH SIDES', W - 10, H - 10);
  }

  function hexRgb(h) {
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }

  function loop() { if (!active) return; update(); render(); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
};
