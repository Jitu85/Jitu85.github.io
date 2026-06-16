window.initAsteroidBlast = function(canvas, onGameOver, onScoreUpdate) {
  const ctx = canvas.getContext('2d');
  const W = 640, H = 480;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = '100%'; canvas.style.height = '100%';
  ctx.scale(dpr, dpr);

  let active = true, score = 0, lives = 3, level = 1, frame = 0;
  let invincible = 0, shootTimer = 0, levelDelay = 0;
  let particles = [], bullets = [], asteroids = [];

  const stars = Array.from({ length: 80 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    r: Math.random() * 1.5 + 0.3, alpha: 0.2 + Math.random() * 0.6
  }));

  const ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2, radius: 15 };
  const keys = {};
  let touchLeft = false, touchRight = false, touchThrust = false, touchShoot = false;

  function makeAsteroid(x, y, size) {
    const sides = 6 + Math.floor(Math.random() * 5);
    const offs = Array.from({ length: sides }, () => 0.7 + Math.random() * 0.6);
    const speed = (0.6 + Math.random() * 1.2) * (1 + level * 0.1);
    const ang = Math.random() * Math.PI * 2;
    return {
      x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      size, radius: size === 3 ? 40 : size === 2 ? 22 : 11,
      angle: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.04,
      sides, offs
    };
  }

  function buildLevel() {
    asteroids = [];
    for (let i = 0; i < 3 + level; i++) {
      let x, y;
      do { x = Math.random() * W; y = Math.random() * H; }
      while (Math.hypot(x - ship.x, y - ship.y) < 130);
      asteroids.push(makeAsteroid(x, y, 3));
    }
    levelDelay = 0;
  }
  buildLevel();

  function wrap(o) {
    if (o.x > W + 55) o.x -= W + 110; if (o.x < -55) o.x += W + 110;
    if (o.y > H + 55) o.y -= H + 110; if (o.y < -55) o.y += H + 110;
  }
  function emit(x, y, col, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 5;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, alpha: 1, color: col, r: 2 + Math.random() * 4 });
    }
  }

  function fire() {
    bullets.push({
      x: ship.x + Math.cos(ship.angle) * (ship.radius + 6),
      y: ship.y + Math.sin(ship.angle) * (ship.radius + 6),
      vx: Math.cos(ship.angle) * 11 + ship.vx * 0.4,
      vy: Math.sin(ship.angle) * 11 + ship.vy * 0.4,
      life: 65, trail: []
    });
    if (window.audioManager) window.audioManager.playBlip();
  }

  function onKeydown(e) { keys[e.key] = true; if ([' ','ArrowUp','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault(); }
  function onKeyup(e) { keys[e.key] = false; }
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('keyup', onKeyup);

  canvas.addEventListener('touchstart', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    Array.from(e.touches).forEach(t => {
      const x = (t.clientX - rect.left) * scaleX, y = (t.clientY - rect.top) * scaleY;
      if (x < W * 0.25) touchLeft = true;
      else if (x > W * 0.75) touchRight = true;
      else if (y < H * 0.38) touchShoot = true;
      else touchThrust = true;
    });
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', () => { touchLeft = touchRight = touchThrust = touchShoot = false; });

  window.destroyAsteroidBlast = function() {
    active = false;
    window.removeEventListener('keydown', onKeydown);
    window.removeEventListener('keyup', onKeyup);
  };

  function update() {
    frame++;
    if (invincible > 0) invincible--;
    if (shootTimer > 0) shootTimer--;
    if (levelDelay > 0) { levelDelay--; if (levelDelay === 0) buildLevel(); return; }

    // Ship controls
    if (keys['ArrowLeft'] || keys['a'] || touchLeft) ship.angle -= 0.058;
    if (keys['ArrowRight'] || keys['d'] || touchRight) ship.angle += 0.058;
    const thrusting = keys['ArrowUp'] || keys['w'] || touchThrust;
    if (thrusting) {
      ship.vx += Math.cos(ship.angle) * 0.18;
      ship.vy += Math.sin(ship.angle) * 0.18;
      if (frame % 2 === 0) {
        const back = ship.angle + Math.PI;
        particles.push({
          x: ship.x + Math.cos(back) * ship.radius,
          y: ship.y + Math.sin(back) * ship.radius,
          vx: Math.cos(back) * (2 + Math.random() * 2) + ship.vx * 0.25,
          vy: Math.sin(back) * (2 + Math.random() * 2) + ship.vy * 0.25,
          alpha: 1, color: frame % 3 === 0 ? '#ff007f' : '#ffea00', r: 2 + Math.random() * 2
        });
      }
    }
    ship.vx *= 0.984; ship.vy *= 0.984;
    const spd = Math.hypot(ship.vx, ship.vy);
    if (spd > 7) { ship.vx = ship.vx / spd * 7; ship.vy = ship.vy / spd * 7; }
    ship.x += ship.vx; ship.y += ship.vy; wrap(ship);

    if ((keys[' '] || touchShoot) && shootTimer <= 0) { fire(); shootTimer = 11; }

    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 7) b.trail.shift();
      b.x += b.vx; b.y += b.vy; b.life--;
      wrap(b);
      if (b.life <= 0) { bullets.splice(i, 1); continue; }

      let hit = false;
      for (let j = asteroids.length - 1; j >= 0; j--) {
        const a = asteroids[j];
        if (Math.hypot(b.x - a.x, b.y - a.y) < a.radius) {
          emit(b.x, b.y, '#00f0ff', 8);
          bullets.splice(i, 1); hit = true;
          if (--a.hp === undefined || a.hp === undefined) a.hp = a.size;
          a.hp = (a.hp || a.size) - 1;
          if (a.hp <= 0) {
            const col = a.size === 3 ? '#b026ff' : a.size === 2 ? '#00f0ff' : '#ffea00';
            emit(a.x, a.y, col, 18);
            if (window.audioManager) window.audioManager.playExplosion();
            score += (4 - a.size) * 25 * level; if (onScoreUpdate) onScoreUpdate(score);
            if (a.size > 1) {
              asteroids.push(makeAsteroid(a.x + 10, a.y + 10, a.size - 1));
              asteroids.push(makeAsteroid(a.x - 10, a.y - 10, a.size - 1));
            }
            asteroids.splice(j, 1);
          }
          break;
        }
      }
      if (hit) continue;
    }

    // Init HP if missing
    asteroids.forEach(a => { if (a.hp === undefined) a.hp = a.size; });

    // Asteroids
    asteroids.forEach(a => {
      a.x += a.vx; a.y += a.vy; a.angle += a.rotSpeed; wrap(a);
      if (invincible <= 0 && Math.hypot(ship.x - a.x, ship.y - a.y) < ship.radius + a.radius - 6) {
        lives--; invincible = 130;
        emit(ship.x, ship.y, '#00f0ff', 28);
        if (window.audioManager) window.audioManager.playExplosion();
        if (lives <= 0) { active = false; if (onGameOver) onGameOver(score); }
      }
    });

    if (asteroids.length === 0 && levelDelay === 0) {
      level++; score += 250 * level; if (onScoreUpdate) onScoreUpdate(score); levelDelay = 130;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vx *= 0.97; p.vy *= 0.97; p.alpha -= 0.022;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  function drawAsteroid(a) {
    ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.angle);
    const col = a.size === 3 ? '#b026ff' : a.size === 2 ? '#00f0ff' : '#ffea00';
    ctx.shadowBlur = 14; ctx.shadowColor = col;
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.fillStyle = `rgba(${a.size === 3 ? '176,38,255' : a.size === 2 ? '0,240,255' : '255,234,0'},0.1)`;
    ctx.beginPath();
    for (let i = 0; i < a.sides; i++) {
      const ang = (i / a.sides) * Math.PI * 2;
      const r = a.radius * a.offs[i];
      i === 0 ? ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r)
              : ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function render() {
    ctx.fillStyle = '#05050f'; ctx.fillRect(0, 0, W, H);
    stars.forEach(s => {
      ctx.globalAlpha = s.alpha; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    asteroids.forEach(drawAsteroid);

    bullets.forEach(b => {
      b.trail.forEach((t, idx) => {
        ctx.globalAlpha = (idx / b.trail.length) * 0.5;
        ctx.fillStyle = '#39ff14';
        ctx.beginPath(); ctx.arc(t.x, t.y, 2, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#39ff14'; ctx.shadowBlur = 10; ctx.shadowColor = '#39ff14';
      ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    if (invincible <= 0 || frame % 5 < 3) {
      ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.angle);
      ctx.shadowBlur = 20; ctx.shadowColor = '#00f0ff';
      ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2.5;
      ctx.fillStyle = 'rgba(0,240,255,0.12)';
      ctx.beginPath();
      ctx.moveTo(ship.radius, 0);
      ctx.lineTo(-ship.radius * 0.7, -ship.radius * 0.6);
      ctx.lineTo(-ship.radius * 0.35, 0);
      ctx.lineTo(-ship.radius * 0.7, ship.radius * 0.6);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    particles.forEach(p => {
      ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.shadowBlur = 7; ctx.shadowColor = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff'; ctx.font = "bold 20px 'Space Grotesk',sans-serif"; ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${score}`, 12, 28);
    ctx.fillStyle = '#b026ff'; ctx.textAlign = 'right';
    ctx.fillText(`LEVEL ${level}`, W - 12, 28);
    for (let l = 0; l < 3; l++) {
      ctx.globalAlpha = l < lives ? 1 : 0.15; ctx.font = '17px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText('💠', W - 10 - l * 26, H - 10);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = "11px 'Space Grotesk',sans-serif";
    ctx.fillText('← → ROTATE  ↑ THRUST  SPACE FIRE', 10, H - 10);

    if (levelDelay > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, levelDelay / 40);
      ctx.font = "bold 36px 'Space Grotesk',sans-serif"; ctx.fillStyle = '#39ff14';
      ctx.shadowBlur = 22; ctx.shadowColor = '#39ff14'; ctx.textAlign = 'center';
      ctx.fillText(`SECTOR ${level - 1} CLEARED!`, W / 2, H / 2); ctx.restore();
    }
  }

  function loop() { if (!active) return; update(); render(); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
};
