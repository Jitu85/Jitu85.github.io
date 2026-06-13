window.initSpaceDefender = function(canvas, onGameOver, onScoreUpdate) {
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
  let wave = 1;
  let waveDelay = 0;

  // Player
  const player = { x: W / 2, y: H - 50, w: 44, h: 32, speed: 5, lives: 3, invincible: 0 };
  const keys = {};
  const bullets = [];
  const enemyBullets = [];
  const enemies = [];
  const particles = [];
  let shootCooldown = 0;
  let bossActive = false;
  let boss = null;

  function spawnWave() {
    enemies.length = 0;
    bossActive = false;
    boss = null;
    if (wave % 5 === 0) {
      // Boss wave
      bossActive = true;
      boss = { x: W / 2, y: 80, w: 80, h: 50, hp: 20 + wave * 5, maxHp: 20 + wave * 5, dx: 1.5, shootTimer: 0 };
    } else {
      const rows = Math.min(3 + Math.floor(wave / 2), 5);
      const cols = Math.min(6 + wave, 10);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          enemies.push({
            x: 50 + c * ((W - 100) / cols),
            y: 50 + r * 45,
            w: 28, h: 22,
            hp: 1 + Math.floor(wave / 3),
            type: r === 0 ? 'elite' : 'basic',
            shootTimer: Math.floor(Math.random() * 180),
          });
        }
      }
    }
  }

  spawnWave();

  function spawnParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 1.5 + Math.random() * 3;
      particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, alpha: 1, color, r: 2 + Math.random() * 3 });
    }
  }

  function handleKeydown(e) {
    keys[e.key] = true;
    if ((e.key === ' ' || e.key === 'ArrowUp') && active) { e.preventDefault(); }
  }
  function handleKeyup(e) { keys[e.key] = false; }

  let touchLeft = false, touchRight = false;
  canvas.addEventListener('touchstart', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    Array.from(e.touches).forEach(t => {
      const x = (t.clientX - rect.left) * scaleX;
      if (x < W / 2) touchLeft = true; else touchRight = true;
    });
    // Tap anywhere to also fire
    if (shootCooldown <= 0 && active) fireBullet();
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    touchLeft = false; touchRight = false;
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('keyup', handleKeyup);

  window.destroySpaceDefender = function() {
    active = false;
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('keyup', handleKeyup);
  };

  function fireBullet() {
    bullets.push({ x: player.x, y: player.y - player.h / 2 - 5, speed: 10, color: '#39ff14' });
    if (window.audioManager) window.audioManager.playBlip();
    shootCooldown = 12;
  }

  function update() {
    frame++;
    if (player.invincible > 0) player.invincible--;
    if (shootCooldown > 0) shootCooldown--;
    if (waveDelay > 0) { waveDelay--; if (waveDelay === 0) spawnWave(); return; }

    // Player movement
    if ((keys['ArrowLeft'] || keys['a'] || touchLeft) && player.x - player.w / 2 > 0)
      player.x -= player.speed;
    if ((keys['ArrowRight'] || keys['d'] || touchRight) && player.x + player.w / 2 < W)
      player.x += player.speed;

    // Auto fire on space
    if ((keys[' '] || keys['ArrowUp']) && shootCooldown <= 0) fireBullet();

    // Player bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.y -= b.speed;
      if (b.y < 0) { bullets.splice(i, 1); continue; }

      // Boss collision
      if (boss && b.x > boss.x - boss.w / 2 && b.x < boss.x + boss.w / 2 && b.y > boss.y - boss.h / 2 && b.y < boss.y + boss.h / 2) {
        boss.hp--;
        spawnParticles(b.x, b.y, '#ff007f', 6);
        bullets.splice(i, 1);
        if (boss.hp <= 0) {
          spawnParticles(boss.x, boss.y, '#ff007f', 30);
          score += 500;
          if (window.audioManager) window.audioManager.playExplosion();
          boss = null; bossActive = false;
          wave++;
          waveDelay = 120;
        }
        continue;
      }

      // Enemy collision
      let hit = false;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const en = enemies[j];
        if (b.x > en.x - en.w / 2 && b.x < en.x + en.w / 2 && b.y > en.y - en.h / 2 && b.y < en.y + en.h / 2) {
          en.hp--;
          spawnParticles(b.x, b.y, en.type === 'elite' ? '#b026ff' : '#ff007f', 6);
          if (en.hp <= 0) {
            score += en.type === 'elite' ? 30 : 10;
            if (window.audioManager) window.audioManager.playExplosion();
            spawnParticles(en.x, en.y, en.type === 'elite' ? '#b026ff' : '#ff007f', 12);
            enemies.splice(j, 1);
          }
          hit = true;
          break;
        }
      }
      if (hit) { bullets.splice(i, 1); if (onScoreUpdate) onScoreUpdate(score); }
    }

    // Enemy movement + shooting
    const drift = Math.sin(frame * 0.012) * 60;
    enemies.forEach(en => {
      en.x += drift * 0.015;
      en.shootTimer--;
      if (en.shootTimer <= 0) {
        en.shootTimer = 150 + Math.floor(Math.random() * 100) - Math.min(wave * 5, 80);
        enemyBullets.push({ x: en.x, y: en.y + en.h / 2, speed: 3 + wave * 0.3, color: '#ff007f' });
      }
      // Reached player line
      if (en.y + en.h / 2 >= player.y - 10) {
        active = false;
        if (onGameOver) onGameOver(score);
      }
    });

    // Boss movement
    if (boss) {
      boss.x += boss.dx * (1 + wave * 0.1);
      if (boss.x > W - boss.w / 2 || boss.x < boss.w / 2) boss.dx *= -1;
      boss.shootTimer++;
      if (boss.shootTimer >= 40) {
        boss.shootTimer = 0;
        const angles = [-0.3, 0, 0.3];
        angles.forEach(a => {
          enemyBullets.push({ x: boss.x, y: boss.y + boss.h / 2, speed: 4, color: '#ff007f', vx: Math.sin(a) * 4, vy: 4 });
        });
      }
    }

    // Enemy bullets
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.y += b.speed;
      if (b.vx) b.x += b.vx;
      if (b.y > H) { enemyBullets.splice(i, 1); continue; }
      // Player hit
      if (player.invincible <= 0 && Math.abs(b.x - player.x) < player.w / 2 + 5 && Math.abs(b.y - player.y) < player.h / 2 + 5) {
        player.lives--;
        player.invincible = 90;
        if (window.audioManager) window.audioManager.playExplosion();
        spawnParticles(player.x, player.y, '#00f0ff', 15);
        enemyBullets.splice(i, 1);
        if (player.lives <= 0) { active = false; if (onGameOver) onGameOver(score); }
        continue;
      }
    }

    // Wave cleared
    if (!bossActive && enemies.length === 0) {
      score += wave * 50;
      if (onScoreUpdate) onScoreUpdate(score);
      wave++;
      waveDelay = 120;
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.alpha -= 0.035;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  function drawShip(x, y, color, w, h, flipped = false) {
    ctx.save();
    ctx.translate(x, y);
    if (flipped) ctx.scale(1, -1);
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(w / 2, h / 2);
    ctx.lineTo(w / 4, h / 3);
    ctx.lineTo(-w / 4, h / 3);
    ctx.lineTo(-w / 2, h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function render() {
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (let s = 0; s < 60; s++) {
      const sx = (s * 173 + frame * 0.3) % W;
      const sy = (s * 97 + frame * (0.5 + s % 3 * 0.2)) % H;
      ctx.fillStyle = `rgba(255,255,255,${0.1 + (s % 5) * 0.1})`;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // Player
    if (player.invincible <= 0 || frame % 6 < 3) {
      drawShip(player.x, player.y, '#00f0ff', player.w, player.h);
      // Thruster glow
      ctx.fillStyle = '#39ff14';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#39ff14';
      ctx.fillRect(player.x - 6, player.y + player.h / 2, 12, 5);
      ctx.shadowBlur = 0;
    }

    // Enemies
    enemies.forEach(en => {
      drawShip(en.x, en.y, en.type === 'elite' ? '#b026ff' : '#ff007f', en.w, en.h, true);
    });

    // Boss
    if (boss) {
      ctx.save();
      ctx.translate(boss.x, boss.y);
      ctx.shadowBlur = 25;
      ctx.shadowColor = '#ff007f';
      ctx.fillStyle = '#ff007f';
      ctx.fillRect(-boss.w / 2, -boss.h / 2, boss.w, boss.h);
      // HP bar
      ctx.fillStyle = '#333';
      ctx.fillRect(-boss.w / 2, boss.h / 2 + 5, boss.w, 6);
      ctx.fillStyle = '#ff007f';
      ctx.fillRect(-boss.w / 2, boss.h / 2 + 5, boss.w * (boss.hp / boss.maxHp), 6);
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = "bold 13px 'Space Grotesk', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText('⚡ BOSS', boss.x, boss.y - boss.h / 2 - 8);
      ctx.textAlign = 'left';
    }

    // Player bullets
    bullets.forEach(b => {
      ctx.fillStyle = b.color;
      ctx.shadowBlur = 8; ctx.shadowColor = b.color;
      ctx.fillRect(b.x - 2, b.y - 8, 4, 12);
      ctx.shadowBlur = 0;
    });

    // Enemy bullets
    enemyBullets.forEach(b => {
      ctx.fillStyle = b.color;
      ctx.shadowBlur = 6; ctx.shadowColor = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

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
    ctx.fillText(`SCORE: ${score}`, 12, 28);
    ctx.fillStyle = '#ff007f';
    ctx.textAlign = 'right';
    ctx.fillText(`WAVE ${wave}`, W - 12, 28);
    ctx.textAlign = 'left';
    // Lives
    for (let l = 0; l < 3; l++) {
      ctx.globalAlpha = l < player.lives ? 1 : 0.15;
      ctx.font = "18px sans-serif";
      ctx.fillText('💠', 12 + l * 28, H - 10);
    }
    ctx.globalAlpha = 1;

    // Wave clear banner
    if (waveDelay > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, waveDelay / 40);
      ctx.font = "bold 36px 'Space Grotesk', sans-serif";
      ctx.fillStyle = '#39ff14';
      ctx.shadowBlur = 20; ctx.shadowColor = '#39ff14';
      ctx.textAlign = 'center';
      ctx.fillText(`WAVE ${wave - 1} CLEARED!`, W / 2, H / 2);
      ctx.restore();
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
