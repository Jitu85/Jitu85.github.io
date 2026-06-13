window.initMathMahjong = function(canvas, onGameOver, onScoreUpdate) {
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
  let timeLeft = 120;
  let lastSecond = performance.now();

  const TILE_W = 62, TILE_H = 48;
  const COLS = 8, ROWS = 5;
  const GRID_X = (W - COLS * (TILE_W + 4)) / 2;
  const GRID_Y = 60;
  const PAD = 4;

  let target = 0;
  let tiles = [];
  let selected = [];
  let particles = [];
  let flashMsg = '';
  let flashTimer = 0;
  let removingTiles = new Set();

  const COLORS = ['#ff007f', '#00f0ff', '#b026ff', '#ffea00', '#39ff14'];

  function newRound() {
    target = 5 + Math.floor(Math.random() * 16); // target 5-20
    tiles = [];
    removingTiles.clear();
    selected = [];
    let id = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const val = 1 + Math.floor(Math.random() * 9);
        tiles.push({ id: id++, r, c, val, color: COLORS[Math.floor(Math.random() * COLORS.length)], alive: true });
      }
    }
  }

  newRound();

  function getSelectedSum() { return selected.reduce((s, t) => s + t.val, 0); }

  function tryMatch() {
    const sum = getSelectedSum();
    if (sum === target) {
      // Match!
      selected.forEach(t => {
        removingTiles.add(t.id);
        spawnParticles(
          GRID_X + t.c * (TILE_W + PAD) + TILE_W / 2,
          GRID_Y + t.r * (TILE_H + PAD) + TILE_H / 2,
          t.color, 12
        );
        t.alive = false;
      });
      const pts = selected.length * 20;
      score += pts;
      if (onScoreUpdate) onScoreUpdate(score);
      if (window.audioManager) window.audioManager.playScore();
      flashMsg = `✅ SUM = ${target}! +${pts}`;
      flashTimer = 80;
      selected = [];

      // Check if board cleared
      const anyAlive = tiles.some(t => t.alive);
      if (!anyAlive) {
        score += 200;
        if (onScoreUpdate) onScoreUpdate(score);
        flashMsg = '🏆 BOARD CLEARED! +200';
        flashTimer = 120;
        setTimeout(() => { if (active) newRound(); }, 1500);
      }
    } else if (sum > target) {
      flashMsg = `❌ ${sum} > ${target}, RESET`;
      flashTimer = 60;
      if (window.audioManager) window.audioManager.playBlip();
      selected = [];
    }
  }

  function handleClick(e) {
    if (!active) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    const src = e.touches ? e.touches[0] : e;
    const x = (src.clientX - rect.left) * scaleX;
    const y = (src.clientY - rect.top) * scaleY;

    // New target button
    if (x > W - 130 && x < W - 10 && y > 50 && y < 76) {
      newRound();
      return;
    }

    for (const tile of tiles) {
      if (!tile.alive) continue;
      const tx = GRID_X + tile.c * (TILE_W + PAD);
      const ty = GRID_Y + tile.r * (TILE_H + PAD);
      if (x >= tx && x <= tx + TILE_W && y >= ty && y <= ty + TILE_H) {
        const alreadyIdx = selected.findIndex(s => s.id === tile.id);
        if (alreadyIdx >= 0) {
          selected.splice(alreadyIdx, 1);
        } else {
          selected.push(tile);
          if (window.audioManager) window.audioManager.playBlip();
          tryMatch();
        }
        break;
      }
    }
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, spd = 2 + Math.random() * 3;
      particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, alpha: 1, color, r: 2 + Math.random() * 3 });
    }
  }

  canvas.addEventListener('click', handleClick);
  canvas.addEventListener('touchstart', (e) => { handleClick(e); e.preventDefault(); }, { passive: false });

  window.destroyMathMahjong = function() { active = false; };

  function update() {
    frame++;
    if (flashTimer > 0) flashTimer--;

    const now = performance.now();
    if (now - lastSecond >= 1000) {
      timeLeft--;
      lastSecond = now;
      if (timeLeft <= 0) {
        active = false;
        if (onGameOver) onGameOver(score);
        return;
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.alpha -= 0.04;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  function render() {
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, W, H);

    // Target display
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.roundRect(12, 8, 240, 46, 10);
    ctx.fill();
    ctx.fillStyle = '#ffea00';
    ctx.font = "bold 14px 'Space Grotesk', sans-serif";
    ctx.fillText('TARGET SUM', 22, 28);
    ctx.font = "bold 32px 'Space Grotesk', sans-serif";
    ctx.shadowBlur = 14; ctx.shadowColor = '#ffea00';
    ctx.fillText(target, 130, 44);
    ctx.shadowBlur = 0;

    // Current sum
    const sum = getSelectedSum();
    const sumColor = sum === target ? '#39ff14' : sum > target ? '#ff007f' : '#00f0ff';
    ctx.fillStyle = sumColor;
    ctx.font = "bold 14px 'Space Grotesk', sans-serif";
    ctx.fillText('SELECTED SUM', 270, 28);
    ctx.font = "bold 32px 'Space Grotesk', sans-serif";
    ctx.shadowBlur = 10; ctx.shadowColor = sumColor;
    ctx.fillText(sum, 380, 44);
    ctx.shadowBlur = 0;

    // New round button
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.roundRect(W - 130, 50, 118, 28, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = "bold 12px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('🔄 NEW BOARD', W - 70, 69);
    ctx.textAlign = 'left';

    // Timer
    const timerColor = timeLeft < 30 ? '#ff007f' : '#fff';
    ctx.fillStyle = timerColor;
    ctx.font = "bold 18px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'right';
    ctx.fillText(`⏱ ${timeLeft}s`, W - 12, 38);

    // Score
    ctx.fillStyle = '#fff';
    ctx.fillText(`SCORE: ${score}`, W - 12, 18);
    ctx.textAlign = 'left';

    // Tiles
    tiles.forEach(tile => {
      if (!tile.alive) return;
      const tx = GRID_X + tile.c * (TILE_W + PAD);
      const ty = GRID_Y + tile.r * (TILE_H + PAD);
      const isSel = selected.some(s => s.id === tile.id);
      const pulse = isSel ? 1 + Math.sin(frame * 0.15) * 0.06 : 1;

      ctx.save();
      ctx.translate(tx + TILE_W / 2, ty + TILE_H / 2);
      ctx.scale(pulse, pulse);

      // Tile bg
      ctx.shadowBlur = isSel ? 20 : 8;
      ctx.shadowColor = tile.color;
      ctx.fillStyle = isSel ? tile.color + '55' : tile.color + '22';
      ctx.beginPath();
      ctx.roundRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 8);
      ctx.fill();
      ctx.strokeStyle = isSel ? tile.color : tile.color + '88';
      ctx.lineWidth = isSel ? 2.5 : 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Value
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${isSel ? 28 : 24}px 'Space Grotesk', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tile.val, 0, 0);

      ctx.restore();
    });

    // Particles
    particles.forEach(p => {
      ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Flash
    if (flashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, flashTimer / 25);
      ctx.font = "bold 22px 'Space Grotesk', sans-serif";
      ctx.fillStyle = '#39ff14';
      ctx.shadowBlur = 14; ctx.shadowColor = '#39ff14';
      ctx.textAlign = 'center';
      ctx.fillText(flashMsg, W / 2, GRID_Y + ROWS * (TILE_H + PAD) + 30);
      ctx.restore();
    }

    // Hint
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = "11px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'right';
    ctx.fillText('CLICK TILES WHOSE VALUES SUM TO TARGET', W - 10, H - 8);
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
