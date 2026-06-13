window.initIdleMiner = function(canvas, onGameOver, onScoreUpdate) {
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

  // Resources
  let ore = 0;
  let orePerClick = 1;
  let orePerSec = 0;
  let totalEarned = 0;
  let clickParticles = [];

  // Upgrades
  const UPGRADES = [
    { id: 'drill',       label: '⛏️ Hand Drill',     desc: '+1 ore/click',      baseCost: 10,  count: 0, effect: () => { orePerClick += 1; }, costMult: 1.5 },
    { id: 'laser',       label: '🔦 Laser Drill',     desc: '+0.5 ore/sec',      baseCost: 25,  count: 0, effect: () => { orePerSec += 0.5; }, costMult: 1.6 },
    { id: 'robot',       label: '🤖 Mining Robot',    desc: '+2 ore/sec',        baseCost: 120, count: 0, effect: () => { orePerSec += 2; }, costMult: 1.7 },
    { id: 'ship',        label: '🚀 Ore Rocket',       desc: '+8 ore/sec',        baseCost: 600, count: 0, effect: () => { orePerSec += 8; }, costMult: 1.8 },
    { id: 'planet',      label: '🪐 Planet Mine',      desc: '+25 ore/sec',       baseCost: 3000,count: 0, effect: () => { orePerSec += 25; }, costMult: 1.9 },
    { id: 'clickboost',  label: '💥 Click Booster',   desc: '+5 ore/click',      baseCost: 200, count: 0, effect: () => { orePerClick += 5; }, costMult: 1.8 },
  ];

  function getCost(upg) {
    return Math.floor(upg.baseCost * Math.pow(upg.costMult, upg.count));
  }

  // Mine shaft visual
  const SHAFT_X = 60, SHAFT_Y = 50;
  const SHAFT_W = 220, SHAFT_H = 360;
  const LAYERS = 6;
  const LAYER_H = SHAFT_H / LAYERS;

  let miners = []; // visual mining drills
  let oreChunks = []; // floating ore collected
  let lastSecond = performance.now();
  let oreAccum = 0;
  let animParticles = [];

  // HUD button rects
  const UPGRADE_PANEL_X = SHAFT_X + SHAFT_W + 30;
  const UPGRADE_PANEL_W = W - UPGRADE_PANEL_X - 20;
  const MINE_BTN = { x: SHAFT_X, y: SHAFT_Y + SHAFT_H + 18, w: SHAFT_W, h: 50 };

  // Prestige
  let prestiges = 0;
  let prestigeUnlocked = false;
  const PRESTIGE_THRESHOLD = 5000;

  function formatNum(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return Math.floor(n).toString();
  }

  function spawnClickParticles(x, y, amount) {
    clickParticles.push({ x, y, text: `+${formatNum(amount)}`, alpha: 1, vy: -2, timer: 60 });
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2, spd = 1.5 + Math.random() * 2;
      animParticles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 1, alpha: 1, color: '#ffea00', r: 3 + Math.random() * 3 });
    }
  }

  function handleClick(e) {
    if (!active) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    const src = e.touches ? e.touches[0] : e;
    const x = (src.clientX - rect.left) * scaleX;
    const y = (src.clientY - rect.top) * scaleY;

    // Mine button
    if (x >= MINE_BTN.x && x <= MINE_BTN.x + MINE_BTN.w && y >= MINE_BTN.y && y <= MINE_BTN.y + MINE_BTN.h) {
      const earned = orePerClick;
      ore += earned;
      totalEarned += earned;
      if (window.audioManager) window.audioManager.playBlip();
      spawnClickParticles(MINE_BTN.x + MINE_BTN.w / 2, MINE_BTN.y, earned);
      if (onScoreUpdate) onScoreUpdate(Math.floor(totalEarned));
      return;
    }

    // Prestige button
    if (prestigeUnlocked) {
      const pbx = UPGRADE_PANEL_X, pby = SHAFT_Y + SHAFT_H - 44;
      if (x >= pbx && x <= pbx + UPGRADE_PANEL_W && y >= pby && y <= pby + 40) {
        // Prestige!
        prestiges++;
        ore = 0;
        orePerClick = 1 + prestiges * 2;
        orePerSec = 0;
        UPGRADES.forEach(u => { u.count = 0; });
        orePerClick = 1 + prestiges * 2;
        orePerSec = 0;
        prestigeUnlocked = false;
        if (window.audioManager) window.audioManager.playScore();
        return;
      }
    }

    // Upgrade buttons
    UPGRADES.forEach((upg, i) => {
      const uy = SHAFT_Y + 8 + i * 58;
      if (x >= UPGRADE_PANEL_X && x <= UPGRADE_PANEL_X + UPGRADE_PANEL_W && y >= uy && y <= uy + 52) {
        const cost = getCost(upg);
        if (ore >= cost) {
          ore -= cost;
          upg.count++;
          upg.effect();
          if (window.audioManager) window.audioManager.playScore();
          spawnClickParticles(UPGRADE_PANEL_X + UPGRADE_PANEL_W / 2, uy, -cost);
        }
      }
    });
  }

  canvas.addEventListener('click', handleClick);
  canvas.addEventListener('touchstart', (e) => { handleClick(e); e.preventDefault(); }, { passive: false });

  window.destroyIdleMiner = function() {
    active = false;
    canvas.removeEventListener('click', handleClick);
  };

  function update() {
    frame++;

    // Passive income
    const now = performance.now();
    if (now - lastSecond >= 1000) {
      const earned = orePerSec;
      ore += earned;
      totalEarned += earned;
      oreAccum = 0;
      lastSecond = now;
      if (earned > 0) spawnClickParticles(SHAFT_X + SHAFT_W / 2, SHAFT_Y + SHAFT_H / 2, earned);
      if (onScoreUpdate) onScoreUpdate(Math.floor(totalEarned));
    }

    // Prestige unlock
    prestigeUnlocked = totalEarned >= PRESTIGE_THRESHOLD;

    // Animate click particles
    for (let i = clickParticles.length - 1; i >= 0; i--) {
      const p = clickParticles[i];
      p.y += p.vy; p.alpha -= 0.016; p.timer--;
      if (p.timer <= 0 || p.alpha <= 0) clickParticles.splice(i, 1);
    }

    // Anim particles
    for (let i = animParticles.length - 1; i >= 0; i--) {
      const p = animParticles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.alpha -= 0.04;
      if (p.alpha <= 0) animParticles.splice(i, 1);
    }
  }

  function drawShaft() {
    // Shaft border
    ctx.fillStyle = '#0a0a1e';
    ctx.fillRect(SHAFT_X, SHAFT_Y, SHAFT_W, SHAFT_H);
    ctx.strokeStyle = 'rgba(0,240,255,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(SHAFT_X, SHAFT_Y, SHAFT_W, SHAFT_H);

    // Layers
    const LAYER_COLORS = ['#1a0a00', '#0a0a1a', '#0a1a0a', '#1a1a00', '#1a000a', '#000a1a'];
    const LAYER_ORE = ['#ff6600', '#00f0ff', '#39ff14', '#ffea00', '#ff007f', '#b026ff'];
    for (let l = 0; l < LAYERS; l++) {
      const ly = SHAFT_Y + l * LAYER_H;
      ctx.fillStyle = LAYER_COLORS[l];
      ctx.fillRect(SHAFT_X + 1, ly + 1, SHAFT_W - 2, LAYER_H - 2);

      // Ore veins
      ctx.fillStyle = LAYER_ORE[l] + '44';
      for (let v = 0; v < 4; v++) {
        const vx = SHAFT_X + 15 + ((v * 53 + l * 31) % (SHAFT_W - 30));
        const vy = ly + 8 + ((v * 29 + l * 17) % (LAYER_H - 16));
        ctx.beginPath();
        ctx.arc(vx, vy, 6 + (v % 3) * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Layer label
      ctx.fillStyle = LAYER_ORE[l] + 'aa';
      ctx.font = "10px 'Space Grotesk', sans-serif";
      ctx.fillText(`L${l + 1}`, SHAFT_X + 4, ly + 14);

      // Horizontal separator
      if (l > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(SHAFT_X, ly); ctx.lineTo(SHAFT_X + SHAFT_W, ly); ctx.stroke();
      }
    }

    // Animated drill
    const drillX = SHAFT_X + SHAFT_W / 2;
    const drillY = SHAFT_Y + 30 + (frame % 80) * (SHAFT_H - 60) / 80;
    ctx.save();
    ctx.shadowBlur = 14; ctx.shadowColor = '#00f0ff';
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.moveTo(drillX, drillY - 12);
    ctx.lineTo(drillX + 10, drillY);
    ctx.lineTo(drillX - 10, drillY);
    ctx.closePath();
    ctx.fill();
    // Drill bit
    ctx.fillStyle = '#ffea00';
    ctx.beginPath();
    ctx.moveTo(drillX - 6, drillY);
    ctx.lineTo(drillX + 6, drillY);
    ctx.lineTo(drillX, drillY + 16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Extra robots based on upgrades
    const robotCount = UPGRADES.find(u => u.id === 'robot')?.count || 0;
    for (let rb = 0; rb < Math.min(robotCount, 3); rb++) {
      const robotX = SHAFT_X + 20 + rb * 60;
      const robotY = SHAFT_Y + ((frame * (1 + rb * 0.3)) % SHAFT_H);
      ctx.save();
      ctx.shadowBlur = 8; ctx.shadowColor = '#b026ff';
      ctx.fillStyle = '#b026ff';
      ctx.fillRect(robotX - 8, robotY - 8, 16, 16);
      ctx.fillStyle = '#fff';
      ctx.fillRect(robotX - 4, robotY - 4, 4, 4);
      ctx.fillRect(robotX + 1, robotY - 4, 4, 4);
      ctx.restore();
    }
  }

  function render() {
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, W, H);

    drawShaft();

    // Mine button
    const mineHover = false;
    ctx.shadowBlur = 12; ctx.shadowColor = '#00f0ff';
    ctx.fillStyle = '#00f0ff33';
    ctx.beginPath();
    ctx.roundRect(MINE_BTN.x, MINE_BTN.y, MINE_BTN.w, MINE_BTN.h, 10);
    ctx.fill();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = "bold 18px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(`⛏️  MINE  (+${formatNum(orePerClick)}/click)`, MINE_BTN.x + MINE_BTN.w / 2, MINE_BTN.y + 32);
    ctx.textAlign = 'left';

    // Ore display
    ctx.fillStyle = '#ffea00';
    ctx.font = "bold 28px 'Space Grotesk', sans-serif";
    ctx.shadowBlur = 10; ctx.shadowColor = '#ffea00';
    ctx.textAlign = 'center';
    ctx.fillText(`💎 ${formatNum(ore)}`, MINE_BTN.x + MINE_BTN.w / 2, SHAFT_Y - 12);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';

    // Passive rate
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = "12px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(`${formatNum(orePerSec)}/sec`, MINE_BTN.x + MINE_BTN.w / 2, SHAFT_Y - 30);
    ctx.textAlign = 'left';

    // Upgrade panel header
    ctx.fillStyle = '#fff';
    ctx.font = "bold 14px 'Space Grotesk', sans-serif";
    ctx.fillText('UPGRADES', UPGRADE_PANEL_X, SHAFT_Y - 6);

    // Upgrades
    UPGRADES.forEach((upg, i) => {
      const uy = SHAFT_Y + 8 + i * 58;
      const cost = getCost(upg);
      const canAfford = ore >= cost;

      ctx.fillStyle = canAfford ? 'rgba(0,240,255,0.08)' : 'rgba(255,255,255,0.03)';
      ctx.beginPath();
      ctx.roundRect(UPGRADE_PANEL_X, uy, UPGRADE_PANEL_W, 52, 8);
      ctx.fill();
      ctx.strokeStyle = canAfford ? '#00f0ff55' : 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = canAfford ? '#fff' : 'rgba(255,255,255,0.4)';
      ctx.font = `bold 13px 'Space Grotesk', sans-serif`;
      ctx.fillText(upg.label, UPGRADE_PANEL_X + 8, uy + 20);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `11px 'Space Grotesk', sans-serif`;
      ctx.fillText(upg.desc, UPGRADE_PANEL_X + 8, uy + 36);
      ctx.textAlign = 'right';
      ctx.fillStyle = canAfford ? '#ffea00' : 'rgba(255,234,0,0.3)';
      ctx.font = `bold 13px 'Space Grotesk', sans-serif`;
      ctx.fillText(`${formatNum(cost)} 💎`, UPGRADE_PANEL_X + UPGRADE_PANEL_W - 8, uy + 20);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = `10px 'Space Grotesk', sans-serif`;
      ctx.fillText(`×${upg.count}`, UPGRADE_PANEL_X + UPGRADE_PANEL_W - 8, uy + 36);
      ctx.textAlign = 'left';
    });

    // Prestige button
    if (prestigeUnlocked) {
      const pby = SHAFT_Y + SHAFT_H - 44;
      ctx.shadowBlur = 12; ctx.shadowColor = '#ff007f';
      ctx.fillStyle = '#ff007f33';
      ctx.beginPath(); ctx.roundRect(UPGRADE_PANEL_X, pby, UPGRADE_PANEL_W, 40, 8); ctx.fill();
      ctx.strokeStyle = '#ff007f'; ctx.lineWidth = 2; ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = "bold 13px 'Space Grotesk', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText(`🌟 PRESTIGE (×${prestiges + 1}) — RESET FOR BONUS`, UPGRADE_PANEL_X + UPGRADE_PANEL_W / 2, pby + 25);
      ctx.textAlign = 'left';
    } else {
      const progress = Math.min(totalEarned / PRESTIGE_THRESHOLD, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath(); ctx.roundRect(UPGRADE_PANEL_X, SHAFT_Y + SHAFT_H - 22, UPGRADE_PANEL_W, 10, 4); ctx.fill();
      ctx.fillStyle = '#ff007f55';
      ctx.fillRect(UPGRADE_PANEL_X, SHAFT_Y + SHAFT_H - 22, UPGRADE_PANEL_W * progress, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = "10px 'Space Grotesk', sans-serif";
      ctx.fillText(`PRESTIGE at ${formatNum(PRESTIGE_THRESHOLD)} 💎 (${Math.floor(progress * 100)}%)`, UPGRADE_PANEL_X, SHAFT_Y + SHAFT_H - 26);
    }

    // Prestiges badge
    if (prestiges > 0) {
      ctx.fillStyle = '#ff007f';
      ctx.font = "bold 12px 'Space Grotesk', sans-serif";
      ctx.fillText(`🌟 PRESTIGE ×${prestiges}`, UPGRADE_PANEL_X, SHAFT_Y + SHAFT_H + 16);
    }

    // Click particles
    clickParticles.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = '#ffea00';
      ctx.shadowBlur = 6; ctx.shadowColor = '#ffea00';
      ctx.font = "bold 16px 'Space Grotesk', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

    // Anim particles
    animParticles.forEach(p => {
      ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Total earned
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = "11px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'right';
    ctx.fillText(`TOTAL MINED: ${formatNum(totalEarned)} 💎`, W - 10, H - 8);
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
