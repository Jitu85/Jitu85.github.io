window.initAirHockey = function(canvas, onGameOver, onScoreUpdate) {
  const ctx = canvas.getContext('2d');
  const W = 640, H = 480;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  ctx.scale(dpr, dpr);

  let active = true;
  let frame = 0;
  const WIN_SCORE = 7;

  const PADDLE_R = 28;
  const PUCK_R = 16;
  const GOAL_W = 160;

  // Player paddle (bottom)
  const player = { x: W / 2, y: H - 60, r: PADDLE_R, color: '#00f0ff' };
  // AI paddle (top)
  const ai = { x: W / 2, y: 60, r: PADDLE_R, color: '#ff007f', speed: 3.5 };
  // Puck
  const puck = { x: W / 2, y: H / 2, vx: 3, vy: -4, r: PUCK_R };

  let playerScore = 0, aiScore = 0;
  let scored = false;
  let scoredTimer = 0;
  let scoredMsg = '';

  // Mouse / touch tracking
  let targetX = W / 2, targetY = H - 60;

  function resetPuck(scoredPlayer) {
    puck.x = W / 2;
    puck.y = H / 2;
    puck.vx = (Math.random() < 0.5 ? 1 : -1) * (3 + Math.random());
    puck.vy = scoredPlayer ? 4 : -4;
    scored = false;
  }

  function updateMouse(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    const src = e.touches ? e.touches[0] : e;
    targetX = (src.clientX - rect.left) * scaleX;
    targetY = (src.clientY - rect.top) * scaleY;
  }

  canvas.addEventListener('mousemove', updateMouse);
  canvas.addEventListener('touchmove', updateMouse, { passive: false });
  canvas.addEventListener('touchstart', updateMouse, { passive: false });

  window.destroyAirHockey = function() {
    active = false;
    canvas.removeEventListener('mousemove', updateMouse);
    canvas.removeEventListener('touchmove', updateMouse);
    canvas.removeEventListener('touchstart', updateMouse);
  };

  function circleCollide(ax, ay, ar, bx, by, br) {
    const dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy) < ar + br;
  }

  function resolvePaddlePuck(paddle) {
    const dx = puck.x - paddle.x, dy = puck.y - paddle.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < paddle.r + puck.r) {
      const nx = dx / dist, ny = dy / dist;
      // Reflect
      const dot = puck.vx * nx + puck.vy * ny;
      puck.vx = (puck.vx - 2 * dot * nx) * 1.05;
      puck.vy = (puck.vy - 2 * dot * ny) * 1.05;
      // Cap speed
      const spd = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
      const MAX_SPD = 14;
      if (spd > MAX_SPD) { puck.vx = (puck.vx / spd) * MAX_SPD; puck.vy = (puck.vy / spd) * MAX_SPD; }
      // Push out
      const overlap = (paddle.r + puck.r) - dist + 1;
      puck.x += nx * overlap;
      puck.y += ny * overlap;
      if (window.audioManager) window.audioManager.playBlip();
    }
  }

  function update() {
    frame++;
    if (scored) { scoredTimer--; if (scoredTimer <= 0) resetPuck(scoredMsg === 'YOU SCORE!'); return; }

    // Player paddle — follow mouse/touch, restricted to bottom half
    const pdx = targetX - player.x, pdy = targetY - player.y;
    const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
    const pSpd = 12;
    if (pDist > 1) { player.x += (pdx / pDist) * Math.min(pSpd, pDist); player.y += (pdy / pDist) * Math.min(pSpd, pDist); }
    player.x = Math.max(PADDLE_R, Math.min(W - PADDLE_R, player.x));
    player.y = Math.max(H / 2 + PADDLE_R, Math.min(H - PADDLE_R, player.y));

    // AI paddle — tracks puck, restricted to top half
    const aDx = puck.x - ai.x;
    if (Math.abs(aDx) > 2) ai.x += Math.sign(aDx) * ai.speed;
    ai.x = Math.max(PADDLE_R, Math.min(W - PADDLE_R, ai.x));
    ai.y = Math.max(PADDLE_R, Math.min(H / 2 - PADDLE_R, ai.y));

    // Move puck
    puck.x += puck.vx;
    puck.y += puck.vy;

    // Wall bounce
    if (puck.x - puck.r < 0) { puck.x = puck.r; puck.vx = Math.abs(puck.vx); }
    if (puck.x + puck.r > W) { puck.x = W - puck.r; puck.vx = -Math.abs(puck.vx); }

    // Goal detection (top/bottom walls, outside goal opening)
    const goalLeft = (W - GOAL_W) / 2;
    const goalRight = goalLeft + GOAL_W;

    if (puck.y - puck.r < 0) {
      if (puck.x > goalLeft && puck.x < goalRight) {
        // Player scored
        playerScore++;
        if (window.audioManager) window.audioManager.playScore();
        if (onScoreUpdate) onScoreUpdate(playerScore);
        scoredMsg = 'YOU SCORE!';
        scored = true; scoredTimer = 90;
        if (playerScore >= WIN_SCORE) { active = false; if (onGameOver) onGameOver(playerScore * 10); }
      } else { puck.y = puck.r; puck.vy = Math.abs(puck.vy); }
    }
    if (puck.y + puck.r > H) {
      if (puck.x > goalLeft && puck.x < goalRight) {
        // AI scored
        aiScore++;
        if (window.audioManager) window.audioManager.playExplosion();
        scoredMsg = 'AI SCORES!';
        scored = true; scoredTimer = 90;
        if (aiScore >= WIN_SCORE) { active = false; if (onGameOver) onGameOver(playerScore * 10); }
      } else { puck.y = H - puck.r; puck.vy = -Math.abs(puck.vy); }
    }

    // Paddle collisions
    resolvePaddlePuck(player);
    resolvePaddlePuck(ai);
  }

  function drawGlow(x, y, r, color) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color + 'cc');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function render() {
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, W, H);

    // Rink
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
    // Center line
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    ctx.setLineDash([]);
    // Center circle
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 60, 0, Math.PI * 2); ctx.stroke();

    // Goals
    const goalLeft = (W - GOAL_W) / 2;
    // Top goal (player scores here)
    ctx.fillStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.fillRect(goalLeft, 0, GOAL_W, 12);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(goalLeft, 0, GOAL_W, 12);
    // Bottom goal (AI scores here)
    ctx.fillStyle = 'rgba(255, 0, 127, 0.12)';
    ctx.fillRect(goalLeft, H - 12, GOAL_W, 12);
    ctx.strokeStyle = '#ff007f';
    ctx.strokeRect(goalLeft, H - 12, GOAL_W, 12);

    // Paddles
    drawGlow(ai.x, ai.y, ai.r, '#ff007f');
    ctx.shadowBlur = 16; ctx.shadowColor = '#ff007f';
    ctx.fillStyle = '#ff007f';
    ctx.beginPath(); ctx.arc(ai.x, ai.y, ai.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ai.x, ai.y, ai.r * 0.4, 0, Math.PI * 2); ctx.fill();

    drawGlow(player.x, player.y, player.r, '#00f0ff');
    ctx.shadowBlur = 16; ctx.shadowColor = '#00f0ff';
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(player.x, player.y, player.r * 0.4, 0, Math.PI * 2); ctx.fill();

    // Puck
    ctx.shadowBlur = 20; ctx.shadowColor = '#fff';
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(puck.x, puck.y, puck.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // HUD - Score
    ctx.font = "bold 36px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff007f';
    ctx.shadowBlur = 10; ctx.shadowColor = '#ff007f';
    ctx.fillText(aiScore, W / 2, 38);
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.fillText(playerScore, W / 2, H - 16);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = "12px 'Space Grotesk', sans-serif";
    ctx.fillText('AI', W / 2 - 50, 38);
    ctx.fillText('YOU', W / 2 + 50, H - 16);
    ctx.textAlign = 'left';

    // Scored banner
    if (scored) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, scoredTimer / 30);
      ctx.font = "bold 40px 'Space Grotesk', sans-serif";
      const isPlayer = scoredMsg === 'YOU SCORE!';
      ctx.fillStyle = isPlayer ? '#39ff14' : '#ff007f';
      ctx.shadowBlur = 20; ctx.shadowColor = ctx.fillStyle;
      ctx.textAlign = 'center';
      ctx.fillText(scoredMsg, W / 2, H / 2 + 14);
      ctx.restore();
    }

    // Controls hint
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = "11px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'right';
    ctx.fillText('MOVE MOUSE / TOUCH TO CONTROL', W - 10, H - 10);
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
