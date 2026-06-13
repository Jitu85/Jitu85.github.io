window.initRoadTraffic = function(canvas, onGameOver, onScoreUpdate) {
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
  let level = 1;

  const LANES = 5;
  const LANE_W = 90;
  const ROAD_X = (W - LANES * LANE_W) / 2;
  const CELL_H = H / 8; // 8 rows: top safe, 6 road rows, bottom safe
  const CAR_W = 52, CAR_H = 34;
  const PLAYER_W = 28, PLAYER_H = 28;

  // Player starts at bottom row (row 7), center lane
  const player = { col: 2, row: 7, moving: false, tx: 2, ty: 7, px: 0, py: 0, anim: 0 };

  // Cars: [{lane, row, dx, x}]
  let cars = [];
  let logs = []; // row 0 = water? No, we do road only. Keep simple.
  let particles = [];
  let invincible = 0;
  let deadTimer = 0;
  let winTimer = 0;

  function getX(col) { return ROAD_X + col * LANE_W + LANE_W / 2; }
  function getY(row) { return row * CELL_H + CELL_H / 2; }

  function initCars() {
    cars = [];
    const ROAD_ROWS = [1, 2, 3, 4, 5, 6];
    ROAD_ROWS.forEach((row, i) => {
      const count = 2 + Math.floor(level / 2);
      const speed = (1.2 + level * 0.3) * (i % 2 === 0 ? 1 : -1);
      const spacing = W / count;
      for (let c = 0; c < count; c++) {
        cars.push({
          row,
          x: ROAD_X + (c * spacing) + (i % 2 === 0 ? 0 : spacing / 2),
          dx: speed,
          color: ['#ff007f', '#00f0ff', '#b026ff', '#ffea00', '#39ff14'][Math.floor(Math.random() * 5)],
        });
      }
    });
  }

  initCars();

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 4;
      particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, alpha: 1, color, r: 2 + Math.random() * 3 });
    }
  }

  function movePlayer(dc, dr) {
    if (!active || player.moving || deadTimer > 0 || winTimer > 0) return;
    const newCol = player.col + dc;
    const newRow = player.row + dr;
    if (newCol < 0 || newCol >= LANES) return;
    if (newRow < 0 || newRow > 7) return;
    player.px = getX(player.col);
    player.py = getY(player.row);
    player.col = newCol;
    player.row = newRow;
    player.moving = true;
    player.anim = 0;
    if (window.audioManager) window.audioManager.playBlip();

    // Win condition
    if (player.row === 0) {
      score += 100 + level * 10;
      if (onScoreUpdate) onScoreUpdate(score);
      if (window.audioManager) window.audioManager.playScore();
      winTimer = 90;
    }
  }

  function handleKey(e) {
    if (!active) return;
    switch (e.key) {
      case 'ArrowUp': case 'w': e.preventDefault(); movePlayer(0, -1); break;
      case 'ArrowDown': case 's': e.preventDefault(); movePlayer(0, 1); break;
      case 'ArrowLeft': case 'a': e.preventDefault(); movePlayer(-1, 0); break;
      case 'ArrowRight': case 'd': e.preventDefault(); movePlayer(1, 0); break;
    }
  }

  window.addEventListener('keydown', handleKey);

  // Mobile touch swipe
  let touchStartX = 0, touchStartY = 0;
  canvas.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 20) movePlayer(1, 0); else if (dx < -20) movePlayer(-1, 0);
    } else {
      if (dy < -20) movePlayer(0, -1); else if (dy > 20) movePlayer(0, 1);
    }
    e.preventDefault();
  }, { passive: false });

  window.destroyRoadTraffic = function() {
    active = false;
    window.removeEventListener('keydown', handleKey);
  };

  function update() {
    frame++;
    if (invincible > 0) invincible--;

    // Animate player movement
    if (player.moving) {
      player.anim = Math.min(player.anim + 0.15, 1);
      if (player.anim >= 1) { player.moving = false; player.anim = 1; }
    }

    // Win timer — restart from bottom
    if (winTimer > 0) {
      winTimer--;
      if (winTimer === 0) {
        level++;
        player.col = 2; player.row = 7;
        player.moving = false;
        invincible = 60;
        initCars();
      }
      return;
    }

    if (deadTimer > 0) { deadTimer--; return; }

    // Move cars
    cars.forEach(car => {
      car.x += car.dx;
      if (car.x > W + 60) car.x = ROAD_X - 60;
      if (car.x < ROAD_X - 60) car.x = W + 60;
    });

    // Collision check (only when not moving for simplicity)
    if (!player.moving && invincible <= 0 && player.row >= 1 && player.row <= 6) {
      const px = getX(player.col), py = getY(player.row);
      for (const car of cars) {
        const cy = getY(car.row);
        if (Math.abs(cy - py) < CELL_H * 0.6 && Math.abs(car.x - px) < (LANE_W * 0.48 + PLAYER_W / 2)) {
          // Hit!
          score = Math.max(0, score - 30);
          if (window.audioManager) window.audioManager.playExplosion();
          spawnParticles(px, py, '#ff007f');
          player.col = 2; player.row = 7;
          player.moving = false;
          invincible = 90;
          if (onScoreUpdate) onScoreUpdate(score);
          deadTimer = 60;
          return;
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

  function drawCar(x, y, color) {
    ctx.save();
    ctx.shadowBlur = 10; ctx.shadowColor = color;
    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x - CAR_W / 2, y - CAR_H / 2, CAR_W, CAR_H, 6);
    ctx.fill();
    // Windows
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - CAR_W / 2 + 10, y - CAR_H / 2 + 5, CAR_W - 20, CAR_H - 10);
    ctx.shadowBlur = 0;
    // Headlights
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - CAR_W / 2 + 2, y - 5, 5, 10);
    ctx.fillRect(x + CAR_W / 2 - 7, y - 5, 5, 10);
    ctx.restore();
  }

  function drawPlayer(x, y) {
    const alpha = invincible > 0 ? (frame % 8 < 4 ? 0.4 : 1) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 14; ctx.shadowColor = '#39ff14';
    ctx.font = `${PLAYER_W}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚶', x, y);
    ctx.restore();
  }

  function render() {
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, W, H);

    // Draw rows
    for (let r = 0; r <= 7; r++) {
      const y = r * CELL_H;
      const isRoad = r >= 1 && r <= 6;
      // Road
      ctx.fillStyle = isRoad ? '#0d0d1a' : '#1a2a1a';
      ctx.fillRect(ROAD_X, y, LANES * LANE_W, CELL_H);
      // Lane dividers
      if (isRoad) {
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.setLineDash([12, 10]);
        for (let l = 1; l < LANES; l++) {
          ctx.beginPath();
          ctx.moveTo(ROAD_X + l * LANE_W, y);
          ctx.lineTo(ROAD_X + l * LANE_W, y + CELL_H);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      } else {
        // Safe zone markings
        ctx.strokeStyle = 'rgba(57,255,20,0.2)';
        ctx.lineWidth = 2;
        ctx.strokeRect(ROAD_X + 2, y + 2, LANES * LANE_W - 4, CELL_H - 4);
      }
    }

    // Road borders
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(ROAD_X, 0, LANES * LANE_W, H);

    // Cars
    cars.forEach(car => {
      drawCar(car.x, getY(car.row), car.color);
    });

    // Player
    let px, py;
    if (player.moving && player.anim < 1) {
      const t = player.anim;
      px = player.px + (getX(player.col) - player.px) * t;
      py = player.py + (getY(player.row) - player.py) * t;
    } else {
      px = getX(player.col);
      py = getY(player.row);
    }
    drawPlayer(px, py);

    // Particles
    particles.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = "bold 20px 'Space Grotesk', sans-serif";
    ctx.fillText(`SCORE: ${score}`, 12, 22);
    ctx.fillStyle = '#ffea00';
    ctx.textAlign = 'right';
    ctx.fillText(`LEVEL ${level}`, W - 12, 22);
    ctx.textAlign = 'left';

    // Goal label
    ctx.fillStyle = '#39ff14';
    ctx.font = "bold 11px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('⬆ REACH HERE', ROAD_X + LANES * LANE_W / 2, 14);
    ctx.textAlign = 'left';

    // Win banner
    if (winTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, winTimer / 30);
      ctx.font = "bold 38px 'Space Grotesk', sans-serif";
      ctx.fillStyle = '#39ff14';
      ctx.shadowBlur = 20; ctx.shadowColor = '#39ff14';
      ctx.textAlign = 'center';
      ctx.fillText('YOU MADE IT! +' + (100 + level * 10), W / 2, H / 2);
      ctx.restore();
    }

    // Death flash
    if (deadTimer > 50) {
      ctx.fillStyle = `rgba(255,0,0,${(deadTimer - 50) / 30 * 0.4})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Controls hint
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = "11px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'right';
    ctx.fillText('ARROW KEYS / SWIPE TO MOVE', W - 10, H - 8);
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
