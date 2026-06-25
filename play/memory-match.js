window.initMemoryMatch = function(canvas, onGameOver, onScoreUpdate) {
  const ctx = canvas.getContext('2d');
  const W = 640, H = 480;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = '100%'; canvas.style.height = '100%';
  ctx.scale(dpr, dpr);

  let active = true, score = 0, frame = 0, round = 1;
  let flipped = [], locked = false, lockTimer = 0, roundDelay = 0;
  let particles = [], timeLeft = 60;
  let timerTick = 0;

  const COLS = 4, ROWS = 4, CW = 124, CH = 88, GAP = 10;
  const SYMBOLS = ['⚡', '💎', '🔮', '🌟', '🚀', '🎯', '💫', '🔥'];
  const NEON = ['#ff007f', '#00f0ff', '#b026ff', '#39ff14', '#ffea00', '#ff6b35', '#a0ff20', '#ff3388'];

  const totalW = COLS * CW + (COLS - 1) * GAP;
  const totalH = ROWS * CH + (ROWS - 1) * GAP;
  const padX = (W - totalW) / 2;
  const padY = (H - totalH) / 2 + 24;

  let cards = [];

  function buildGrid() {
    const pairs = (COLS * ROWS) / 2;
    let pool = [];
    for (let i = 0; i < pairs; i++) {
      pool.push({ sym: SYMBOLS[i % SYMBOLS.length], col: NEON[i % NEON.length] });
      pool.push({ sym: SYMBOLS[i % SYMBOLS.length], col: NEON[i % NEON.length] });
    }
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    cards = pool.map((s, idx) => {
      const col = idx % COLS, row = Math.floor(idx / COLS);
      return {
        x: padX + col * (CW + GAP), y: padY + row * (CH + GAP),
        w: CW, h: CH, sym: s.sym, col: s.col,
        flip: 0, flipped: false, matched: false
      };
    });
    flipped = []; locked = false;
    timeLeft = Math.max(35, 60 - (round - 1) * 8);
    timerTick = 0;
    roundDelay = 0;
  }
  buildGrid();

  function emit(x, y, col) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 4;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, alpha: 1, color: col, r: 2 + Math.random() * 3 });
    }
  }

  function onClick(e) {
    if (!active || locked || roundDelay > 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ((e.touches ? e.touches[0].clientX : e.clientX) - rect.left) * (W / rect.width);
    const my = ((e.touches ? e.touches[0].clientY : e.clientY) - rect.top) * (H / rect.height);
    const card = cards.find(c => !c.flipped && !c.matched &&
      mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h);
    if (!card) return;
    card.flipped = true; flipped.push(card);
    if (window.audioManager) window.audioManager.playBlip();
    if (flipped.length === 2) { locked = true; lockTimer = 55; }
    e.preventDefault();
  }
  canvas.addEventListener('mousedown', onClick);
  canvas.addEventListener('touchstart', onClick, { passive: false });

  window.destroyMemoryMatch = function() {
    active = false;
    canvas.removeEventListener('mousedown', onClick);
    canvas.removeEventListener('touchstart', onClick);
  };

  function update() {
    frame++;
    timerTick++;
    if (timerTick >= 60) { timerTick = 0; timeLeft--; }
    if (timeLeft <= 0 && active) { active = false; if (onGameOver) onGameOver(score); return; }

    cards.forEach(c => {
      const target = (c.flipped || c.matched) ? 1 : 0;
      c.flip += (target - c.flip) * 0.14;
    });

    if (locked && lockTimer > 0) {
      lockTimer--;
      if (lockTimer === 0) {
        if (flipped.length === 2 && flipped[0].sym === flipped[1].sym) {
          flipped.forEach(c => {
            c.matched = true;
            emit(c.x + c.w / 2, c.y + c.h / 2, c.col);
          });
          score += 100 + timeLeft * 2; if (onScoreUpdate) onScoreUpdate(score);
          if (window.audioManager) window.audioManager.playScore();
          if (cards.every(c => c.matched)) { round++; score += 500; roundDelay = 100; }
        } else {
          flipped.forEach(c => { c.flipped = false; });
        }
        flipped = []; locked = false;
      }
    }
    if (roundDelay > 0) { roundDelay--; if (roundDelay === 0) buildGrid(); }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.alpha -= 0.024;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  function render() {
    ctx.fillStyle = '#05050f'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(176,38,255,0.04)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    cards.forEach(c => {
      const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
      const scaleX = Math.abs(Math.cos(c.flip * Math.PI));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(Math.max(0.01, scaleX), 1);

      if (c.flip < 0.5) {
        // Back face
        ctx.shadowBlur = 8; ctx.shadowColor = '#b026ff';
        ctx.fillStyle = 'rgba(15,8,40,0.97)';
        ctx.beginPath(); ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 10); ctx.fill();
        ctx.strokeStyle = '#b026ff'; ctx.lineWidth = 1.5; ctx.stroke();
        // Back design — diamond pattern
        ctx.fillStyle = 'rgba(176,38,255,0.18)';
        ctx.font = '30px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('❓', 0, 0);
      } else {
        // Front face
        const isMatch = c.matched;
        ctx.shadowBlur = isMatch ? 22 : 10; ctx.shadowColor = c.col;
        ctx.fillStyle = isMatch ? `rgba(${hexRgb(c.col)},0.18)` : 'rgba(10,8,28,0.97)';
        ctx.beginPath(); ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 10); ctx.fill();
        ctx.strokeStyle = c.col; ctx.lineWidth = isMatch ? 2.5 : 1.5; ctx.stroke();
        // Shine on matched
        if (isMatch) {
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.beginPath(); ctx.roundRect(-c.w / 2 + 2, -c.h / 2 + 2, c.w - 4, c.h * 0.4, 8); ctx.fill();
        }
        ctx.font = '36px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(c.sym, 0, 0);
      }
      ctx.restore();
    });

    particles.forEach(p => {
      ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.shadowBlur = 8; ctx.shadowColor = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;

    // HUD
    ctx.fillStyle = '#fff'; ctx.font = "bold 20px 'Space Grotesk',sans-serif"; ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${score}`, 12, 28);
    const tc = timeLeft <= 10 ? '#ff007f' : '#00f0ff';
    ctx.fillStyle = tc; ctx.shadowBlur = timeLeft <= 10 ? 14 : 0; ctx.shadowColor = tc;
    ctx.textAlign = 'center'; ctx.font = "bold 20px 'Space Grotesk',sans-serif";
    ctx.fillText(`⏱ ${timeLeft}s`, W / 2, 28);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#b026ff'; ctx.textAlign = 'right';
    ctx.fillText(`ROUND ${round}`, W - 12, 28);

    if (roundDelay > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, roundDelay / 30);
      ctx.font = "bold 40px 'Space Grotesk',sans-serif"; ctx.fillStyle = '#39ff14';
      ctx.shadowBlur = 22; ctx.shadowColor = '#39ff14'; ctx.textAlign = 'center';
      ctx.fillText('ALL MATCHED! ⭐', W / 2, H / 2); ctx.restore();
    }
  }

  function hexRgb(h) {
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }

  function loop() { if (!active) return; update(); render(); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
};
