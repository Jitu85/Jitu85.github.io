window.initBalloonPop = function(canvas, onGameOver, onScoreUpdate) {
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
  let lives = 3;
  let combo = 0;
  let comboTimer = 0;
  let spawnTimer = 0;
  let spawnInterval = 90;
  let frame = 0;
  let particles = [];
  let balloons = [];

  const COLORS = [
    { fill: '#ff007f', glow: '#ff007f', label: '🎈' },
    { fill: '#00f0ff', glow: '#00f0ff', label: '🔵' },
    { fill: '#b026ff', glow: '#b026ff', label: '🟣' },
    { fill: '#ffea00', glow: '#ffea00', label: '🟡' },
    { fill: '#39ff14', glow: '#39ff14', label: '🟢' },
  ];

  function spawnBalloon() {
    const col = COLORS[Math.floor(Math.random() * COLORS.length)];
    const radius = 22 + Math.random() * 14;
    balloons.push({
      x: radius + Math.random() * (W - radius * 2),
      y: H + radius + 10,
      r: radius,
      speed: 0.6 + Math.random() * 0.8 + score * 0.004,
      color: col,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.02 + Math.random() * 0.015,
      pop: false,
      popFrame: 0,
      scale: 1,
    });
  }

  function spawnParticles(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.3;
      const speed = 2 + Math.random() * 3;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        color,
        r: 3 + Math.random() * 3,
      });
    }
  }

  function handlePointerDown(e) {
    if (!active) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const touches = e.touches || [e];
    for (let t = 0; t < touches.length; t++) {
      const cx = (touches[t].clientX - rect.left) * scaleX;
      const cy = (touches[t].clientY - rect.top) * scaleY;
      let hit = false;
      for (let i = balloons.length - 1; i >= 0; i--) {
        const b = balloons[i];
        if (b.pop) continue;
        const dx = cx - b.x, dy = cy - b.y;
        if (Math.sqrt(dx * dx + dy * dy) < b.r) {
          b.pop = true;
          b.popFrame = 0;
          combo++;
          comboTimer = 90;
          const mult = Math.min(combo, 5);
          score += mult;
          if (onScoreUpdate) onScoreUpdate(score);
          if (window.audioManager) window.audioManager.playScore();
          spawnParticles(b.x, b.y, b.color.fill);
          hit = true;
          break;
        }
      }
      if (!hit) {
        combo = 0;
        comboTimer = 0;
      }
    }
    e.preventDefault();
  }

  canvas.addEventListener('mousedown', handlePointerDown);
  canvas.addEventListener('touchstart', handlePointerDown, { passive: false });

  window.destroyBalloonPop = function() {
    active = false;
    canvas.removeEventListener('mousedown', handlePointerDown);
    canvas.removeEventListener('touchstart', handlePointerDown);
  };

  function update() {
    frame++;
    if (comboTimer > 0) comboTimer--;
    else combo = 0;

    // Spawn
    spawnTimer++;
    if (spawnTimer >= spawnInterval) {
      spawnBalloon();
      spawnTimer = 0;
      spawnInterval = Math.max(40, spawnInterval - 0.3);
    }

    // Update balloons
    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i];
      if (b.pop) {
        b.popFrame++;
        b.scale = 1 + b.popFrame * 0.08;
        if (b.popFrame > 10) balloons.splice(i, 1);
        continue;
      }
      b.sway += b.swaySpeed;
      b.x += Math.sin(b.sway) * 0.5;
      b.y -= b.speed;
      // Missed!
      if (b.y + b.r < 0) {
        lives--;
        if (window.audioManager) window.audioManager.playExplosion();
        balloons.splice(i, 1);
        if (lives <= 0) {
          active = false;
          if (onGameOver) onGameOver(score);
          return;
        }
      }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.alpha -= 0.03;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  function render() {
    // Background
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let s = 0; s < 40; s++) {
      const sx = ((s * 137 + frame * 0.1) % W);
      const sy = ((s * 97 + frame * 0.05) % H);
      ctx.fillRect(sx, sy, 1, 1);
    }

    // Balloons
    balloons.forEach(b => {
      ctx.save();
      ctx.translate(b.x, b.y);
      if (b.pop) ctx.scale(b.scale, b.scale);
      ctx.globalAlpha = b.pop ? Math.max(0, 1 - b.popFrame * 0.12) : 1;

      // Glow
      ctx.shadowBlur = 18;
      ctx.shadowColor = b.color.glow;

      // Body
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r, b.r * 1.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = b.color.fill;
      ctx.fill();

      // Shine
      ctx.beginPath();
      ctx.ellipse(-b.r * 0.25, -b.r * 0.3, b.r * 0.25, b.r * 0.2, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fill();

      ctx.shadowBlur = 0;

      // String
      if (!b.pop) {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, b.r * 1.2);
        ctx.quadraticCurveTo(b.r * 0.3, b.r * 1.7, 0, b.r * 2.2);
        ctx.stroke();
      }

      ctx.restore();
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
    ctx.font = "bold 22px 'Space Grotesk', sans-serif";
    ctx.fillText(`SCORE: ${score}`, 20, 36);

    // Lives
    ctx.font = "20px sans-serif";
    for (let l = 0; l < 3; l++) {
      ctx.globalAlpha = l < lives ? 1 : 0.2;
      ctx.fillText('🎈', W - 36 - l * 34, 36);
    }
    ctx.globalAlpha = 1;

    // Combo
    if (comboTimer > 0 && combo > 1) {
      ctx.save();
      ctx.font = `bold ${20 + combo * 4}px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = '#ffea00';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ffea00';
      ctx.textAlign = 'center';
      ctx.fillText(`${combo}x COMBO!`, W / 2, 70);
      ctx.restore();
    }

    // Level indicator
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = "12px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'right';
    ctx.fillText(`MISS: ${3 - lives}/3`, W - 10, H - 10);
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
