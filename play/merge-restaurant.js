window.initMergeRestaurant = function(canvas, onGameOver, onScoreUpdate) {
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

  // Grid
  const COLS = 5, ROWS = 4;
  const CELL = 72;
  const GRID_X = 20;
  const GRID_Y = 90;

  // Ingredient tiers: 0=tomato→1=sauce→2=dough→3=cheese→4=pizza slice→5=pizza!
  const INGREDIENTS = [
    { label: '🍅', name: 'Tomato',       color: '#ff007f' },
    { label: '🥫', name: 'Sauce',        color: '#ff4400' },
    { label: '🫓', name: 'Dough',        color: '#ffea00' },
    { label: '🧀', name: 'Cheese',       color: '#ff9900' },
    { label: '🍕', name: 'Pizza Slice',  color: '#39ff14' },
    { label: '🎉', name: 'Full Pizza!',  color: '#b026ff' },
  ];

  // Customer orders
  const MAX_CUSTOMERS = 3;
  let customers = []; // { want: tier, timer: n, maxTimer: n }
  let orderTimer = 0;
  const ORDER_INTERVAL = 300;

  // Grid cells: null or { tier }
  let grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  let particles = [];
  let flashMsg = '';
  let flashTimer = 0;
  let dragging = null;
  let dragPos = { x: 0, y: 0 };
  let lives = 5;
  let spawnTimer = 0;
  const SPAWN_INTERVAL = 180;

  // Fill a few starter ingredients
  function spawnIngredient() {
    const empty = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (!grid[r][c]) empty.push({ r, c });
    if (empty.length === 0) return;
    const { r, c } = empty[Math.floor(Math.random() * empty.length)];
    grid[r][c] = { tier: Math.floor(Math.random() * 2) }; // spawn tier 0 or 1
  }

  for (let i = 0; i < 5; i++) spawnIngredient();

  function spawnCustomer() {
    if (customers.length >= MAX_CUSTOMERS) return;
    const tier = 2 + Math.floor(Math.random() * 3); // order tier 2-4
    const maxTimer = 400 + tier * 100;
    customers.push({ want: tier, timer: maxTimer, maxTimer });
  }

  spawnCustomer();

  function cellFromXY(x, y) {
    const c = Math.floor((x - GRID_X) / CELL);
    const r = Math.floor((y - GRID_Y) / CELL);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return { r, c };
  }

  function tryMerge(from, to) {
    if (!from || !to) return false;
    const fi = grid[from.r][from.c];
    const ti = grid[to.r][to.c];
    if (!fi) return false;
    if (!ti) {
      // Move
      grid[to.r][to.c] = fi;
      grid[from.r][from.c] = null;
      return true;
    }
    if (fi.tier === ti.tier && fi.tier < INGREDIENTS.length - 1) {
      const newTier = fi.tier + 1;
      grid[to.r][to.c] = { tier: newTier };
      grid[from.r][from.c] = null;
      spawnParticles(GRID_X + to.c * CELL + CELL / 2, GRID_Y + to.r * CELL + CELL / 2, INGREDIENTS[newTier].color, 12);
      if (window.audioManager) window.audioManager.playScore();
      flashMsg = `✨ ${INGREDIENTS[newTier].name}!`;
      flashTimer = 60;
      return true;
    }
    return false;
  }

  function serveCustomer(fromR, fromC) {
    const item = grid[fromR][fromC];
    if (!item) return false;
    // Check if any customer wants this tier or lower
    for (let i = 0; i < customers.length; i++) {
      if (customers[i].want <= item.tier) {
        const bonus = Math.floor(customers[i].timer / customers[i].maxTimer * 50) + item.tier * 20;
        score += bonus;
        if (onScoreUpdate) onScoreUpdate(score);
        if (window.audioManager) window.audioManager.playScore();
        spawnParticles(GRID_X + fromC * CELL + CELL / 2, GRID_Y + fromR * CELL + CELL / 2, '#ffea00', 16);
        flashMsg = `🍽 ORDER SERVED! +${bonus}`;
        flashTimer = 80;
        customers.splice(i, 1);
        grid[fromR][fromC] = null;
        return true;
      }
    }
    flashMsg = '❓ No customer wants that yet!';
    flashTimer = 50;
    return false;
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, spd = 2 + Math.random() * 3;
      particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, alpha: 1, color, r: 2 + Math.random() * 3 });
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
    if (cell && grid[cell.r][cell.c]) { dragging = cell; dragPos = { x, y }; }
  });
  canvas.addEventListener('mousemove', (e) => { if (dragging) dragPos = getPointerPos(e); });
  canvas.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    const { x, y } = getPointerPos(e);
    // Check if dropped on customer (top area)
    if (y < GRID_Y - 10) {
      serveCustomer(dragging.r, dragging.c);
    } else {
      const cell = cellFromXY(x, y);
      if (cell && (cell.r !== dragging.r || cell.c !== dragging.c)) tryMerge(dragging, cell);
    }
    dragging = null;
  });
  canvas.addEventListener('touchstart', (e) => {
    const { x, y } = getPointerPos(e);
    const cell = cellFromXY(x, y);
    if (cell && grid[cell.r][cell.c]) { dragging = cell; dragPos = { x, y }; }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { if (dragging) dragPos = getPointerPos(e); e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    if (!dragging) return;
    const { x, y } = getPointerPos(e);
    if (y < GRID_Y - 10) {
      serveCustomer(dragging.r, dragging.c);
    } else {
      const cell = cellFromXY(x, y);
      if (cell && (cell.r !== dragging.r || cell.c !== dragging.c)) tryMerge(dragging, cell);
    }
    dragging = null;
    e.preventDefault();
  }, { passive: false });

  window.destroyMergeRestaurant = function() { active = false; };

  function update() {
    frame++;
    if (flashTimer > 0) flashTimer--;

    // Spawn timer
    spawnTimer++;
    if (spawnTimer >= SPAWN_INTERVAL) {
      spawnIngredient();
      spawnTimer = 0;
    }

    // Order timer
    orderTimer++;
    if (orderTimer >= ORDER_INTERVAL) {
      spawnCustomer();
      orderTimer = 0;
    }

    // Tick customers
    for (let i = customers.length - 1; i >= 0; i--) {
      customers[i].timer--;
      if (customers[i].timer <= 0) {
        customers.splice(i, 1);
        lives--;
        if (window.audioManager) window.audioManager.playExplosion();
        flashMsg = `⏰ CUSTOMER LEFT! Lives: ${lives}`;
        flashTimer = 80;
        if (lives <= 0) { active = false; if (onGameOver) onGameOver(score); return; }
      }
    }

    // Check if grid is full
    let allFull = true;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (!grid[r][c]) { allFull = false; break; }
    if (allFull) { active = false; if (onGameOver) onGameOver(score); return; }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.alpha -= 0.04;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  function render() {
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, W, H);

    // Counter / customer area at top
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath(); ctx.roundRect(10, 10, W - 20, 72, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1; ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = "bold 12px 'Space Grotesk', sans-serif";
    ctx.fillText('DRAG FOOD HERE TO SERVE ↑', 16, 26);

    // Draw customers
    customers.forEach((cust, i) => {
      const cx = 80 + i * 180;
      const cy = 52;
      const pct = cust.timer / cust.maxTimer;
      const timerColor = pct > 0.5 ? '#39ff14' : pct > 0.25 ? '#ffea00' : '#ff007f';

      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.roundRect(cx - 60, 30, 130, 48, 8); ctx.fill();
      ctx.strokeStyle = timerColor + '88'; ctx.lineWidth = 1.5; ctx.stroke();

      ctx.font = `28px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(INGREDIENTS[cust.want].label, cx, cy - 2);

      ctx.font = `10px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(`WANTS: ${INGREDIENTS[cust.want].name}`, cx, cy + 14);

      // Timer bar
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(cx - 50, cy + 20, 100, 4);
      ctx.fillStyle = timerColor;
      ctx.fillRect(cx - 50, cy + 20, 100 * pct, 4);
    });
    ctx.textAlign = 'left';

    // Grid
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = GRID_X + c * CELL, y = GRID_Y + r * CELL;
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.beginPath(); ctx.roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 10); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 0.5; ctx.stroke();

        const ing = grid[r][c];
        if (ing && !(dragging && dragging.r === r && dragging.c === c)) {
          const info = INGREDIENTS[ing.tier];
          ctx.save();
          ctx.shadowBlur = 12; ctx.shadowColor = info.color;
          ctx.fillStyle = info.color + '33';
          ctx.beginPath(); ctx.roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 8); ctx.fill();
          ctx.strokeStyle = info.color; ctx.lineWidth = 2; ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.font = `${CELL * 0.42}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(info.label, x + CELL / 2, y + CELL / 2 - 4);
          ctx.font = `bold 9px 'Space Grotesk', sans-serif`;
          ctx.fillStyle = info.color;
          ctx.fillText(info.name, x + CELL / 2, y + CELL - 10);
          ctx.restore();
        }
      }
    }

    // Dragging item
    if (dragging && grid[dragging.r][dragging.c]) {
      const info = INGREDIENTS[grid[dragging.r][dragging.c].tier];
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.shadowBlur = 16; ctx.shadowColor = info.color;
      ctx.fillStyle = info.color + '55';
      ctx.beginPath(); ctx.roundRect(dragPos.x - CELL / 2 + 4, dragPos.y - CELL / 2 + 4, CELL - 8, CELL - 8, 8); ctx.fill();
      ctx.strokeStyle = info.color; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = `${CELL * 0.42}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(info.label, dragPos.x, dragPos.y - 4);
      ctx.restore();
    }

    // Sidebar: merge recipe
    const SX = GRID_X + COLS * CELL + 16;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath(); ctx.roundRect(SX, GRID_Y, W - SX - 10, ROWS * CELL, 10); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = "bold 12px 'Space Grotesk', sans-serif";
    ctx.fillText('RECIPE', SX + 8, GRID_Y + 18);
    INGREDIENTS.forEach((ing, i) => {
      const ry = GRID_Y + 30 + i * 48;
      ctx.font = `22px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(ing.label, SX + 8, ry + 24);
      ctx.font = `10px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = ing.color;
      ctx.fillText(ing.name, SX + 36, ry + 14);
      if (i < INGREDIENTS.length - 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillText('+ same → next', SX + 36, ry + 28);
      }
    });
    ctx.textAlign = 'left';

    // Particles
    particles.forEach(p => {
      ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = "bold 20px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'right';
    ctx.fillText(`SCORE: ${score}`, W - 10, H - 24);
    for (let l = 0; l < 5; l++) {
      ctx.globalAlpha = l < lives ? 1 : 0.15;
      ctx.font = "16px sans-serif";
      ctx.fillText('❤️', W - 10 - l * 24, H - 8);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

    // Spawn countdown
    const spawnPct = spawnTimer / SPAWN_INTERVAL;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(GRID_X, GRID_Y + ROWS * CELL + 6, COLS * CELL, 5);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(GRID_X, GRID_Y + ROWS * CELL + 6, COLS * CELL * spawnPct, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = "10px 'Space Grotesk', sans-serif";
    ctx.fillText('NEXT INGREDIENT ↑', GRID_X, GRID_Y + ROWS * CELL + 22);

    // Flash
    if (flashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, flashTimer / 25);
      ctx.font = "bold 20px 'Space Grotesk', sans-serif";
      ctx.fillStyle = '#ffea00';
      ctx.shadowBlur = 12; ctx.shadowColor = '#ffea00';
      ctx.textAlign = 'center';
      ctx.fillText(flashMsg, W / 2, H - 50);
      ctx.restore();
    }

    // Hint
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = "11px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'left';
    ctx.fillText('DRAG SAME ITEMS TO MERGE — DRAG FOOD UP TO SERVE CUSTOMERS', GRID_X, H - 8);
  }

  function loop() {
    if (!active) return;
    update();
    render();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
};
