window.initCircuitBreaker = function(canvas, onGameOver, onScoreUpdate) {
  const ctx = canvas.getContext('2d');
  const W = 640, H = 480;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = '100%'; canvas.style.height = '100%';
  ctx.scale(dpr, dpr);

  let active = true, score = 0, frame = 0, level = 1;
  let cleared = false, clearTimer = 0, particles = [];

  const GS = 5, TS = 72;
  const OX = (W - GS * TS) / 2, OY = (H - GS * TS) / 2 + 16;

  // Pipe types: bitmask N=8, E=4, S=2, W=1
  const PIPES = [0b0110, 0b1001, 0b1010, 0b0101, 0b1110, 0b0111, 0b1101, 0b1011, 0b1111];
  //              ES      WN      NS      EW      NES     ESW     NSW     NEW     NESW

  function rotCW(c) { return ((c >> 1) | ((c & 1) << 3)) & 0xF; }
  function getConn(tile) {
    let c = PIPES[tile.pipeIdx];
    for (let i = 0; i < tile.rot; i++) c = rotCW(c);
    return c;
  }

  function connects(a, b, dir) {
    // dir 0=N,1=E,2=S,3=W
    const masks = [8, 4, 2, 1], opp = [2, 3, 0, 1];
    return !!(getConn(a) & masks[dir]) && !!(getConn(b) & masks[opp[dir]]);
  }

  function getTile(r, c) {
    if (r < 0 || r >= GS || c < 0 || c >= GS) return null;
    return grid[r * GS + c];
  }

  let grid = [];

  function buildLevel() {
    // Generate valid path first, then scramble
    const path = [[0, 0]];
    let r = 0, c = 0;
    while (r < GS - 1 || c < GS - 1) {
      const canR = c < GS - 1, canD = r < GS - 1;
      if (canR && canD) { if (Math.random() > 0.5) c++; else r++; }
      else if (canR) c++;
      else r++;
      path.push([r, c]);
    }

    const pathSet = new Set(path.map(p => `${p[0]},${p[1]}`));

    // Build solved grid
    grid = [];
    for (let row = 0; row < GS; row++) {
      for (let col = 0; col < GS; col++) {
        const isPath = pathSet.has(`${row},${col}`);
        const isSrc = row === 0 && col === 0;
        const isSink = row === GS - 1 && col === GS - 1;
        // Pick a random pipe for filler, cross for path
        const pipeIdx = (isPath || isSrc || isSink) ? 8 : Math.floor(Math.random() * PIPES.length);
        grid.push({
          row, col, pipeIdx, rot: 0,
          animAngle: 0, targetAngle: 0,
          lit: false, isSrc, isSink
        });
      }
    }

    // Source = cross facing E+S specifically (we'll fix rot to 0)
    getTile(0, 0).pipeIdx = 8; // cross

    // Scramble: rotate non-source tiles randomly
    grid.forEach(t => {
      if (!t.isSrc) {
        const r2 = Math.floor(Math.random() * 4);
        t.rot = r2; t.animAngle = r2 * 90; t.targetAngle = r2 * 90;
      }
    });

    cleared = false;
    checkCircuit();
  }
  buildLevel();

  function checkCircuit() {
    grid.forEach(t => t.lit = false);
    const start = getTile(0, 0);
    if (!start) return;
    const queue = [start]; start.lit = true;
    while (queue.length) {
      const t = queue.shift();
      const nb = [
        { dr: -1, dc: 0, dir: 0 }, { dr: 0, dc: 1, dir: 1 },
        { dr: 1, dc: 0, dir: 2 }, { dr: 0, dc: -1, dir: 3 }
      ];
      nb.forEach(n => {
        const neighbor = getTile(t.row + n.dr, t.col + n.dc);
        if (!neighbor || neighbor.lit) return;
        if (connects(t, neighbor, n.dir)) { neighbor.lit = true; queue.push(neighbor); }
      });
    }
    const sink = getTile(GS - 1, GS - 1);
    if (sink && sink.lit && !cleared) {
      cleared = true; clearTimer = 110;
      score += 1000 + level * 250; if (onScoreUpdate) onScoreUpdate(score);
      if (window.audioManager) window.audioManager.playScore();
      grid.filter(t => t.lit).forEach(t => {
        const tx = OX + t.col * TS + TS / 2, ty = OY + t.row * TS + TS / 2;
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
          particles.push({ x: tx, y: ty, vx: Math.cos(a) * s, vy: Math.sin(a) * s, alpha: 1, color: '#39ff14', r: 2 + Math.random() * 2 });
        }
      });
    }
  }

  function onClick(e) {
    if (!active || cleared) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ((e.touches ? e.touches[0].clientX : e.clientX) - rect.left) * (W / rect.width);
    const my = ((e.touches ? e.touches[0].clientY : e.clientY) - rect.top) * (H / rect.height);
    const col = Math.floor((mx - OX) / TS), row = Math.floor((my - OY) / TS);
    const tile = getTile(row, col);
    if (!tile || tile.isSrc) return;
    tile.rot = (tile.rot + 1) % 4;
    tile.targetAngle = tile.rot * 90;
    if (window.audioManager) window.audioManager.playBlip();
    checkCircuit();
    e.preventDefault();
  }
  canvas.addEventListener('mousedown', onClick);
  canvas.addEventListener('touchstart', onClick, { passive: false });

  window.destroyCircuitBreaker = function() {
    active = false;
    canvas.removeEventListener('mousedown', onClick);
    canvas.removeEventListener('touchstart', onClick);
  };

  function update() {
    frame++;
    grid.forEach(t => {
      const diff = t.targetAngle - t.animAngle;
      if (Math.abs(diff) > 0.5) t.animAngle += diff * 0.28; else t.animAngle = t.targetAngle;
    });
    if (clearTimer > 0) { clearTimer--; if (clearTimer === 0) { level++; buildLevel(); } }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.alpha -= 0.018;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  function drawPipe(tile, tx, ty) {
    const conn = getConn(tile);
    const lit = tile.lit;
    const col = tile.isSrc ? '#ffea00' : tile.isSink ? '#ff007f' : lit ? '#39ff14' : '#2a3a4a';
    const half = TS / 2, pw = 11;

    ctx.save();
    ctx.translate(tx + half, ty + half);
    ctx.rotate((tile.animAngle * Math.PI) / 180);
    ctx.strokeStyle = col; ctx.lineWidth = pw; ctx.lineCap = 'round';
    if (lit) { ctx.shadowBlur = 16; ctx.shadowColor = col; }
    ctx.beginPath();
    if (conn & 8) { ctx.moveTo(0, 0); ctx.lineTo(0, -half + 4); }
    if (conn & 4) { ctx.moveTo(0, 0); ctx.lineTo(half - 4, 0); }
    if (conn & 2) { ctx.moveTo(0, 0); ctx.lineTo(0, half - 4); }
    if (conn & 1) { ctx.moveTo(0, 0); ctx.lineTo(-half + 4, 0); }
    ctx.stroke();
    ctx.fillStyle = col; ctx.shadowBlur = lit ? 8 : 0;
    ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); ctx.shadowBlur = 0;
  }

  function render() {
    ctx.fillStyle = '#05050f'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,240,255,0.025)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Cells
    for (let r = 0; r < GS; r++) {
      for (let c = 0; c < GS; c++) {
        const t = getTile(r, c);
        const tx = OX + c * TS, ty = OY + r * TS;
        ctx.fillStyle = t.isSrc ? 'rgba(255,234,0,0.07)' : t.isSink ? 'rgba(255,0,127,0.07)' : t.lit ? 'rgba(57,255,20,0.05)' : 'rgba(255,255,255,0.02)';
        ctx.strokeStyle = t.isSrc ? 'rgba(255,234,0,0.35)' : t.isSink ? 'rgba(255,0,127,0.35)' : t.lit ? 'rgba(57,255,20,0.25)' : 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(tx + 2, ty + 2, TS - 4, TS - 4, 6); ctx.fill(); ctx.stroke();
        // Labels
        if (t.isSrc) {
          ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillStyle = '#ffea00'; ctx.fillText('⚡', tx + TS / 2, ty + 4);
        }
        if (t.isSink) {
          ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillStyle = '#ff007f'; ctx.fillText('🔌', tx + TS / 2, ty + 4);
        }
        drawPipe(t, tx, ty);
      }
    }

    // Electric pulse on lit path
    if (cleared) {
      const pulse = 0.5 + Math.sin(frame * 0.3) * 0.5;
      ctx.strokeStyle = `rgba(57,255,20,${pulse * 0.4})`; ctx.lineWidth = 4;
      ctx.shadowBlur = 18; ctx.shadowColor = '#39ff14';
      grid.filter(t => t.lit).forEach(t => {
        const tx = OX + t.col * TS + TS / 2, ty = OY + t.row * TS + TS / 2;
        ctx.beginPath(); ctx.arc(tx, ty, TS / 2 - 4, 0, Math.PI * 2); ctx.stroke();
      });
      ctx.shadowBlur = 0;
    }

    particles.forEach(p => {
      ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.shadowBlur = 8; ctx.shadowColor = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff'; ctx.font = "bold 20px 'Space Grotesk',sans-serif"; ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${score}`, 12, 28);
    ctx.fillStyle = '#39ff14'; ctx.textAlign = 'right';
    ctx.fillText(`LEVEL ${level}`, W - 12, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.font = "11px 'Space Grotesk',sans-serif"; ctx.textAlign = 'center';
    ctx.fillText('CLICK / TAP TILES TO ROTATE · CONNECT ⚡ TO 🔌', W / 2, H - 12);

    if (cleared && clearTimer > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, clearTimer / 30);
      ctx.font = "bold 38px 'Space Grotesk',sans-serif"; ctx.fillStyle = '#39ff14';
      ctx.shadowBlur = 24; ctx.shadowColor = '#39ff14'; ctx.textAlign = 'center';
      ctx.fillText('⚡ CIRCUIT COMPLETE! ⚡', W / 2, H / 2 - 10); ctx.restore();
    }
  }

  function loop() { if (!active) return; update(); render(); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
};
