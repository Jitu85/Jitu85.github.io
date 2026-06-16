window.initDodgeBlitz = function(canvas, onGameOver, onScoreUpdate) {
  const ctx = canvas.getContext('2d');
  const W = 640, H = 480;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = '100%'; canvas.style.height = '100%';
  ctx.scale(dpr, dpr);

  let active = true, score = 0, frame = 0, survived = 0;
  let particles = [], projectiles = [], pickups = [];
  let spawnTimer = 0, spawnInterval = 55, pickupTimer = 0;
  let shieldTimer = 0, speedBoost = false, speedBoostTimer = 0;

  // Player
  const player = { x: W / 2, y: H / 2, r: 16, targetX: W / 2, targetY: H / 2, trail: [] };
  let mouseX = W / 2, mouseY = H / 2;

  // Projectile colors
  const PROJ_COLORS = ['#ff007f', '#b026ff', '#ffea00', '#ff6b35'];
  // Stars
  const stars = Array.from({ length: 60 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    r: Math.random() * 1.2 + 0.2, alpha: 0.1 + Math.random() * 0.5
  }));

  function onPointer(e) {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    mouseX = (src.clientX - rect.left) * (W / rect.width);
    mouseY = (src.clientY - rect.top) * (H / rect.height);
    e.preventDefault();
  }
  canvas.addEventListener('mousemove', onPointer);
  canvas.addEventListener('touchmove', onPointer, { passive: false });
  canvas.addEventListener('touchstart', onPointer, { passive: false });

  window.destroyDodgeBlitz = function() {
    active = false;
    canvas.removeEventListener('mousemove', onPointer);
    canvas.removeEventListener('touchmove', onPointer);
    canvas.removeEventListener('touchstart', onPointer);
  };

  function spawnProjectile() {
    // Spawn from a random edge
    const edge = Math.floor(Math.random() * 4);
    let x, y, vx, vy;
    const spd = 2.8 + Math.min(score / 400, 4);
    const spread = (Math.random() - 0.5) * 1.5;

    if (edge === 0) { x = Math.random() * W; y = -12; vx = spread; vy = spd; }
    else if (edge === 1) { x = W + 12; y = Math.random() * H; vx = -spd; vy = spread; }
    else if (edge === 2) { x = Math.random() * W; y = H + 12; vx = spread; vy = -spd; }
    else { x = -12; y = Math.random() * H; vx = spd; vy = spread; }

    // Homing factor — slightly aim toward player
    const dx = player.x - x, dy = player.y - y;
    const dist = Math.hypot(dx, dy) || 1;
    const homing = 0.15 + Math.min(score / 1000, 0.35);
    vx += (dx / dist) * spd * homing;
    vy += (dy / dist) * spd * homing;
    // Normalize back to speed
    const mag = Math.hypot(vx, vy) || 1;
    vx = vx / mag * spd; vy = vy / mag * spd;

    const col = PROJ_COLORS[Math.floor(Math.random() * PROJ_COLORS.length)];
    const size = 6 + Math.random() * 8;
    projectiles.push({ x, y, vx, vy, r: size, color: col, trail: [] });
  }

  function spawnPickup() {
    pickups.push({
      x: 60 + Math.random() * (W - 120),
      y: 60 + Math.random() * (H - 120),
      r: 14, type: Math.random() < 0.6 ? 'shield' : 'speed',
      life: 240, maxLife: 240, pulse: 0
    });
  }

  function emit(x, y, col, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 4;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, alpha: 1, color: col, r: 2 + Math.random() * 3 });
    }
  }

  function update() {
    frame++;
    survived++;
    score = Math.floor(survived / 2);
    if (frame % 120 === 0 && onScoreUpdate) onScoreUpdate(score);

    // Player movement — smooth follow mouse
    const spd = speedBoost ? 10 : 5.5;
    const dx = mouseX - player.x, dy = mouseY - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 2) {
      player.x += (dx / dist) * Math.min(spd, dist);
      player.y += (dy / dist) * Math.min(spd, dist);
    }
    player.x = Math.max(player.r, Math.min(W - player.r, player.x));
    player.y = Math.max(player.r, Math.min(H - player.r, player.y));
    player.trail.push({ x: player.x, y: player.y });
    if (player.trail.length > 10) player.trail.shift();

    if (shieldTimer > 0) shieldTimer--;
    if (speedBoostTimer > 0) { speedBoostTimer--; if (speedBoostTimer === 0) speedBoost = false; }

    // Spawn projectiles
    spawnTimer++;
    spawnInterval = Math.max(18, 55 - Math.floor(score / 100) * 3);
    if (spawnTimer >= spawnInterval) { spawnProjectile(); spawnTimer = 0; }

    // Pickup spawn
    pickupTimer++;
    if (pickupTimer >= 300 && pickups.length < 2) { spawnPickup(); pickupTimer = 0; }

    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 8) p.trail.shift();
      p.x += p.vx; p.y += p.vy;
      if (p.x < -50 || p.x > W + 50 || p.y < -50 || p.y > H + 50) {
        projectiles.splice(i, 1); continue;
      }
      // Collision with player
      if (shieldTimer <= 0 && Math.hypot(p.x - player.x, p.y - player.y) < p.r + player.r - 4) {
        active = false;
        emit(player.x, player.y, '#00f0ff', 35);
        if (window.audioManager) window.audioManager.playExplosion();
        if (onGameOver) onGameOver(score); return;
      }
    }

    // Pickups
    for (let i = pickups.length - 1; i >= 0; i--) {
      const pk = pickups[i];
      pk.pulse += 0.08; pk.life--;
      if (pk.life <= 0) { pickups.splice(i, 1); continue; }
      if (Math.hypot(pk.x - player.x, pk.y - player.y) < pk.r + player.r) {
        if (pk.type === 'shield') { shieldTimer = 180; emit(player.x, player.y, '#00f0ff', 16); }
        else { speedBoost = true; speedBoostTimer = 300; emit(player.x, player.y, '#39ff14', 16); }
        if (window.audioManager) window.audioManager.playScore();
        pickups.splice(i, 1);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96; p.alpha -= 0.025;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  function render() {
    ctx.fillStyle = '#05050f'; ctx.fillRect(0, 0, W, H);
    // Danger ring near edges
    ctx.strokeStyle = 'rgba(255,0,60,0.06)'; ctx.lineWidth = 30;
    ctx.strokeRect(0, 0, W, H);
    // Stars
    stars.forEach(s => {
      ctx.globalAlpha = s.alpha; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    // Grid
    ctx.strokeStyle = 'rgba(0,240,255,0.025)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Pickups
    pickups.forEach(pk => {
      const pulse = 1 + Math.sin(pk.pulse) * 0.12;
      const pct = pk.life / pk.maxLife;
      const col = pk.type === 'shield' ? '#00f0ff' : '#39ff14';
      ctx.globalAlpha = Math.min(1, pct * 3);
      ctx.shadowBlur = 20; ctx.shadowColor = col;
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(pk.x, pk.y, pk.r * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pk.type === 'shield' ? '🛡️' : '⚡', pk.x, pk.y);
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    });

    // Projectiles
    projectiles.forEach(p => {
      p.trail.forEach((t, idx) => {
        ctx.globalAlpha = (idx / p.trail.length) * 0.4;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(t.x, t.y, p.r * (idx / p.trail.length) * 0.7, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 14; ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      // White core
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Player trail
    player.trail.forEach((t, idx) => {
      ctx.globalAlpha = (idx / player.trail.length) * 0.25;
      ctx.fillStyle = speedBoost ? '#39ff14' : '#00f0ff';
      ctx.beginPath(); ctx.arc(t.x, t.y, player.r * (idx / player.trail.length) * 0.6, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Shield ring
    if (shieldTimer > 0) {
      const shieldAlpha = Math.min(1, shieldTimer / 30);
      ctx.globalAlpha = shieldAlpha * 0.7;
      ctx.strokeStyle = '#00f0ff'; ctx.shadowBlur = 20; ctx.shadowColor = '#00f0ff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(player.x, player.y, player.r + 10, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    // Player
    const playerCol = speedBoost ? '#39ff14' : '#00f0ff';
    ctx.shadowBlur = 20; ctx.shadowColor = playerCol;
    ctx.fillStyle = playerCol;
    ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(player.x - player.r * 0.28, player.y - player.r * 0.28, player.r * 0.35, 0, Math.PI * 2); ctx.fill();
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
    ctx.fillStyle = '#39ff14'; ctx.textAlign = 'right';
    ctx.fillText(`WAVE ${Math.floor(score / 100) + 1}`, W - 12, 28);
    if (shieldTimer > 0) {
      ctx.fillStyle = '#00f0ff'; ctx.shadowBlur = 10; ctx.shadowColor = '#00f0ff';
      ctx.textAlign = 'center'; ctx.font = "bold 14px 'Space Grotesk',sans-serif";
      ctx.fillText(`🛡️ SHIELD ${Math.ceil(shieldTimer / 60)}s`, W / 2, 28);
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = "11px 'Space Grotesk',sans-serif"; ctx.textAlign = 'center';
    ctx.fillText('MOVE MOUSE / TOUCH TO DODGE · COLLECT POWER-UPS', W / 2, H - 12);
  }

  function loop() { if (!active) return; update(); render(); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
};
