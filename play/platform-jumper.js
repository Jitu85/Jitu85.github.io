window.initPlatformJumper = function(canvas, onGameOver, onScoreUpdate) {
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

  // Camera
  let camY = 0; // world Y offset (positive = moved up)

  // Player
  const player = {
    x: W / 2 - 14, y: 380,
    w: 28, h: 36,
    vx: 0, vy: 0,
    onGround: false,
    facing: 1,
    runFrame: 0,
    jumpPow: -14,
    dead: false,
  };

  const GRAVITY = 0.55;
  const SPEED = 4.5;
  const keys = {};
  let particles = [];
  let highestY = player.y;
  let platforms = [];
  let enemies = [];
  let coins = [];
  let deathTimer = 0;

  function genPlatform(worldY) {
    const w = 80 + Math.random() * 120;
    const x = Math.random() * (W - w);
    const moving = Math.random() < 0.2 + score * 0.001;
    return { x, y: worldY, w, h: 14, moving, dx: moving ? (Math.random() < 0.5 ? 1.5 : -1.5) : 0, origX: x };
  }

  function genEnemy(worldY, platX, platW) {
    return { x: platX + Math.random() * (platW - 24), y: worldY - 30, w: 22, h: 22, dx: 1.2, alive: true };
  }

  function genCoin(worldY, platX, platW) {
    return { x: platX + platW / 2, y: worldY - 20, r: 8, collected: false };
  }

  // Generate initial platforms (bottom to top)
  function initPlatforms() {
    platforms = [];
    enemies = [];
    coins = [];
    platforms.push({ x: W / 2 - 70, y: 420, w: 140, h: 14, moving: false, dx: 0 }); // starter
    for (let i = 1; i < 40; i++) {
      const worldY = 420 - i * 85 - Math.random() * 30;
      const p = genPlatform(worldY);
      platforms.push(p);
      if (i > 3 && Math.random() < 0.25) enemies.push(genEnemy(worldY, p.x, p.w));
      if (Math.random() < 0.5) coins.push(genCoin(worldY, p.x, p.w));
    }
  }

  initPlatforms();

  function spawnParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, spd = 2 + Math.random() * 3;
      particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, alpha: 1, color, r: 2 + Math.random() * 3 });
    }
  }

  function handleKeydown(e) {
    keys[e.key] = true;
    if ((e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') && player.onGround && !player.dead) {
      player.vy = player.jumpPow;
      player.onGround = false;
      if (window.audioManager) window.audioManager.playBlip();
      e.preventDefault();
    }
  }
  function handleKeyup(e) { keys[e.key] = false; }
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('keyup', handleKeyup);

  // Mobile buttons
  let touchJump = false, touchLeft = false, touchRight = false;
  const mobileLeft = document.getElementById('runner-left');
  const mobileRight = document.getElementById('runner-right');
  const mobileJump = document.getElementById('runner-up');

  function bindBtn(el, downCb, upCb) {
    if (!el) return;
    el.addEventListener('touchstart', (e) => { downCb(); e.preventDefault(); }, { passive: false });
    el.addEventListener('touchend', (e) => { upCb(); e.preventDefault(); }, { passive: false });
    el.addEventListener('mousedown', downCb);
    el.addEventListener('mouseup', upCb);
  }

  bindBtn(mobileLeft, () => { touchLeft = true; }, () => { touchLeft = false; });
  bindBtn(mobileRight, () => { touchRight = true; }, () => { touchRight = false; });
  bindBtn(mobileJump, () => { if (player.onGround && !player.dead) { player.vy = player.jumpPow; player.onGround = false; if (window.audioManager) window.audioManager.playBlip(); } }, () => {});

  window.destroyPlatformJumper = function() {
    active = false;
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('keyup', handleKeyup);
  };

  function update() {
    frame++;
    if (deathTimer > 0) { deathTimer--; if (deathTimer === 0) { active = false; if (onGameOver) onGameOver(score); } return; }

    const moveLeft = keys['ArrowLeft'] || keys['a'] || touchLeft;
    const moveRight = keys['ArrowRight'] || keys['d'] || touchRight;

    // Horizontal
    if (moveLeft) { player.vx = -SPEED; player.facing = -1; }
    else if (moveRight) { player.vx = SPEED; player.facing = 1; }
    else player.vx *= 0.7;

    // Wrap around walls
    if (player.x + player.w < 0) player.x = W;
    if (player.x > W) player.x = -player.w;

    // Gravity
    player.vy += GRAVITY;
    if (player.vy > 20) player.vy = 20;

    player.x += player.vx;
    player.y += player.vy;

    // Platform collisions
    player.onGround = false;
    platforms.forEach(p => {
      // Move platform
      if (p.moving) {
        p.x += p.dx;
        if (p.x < 0 || p.x + p.w > W) p.dx *= -1;
      }
      // Collision (only when falling down)
      if (player.vy >= 0 &&
          player.x + player.w > p.x + 4 &&
          player.x < p.x + p.w - 4 &&
          player.y + player.h > p.y + camY &&
          player.y + player.h < p.y + camY + p.h + player.vy + 5) {
        player.y = p.y + camY - player.h;
        player.vy = 0;
        player.onGround = true;
      }
    });

    // Camera scroll (scroll up when player goes above center)
    if (player.y < H / 2) {
      const delta = H / 2 - player.y;
      camY += delta;
      player.y = H / 2;
      platforms.forEach(p => { /* already in world space */ });
      // Score = how high we've climbed
      const newScore = Math.round(camY / 10);
      if (newScore > score) {
        score = newScore;
        if (onScoreUpdate) onScoreUpdate(score);
      }
    }

    // Add more platforms as needed
    const topPlatY = Math.min(...platforms.map(p => p.y));
    if (topPlatY + camY > -200) {
      const newWorldY = topPlatY - 85 - Math.random() * 30;
      const p = genPlatform(newWorldY);
      platforms.push(p);
      if (Math.random() < 0.25 + score * 0.0005) enemies.push(genEnemy(newWorldY, p.x, p.w));
      if (Math.random() < 0.4) coins.push(genCoin(newWorldY, p.x, p.w));
    }

    // Remove off-screen platforms
    platforms = platforms.filter(p => p.y + camY < H + 100);
    enemies = enemies.filter(e => e.y + camY < H + 100);
    coins = coins.filter(c => c.y + camY < H + 100);

    // Enemies
    enemies.forEach(en => {
      if (!en.alive) return;
      en.x += en.dx;
      const plat = platforms.find(p => en.y + en.h >= p.y - 2 && en.y + en.h <= p.y + 10 && en.x >= p.x && en.x + en.w <= p.x + p.w + 5);
      if (plat && (en.x < plat.x || en.x + en.w > plat.x + plat.w)) en.dx *= -1;

      // Player-enemy collision
      const ey = en.y + camY;
      if (!player.dead && Math.abs(player.x + player.w / 2 - (en.x + en.w / 2)) < (player.w / 2 + en.w / 2) - 4 &&
          Math.abs(player.y + player.h / 2 - (ey + en.h / 2)) < (player.h / 2 + en.h / 2) - 4) {
        if (player.vy > 0 && player.y + player.h < ey + en.h / 2) {
          // Stomp
          en.alive = false;
          player.vy = -10;
          score += 50;
          if (onScoreUpdate) onScoreUpdate(score);
          if (window.audioManager) window.audioManager.playScore();
          spawnParticles(en.x + en.w / 2, ey, '#ff007f', 12);
        } else {
          // Player hit
          spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#00f0ff', 15);
          if (window.audioManager) window.audioManager.playExplosion();
          player.dead = true;
          deathTimer = 90;
          return;
        }
      }
    });

    // Coins
    coins.forEach(coin => {
      if (coin.collected) return;
      const cy = coin.y + camY;
      if (Math.abs(player.x + player.w / 2 - coin.x) < player.w / 2 + coin.r &&
          Math.abs(player.y + player.h / 2 - cy) < player.h / 2 + coin.r) {
        coin.collected = true;
        score += 10;
        if (onScoreUpdate) onScoreUpdate(score);
        if (window.audioManager) window.audioManager.playBlip();
        spawnParticles(coin.x, cy, '#ffea00', 8);
      }
    });

    // Fall off bottom
    if (player.y > H + 60 && !player.dead) {
      spawnParticles(player.x + player.w / 2, H - 20, '#00f0ff', 15);
      if (window.audioManager) window.audioManager.playExplosion();
      player.dead = true;
      deathTimer = 90;
    }

    // Run animation
    if (Math.abs(player.vx) > 0.5) player.runFrame = Math.floor(frame / 6) % 2;

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.alpha -= 0.04;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  function drawPlayer() {
    if (player.dead) return;
    ctx.save();
    ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
    ctx.scale(player.facing, 1);

    ctx.shadowBlur = 14; ctx.shadowColor = '#00f0ff';
    // Body
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(-player.w / 2, -player.h / 2, player.w, player.h * 0.6);
    // Legs
    ctx.fillStyle = '#0099cc';
    const legOffset = player.onGround ? (player.runFrame === 0 ? -4 : 4) : 0;
    ctx.fillRect(-player.w / 2, -player.h / 2 + player.h * 0.6, player.w / 2 - 2, player.h * 0.4);
    ctx.fillRect(2, -player.h / 2 + player.h * 0.6, player.w / 2 - 2, player.h * 0.4);
    // Visor
    ctx.fillStyle = '#b026ff';
    ctx.fillRect(-player.w / 2 + 4, -player.h / 2 + 4, player.w - 8, 10);

    ctx.restore();
  }

  function render() {
    // BG gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#020008');
    grad.addColorStop(1, '#05050f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (let s = 0; s < 50; s++) {
      const sy = ((s * 97 + camY * 0.1) % H + H) % H;
      ctx.fillStyle = `rgba(255,255,255,${0.1 + (s % 4) * 0.08})`;
      ctx.fillRect((s * 173) % W, sy, 1.5, 1.5);
    }

    // Platforms
    platforms.forEach(p => {
      const screenY = p.y + camY;
      if (screenY < -20 || screenY > H + 20) return;
      ctx.shadowBlur = 8; ctx.shadowColor = p.moving ? '#b026ff' : '#00f0ff';
      ctx.fillStyle = p.moving ? '#b026ff' : '#00f0ff';
      ctx.fillRect(p.x, screenY, p.w, p.h);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(p.x, screenY, p.w, 3);
      ctx.shadowBlur = 0;
    });

    // Enemies
    enemies.forEach(en => {
      if (!en.alive) return;
      const ey = en.y + camY;
      ctx.save();
      ctx.shadowBlur = 10; ctx.shadowColor = '#ff007f';
      ctx.fillStyle = '#ff007f';
      ctx.fillRect(en.x, ey, en.w, en.h);
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(en.x + 4, ey + 5, 5, 5);
      ctx.fillRect(en.x + 13, ey + 5, 5, 5);
      ctx.restore();
    });

    // Coins
    coins.forEach(coin => {
      if (coin.collected) return;
      const cy = coin.y + camY;
      const pulse = 1 + Math.sin(frame * 0.1) * 0.1;
      ctx.save();
      ctx.shadowBlur = 10; ctx.shadowColor = '#ffea00';
      ctx.fillStyle = '#ffea00';
      ctx.beginPath();
      ctx.arc(coin.x, cy, coin.r * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Player
    drawPlayer();

    // Particles
    particles.forEach(p => {
      ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = "bold 22px 'Space Grotesk', sans-serif";
    ctx.fillText(`HEIGHT: ${score}m`, 12, 30);
    ctx.fillStyle = '#ffea00';
    ctx.textAlign = 'right';
    ctx.fillText('JUMP+STOMP ENEMIES!', W - 12, 30);
    ctx.textAlign = 'left';

    // Hint
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = "11px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'right';
    ctx.fillText('ARROWS / WASD TO MOVE & JUMP', W - 10, H - 8);
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
