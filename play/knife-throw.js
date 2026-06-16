window.initKnifeThrow = function(canvas, onGameOver, onScoreUpdate) {
  const ctx = canvas.getContext('2d');
  const W = 640, H = 480;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = '100%'; canvas.style.height = '100%';
  ctx.scale(dpr, dpr);

  let active = true, score = 0, lives = 3, level = 1, frame = 0;
  let targetRot = 0, rotSpeed = 0.022, rotDir = 1;
  let stuckKnives = []; // angles stuck in the log
  let particles = [], flashTimer = 0, flashColor = '';
  let knifeState = 'ready'; // 'ready' | 'flying' | 'hit' | 'crash'
  let knifeY = H - 80;
  let animId;

  // Stars
  const stars = Array.from({ length: 55 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    r: Math.random() * 1.3 + 0.2, alpha: 0.1 + Math.random() * 0.5
  }));

  const LOG_X = W / 2, LOG_Y = 155, LOG_R = 68;
  const KNIFE_X = W / 2;
  const KNIFE_START_Y = H - 80;
  const KNIFE_SPEED = 16;
  const KNIFE_LEN = 52;
  const COLLISION_TOLERANCE = 0.22; // radians (~12.6°)

  function emit(x, y, col, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 5;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, alpha: 1, color: col, r: 2 + Math.random() * 3 });
    }
  }

  function nextLevel() {
    stuckKnives = [];
    level++;
    rotSpeed = 0.018 + level * 0.007;
    // Randomize direction each level
    if (Math.random() > 0.5) rotDir *= -1;
    // Sometimes add speed variation mid-level
  }

  function throwKnife() {
    if (knifeState !== 'ready' || !active) return;
    knifeState = 'flying';
    knifeY = KNIFE_START_Y;
    if (window.audioManager) window.audioManager.playBlip();
  }

  function handleInput(e) {
    e.preventDefault();
    throwKnife();
  }
  canvas.addEventListener('mousedown', handleInput);
  canvas.addEventListener('touchstart', handleInput, { passive: false });

  window.destroyKnifeThrow = function() {
    active = false;
    cancelAnimationFrame(animId);
    canvas.removeEventListener('mousedown', handleInput);
    canvas.removeEventListener('touchstart', handleInput);
  };

  function update() {
    frame++;

    // Target rotation
    targetRot += rotSpeed * rotDir;

    // Knife flight
    if (knifeState === 'flying') {
      knifeY -= KNIFE_SPEED;

      // Check landing
      if (knifeY - KNIFE_LEN / 2 <= LOG_Y + LOG_R) {
        // The angle where the knife hits, relative to the log's current rotation
        const hitAngle = ((-targetRot) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

        // Check overlap with existing stuck knives
        let crash = false;
        for (const a of stuckKnives) {
          let diff = Math.abs(a - hitAngle);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;
          if (diff < COLLISION_TOLERANCE) { crash = true; break; }
        }

        if (crash) {
          knifeState = 'crash';
          flashTimer = 40; flashColor = '#ff007f';
          emit(LOG_X, LOG_Y + LOG_R, '#ff007f', 24);
          if (window.audioManager) window.audioManager.playExplosion();
          lives--;
          if (lives <= 0) {
            active = false;
            setTimeout(() => { if (onGameOver) onGameOver(score); }, 800);
          } else {
            // Brief pause then reset
            setTimeout(() => { if (active) { knifeState = 'ready'; knifeY = KNIFE_START_Y; } }, 700);
          }
        } else {
          stuckKnives.push(hitAngle);
          knifeState = 'ready'; knifeY = KNIFE_START_Y;
          score += 10 * level; if (onScoreUpdate) onScoreUpdate(score);
          emit(LOG_X, LOG_Y + LOG_R, '#39ff14', 10);
          flashTimer = 12; flashColor = '#39ff14';
          if (window.audioManager) window.audioManager.playScore();

          // Level up after 8 successful throws
          if (stuckKnives.length >= 8) {
            score += 100 * level; if (onScoreUpdate) onScoreUpdate(score);
            emit(LOG_X, LOG_Y, '#ffea00', 30);
            flashTimer = 30; flashColor = '#ffea00';
            nextLevel();
          }
        }
      }
    }

    if (flashTimer > 0) flashTimer--;

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.vx *= 0.97;
      p.alpha -= 0.028; if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  function drawKnife(cx, cy, angle, stuck) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle);
    const glow = stuck ? '#ffea00' : knifeState === 'crash' ? '#ff007f' : '#00f0ff';
    ctx.shadowBlur = stuck ? 12 : 18; ctx.shadowColor = glow;

    // Blade
    const grad = ctx.createLinearGradient(0, -KNIFE_LEN / 2, 0, KNIFE_LEN / 2);
    grad.addColorStop(0, '#e8f4ff');
    grad.addColorStop(0.55, '#a0c8e0');
    grad.addColorStop(1, '#60a0c8');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -KNIFE_LEN / 2);
    ctx.lineTo(5, -KNIFE_LEN / 4);
    ctx.lineTo(5, KNIFE_LEN * 0.28);
    ctx.lineTo(-5, KNIFE_LEN * 0.28);
    ctx.lineTo(-5, -KNIFE_LEN / 4);
    ctx.closePath(); ctx.fill();

    // Blade edge shine
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-2, -KNIFE_LEN / 2); ctx.lineTo(-2, KNIFE_LEN * 0.25); ctx.stroke();

    // Guard
    ctx.fillStyle = '#b026ff'; ctx.shadowBlur = 8; ctx.shadowColor = '#b026ff';
    ctx.fillRect(-7, KNIFE_LEN * 0.28, 14, 6);

    // Handle (wrapped grip)
    const hGrad = ctx.createLinearGradient(-5, 0, 5, 0);
    hGrad.addColorStop(0, '#1a0a3a'); hGrad.addColorStop(0.5, '#3a1a6a'); hGrad.addColorStop(1, '#1a0a3a');
    ctx.fillStyle = hGrad; ctx.shadowBlur = 0;
    ctx.fillRect(-5, KNIFE_LEN * 0.34, 10, KNIFE_LEN * 0.32);
    // Grip lines
    ctx.strokeStyle = '#b026ff'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const yy = KNIFE_LEN * 0.36 + i * (KNIFE_LEN * 0.08);
      ctx.beginPath(); ctx.moveTo(-5, yy); ctx.lineTo(5, yy); ctx.stroke();
    }
    // Pommel
    ctx.fillStyle = '#5010a0';
    ctx.beginPath(); ctx.ellipse(0, KNIFE_LEN * 0.68, 6, 5, 0, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  function drawLog() {
    ctx.save(); ctx.translate(LOG_X, LOG_Y); ctx.rotate(targetRot);

    // Wood log body
    const grad = ctx.createRadialGradient(-LOG_R * 0.3, -LOG_R * 0.3, 0, 0, 0, LOG_R);
    grad.addColorStop(0, '#d4a857');
    grad.addColorStop(0.4, '#b8893a');
    grad.addColorStop(0.75, '#8b6020');
    grad.addColorStop(1, '#5a3e10');
    ctx.shadowBlur = 18; ctx.shadowColor = '#b026ff';
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, LOG_R, 0, Math.PI * 2); ctx.fill();

    // Tree rings
    ctx.strokeStyle = 'rgba(90,60,10,0.4)'; ctx.lineWidth = 1.5;
    [0.72, 0.52, 0.34, 0.18].forEach(r => {
      ctx.beginPath(); ctx.arc(0, 0, LOG_R * r, 0, Math.PI * 2); ctx.stroke();
    });

    // Outer neon ring
    ctx.strokeStyle = '#b026ff'; ctx.lineWidth = 3; ctx.shadowBlur = 14; ctx.shadowColor = '#b026ff';
    ctx.beginPath(); ctx.arc(0, 0, LOG_R + 2, 0, Math.PI * 2); ctx.stroke();

    // Inner dot
    ctx.fillStyle = '#ff007f'; ctx.shadowBlur = 10; ctx.shadowColor = '#ff007f';
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();

    // Stuck knives (drawn IN the log rotation context)
    stuckKnives.forEach(ang => {
      ctx.save(); ctx.rotate(ang);
      const tipX = 0, tipY = -(LOG_R + KNIFE_LEN * 0.5);
      drawKnifeSimple(tipX, tipY);
      ctx.restore();
    });

    ctx.restore();
  }

  // Draw knife in log's local space (pointing outward from center)
  function drawKnifeSimple(cx, cy) {
    ctx.save(); ctx.translate(cx, cy);
    ctx.shadowBlur = 10; ctx.shadowColor = '#ffea00';
    // Blade
    const grad = ctx.createLinearGradient(0, -KNIFE_LEN * 0.38, 0, KNIFE_LEN * 0.38);
    grad.addColorStop(0, '#e8f4ff'); grad.addColorStop(1, '#60a0c8');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -KNIFE_LEN * 0.38);
    ctx.lineTo(4, -KNIFE_LEN * 0.16); ctx.lineTo(4, KNIFE_LEN * 0.1);
    ctx.lineTo(-4, KNIFE_LEN * 0.1); ctx.lineTo(-4, -KNIFE_LEN * 0.16);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a1a6a';
    ctx.fillRect(-4, KNIFE_LEN * 0.1, 8, KNIFE_LEN * 0.26);
    ctx.restore();
  }

  function render() {
    ctx.fillStyle = '#05050f'; ctx.fillRect(0, 0, W, H);

    // Flash overlay
    if (flashTimer > 0) {
      ctx.fillStyle = `rgba(${flashColor === '#ff007f' ? '255,0,127' : flashColor === '#ffea00' ? '255,234,0' : '57,255,20'},${(flashTimer / 40) * 0.12})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Stars
    stars.forEach(s => {
      ctx.globalAlpha = s.alpha + Math.sin(frame * 0.04 + s.x) * 0.1;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Subtle grid
    ctx.strokeStyle = 'rgba(176,38,255,0.04)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // Chain hanging log
    ctx.strokeStyle = 'rgba(176,38,255,0.5)'; ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(LOG_X, 0); ctx.lineTo(LOG_X, LOG_Y - LOG_R); ctx.stroke();
    ctx.setLineDash([]);

    // Log shadow
    ctx.save();
    ctx.shadowBlur = 40; ctx.shadowColor = 'rgba(176,38,255,0.4)';
    ctx.beginPath(); ctx.arc(LOG_X, LOG_Y, LOG_R + 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    drawLog();

    // Throwing knife (only in ready/flying state)
    if (knifeState === 'ready' || knifeState === 'flying') {
      const bobY = knifeState === 'ready' ? KNIFE_START_Y + Math.sin(frame * 0.06) * 5 : knifeY;
      drawKnife(KNIFE_X, bobY, 0, false);

      // Aim guide dots (only in ready state)
      if (knifeState === 'ready') {
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = '#00f0ff'; ctx.setLineDash([4, 8]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(KNIFE_X, bobY - KNIFE_LEN / 2); ctx.lineTo(KNIFE_X, LOG_Y + LOG_R); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
    }

    // Particles
    particles.forEach(p => {
      ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.shadowBlur = 8; ctx.shadowColor = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;

    // HUD
    ctx.fillStyle = '#fff'; ctx.font = "bold 20px 'Space Grotesk',sans-serif"; ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${score}`, 12, 28);
    ctx.fillStyle = '#b026ff'; ctx.textAlign = 'right';
    ctx.fillText(`LEVEL ${level}`, W - 12, 28);

    // Lives
    for (let l = 0; l < 3; l++) {
      ctx.globalAlpha = l < lives ? 1 : 0.15; ctx.font = '17px sans-serif';
      ctx.textAlign = 'left'; ctx.fillText('🗡️', 12 + l * 26, H - 10);
    }
    ctx.globalAlpha = 1;

    // Progress bar (knives stuck vs 8)
    const prog = stuckKnives.length / 8;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath(); ctx.roundRect(W / 2 - 100, H - 22, 200, 10, 5); ctx.fill();
    if (prog > 0) {
      ctx.fillStyle = '#b026ff'; ctx.shadowBlur = 8; ctx.shadowColor = '#b026ff';
      ctx.beginPath(); ctx.roundRect(W / 2 - 100, H - 22, 200 * prog, 10, 5); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = "11px 'Space Grotesk',sans-serif"; ctx.textAlign = 'center';
    ctx.fillText(`${stuckKnives.length}/8 KNIVES · CLICK OR TAP TO THROW`, W / 2, H - 26);

    // Crash label
    if (knifeState === 'crash') {
      ctx.save();
      ctx.font = "bold 40px 'Space Grotesk',sans-serif"; ctx.fillStyle = '#ff007f';
      ctx.shadowBlur = 25; ctx.shadowColor = '#ff007f'; ctx.textAlign = 'center';
      ctx.fillText('HIT! 💥', W / 2, H / 2 + 30); ctx.restore();
    }
  }

  function loop() {
    if (!active) { render(); return; }
    update(); render();
    animId = requestAnimationFrame(loop);
  }
  animId = requestAnimationFrame(loop);
};
