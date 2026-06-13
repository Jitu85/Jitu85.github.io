window.initMergePuzzle = function(canvas, onGameOver, onScoreUpdate) {
  const ctx = canvas.getContext('2d');
  const W = 640, H = 480;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  ctx.scale(dpr, dpr);

  let active = true;
  let score = 0;
  let frame = 0;

  const COLS = 6, ROWS = 5;
  const CELL = 80;
  const GRID_X = (W - COLS * CELL) / 2;
  const GRID_Y = 60;
  const MAX_TIER = 8;

  // Tier config
  const TIERS = [
    { label: '✨', color: '#555', name: 'Spark' },
    { label: '⚡', color: '#ffea00', name: 'Zap' },
    { label: '💠', color: '#00f0ff', name: 'Crystal' },
    { label: '🔮', color: '#b026ff', name: 'Orb' },
    { label: '🌟', color: '#ff007f', name: 'Star' },
    { label: '💎', color: '#39ff14', name: 'Diamond' },
    { label: '🏆', color: '#ff6600', name: 'Trophy' },
    { label: '👑', color: '#ffea00', name: 'Crown' },
  ];

  let grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  let particles = [];
  let dragging = null; // {r, c, px, py}
  let dragPos = { x: 0, y: 0 };
  let flashMsg = '';
  let flashTimer = 0;

  // Spawn a random low-tier gem
  function spawnGem() {
    // Find empty cells
    const empty = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (!grid[r][c]) empty.push({ r, c });
    if (empty.length === 0) {
      active = false;
      if (onGameOver) onGameOver(score);
      return;
    }
    const { r, c } = empty[Math.floor(Math.random() * empty.length)];
    const tier = Math.random() < 0.7 ? 0 : Math.min(1, Math.floor(Math.random() * 3));
    grid[r][c] = { tier };
  }

  // Start with a few gems
  for (let i = 0; i < 6; i++) spawnGem();

  function cellFromXY(x, y) {
    const c = Math.floor((x - GRID_X) / CELL);
    const r = Math.floor((y - GRID_Y) / CELL);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return { r, c };
  }

  function tryMerge(fromR, fromC, toR, toC) {
    const from = grid[fromR][fromC];
    const to = grid[toR][toC];
    if (!from) return false;

    if (!to) {
      // Move to empty
      grid[toR][toC] = from;
      grid[fromR][fromC] = null;
      return true;
    }

    if (to.tier === from.tier && from.tier < MAX_TIER - 1) {
      // Merge!
      const newTier = from.tier + 1;
      grid[toR][toC] = { tier: newTier };
      grid[fromR][fromC] = null;
      const pts = Math.pow(2, newTier) * 10;
      score += pts;
      if (onScoreUpdate) onScoreUpdate(score);
      if (window.audioManager) window.audioManager.playScore();
      spawnParticles(GRID_X + toC * CELL + CELL / 2, GRID_Y + toR * CELL + CELL / 2, TIERS[newTier].color, 16);
      flashMsg = `+${pts} — ${TIERS[newTier].name}!`;
      flashTimer = 70;

      if (newTier === MAX_TIER - 1) {
        flashMsg = '👑 ULTIMATE GEM!';
        flashTimer = 120;
        score += 1000;
        if (onScoreUpdate) onScoreUpdate(score);
      }

      // Spawn new gem after merge
      setTimeout(() => { if (active) spawnGem(); }, 400);
      return true;
    }
    return false;
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, spd = 2 + Math.random() * 4;
      particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, alpha: 1, color, r: 2 + Math.random() * 4 });
    }
  }

  function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * (W / rect.width), y: (src.clientY - rect.top) * (H / rect.height) };
  }

  canvas.addEventListener('mousedown', (e) => {
    const { x, y } = getPointerPos(e);
    const cell = cellFromXY(x, y);
    if (cell && grid[cell.r][cell.c]) {
      dragging = { ...cell };
      dragPos = { x, y };
    }
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const p = getPointerPos(e);
    dragPos = p;
  });
  canvas.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    const { x, y } = getPointerPos(e);
    const cell = cellFromXY(x, y);
    if (cell && (cell.r !== dragging.r || cell.c !== dragging.c)) {
      tryMerge(dragging.r, dragging.c, cell.r, cell.c);
    }
    dragging = null;
  });
  canvas.addEventListener('touchstart', (e) => {
    const { x, y } = getPointerPos(e);
    const cell = cellFromXY(x, y);
    if (cell && grid[cell.r][cell.c]) { dragging = { ...cell }; dragPos = { x, y }; }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    dragPos = getPointerPos(e);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    if (!dragging) return;
    const { x, y } = getPointerPos(e);
    const cell = cellFromXY(x, y);
    if (cell && (cell.r !== dragging.r || cell.c !== dragging.c)) {
      tryMerge(dragging.r, dragging.c, cell.r, cell.c);
    }
    dragging = null;
    e.preventDefault();
  }, { passive: false });

  window.destroyMergePuzzle = function() { active = false; };

  function update() {
    frame++;
    if (flashTimer > 0) flashTimer--;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.alpha -= 0.04;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  function drawGem(x, y, tier, ghost = false) {
    const t = TIERS[tier];
    ctx.save();
    ctx.globalAlpha = ghost ? 0.5 : 1;
    ctx.shadowBlur = 16;
    ctx.shadowColor = t.color;
    ctx.fillStyle = t.color + '33';
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 12);
    ctx.fill();
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = `${CELL * 0.42}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.label, x + CELL / 2, y + CELL / 2 - 4);
    ctx.font = `bold 10px 'Space Grotesk', sans-serif`;
    ctx.fillStyle = t.color;
    ctx.fillText(t.name.toUpperCase(), x + CELL / 2, y + CELL - 12);
    ctx.restore();
  }

  function render() {
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, W, H);

    // Grid
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = GRID_X + c * CELL, y = GRID_Y + r * CELL;
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        ctx.stroke();

        const gem = grid[r][c];
        if (gem && !(dragging && dragging.r === r && dragging.c === c)) {
          drawGem(x, y, gem.tier);
        }
      }
    }

    // Dragging ghost
    if (dragging && grid[dragging.r][dragging.c]) {
      const gem = grid[dragging.r][dragging.c];
      drawGem(dragPos.x - CELL / 2, dragPos.y - CELL / 2, gem.tier, false);
    }

    // Particles
    particles.forEach(p => {
      ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Legend strip
    const legY = GRID_Y + ROWS * CELL + 12;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = "11px 'Space Grotesk', sans-serif";
    ctx.fillText('MERGE CHAIN:', 12, legY + 12);
    TIERS.forEach((t, i) => {
      ctx.font = `${16}px sans-serif`;
      ctx.fillText(t.label, 120 + i * 36, legY + 14);
      if (i < TIERS.length - 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = "12px sans-serif";
        ctx.fillText('→', 137 + i * 36, legY + 14);
      }
    });

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = "bold 22px 'Space Grotesk', sans-serif";
    ctx.fillText(`SCORE: ${score}`, 12, 38);
    ctx.fillStyle = '#b026ff';
    ctx.textAlign = 'right';
    ctx.fillText('COSMIC MERGE', W - 12, 38);
    ctx.textAlign = 'left';

    // Flash
    if (flashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, flashTimer / 25);
      ctx.font = "bold 22px 'Space Grotesk', sans-serif";
      ctx.fillStyle = '#ffea00';
      ctx.shadowBlur = 12; ctx.shadowColor = '#ffea00';
      ctx.textAlign = 'center';
      ctx.fillText(flashMsg, W / 2, legY - 12);
      ctx.restore();
    }

    // Hint
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = "11px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'right';
    ctx.fillText('DRAG GEMS TO MERGE SAME-TIER PAIRS', W - 10, H - 8);
    ctx.textAlign = 'left';
  }

  function loop() {
    if (!active) return;
    update();
    render();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
};
