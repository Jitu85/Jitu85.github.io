window.initNeonBreakout = function(canvas, onGameOver, onScoreUpdate) {
  const ctx = canvas.getContext('2d');
  const W = 640, H = 480;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  ctx.scale(dpr, dpr);

  let active = true, score = 0, lives = 3, level = 1, frame = 0;
  let mouseX = W / 2, launched = false;
  let particles = [], powerups = [], balls = [];
  let paddleBonus = 0, paddleBonusTimer = 0, speedMult = 1;

  const PADDLE = { w: 100, h: 12, x: W / 2, y: H - 38 };
  const COLS = 10, ROWS = 5;
  const BW = (W - 40) / COLS, BH = 22, GAP = 4;
  const BRICK_PALETTE = [
    { fill: '#ff007f', glow: '#ff007f', hp: 3 },
    { fill: '#b026ff', glow: '#b026ff', hp: 2 },
    { fill: '#00f0ff', glow: '#00f0ff', hp: 2 },
    { fill: '#39ff14', glow: '#39ff14', hp: 1 },
    { fill: '#ffea00', glow: '#ffea00', hp: 1 },
  ];
  const PU_TYPES = [
    { type: 'wide', color: '#00f0ff', label: 'W' },
    { type: 'multi', color: '#ffea00', label: 'M' },
    { type: 'slow',  color: '#39ff14', label: 'S' },
  ];

  let bricks = [];
  function buildLevel() {
    bricks = [];
    const rows = Math.min(ROWS + level - 1, 8);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        const pal = BRICK_PALETTE[Math.min(r, BRICK_PALETTE.length - 1)];
        const extra = Math.floor(level / 3);
        bricks.push({
          x: 20 + c * BW + GAP / 2, y: 58 + r * (BH + GAP),
          w: BW - GAP, h: BH,
          hp: pal.hp + extra, maxHp: pal.hp + extra,
          color: pal, alive: true, shake: 0
        });
      }
    }
  }
  buildLevel();

  function spawnBall() {
    balls.push({ x: PADDLE.x, y: PADDLE.y - 12, vx: (Math.random() - 0.5) * 4, vy: -5.5, r: 7, trail: [], launched: false });
  }
  spawnBall();

  function emit(x, y, col, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 4;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, alpha: 1, color: col, r: 2 + Math.random() * 3 });
    }
  }

  function onPointer(e) {
    const rect = canvas.getBoundingClientRect();
    mouseX = ((e.touches ? e.touches[0].clientX : e.clientX) - rect.left) * (W / rect.width);
    if (!launched && active) { launched = true; balls.forEach(b => b.launched = true); }
    e.preventDefault();
  }
  canvas.addEventListener('mousemove', onPointer);
  canvas.addEventListener('mousedown', onPointer);
  canvas.addEventListener('touchmove', onPointer, { passive: false });
  canvas.addEventListener('touchstart', onPointer, { passive: false });

  window.destroyNeonBreakout = function() {
    active = false;
    canvas.removeEventListener('mousemove', onPointer);
    canvas.removeEventListener('mousedown', onPointer);
    canvas.removeEventListener('touchmove', onPointer);
    canvas.removeEventListener('touchstart', onPointer);
  };

  function update() {
    frame++;
    const pw = PADDLE.w + paddleBonus;
    const tx = Math.max(pw / 2, Math.min(W - pw / 2, mouseX));
    PADDLE.x += (tx - PADDLE.x) * 0.28;
    if (paddleBonusTimer > 0) paddleBonusTimer--;
    else paddleBonus = Math.max(0, paddleBonus - 1.5);

    // Balls
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (!b.launched) { b.x = PADDLE.x; continue; }
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 14) b.trail.shift();
      b.x += b.vx * speedMult; b.y += b.vy * speedMult;

      if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); }
      if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); }
      if (b.y > H + 30) {
        balls.splice(i, 1);
        if (balls.length === 0) {
          lives--; if (lives <= 0) { active = false; if (onGameOver) onGameOver(score); return; }
          spawnBall(); launched = false;
        }
        continue;
      }

      // Paddle
      const pw2 = (PADDLE.w + paddleBonus) / 2;
      if (b.vy > 0 && b.y + b.r >= PADDLE.y - PADDLE.h / 2 && b.y - b.r <= PADDLE.y + PADDLE.h / 2 &&
          b.x >= PADDLE.x - pw2 && b.x <= PADDLE.x + pw2) {
        b.vy = -Math.abs(b.vy);
        const hit = (b.x - PADDLE.x) / pw2;
        b.vx = hit * 6;
        const spd = Math.hypot(b.vx, b.vy);
        if (spd > 9) { b.vx = b.vx / spd * 9; b.vy = b.vy / spd * 9; }
        emit(b.x, PADDLE.y, '#00f0ff', 6);
        if (window.audioManager) window.audioManager.playBlip();
      }

      // Bricks
      for (let j = bricks.length - 1; j >= 0; j--) {
        const br = bricks[j];
        if (!br.alive) continue;
        if (b.x + b.r > br.x && b.x - b.r < br.x + br.w && b.y + b.r > br.y && b.y - b.r < br.y + br.h) {
          const ox = Math.min(b.x + b.r - br.x, br.x + br.w - (b.x - b.r));
          const oy = Math.min(b.y + b.r - br.y, br.y + br.h - (b.y - b.r));
          if (ox < oy) b.vx = -b.vx; else b.vy = -b.vy;
          br.hp--; br.shake = 7;
          emit(b.x, b.y, br.color.fill, 7);
          if (window.audioManager) window.audioManager.playScore();
          if (br.hp <= 0) {
            br.alive = false;
            score += 10 * level; if (onScoreUpdate) onScoreUpdate(score);
            if (Math.random() < 0.2) {
              const pt = PU_TYPES[Math.floor(Math.random() * PU_TYPES.length)];
              powerups.push({ x: br.x + br.w / 2, y: br.y + br.h / 2, vy: 2.5, ...pt });
            }
          }
          break;
        }
      }
    }

    // Power-ups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i]; p.y += p.vy;
      const pw2 = (PADDLE.w + paddleBonus) / 2;
      if (p.y > PADDLE.y - 20 && p.y < PADDLE.y + 20 && Math.abs(p.x - PADDLE.x) < pw2 + 12) {
        if (p.type === 'wide') { paddleBonus = 70; paddleBonusTimer = 350; }
        if (p.type === 'multi' && balls.length < 3) {
          const ref = balls[0];
          if (ref) {
            balls.push({ x: ref.x, y: ref.y, vx: ref.vx + 2.5, vy: ref.vy, r: 7, trail: [], launched: true });
            balls.push({ x: ref.x, y: ref.y, vx: ref.vx - 2.5, vy: ref.vy, r: 7, trail: [], launched: true });
          }
        }
        if (p.type === 'slow') { speedMult = 0.55; setTimeout(() => { if (active) speedMult = 1; }, 5000); }
        emit(p.x, p.y, p.color, 14);
        powerups.splice(i, 1); continue;
      }
      if (p.y > H + 20) powerups.splice(i, 1);
    }

    // Level clear
    if (bricks.every(b => !b.alive)) {
      level++; score += 150 * level; if (onScoreUpdate) onScoreUpdate(score);
      balls = []; powerups = []; buildLevel(); spawnBall(); launched = false;
    }

    bricks.forEach(b => { if (b.shake > 0) b.shake--; });
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.09; p.alpha -= 0.028;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function render() {
    ctx.fillStyle = '#05050f'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,240,255,0.03)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Bricks
    bricks.forEach(b => {
      if (!b.alive) return;
      const hp = b.hp / b.maxHp;
      const sx = b.shake > 0 ? (Math.random() - 0.5) * b.shake * 0.8 : 0;
      const sy = b.shake > 0 ? (Math.random() - 0.5) * b.shake * 0.8 : 0;
      ctx.save(); ctx.translate(sx, sy);
      ctx.shadowBlur = 10 * hp; ctx.shadowColor = b.color.glow;
      ctx.globalAlpha = 0.45 + hp * 0.55;
      ctx.fillStyle = b.color.fill;
      rr(b.x + 1, b.y + 1, b.w - 2, b.h - 2, 4); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = b.color.fill; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      rr(b.x + 2, b.y + 2, b.w - 4, b.h / 2 - 2, 3); ctx.fill();
      ctx.restore();
    });

    // Power-ups
    powerups.forEach(p => {
      ctx.save(); ctx.shadowBlur = 14; ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = 'bold 10px Space Grotesk,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.label, p.x, p.y); ctx.restore();
    });

    // Ball trails + balls
    balls.forEach(b => {
      b.trail.forEach((t, idx) => {
        ctx.globalAlpha = (idx / b.trail.length) * 0.35;
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath(); ctx.arc(t.x, t.y, b.r * (idx / b.trail.length), 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 18; ctx.shadowColor = '#00f0ff';
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Paddle
    const pw = PADDLE.w + paddleBonus;
    const grad = ctx.createLinearGradient(PADDLE.x - pw / 2, 0, PADDLE.x + pw / 2, 0);
    grad.addColorStop(0, '#b026ff'); grad.addColorStop(0.5, '#00f0ff'); grad.addColorStop(1, '#b026ff');
    ctx.shadowBlur = 22; ctx.shadowColor = '#00f0ff';
    ctx.fillStyle = grad;
    rr(PADDLE.x - pw / 2, PADDLE.y - PADDLE.h / 2, pw, PADDLE.h, 6); ctx.fill();
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
    ctx.fillText(`SCORE: ${score}`, 12, 28);
    ctx.fillStyle = '#ff007f'; ctx.textAlign = 'right';
    ctx.fillText(`LEVEL ${level}`, W - 12, 28);
    for (let l = 0; l < 3; l++) {
      ctx.globalAlpha = l < lives ? 1 : 0.15;
      ctx.font = '16px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('💙', 12 + l * 22, H - 10);
    }
    ctx.globalAlpha = 1;
    if (!launched && balls.length > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = "13px 'Space Grotesk',sans-serif";
      ctx.textAlign = 'center'; ctx.fillText('CLICK / TAP TO LAUNCH', W / 2, H - 14);
    }
  }

  function loop() { if (!active) return; update(); render(); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
};
