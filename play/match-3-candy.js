window.initMatch3Candy = function(canvas, onGameOver, onScoreUpdate) {
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
  let movesLeft = 30;

  const COLS = 8, ROWS = 8;
  const CELL = 52;
  const GRID_X = (W - COLS * CELL) / 2;
  const GRID_Y = 50;

  const COLORS = ['#ff007f', '#00f0ff', '#b026ff', '#ffea00', '#39ff14', '#ff6600'];
  const EMOJIS = ['🍭', '🍬', '🎂', '🍰', '🧁', '🍩'];

  let grid = []; // grid[r][c] = colorIndex or -1
  let selected = null; // {r, c}
  let animating = false;
  let particles = [];
  let flashMsg = '';
  let flashTimer = 0;
  let dropAnims = []; // [{r, c, fromY, toY, t}]

  function randomColor() { return Math.floor(Math.random() * COLORS.length); }

  function buildGrid() {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
      grid.push([]);
      for (let c = 0; c < COLS; c++) {
        let col;
        do { col = randomColor(); } while (hasMatchAt(r, c, col));
        grid[r].push(col);
      }
    }
  }

  function hasMatchAt(r, c, col) {
    // Check horizontal
    if (c >= 2 && grid[r][c-1] === col && grid[r][c-2] === col) return true;
    // Check vertical
    if (r >= 2 && grid[r-1] && grid[r-1][c] === col && grid[r-2] && grid[r-2][c] === col) return true;
    return false;
  }

  buildGrid();

  function findMatches() {
    const matched = new Set();
    // Horizontal
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS - 2; c++) {
        const col = grid[r][c];
        if (col === -1) continue;
        if (grid[r][c+1] === col && grid[r][c+2] === col) {
          let len = 3;
          while (c + len < COLS && grid[r][c+len] === col) len++;
          for (let i = 0; i < len; i++) matched.add(`${r},${c+i}`);
        }
      }
    }
    // Vertical
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS - 2; r++) {
        const col = grid[r][c];
        if (col === -1) continue;
        if (grid[r+1][c] === col && grid[r+2][c] === col) {
          let len = 3;
          while (r + len < ROWS && grid[r+len][c] === col) len++;
          for (let i = 0; i < len; i++) matched.add(`${r+i},${c}`);
        }
      }
    }
    return matched;
  }

  function clearMatches(matched) {
    matched.forEach(key => {
      const [r, c] = key.split(',').map(Number);
      const col = grid[r][c];
      spawnParticles(GRID_X + c * CELL + CELL / 2, GRID_Y + r * CELL + CELL / 2, COLORS[col]);
      grid[r][c] = -1;
    });
    score += matched.size * 15;
    if (onScoreUpdate) onScoreUpdate(score);
    if (window.audioManager) window.audioManager.playScore();
    flashMsg = `+${matched.size * 15}`;
    flashTimer = 60;
  }

  function dropDown() {
    let dropped = false;
    for (let c = 0; c < COLS; c++) {
      for (let r = ROWS - 1; r > 0; r--) {
        if (grid[r][c] === -1) {
          for (let sr = r - 1; sr >= 0; sr--) {
            if (grid[sr][c] !== -1) {
              grid[r][c] = grid[sr][c];
              grid[sr][c] = -1;
              dropped = true;
              break;
            }
          }
        }
      }
      // Fill top
      for (let r = 0; r < ROWS; r++) {
        if (grid[r][c] === -1) {
          grid[r][c] = randomColor();
          dropped = true;
        }
      }
    }
    return dropped;
  }

  function processMatches() {
    if (animating) return;
    const matches = findMatches();
    if (matches.size > 0) {
      animating = true;
      clearMatches(matches);
      setTimeout(() => {
        dropDown();
        setTimeout(() => {
          animating = false;
          processMatches();
        }, 300);
      }, 300);
    }
  }

  function swap(r1, c1, r2, c2) {
    if (!active || animating) return;
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;
    const tmp = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = tmp;

    const matches = findMatches();
    if (matches.size === 0) {
      // Swap back
      const tmp2 = grid[r1][c1];
      grid[r1][c1] = grid[r2][c2];
      grid[r2][c2] = tmp2;
      flashMsg = 'NO MATCH!';
      flashTimer = 40;
      if (window.audioManager) window.audioManager.playBlip();
    } else {
      movesLeft--;
      if (window.audioManager) window.audioManager.playBlip();
      processMatches();
      if (movesLeft <= 0) {
        setTimeout(() => { if (active) { active = false; if (onGameOver) onGameOver(score); } }, 1500);
      }
    }
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, spd = 2 + Math.random() * 3;
      particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, alpha: 1, color, r: 2 + Math.random() * 3 });
    }
  }

  function cellFromXY(x, y) {
    const c = Math.floor((x - GRID_X) / CELL);
    const r = Math.floor((y - GRID_Y) / CELL);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return { r, c };
  }

  let dragStart = null;
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    const cell = cellFromXY(x, y);
    if (cell) { dragStart = cell; selected = cell; }
  });
  canvas.addEventListener('mouseup', (e) => {
    if (!dragStart) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    const cell = cellFromXY(x, y);
    if (cell && (cell.r !== dragStart.r || cell.c !== dragStart.c)) {
      swap(dragStart.r, dragStart.c, cell.r, cell.c);
    }
    dragStart = null; selected = null;
  });
  canvas.addEventListener('touchstart', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches[0].clientX - rect.left) * (W / rect.width);
    const y = (e.touches[0].clientY - rect.top) * (H / rect.height);
    const cell = cellFromXY(x, y);
    if (cell) { dragStart = cell; selected = cell; }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    if (!dragStart) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.changedTouches[0].clientX - rect.left) * (W / rect.width);
    const y = (e.changedTouches[0].clientY - rect.top) * (H / rect.height);
    const cell = cellFromXY(x, y);
    if (cell && (cell.r !== dragStart.r || cell.c !== dragStart.c)) {
      swap(dragStart.r, dragStart.c, cell.r, cell.c);
    }
    dragStart = null; selected = null;
    e.preventDefault();
  }, { passive: false });

  window.destroyMatch3Candy = function() { active = false; };

  function update() {
    frame++;
    if (flashTimer > 0) flashTimer--;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.alpha -= 0.04;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  function render() {
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, W, H);

    // Grid background
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.beginPath();
    ctx.roundRect(GRID_X - 4, GRID_Y - 4, COLS * CELL + 8, ROWS * CELL + 8, 10);
    ctx.fill();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = GRID_X + c * CELL;
        const y = GRID_Y + r * CELL;
        const col = grid[r][c];

        // Cell bg
        const isSelected = selected && selected.r === r && selected.c === c;
        ctx.fillStyle = isSelected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)';
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 6);
        ctx.fill();

        if (col === -1) continue;

        // Gem
        const pulse = 1 + Math.sin(frame * 0.08 + r + c) * 0.04;
        ctx.save();
        ctx.translate(x + CELL / 2, y + CELL / 2);
        ctx.scale(pulse, pulse);
        if (isSelected) { ctx.scale(1.12, 1.12); }

        ctx.shadowBlur = 14; ctx.shadowColor = COLORS[col];
        ctx.fillStyle = COLORS[col];
        ctx.beginPath();
        // Diamond shape
        const s = CELL * 0.38;
        ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0);
        ctx.closePath();
        ctx.fill();

        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.moveTo(-s * 0.3, -s * 0.7); ctx.lineTo(s * 0.3, -s * 0.1); ctx.lineTo(0, -s * 0.3);
        ctx.closePath();
        ctx.fill();

        // Emoji
        ctx.shadowBlur = 0;
        ctx.font = `${CELL * 0.4}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(EMOJIS[col], 0, 0);

        ctx.restore();
      }
    }

    // Particles
    particles.forEach(p => {
      ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = "bold 22px 'Space Grotesk', sans-serif";
    ctx.fillText(`SCORE: ${score}`, 12, 34);
    ctx.fillStyle = movesLeft < 8 ? '#ff007f' : '#ffea00';
    ctx.textAlign = 'right';
    ctx.fillText(`MOVES: ${movesLeft}`, W - 12, 34);
    ctx.textAlign = 'left';

    // Flash
    if (flashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, flashTimer / 20);
      ctx.font = "bold 24px 'Space Grotesk', sans-serif";
      ctx.fillStyle = '#39ff14';
      ctx.shadowBlur = 12; ctx.shadowColor = '#39ff14';
      ctx.textAlign = 'center';
      ctx.fillText(flashMsg, W / 2, GRID_Y + ROWS * CELL + 28);
      ctx.restore();
    }

    // Hint
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = "11px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'right';
    ctx.fillText('DRAG GEMS TO SWAP', W - 10, H - 8);
    ctx.textAlign = 'left';
  }

  function loop() {
    if (!active) return;
    update();
    render();
    requestAnimationFrame(loop);
  }

  processMatches();
  requestAnimationFrame(loop);
};
