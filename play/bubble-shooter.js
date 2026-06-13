window.initBubbleShooter = function(canvas, onGameOver, onScoreUpdate) {
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

  const R = 22; // bubble radius
  const COLS = 12;
  const ROWS_VISIBLE = 9;
  const BW = R * 2;
  const GRID_X = (W - COLS * BW) / 2;
  const GRID_Y = 30;

  const COLORS = ['#ff007f', '#00f0ff', '#b026ff', '#ffea00', '#39ff14'];

  // Grid of bubbles: null or color string
  let grid = [];
  function initGrid() {
    grid = [];
    for (let r = 0; r < 5; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        row.push(COLORS[Math.floor(Math.random() * COLORS.length)]);
      }
      grid.push(row);
    }
    // Fill remaining rows with null
    for (let r = 5; r < ROWS_VISIBLE; r++) {
      grid.push(Array(COLS).fill(null));
    }
  }
  initGrid();

  // Shooter
  const SHOOTER_X = W / 2;
  const SHOOTER_Y = H - 40;
  let angle = -Math.PI / 2;
  let aimX = SHOOTER_X;
  let aimY = 100;
  let currentColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  let nextColor = COLORS[Math.floor(Math.random() * COLORS.length)];

  // Projectile
  let proj = null; // {x, y, vx, vy, color}
  let particles = [];
  let descendTimer = 0;
  const DESCEND_INTERVAL = 600; // frames between grid descent
  let gameOverFlash = false;

  function snapToGrid(x, y) {
    const c = Math.round((x - GRID_X - R) / BW);
    const r = Math.round((y - GRID_Y - R) / BW);
    return { r: Math.max(0, Math.min(r, ROWS_VISIBLE - 1)), c: Math.max(0, Math.min(c, COLS - 1)) };
  }

  function findConnected(startR, startC, color) {
    const visited = new Set();
    const stack = [`${startR},${startC}`];
    const result = [];
    while (stack.length) {
      const key = stack.pop();
      if (visited.has(key)) continue;
      visited.add(key);
      const [r, c] = key.split(',').map(Number);
      if (r < 0 || r >= ROWS_VISIBLE || c < 0 || c >= COLS) continue;
      if (!grid[r] || grid[r][c] !== color) continue;
      result.push({ r, c });
      stack.push(`${r-1},${c}`, `${r+1},${c}`, `${r},${c-1}`, `${r},${c+1}`);
    }
    return result;
  }

  function findFloating() {
    // BFS from top row, find all connected non-null bubbles
    const connected = new Set();
    const stack = [];
    for (let c = 0; c < COLS; c++) {
      if (grid[0] && grid[0][c]) stack.push(`0,${c}`);
    }
    while (stack.length) {
      const key = stack.pop();
      if (connected.has(key)) continue;
      connected.add(key);
      const [r, c] = key.split(',').map(Number);
      [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([nr, nc]) => {
        if (nr >= 0 && nr < ROWS_VISIBLE && nc >= 0 && nc < COLS && grid[nr] && grid[nr][nc] && !connected.has(`${nr},${nc}`))
          stack.push(`${nr},${nc}`);
      });
    }
    const floating = [];
    for (let r = 0; r < ROWS_VISIBLE; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r] && grid[r][c] && !connected.has(`${r},${c}`))
          floating.push({ r, c });
    return floating;
  }

  function placeBubble(r, c, color) {
    // Find free cell near landing
    if (!grid[r]) grid[r] = Array(COLS).fill(null);
    // Try nearby cells if occupied
    const tries = [[r,c],[r-1,c],[r,c-1],[r,c+1],[r+1,c]];
    for (const [tr, tc] of tries) {
      if (tr >= 0 && tr < ROWS_VISIBLE && tc >= 0 && tc < COLS && (!grid[tr] || !grid[tr][tc])) {
        if (!grid[tr]) grid[tr] = Array(COLS).fill(null);
        grid[tr][tc] = color;
        return { r: tr, c: tc };
      }
    }
    grid[r][c] = color;
    return { r, c };
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 / 12) * i;
      particles.push({ x, y, vx: Math.cos(a) * (2 + Math.random() * 3), vy: Math.sin(a) * (2 + Math.random() * 3), alpha: 1, color, r: 3 + Math.random() * 3 });
    }
  }

  function fire() {
    if (proj) return;
    const speed = 10;
    proj = {
      x: SHOOTER_X,
      y: SHOOTER_Y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: currentColor
    };
    currentColor = nextColor;
    nextColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  function updateAim(e) {
    if (!active) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    const src = e.touches ? e.touches[0] : e;
    aimX = (src.clientX - rect.left) * scaleX;
    aimY = (src.clientY - rect.top) * scaleY;
    const dx = aimX - SHOOTER_X, dy = aimY - SHOOTER_Y;
    angle = Math.atan2(dy, dx);
    angle = Math.max(-Math.PI + 0.1, Math.min(-0.1, angle));
  }

  canvas.addEventListener('mousemove', updateAim);
  canvas.addEventListener('click', (e) => { updateAim(e); fire(); });
  canvas.addEventListener('touchstart', (e) => { updateAim(e); fire(); e.preventDefault(); }, { passive: false });

  window.destroyBubbleShooter = function() {
    active = false;
    canvas.removeEventListener('mousemove', updateAim);
    canvas.removeEventListener('click', fire);
    canvas.removeEventListener('touchstart', fire);
  };

  function update() {
    frame++;
    descendTimer++;
    if (descendTimer >= DESCEND_INTERVAL) {
      descendTimer = 0;
      // Add new top row
      grid.unshift(COLORS.map(() => Math.random() < 0.6 ? COLORS[Math.floor(Math.random() * COLORS.length)] : null));
      grid.pop();
    }

    // Check game over: any bubble in last row
    const lastRow = grid[ROWS_VISIBLE - 2];
    if (lastRow && lastRow.some(c => c !== null)) {
      active = false;
      if (onGameOver) onGameOver(score);
      return;
    }

    // Move projectile
    if (proj) {
      proj.x += proj.vx;
      proj.y += proj.vy;

      // Wall bounce
      if (proj.x - R < GRID_X) { proj.x = GRID_X + R; proj.vx = Math.abs(proj.vx); }
      if (proj.x + R > GRID_X + COLS * BW) { proj.x = GRID_X + COLS * BW - R; proj.vx = -Math.abs(proj.vx); }

      // Ceiling
      if (proj.y - R <= GRID_Y) {
        const { r, c } = snapToGrid(proj.x, GRID_Y + R);
        const placed = placeBubble(r, c, proj.color);
        afterPlace(placed.r, placed.c, proj.color);
        proj = null;
        return;
      }

      // Collision with grid bubbles
      for (let r = 0; r < ROWS_VISIBLE; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!grid[r] || !grid[r][c]) continue;
          const bx = GRID_X + c * BW + R;
          const by = GRID_Y + r * BW + R;
          const dx = proj.x - bx, dy = proj.y - by;
          if (Math.sqrt(dx * dx + dy * dy) < R * 1.9) {
            const { r: pr, c: pc } = snapToGrid(proj.x, proj.y);
            const placed = placeBubble(pr, pc, proj.color);
            afterPlace(placed.r, placed.c, proj.color);
            proj = null;
            return;
          }
        }
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.alpha -= 0.04;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  function afterPlace(r, c, color) {
    const connected = findConnected(r, c, color);
    if (connected.length >= 3) {
      connected.forEach(({ r, c }) => {
        spawnParticles(GRID_X + c * BW + R, GRID_Y + r * BW + R, color);
        grid[r][c] = null;
      });
      score += connected.length * 10;
      if (window.audioManager) window.audioManager.playScore();
      if (onScoreUpdate) onScoreUpdate(score);

      // Remove floating
      const floating = findFloating();
      floating.forEach(({ r, c }) => {
        spawnParticles(GRID_X + c * BW + R, GRID_Y + r * BW + R, grid[r][c]);
        grid[r][c] = null;
        score += 5;
      });
      if (onScoreUpdate) onScoreUpdate(score);
    }
  }

  function drawBubble(x, y, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(x, y, R - 1, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    // Shine
    ctx.beginPath();
    ctx.arc(x - R * 0.28, y - R * 0.28, R * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.shadowBlur = 0;
    ctx.fill();
    ctx.restore();
  }

  function render() {
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, W, H);

    // Grid bubbles
    for (let r = 0; r < ROWS_VISIBLE; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r] && grid[r][c]) {
          drawBubble(GRID_X + c * BW + R, GRID_Y + r * BW + R, grid[r][c]);
        }
      }
    }

    // Aim line
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(SHOOTER_X, SHOOTER_Y);
    ctx.lineTo(SHOOTER_X + Math.cos(angle) * 120, SHOOTER_Y + Math.sin(angle) * 120);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Projectile
    if (proj) drawBubble(proj.x, proj.y, proj.color);

    // Shooter base
    drawBubble(SHOOTER_X, SHOOTER_Y, currentColor);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(SHOOTER_X - 12, SHOOTER_Y + R, 24, 8);

    // Next bubble preview
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = "12px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', SHOOTER_X + 60, SHOOTER_Y - 16);
    drawBubble(SHOOTER_X + 60, SHOOTER_Y, nextColor, 0.7);
    ctx.textAlign = 'left';

    // Particles
    particles.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = "bold 20px 'Space Grotesk', sans-serif";
    ctx.fillText(`SCORE: ${score}`, 12, 24);

    // Danger zone line
    const dangerY = GRID_Y + (ROWS_VISIBLE - 2) * BW;
    ctx.strokeStyle = 'rgba(255, 0, 100, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(GRID_X, dangerY);
    ctx.lineTo(GRID_X + COLS * BW, dangerY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function loop() {
    if (!active) return;
    update();
    render();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
};
