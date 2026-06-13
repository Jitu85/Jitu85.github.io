window.initSushiSpin = function(canvas, onGameOver, onScoreUpdate) {
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

  // Disk / plate
  const DISK_CX = W / 2;
  const DISK_CY = H - 80;
  const DISK_R = 70;
  let diskAngle = 0;
  let diskSpeed = 0.015;

  // Stack of sushi pieces on disk
  let stack = [{ angle: 0, offsetAngle: 0, w: 130, h: 28, color: '#ff007f', label: '🍣', score: 0 }];

  // Falling sushi
  let falling = null;
  let fallingAngle = 0; // which "slot" angle it's aimed at
  const FALL_SPEED = 3;
  let fallY = 0;
  const SPAWN_Y = 60;
  let nextColor = randomColor();
  let nextLabel = randomLabel();

  let particles = [];
  let flashMsg = '';
  let flashTimer = 0;
  let combo = 0;
  let gameOverTimer = 0;

  const SUSHI_LABELS = ['🍣', '🍱', '🥢', '🍜', '🍤', '🌸'];
  const SUSHI_COLORS = ['#ff007f', '#00f0ff', '#b026ff', '#ffea00', '#39ff14'];

  function randomColor() { return SUSHI_COLORS[Math.floor(Math.random() * SUSHI_COLORS.length)]; }
  function randomLabel() { return SUSHI_LABELS[Math.floor(Math.random() * SUSHI_LABELS.length)]; }

  function getStackTop() {
    // Returns the Y position of the top of the stack above the disk center
    return stack.length;
  }

  function spawnFalling() {
    falling = {
      y: SPAWN_Y,
      color: nextColor,
      label: nextLabel,
      w: Math.max(40, stack[stack.length - 1].w - 15),
      h: 28,
    };
    fallY = SPAWN_Y;
    nextColor = randomColor();
    nextLabel = randomLabel();
  }

  spawnFalling();

  function dropSushi() {
    if (!falling || !active) return;
    if (window.audioManager) window.audioManager.playBlip();

    // Calculate alignment with top of stack
    const topPiece = stack[stack.length - 1];
    const angleDiff = ((diskAngle - topPiece.offsetAngle) + Math.PI * 4) % (Math.PI * 2);
    const normalizedDiff = angleDiff > Math.PI ? angleDiff - Math.PI * 2 : angleDiff;
    const misalignment = Math.abs(normalizedDiff);

    const PERFECT = 0.12, GOOD = 0.3, OK = 0.5;
    let cutW = falling.w;
    let pts = 0;
    let msg = '';

    if (misalignment < PERFECT) {
      pts = 30; msg = '⚡ PERFECT! +30'; combo++;
    } else if (misalignment < GOOD) {
      const cut = misalignment * falling.w * 0.8;
      cutW = falling.w - cut;
      pts = 15; msg = '✅ GOOD! +15'; combo++;
    } else if (misalignment < OK) {
      const cut = misalignment * falling.w * 1.2;
      cutW = falling.w - cut;
      pts = 5; msg = '🟡 OK +5'; combo = 0;
    } else {
      cutW = Math.max(8, falling.w - misalignment * falling.w * 1.5);
      pts = 1; msg = '😬 SLIPPED +1'; combo = 0;
    }

    if (cutW < 12) {
      // Piece fell off — game over
      spawnParticles(DISK_CX, DISK_CY - stack.length * 30, '#ff007f', 20);
      flashMsg = '💥 FELL OFF!';
      flashTimer = 90;
      gameOverTimer = 90;
      if (window.audioManager) window.audioManager.playExplosion();
      falling = null;
      return;
    }

    // Add to stack
    score += pts * (combo > 1 ? combo : 1);
    if (combo > 1) msg += ` ×${combo}`;
    flashMsg = msg;
    flashTimer = 80;
    if (onScoreUpdate) onScoreUpdate(score);
    if (window.audioManager && pts >= 15) window.audioManager.playScore();

    spawnParticles(DISK_CX, DISK_CY - stack.length * falling.h, falling.color, 8);

    stack.push({
      angle: diskAngle,
      offsetAngle: diskAngle,
      w: cutW,
      h: falling.h,
      color: falling.color,
      label: falling.label,
      score: pts,
    });

    falling = null;

    // Speed up disk
    diskSpeed = 0.015 + stack.length * 0.003;

    setTimeout(() => { if (active) spawnFalling(); }, 300);
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 4;
      particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, alpha: 1, color, r: 2 + Math.random() * 3 });
    }
  }

  canvas.addEventListener('click', dropSushi);
  canvas.addEventListener('touchstart', (e) => { dropSushi(); e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); dropSushi(); } });

  window.destroySpinSushi = function() { active = false; };
  // Register with proper name
  window.destroySushiSpin = function() { active = false; };

  function update() {
    frame++;
    diskAngle += diskSpeed;

    if (gameOverTimer > 0) {
      gameOverTimer--;
      if (gameOverTimer === 0) {
        active = false;
        if (onGameOver) onGameOver(score);
      }
      return;
    }

    // Fall
    if (falling) {
      fallY += FALL_SPEED;
      const stackTopY = DISK_CY - stack.length * falling.h - 20;
      if (fallY >= stackTopY) {
        // Auto-land
        dropSushi();
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.alpha -= 0.04;
      if (p.alpha <= 0) particles.splice(i, 1);
    }

    if (flashTimer > 0) flashTimer--;
  }

  function render() {
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, W, H);

    // Ambient circles
    ctx.save();
    for (let i = 3; i > 0; i--) {
      ctx.beginPath();
      ctx.arc(DISK_CX, DISK_CY, DISK_R + i * 30, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,0,127,${0.04 * i})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    // Stack
    stack.forEach((piece, i) => {
      const stackY = DISK_CY - i * piece.h - piece.h / 2;
      ctx.save();
      ctx.shadowBlur = 10; ctx.shadowColor = piece.color;
      ctx.fillStyle = piece.color;
      ctx.beginPath();
      ctx.roundRect(DISK_CX - piece.w / 2, stackY - piece.h / 2, piece.w, piece.h, 6);
      ctx.fill();
      if (i > 0) {
        ctx.font = "18px sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(piece.label, DISK_CX, stackY);
      }
      ctx.restore();
    });

    // Spinning disk
    ctx.save();
    ctx.translate(DISK_CX, DISK_CY);
    ctx.rotate(diskAngle);
    ctx.shadowBlur = 20; ctx.shadowColor = '#ff007f';
    ctx.fillStyle = '#ff007f';
    ctx.beginPath();
    ctx.arc(0, 0, DISK_R, 0, Math.PI * 2);
    ctx.fill();
    // Plate pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * DISK_R, Math.sin(a) * DISK_R); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, DISK_R * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill();
    ctx.restore();

    // Falling piece
    if (falling) {
      ctx.save();
      ctx.shadowBlur = 12; ctx.shadowColor = falling.color;
      ctx.fillStyle = falling.color;
      ctx.beginPath();
      ctx.roundRect(DISK_CX - falling.w / 2, fallY - falling.h / 2, falling.w, falling.h, 6);
      ctx.fill();
      ctx.font = "18px sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(falling.label, DISK_CX, fallY);
      ctx.restore();
    }

    // Next preview
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = "12px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'left';
    ctx.fillText('NEXT:', 20, 50);
    ctx.shadowBlur = 8; ctx.shadowColor = nextColor;
    ctx.fillStyle = nextColor;
    ctx.beginPath();
    ctx.roundRect(20, 60, 60, 24, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = "16px sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(nextLabel, 50, 77);

    // Particles
    particles.forEach(p => {
      ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = "bold 22px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'right';
    ctx.fillText(`SCORE: ${score}`, W - 12, 30);
    ctx.fillText(`HEIGHT: ${stack.length - 1}`, W - 12, 56);
    ctx.textAlign = 'left';

    // Flash
    if (flashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, flashTimer / 30);
      ctx.font = "bold 22px 'Space Grotesk', sans-serif";
      ctx.fillStyle = '#39ff14';
      ctx.shadowBlur = 12; ctx.shadowColor = '#39ff14';
      ctx.textAlign = 'center';
      ctx.fillText(flashMsg, W / 2, H / 2 - 40);
      ctx.restore();
    }

    // Hint
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = "12px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('CLICK / TAP / SPACE TO DROP', W / 2, H - 12);
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
