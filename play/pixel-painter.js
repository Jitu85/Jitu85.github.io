window.initPixelPainter = function(canvas, onGameOver, onScoreUpdate) {
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
  let mistakeCount = 0;
  const MAX_MISTAKES = 5;

  // Grid: 20x14 cells
  const GCOLS = 20, GROWS = 14;
  const CELL = 22;
  const GRID_X = (W - GCOLS * CELL) / 2;
  const GRID_Y = 54;

  // Color palette (8 colors)
  const PALETTE = [
    '#ff007f', '#00f0ff', '#b026ff', '#ffea00',
    '#39ff14', '#ff6600', '#ffffff', '#888888'
  ];

  // Pattern to paint (pixel art)
  const PATTERNS = [
    // Rocket (20x14)
    `
..........rr........
.........rrrr.......
........rrrrrr......
........rr..rr......
........rrrrrr......
.......rrrrrrrr.....
......rrrrrrrrrrr...
......r.rrrrrr.r....
......r.rrrrrr.r....
......r.rrrrrr.r....
.......rrrrrrr......
......y.rrrr.y......
.....yy......yy.....
....yyy......yyy....
`.trim().split('\n').map(row => row.split('')),
    // Star (20x14)
    `
.........yy.........
.........yy.........
....yyyyyyyyyyy.....
.....yyyyyyyyy......
......yyyyyyy.......
.....yyyyyyyyy......
....yyyyyyyyyyy.....
...yyy.......yyy....
..yy...........yy...
.y.............y....
....................
....................
....................
....................
`.trim().split('\n').map(row => row.split('')),
  ];

  const COLOR_MAP = { r: '#ff007f', b: '#00f0ff', p: '#b026ff', y: '#ffea00', g: '#39ff14', o: '#ff6600', w: '#ffffff', s: '#888888' };
  const patternIdx = Math.floor(Math.random() * PATTERNS.length);
  let pattern = PATTERNS[patternIdx];
  // Normalize to 20x14
  while (pattern.length < GROWS) pattern.push(Array(GCOLS).fill('.'));
  pattern = pattern.slice(0, GROWS).map(row => {
    while (row.length < GCOLS) row.push('.');
    return row.slice(0, GCOLS);
  });

  // Player canvas: what color they've painted
  let painted = Array.from({ length: GROWS }, () => Array(GCOLS).fill(null));
  let selectedColor = 0;
  let painting = false;
  let particles = [];
  let flashMsg = '';
  let flashTimer = 0;
  let complete = false;
  let celebrationTimer = 0;

  // Count required cells
  let totalCells = 0;
  let filledCells = 0;
  pattern.forEach((row, r) => row.forEach((ch, c) => { if (ch !== '.') totalCells++; }));

  function getTargetColor(r, c) {
    const ch = pattern[r][c];
    return COLOR_MAP[ch] || null;
  }

  function paintCell(r, c) {
    if (r < 0 || r >= GROWS || c < 0 || c >= GCOLS) return;
    const target = getTargetColor(r, c);
    const myColor = PALETTE[selectedColor];

    if (!target) {
      // Painting a blank cell
      if (painted[r][c] !== null) {
        // Already painted — erasing? Ignore
        return;
      }
      mistakeCount++;
      if (window.audioManager) window.audioManager.playBlip();
      flashMsg = `❌ WRONG CELL! Mistakes: ${mistakeCount}/${MAX_MISTAKES}`;
      flashTimer = 60;
      if (mistakeCount >= MAX_MISTAKES) {
        active = false;
        if (onGameOver) onGameOver(score);
        return;
      }
      return;
    }

    if (painted[r][c] === myColor) return; // Already painted correctly

    if (myColor !== target) {
      // Wrong color
      mistakeCount++;
      if (window.audioManager) window.audioManager.playBlip();
      flashMsg = `🎨 WRONG COLOR! Mistakes: ${mistakeCount}/${MAX_MISTAKES}`;
      flashTimer = 60;
      if (mistakeCount >= MAX_MISTAKES) {
        active = false;
        if (onGameOver) onGameOver(score);
        return;
      }
      return;
    }

    // Correct paint!
    if (painted[r][c] !== myColor) {
      const wasBlank = painted[r][c] === null;
      painted[r][c] = myColor;
      if (wasBlank && target) {
        filledCells++;
        score += 5;
        if (onScoreUpdate) onScoreUpdate(score);
        spawnParticles(GRID_X + c * CELL + CELL / 2, GRID_Y + r * CELL + CELL / 2, myColor, 6);
      }
    }

    // Check complete
    if (filledCells === totalCells && !complete) {
      complete = true;
      score += 500;
      if (onScoreUpdate) onScoreUpdate(score);
      if (window.audioManager) window.audioManager.playScore();
      flashMsg = '🎨 MASTERPIECE! +500';
      flashTimer = 200;
      celebrationTimer = 200;
    }
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, spd = 1 + Math.random() * 2.5;
      particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, alpha: 1, color, r: 2 + Math.random() * 2 });
    }
  }

  function getCell(e) {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    const x = (src.clientX - rect.left) * (W / rect.width);
    const y = (src.clientY - rect.top) * (H / rect.height);

    // Check palette row
    const palY = H - 44;
    if (y > palY - 4) {
      const palW = PALETTE.length * 36;
      const palX = (W - palW) / 2;
      if (x >= palX && x < palX + palW) {
        const idx = Math.floor((x - palX) / 36);
        if (idx >= 0 && idx < PALETTE.length) selectedColor = idx;
        return null;
      }
    }

    const c = Math.floor((x - GRID_X) / CELL);
    const r = Math.floor((y - GRID_Y) / CELL);
    if (r < 0 || r >= GROWS || c < 0 || c >= GCOLS) return null;
    return { r, c };
  }

  canvas.addEventListener('mousedown', (e) => { painting = true; const cell = getCell(e); if (cell) paintCell(cell.r, cell.c); });
  canvas.addEventListener('mousemove', (e) => { if (!painting) return; const cell = getCell(e); if (cell) paintCell(cell.r, cell.c); });
  canvas.addEventListener('mouseup', () => { painting = false; });
  canvas.addEventListener('touchstart', (e) => { painting = true; const cell = getCell(e); if (cell) paintCell(cell.r, cell.c); e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { if (!painting) return; const cell = getCell(e); if (cell) paintCell(cell.r, cell.c); e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchend', () => { painting = false; });

  window.destroyPixelPainter = function() { active = false; };

  function update() {
    frame++;
    if (flashTimer > 0) flashTimer--;
    if (celebrationTimer > 0) { celebrationTimer--; if (celebrationTimer === 0 && active) { active = false; if (onGameOver) onGameOver(score); } }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.alpha -= 0.03;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  function render() {
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, W, H);

    // Grid
    for (let r = 0; r < GROWS; r++) {
      for (let c = 0; c < GCOLS; c++) {
        const x = GRID_X + c * CELL, y = GRID_Y + r * CELL;
        const target = getTargetColor(r, c);
        const myPaint = painted[r][c];

        if (myPaint) {
          ctx.fillStyle = myPaint;
          ctx.shadowBlur = 6; ctx.shadowColor = myPaint;
          ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
          ctx.shadowBlur = 0;
        } else if (target) {
          // Show hint: darker shade of target
          ctx.fillStyle = target + '22';
          ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
          // Number hint (show color index)
          const palIdx = PALETTE.indexOf(target);
          ctx.fillStyle = target + '66';
          ctx.font = `bold 9px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(palIdx + 1, x + CELL / 2, y + CELL / 2);
        }

        // Grid line
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, CELL, CELL);
      }
    }

    // Particles
    particles.forEach(p => {
      ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Palette row
    const palW = PALETTE.length * 36;
    const palX = (W - palW) / 2;
    const palY = H - 44;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.roundRect(palX - 6, palY - 6, palW + 12, 40, 10); ctx.fill();
    PALETTE.forEach((col, i) => {
      const cx = palX + i * 36 + 14;
      const cy = palY + 14;
      ctx.shadowBlur = i === selectedColor ? 16 : 0;
      ctx.shadowColor = col;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(cx, cy, i === selectedColor ? 14 : 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (i === selectedColor) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = '#000';
      ctx.font = "bold 10px monospace";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(i + 1, cx, cy);
    });

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = "bold 18px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${score}`, 12, 28);
    ctx.fillStyle = '#00f0ff';
    ctx.fillText(`${filledCells}/${totalCells} CELLS`, 12, 46);
    ctx.fillStyle = mistakeCount > 3 ? '#ff007f' : '#ffea00';
    ctx.textAlign = 'right';
    ctx.fillText(`❌ ${mistakeCount}/${MAX_MISTAKES}`, W - 12, 28);

    // Progress bar
    const pct = filledCells / totalCells;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(GRID_X, GRID_Y + GROWS * CELL + 4, GCOLS * CELL, 6);
    ctx.fillStyle = '#39ff14';
    ctx.shadowBlur = 6; ctx.shadowColor = '#39ff14';
    ctx.fillRect(GRID_X, GRID_Y + GROWS * CELL + 4, GCOLS * CELL * pct, 6);
    ctx.shadowBlur = 0;

    // Flash
    if (flashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, flashTimer / 25);
      ctx.font = "bold 20px 'Space Grotesk', sans-serif";
      ctx.fillStyle = flashMsg.startsWith('❌') || flashMsg.startsWith('🎨 WRONG') ? '#ff007f' : '#39ff14';
      ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle;
      ctx.textAlign = 'center';
      ctx.fillText(flashMsg, W / 2, GRID_Y - 10);
      ctx.restore();
    }

    // Celebration sparkles
    if (celebrationTimer > 0) {
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        const px = W / 2 + Math.cos(a) * (80 + Math.random() * 120);
        const py = H / 2 + Math.sin(a) * 60;
        spawnParticles(px, py, PALETTE[Math.floor(Math.random() * PALETTE.length)], 3);
      }
    }
  }

  function loop() {
    if (!active) return;
    update();
    render();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
};
