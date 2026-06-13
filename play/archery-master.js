window.initArcheryMaster = function(canvas, onGameOver, onScoreUpdate) {
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
  let arrowsLeft = 10;
  let level = 1;
  let frame = 0;
  let arrows = []; // fired arrows lodged in targets
  let particles = [];

  // Target
  let target = { x: W * 0.72, y: H / 2, vy: 0, moving: false };
  let targetSpeed = 0;

  // Wind
  let wind = 0;
  let windDisplay = 0;

  // Bow state
  const BOW_X = 110, BOW_Y = H / 2;
  let pulling = false;
  let pullStart = null;
  let currentPull = { x: BOW_X, y: BOW_Y };
  let projectile = null; // {x, y, vx, vy, alive}
  let arrowInFlight = false;

  let flashMsg = '';
  let flashTimer = 0;
  let levelClearTimer = 0;

  function newLevel() {
    arrowsLeft = 10;
    level++;
    targetSpeed = (level - 1) * 0.8;
    target.x = W * 0.72;
    target.y = H / 2;
    target.vy = targetSpeed * (Math.random() < 0.5 ? 1 : -1);
    wind = (Math.random() - 0.5) * (level * 0.04);
    windDisplay = Math.round(wind * 200);
    arrows = [];
    levelClearTimer = 0;
  }
  newLevel();
  level = 1; // reset after first call

  wind = 0; windDisplay = 0; target.vy = 0; targetSpeed = 0;

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 4;
      particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, alpha: 1, color, r: 2 + Math.random() * 3 });
    }
  }

  function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
  }

  canvas.addEventListener('mousedown', (e) => {
    if (!active || arrowInFlight) return;
    pulling = true;
    pullStart = getPointerPos(e);
    currentPull = { ...pullStart };
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!pulling) return;
    currentPull = getPointerPos(e);
  });
  canvas.addEventListener('mouseup', (e) => {
    if (!pulling || !active) return;
    pulling = false;
    fireArrow();
  });
  canvas.addEventListener('touchstart', (e) => {
    if (!active || arrowInFlight) return;
    pulling = true;
    pullStart = getPointerPos(e);
    currentPull = { ...pullStart };
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    currentPull = getPointerPos(e);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    if (!pulling || !active) return;
    pulling = false;
    fireArrow();
    e.preventDefault();
  }, { passive: false });

  window.destroyArcheryMaster = function() {
    active = false;
  };

  function fireArrow() {
    if (!pullStart) return;
    const dx = BOW_X - currentPull.x;
    const dy = BOW_Y - currentPull.y;
    const power = Math.min(Math.sqrt(dx * dx + dy * dy) / 80, 1);
    if (power < 0.1) return;

    const speed = power * 16;
    projectile = {
      x: BOW_X, y: BOW_Y,
      vx: (dx / Math.sqrt(dx * dx + dy * dy)) * speed,
      vy: (dy / Math.sqrt(dx * dx + dy * dy)) * speed,
      alive: true
    };
    arrowInFlight = true;
    arrowsLeft--;
    if (window.audioManager) window.audioManager.playBlip();
  }

  function scoreZone(dist) {
    if (dist < 10) return { pts: 100, label: 'BULLSEYE! +100', color: '#ffea00' };
    if (dist < 22) return { pts: 50, label: 'INNER RING! +50', color: '#39ff14' };
    if (dist < 38) return { pts: 25, label: 'MID RING! +25', color: '#00f0ff' };
    if (dist < 55) return { pts: 10, label: 'OUTER RING! +10', color: '#b026ff' };
    return null;
  }

  function update() {
    frame++;
    if (levelClearTimer > 0) { levelClearTimer--; if (levelClearTimer === 0) newLevel(); return; }

    // Target movement
    target.y += target.vy;
    if (target.y < 60 || target.y > H - 60) target.vy *= -1;

    // Projectile
    if (projectile && projectile.alive) {
      projectile.vx += wind;
      projectile.vy += 0.18; // gravity
      projectile.x += projectile.vx;
      projectile.y += projectile.vy;

      // Off screen
      if (projectile.x > W + 20 || projectile.y > H + 20 || projectile.y < -20) {
        projectile.alive = false;
        arrowInFlight = false;
        flashMsg = 'MISS!';
        flashTimer = 60;
        if (arrowsLeft <= 0) { setTimeout(() => { if (active) { active = false; if (onGameOver) onGameOver(score); } }, 1200); }
      }

      // Hit target
      const dx = projectile.x - target.x;
      const dy = projectile.y - target.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 60) {
        const zone = scoreZone(dist);
        if (zone) {
          score += zone.pts;
          if (onScoreUpdate) onScoreUpdate(score);
          if (window.audioManager) window.audioManager.playScore();
          spawnParticles(projectile.x, projectile.y, zone.color);
          flashMsg = zone.label;
          flashTimer = 90;
          arrows.push({ x: projectile.x - target.x, y: projectile.y - target.y, angle: Math.atan2(projectile.vy, projectile.vx) });
        }
        projectile.alive = false;
        arrowInFlight = false;

        if (arrows.length >= 3) {
          score += 50; // level bonus
          flashMsg = '🏆 LEVEL CLEAR! +50';
          flashTimer = 120;
          levelClearTimer = 120;
          if (onScoreUpdate) onScoreUpdate(score);
        } else if (arrowsLeft <= 0) {
          setTimeout(() => { if (active) { active = false; if (onGameOver) onGameOver(score); } }, 1200);
        }
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.alpha -= 0.035;
      if (p.alpha <= 0) particles.splice(i, 1);
    }

    if (flashTimer > 0) flashTimer--;
  }

  function drawTarget(x, y) {
    const rings = [
      { r: 55, color: '#1a1a2e' },
      { r: 38, color: '#b026ff' },
      { r: 22, color: '#00f0ff' },
      { r: 10, color: '#39ff14' },
      { r: 4, color: '#ffea00' },
    ];
    rings.forEach(ring => {
      ctx.beginPath();
      ctx.arc(x, y, ring.r, 0, Math.PI * 2);
      ctx.fillStyle = ring.color;
      ctx.shadowBlur = ring.r < 15 ? 15 : 0;
      ctx.shadowColor = ring.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    ctx.shadowBlur = 0;

    // Lodged arrows
    arrows.forEach(a => {
      ctx.save();
      ctx.translate(x + a.x, y + a.y);
      ctx.rotate(a.angle);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(2, 0);
      ctx.stroke();
      ctx.fillStyle = '#ffea00';
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.lineTo(-4, -4);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  function render() {
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, W, H);

    // Background trees (silhouettes)
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    for (let t = 0; t < 8; t++) {
      ctx.fillRect(300 + t * 40, H - 60 - t * 10, 20, 60 + t * 10);
    }

    // Ground line
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, H - 30); ctx.lineTo(W, H - 30); ctx.stroke();

    // Target post
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(target.x, target.y + 56); ctx.lineTo(target.x, H - 30); ctx.stroke();

    // Target
    drawTarget(target.x, target.y);

    // Bow
    ctx.save();
    ctx.strokeStyle = '#b026ff';
    ctx.shadowBlur = 10; ctx.shadowColor = '#b026ff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(BOW_X, BOW_Y, 28, -Math.PI * 0.7, Math.PI * 0.7);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Bowstring
    if (pulling && currentPull) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(BOW_X, BOW_Y - 28);
      ctx.lineTo(currentPull.x, currentPull.y);
      ctx.lineTo(BOW_X, BOW_Y + 28);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Arrow preview
      ctx.strokeStyle = '#ffea00';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 6; ctx.shadowColor = '#ffea00';
      ctx.beginPath();
      ctx.moveTo(currentPull.x, currentPull.y);
      ctx.lineTo(BOW_X, BOW_Y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(BOW_X, BOW_Y - 28);
      ctx.lineTo(BOW_X, BOW_Y + 28);
      ctx.stroke();
    }
    ctx.restore();

    // Flying arrow
    if (projectile && projectile.alive) {
      ctx.save();
      ctx.translate(projectile.x, projectile.y);
      ctx.rotate(Math.atan2(projectile.vy, projectile.vx));
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(8, 0); ctx.stroke();
      ctx.fillStyle = '#ffea00';
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(2, -4); ctx.lineTo(2, 4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // Particles
    particles.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Wind indicator
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = "13px 'Space Grotesk', sans-serif";
    ctx.fillText(`WIND: ${windDisplay > 0 ? '→' : windDisplay < 0 ? '←' : '·'} ${Math.abs(windDisplay)}`, 12, H - 38);

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = "bold 20px 'Space Grotesk', sans-serif";
    ctx.fillText(`SCORE: ${score}`, 12, 30);
    ctx.fillStyle = '#ffea00';
    ctx.textAlign = 'right';
    ctx.fillText(`LEVEL ${level}  |  🏹 ${arrowsLeft}`, W - 12, 30);
    ctx.textAlign = 'left';

    // Aim guide hint
    if (!pulling && !arrowInFlight) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = "12px 'Space Grotesk', sans-serif";
      ctx.fillText('CLICK & DRAG TO AIM, RELEASE TO FIRE', 12, H - 12);
    }

    // Flash message
    if (flashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, flashTimer / 30);
      ctx.font = "bold 22px 'Space Grotesk', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillStyle = '#39ff14';
      ctx.shadowBlur = 12; ctx.shadowColor = '#39ff14';
      ctx.fillText(flashMsg, W / 2, H / 2 - 30);
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
