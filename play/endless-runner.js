window.initEndlessRunner = function(canvas, onGameOver, onScoreUpdate) {
  const ctx = canvas.getContext('2d');
  
  // Set dimensions
  const width = 640;
  const height = 480;
  
  // High-DPI Scaling
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  ctx.scale(dpr, dpr);

  let active = true;
  let score = 0;
  let frame = 0;

  // 3D camera and road geometry
  const cameraDepth = 250;
  const horizonY = 160;
  const roadWidth = 500;
  const segmentLength = 40;
  const maxZ = 1000;
  
  let roadPosition = 0;
  let roadSpeed = 6;

  // Lanes: 0 = Left, 1 = Center, 2 = Right
  const lanesX = [-160, 0, 160];
  let playerLane = 1;
  let playerCarX = 0;
  let targetCarX = 0;
  let playerY = 0;

  // Jump and Slide state
  let isJumping = false;
  let jumpFrame = 0;
  const maxJumpFrames = 35;

  let isSliding = false;
  let slideFrame = 0;
  const maxSlideFrames = 40;

  // Obstacles: { lane, z, type, passed }
  const obstacles = [];
  let obstacleSpawnRate = 75; // frames between spawns

  // Starfield backdrop
  const stars = [];
  for (let i = 0; i < 60; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * horizonY,
      size: Math.random() * 1.5 + 0.5,
      speed: Math.random() * 0.5 + 0.1
    });
  }

  // Exhaust particles
  const particles = [];

  // Project 3D coordinates (x, y, z) into 2D canvas coordinates
  function project(x, y, z) {
    const scale = cameraDepth / (cameraDepth + z);
    const screenX = width / 2 + x * scale;
    const screenY = horizonY + (height - horizonY - y) * scale;
    return { x: screenX, y: screenY, scale: scale };
  }

  // Keyboard controls
  function handleInput(e) {
    if (!active) return;
    if (e.type === 'keydown') {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        e.preventDefault();
        changeLane(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        e.preventDefault();
        changeLane(1);
      } else if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') && !isJumping && !isSliding) {
        e.preventDefault();
        triggerJump();
      } else if ((e.key === 'ArrowDown' || e.key === 's') && !isJumping && !isSliding) {
        e.preventDefault();
        triggerSlide();
      }
    }
  }

  // HTML mobile steering buttons triggers
  const runLeftBtn = document.getElementById('runner-left');
  const runRightBtn = document.getElementById('runner-right');
  const runUpBtn = document.getElementById('runner-up');
  const runDownBtn = document.getElementById('runner-down');

  function handleTouchLeft(e) { e.preventDefault(); changeLane(-1); }
  function handleTouchRight(e) { e.preventDefault(); changeLane(1); }
  function handleTouchUp(e) { e.preventDefault(); if (!isJumping && !isSliding) triggerJump(); }
  function handleTouchDown(e) { e.preventDefault(); if (!isJumping && !isSliding) triggerSlide(); }

  if (runLeftBtn) {
    runLeftBtn.addEventListener('click', handleTouchLeft);
    runLeftBtn.addEventListener('touchstart', handleTouchLeft, { passive: false });
  }
  if (runRightBtn) {
    runRightBtn.addEventListener('click', handleTouchRight);
    runRightBtn.addEventListener('touchstart', handleTouchRight, { passive: false });
  }
  if (runUpBtn) {
    runUpBtn.addEventListener('click', handleTouchUp);
    runUpBtn.addEventListener('touchstart', handleTouchUp, { passive: false });
  }
  if (runDownBtn) {
    runDownBtn.addEventListener('click', handleTouchDown);
    runDownBtn.addEventListener('touchstart', handleTouchDown, { passive: false });
  }

  window.addEventListener('keydown', handleInput);

  window.destroyEndlessRunner = function() {
    active = false;
    window.removeEventListener('keydown', handleInput);
    if (runLeftBtn) {
      runLeftBtn.removeEventListener('click', handleTouchLeft);
      runLeftBtn.removeEventListener('touchstart', handleTouchLeft);
    }
    if (runRightBtn) {
      runRightBtn.removeEventListener('click', handleTouchRight);
      runRightBtn.removeEventListener('touchstart', handleTouchRight);
    }
    if (runUpBtn) {
      runUpBtn.removeEventListener('click', handleTouchUp);
      runUpBtn.removeEventListener('touchstart', handleTouchUp);
    }
    if (runDownBtn) {
      runDownBtn.removeEventListener('click', handleTouchDown);
      runDownBtn.removeEventListener('touchstart', handleTouchDown);
    }
  };

  function changeLane(dir) {
    const nextLane = playerLane + dir;
    if (nextLane >= 0 && nextLane <= 2) {
      playerLane = nextLane;
      targetCarX = lanesX[playerLane];
      if (window.audioManager) window.audioManager.playLaneChange();
    }
  }

  function triggerJump() {
    isJumping = true;
    jumpFrame = 0;
    if (window.audioManager) {
      // jump chime sweep
      const ctxAud = window.audioManager.ctx;
      if (ctxAud) {
        const osc = ctxAud.createOscillator();
        const gain = ctxAud.createGain();
        osc.connect(gain);
        gain.connect(ctxAud.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, ctxAud.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctxAud.currentTime + 0.15);
        gain.gain.setValueAtTime(0.12, ctxAud.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctxAud.currentTime + 0.15);
        osc.start();
        osc.stop(ctxAud.currentTime + 0.15);
      }
    }
  }

  function triggerSlide() {
    isSliding = true;
    slideFrame = 0;
    if (window.audioManager) {
      // slide slide sweep down / hiss noise
      const ctxAud = window.audioManager.ctx;
      if (ctxAud) {
        const osc = ctxAud.createOscillator();
        const gain = ctxAud.createGain();
        osc.connect(gain);
        gain.connect(ctxAud.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, ctxAud.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctxAud.currentTime + 0.25);
        gain.gain.setValueAtTime(0.08, ctxAud.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctxAud.currentTime + 0.25);
        osc.start();
        osc.stop(ctxAud.currentTime + 0.25);
      }
    }
  }

  // Dynamic Spawns
  function spawnObstacle() {
    const lane = Math.floor(Math.random() * 3);
    
    // Check overlapping horizons
    const tooClose = obstacles.some(o => o.z > 800);
    if (!tooClose) {
      const type = Math.random() > 0.45 ? 'spikes' : 'barrier';
      obstacles.push({
        lane: lane,
        z: maxZ,
        type: type,
        passed: false
      });
    }
  }

  // Game Loop decoupled from refresh rate
  let lastTime = performance.now();
  let accumulator = 0;
  const timestep = 1000 / 60; // 60 updates per second

  function update() {
    if (!active) return;
    frame++;

    // Increment speeds & spawn configurations
    roadSpeed = 6 + Math.min(score * 0.2, 14);
    obstacleSpawnRate = Math.max(75 - Math.floor(score * 1.5), 35);
    
    roadPosition += roadSpeed;

    // Stars scrolling background
    stars.forEach(star => {
      star.x -= star.speed;
      if (star.x < 0) star.x = width;
    });

    // Interpolate player swerve lane coordinates
    playerCarX += (targetCarX - playerCarX) * 0.22;

    // Jump Physics (Sine parabola)
    if (isJumping) {
      jumpFrame++;
      playerY = 110 * Math.sin(Math.PI * (jumpFrame / maxJumpFrames));
      if (jumpFrame >= maxJumpFrames) {
        isJumping = false;
        playerY = 0;
      }
    }

    // Slide state tracking
    if (isSliding) {
      slideFrame++;
      if (slideFrame >= maxSlideFrames) {
        isSliding = false;
      }
    }

    // Spawn cycle
    if (frame % obstacleSpawnRate === 0) {
      spawnObstacle();
    }

    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.z -= roadSpeed;

      // Score update boundary
      if (!o.passed && o.z < 60) {
        o.passed = true;
        score++;
        if (window.audioManager) window.audioManager.playScore();
        if (onScoreUpdate) onScoreUpdate(score);
      }

      // Collisions check
      if (o.z >= 50 && o.z <= 90) {
        if (playerLane === o.lane) {
          if (o.type === 'spikes' && playerY < 40) {
            triggerCollision();
            return;
          } else if (o.type === 'barrier' && !isSliding) {
            triggerCollision();
            return;
          }
        }
      }

      // Clean up offscreen Z depth
      if (o.z < 10) {
        obstacles.splice(i, 1);
      }
    }

    // Spark Particles Spawner
    if (frame % 2 === 0) {
      particles.push({
        x: playerCarX + (Math.random() - 0.5) * 16,
        y: playerY + 5,
        z: 60,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 2 - 1,
        vz: -2,
        life: 1.0,
        decay: 0.05
      });
    }

    // Update sparks
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      p.life -= p.decay;
      if (p.life <= 0 || p.z < 10) {
        particles.splice(i, 1);
      }
    }
  }

  function render() {
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, width, height);

    // Stars background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    stars.forEach(star => {
      ctx.fillRect(star.x, star.y, star.size, star.size);
    });

    // Draw grid sky sunset (neon vector lines fading)
    ctx.strokeStyle = 'rgba(176, 38, 255, 0.12)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, horizonY);
      ctx.lineTo(width / 2 + (i - width / 2) * 0.1, 100);
      ctx.stroke();
    }

    // Draw horizontal road segments (gives feeling of speed)
    const baseOffset = roadPosition % (segmentLength * 2);
    for (let z = 1000; z > 10; z -= segmentLength) {
      const adjustedZ = z - (roadPosition % segmentLength);
      const scaleCurrent = cameraDepth / (cameraDepth + adjustedZ);
      const scaleNext = cameraDepth / (cameraDepth + (adjustedZ + segmentLength));

      const yCurr = horizonY + (height - horizonY) * scaleCurrent;
      const yNext = horizonY + (height - horizonY) * scaleNext;

      const halfWCurr = (roadWidth / 2) * scaleCurrent;
      const halfWNext = (roadWidth / 2) * scaleNext;

      // alternate deep segment blocks
      const stripeIndex = Math.floor((roadPosition + z) / segmentLength) % 2;
      ctx.fillStyle = stripeIndex === 0 ? '#0b0922' : '#040411';
      ctx.beginPath();
      ctx.moveTo(width / 2 - halfWCurr, yCurr);
      ctx.lineTo(width / 2 + halfWCurr, yCurr);
      ctx.lineTo(width / 2 + halfWNext, yNext);
      ctx.lineTo(width / 2 - halfWNext, yNext);
      ctx.closePath();
      ctx.fill();

      // Side grid boundaries (neon stripes)
      ctx.strokeStyle = '#b026ff';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#b026ff';
      ctx.beginPath();
      ctx.moveTo(width / 2 - halfWCurr, yCurr);
      ctx.lineTo(width / 2 - halfWNext, yNext);
      ctx.moveTo(width / 2 + halfWCurr, yCurr);
      ctx.lineTo(width / 2 + halfWNext, yNext);
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset
    }

    // Draw lane lines stretching down in perspective
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
    ctx.lineWidth = 1.5;
    const laneDivs = [-roadWidth / 6, roadWidth / 6];
    laneDivs.forEach(lx => {
      const pNear = project(lx, 0, 10);
      const pFar = project(lx, 0, 1000);
      ctx.beginPath();
      ctx.moveTo(pNear.x, pNear.y);
      ctx.lineTo(pFar.x, pFar.y);
      ctx.stroke();
    });

    // Draw Obstacles (draw back-to-front by sorting obstacles descending by Z)
    const sortedObstacles = [...obstacles].sort((a, b) => b.z - a.z);
    sortedObstacles.forEach(o => {
      const oX = lanesX[o.lane];
      
      if (o.type === 'spikes') {
        // Draw 3D wireframe pyramid
        const pBase1 = project(oX - 35, 0, o.z - 25);
        const pBase2 = project(oX + 35, 0, o.z - 25);
        const pBase3 = project(oX + 35, 0, o.z + 25);
        const pBase4 = project(oX - 35, 0, o.z + 25);
        const pApex = project(oX, 65, o.z); // top tip

        ctx.strokeStyle = '#ff007f';
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff007f';

        // draw base
        ctx.beginPath();
        ctx.moveTo(pBase1.x, pBase1.y);
        ctx.lineTo(pBase2.x, pBase2.y);
        ctx.lineTo(pBase3.x, pBase3.y);
        ctx.lineTo(pBase4.x, pBase4.y);
        ctx.closePath();
        ctx.stroke();

        // draw apex edges
        ctx.beginPath();
        ctx.moveTo(pBase1.x, pBase1.y); ctx.lineTo(pApex.x, pApex.y);
        ctx.moveTo(pBase2.x, pBase2.y); ctx.lineTo(pApex.x, pApex.y);
        ctx.moveTo(pBase3.x, pBase3.y); ctx.lineTo(pApex.x, pApex.y);
        ctx.moveTo(pBase4.x, pBase4.y); ctx.lineTo(pApex.x, pApex.y);
        ctx.stroke();
        
        ctx.shadowBlur = 0;
      } else if (o.type === 'barrier') {
        // Draw high gate barrier (under-passable)
        const pLFoot = project(oX - 45, 0, o.z);
        const pRFoot = project(oX + 45, 0, o.z);
        const pLHead = project(oX - 45, 80, o.z);
        const pRHead = project(oX + 45, 80, o.z);
        const pLBarBottom = project(oX - 45, 45, o.z);
        const pRBarBottom = project(oX + 45, 45, o.z);

        ctx.strokeStyle = '#ffea00';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffea00';

        // Draw left & right posts
        ctx.beginPath();
        ctx.moveTo(pLFoot.x, pLFoot.y); ctx.lineTo(pLHead.x, pLHead.y);
        ctx.moveTo(pRFoot.x, pRFoot.y); ctx.lineTo(pRHead.x, pRHead.y);
        ctx.stroke();

        // Draw cross-gate warning panel (from 45 height to 80)
        ctx.fillStyle = 'rgba(255, 234, 0, 0.15)';
        ctx.beginPath();
        ctx.moveTo(pLBarBottom.x, pLBarBottom.y);
        ctx.lineTo(pLHead.x, pLHead.y);
        ctx.lineTo(pRHead.x, pRHead.y);
        ctx.lineTo(pRBarBottom.x, pRBarBottom.y);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(pLBarBottom.x, pLBarBottom.y); ctx.lineTo(pRBarBottom.x, pRBarBottom.y);
        ctx.moveTo(pLHead.x, pLHead.y); ctx.lineTo(pRHead.x, pRHead.y);
        ctx.stroke();
        
        ctx.shadowBlur = 0;
      }
    });

    // Draw Particles/Trails
    particles.forEach(p => {
      const pScr = project(p.x, p.y, p.z);
      if (pScr.scale > 0) {
        ctx.fillStyle = '#00f0ff';
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(pScr.x, pScr.y, 3 * pScr.scale, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1.0;

    // Draw Player Ship (Neon Cyan wireframe ship with depth 60)
    // Adjust size and cockpit depending on slide frame height scaling
    const pHeight = isSliding ? 10 : 22;
    const pTip = project(playerCarX, playerY + pHeight / 2, 85);
    const pLWing = project(playerCarX - 22, playerY - pHeight / 2, 50);
    const pRWing = project(playerCarX + 22, playerY - pHeight / 2, 50);
    const pExh = project(playerCarX, playerY, 45);

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00f0ff';
    
    // Draw wireframe hull
    ctx.beginPath();
    ctx.moveTo(pTip.x, pTip.y);
    ctx.lineTo(pLWing.x, pLWing.y);
    ctx.lineTo(pExh.x, pExh.y);
    ctx.lineTo(pRWing.x, pRWing.y);
    ctx.closePath();
    ctx.stroke();

    // Draw cockpit inner triangle
    ctx.strokeStyle = '#ffffff';
    const pCockpitTip = project(playerCarX, playerY + pHeight / 4, 75);
    const pCockpitL = project(playerCarX - 8, playerY - pHeight / 4, 55);
    const pCockpitR = project(playerCarX + 8, playerY - pHeight / 4, 55);
    ctx.beginPath();
    ctx.moveTo(pCockpitTip.x, pCockpitTip.y);
    ctx.lineTo(pCockpitL.x, pCockpitL.y);
    ctx.lineTo(pCockpitR.x, pCockpitR.y);
    ctx.closePath();
    ctx.stroke();

    ctx.shadowBlur = 0; // Reset

    // HUD displays
    ctx.fillStyle = '#ffffff';
    ctx.font = "800 24px 'Space Grotesk', sans-serif";
    ctx.fillText("RUNNER SCORE: " + score, 20, 40);

    const speedKmH = Math.floor(roadSpeed * 22);
    ctx.font = "800 20px 'Space Grotesk', sans-serif";
    ctx.fillText("SPEED: " + speedKmH + " KM/H", 20, 70);
  }

  function loop(time) {
    if (!active) return;

    let dt = time - lastTime;
    lastTime = time;
    if (dt > 250) dt = 250;

    accumulator += dt;
    while (accumulator >= timestep) {
      update();
      accumulator -= timestep;
    }

    render();
    requestAnimationFrame(loop);
  }

  function triggerCollision() {
    active = false;
    if (window.audioManager) window.audioManager.playExplosion();

    let shake = 22;
    let flash = 1.0;

    // Explode wireframe ship shards
    const shards = [];
    for (let i = 0; i < 35; i++) {
      shards.push({
        x: playerCarX + (Math.random() - 0.5) * 40,
        y: playerY + (Math.random() - 0.5) * 20,
        z: 60,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.5) * 10,
        vz: (Math.random() - 0.5) * 6,
        life: 1.0,
        decay: Math.random() * 0.03 + 0.015,
        color: Math.random() > 0.4 ? '#b026ff' : '#00f0ff'
      });
    }

    let lastExplosionTime = performance.now();
    function animateExplosion(time) {
      const dt = time - lastExplosionTime;
      lastExplosionTime = time;
      const ticks = Math.min(dt / (1000 / 60), 5); // clamp ticks

      ctx.save();
      if (shake > 0) {
        const dx = (Math.random() - 0.5) * shake;
        const dy = (Math.random() - 0.5) * shake;
        ctx.translate(dx, dy);
        shake *= Math.pow(0.88, ticks);
        if (shake < 0.5) shake = 0;
      }

      ctx.fillStyle = '#05050f';
      ctx.fillRect(0, 0, width, height);

      // Re-draw road and static obstacles
      ctx.strokeStyle = 'rgba(176, 38, 255, 0.12)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, horizonY);
        ctx.lineTo(width / 2 + (i - width / 2) * 0.1, 100);
        ctx.stroke();
      }

      // Draw highway edges
      for (let z = 1000; z > 10; z -= segmentLength) {
        const adjustedZ = z - (roadPosition % segmentLength);
        const scaleCurrent = cameraDepth / (cameraDepth + adjustedZ);
        const scaleNext = cameraDepth / (cameraDepth + (adjustedZ + segmentLength));
        const yCurr = horizonY + (height - horizonY) * scaleCurrent;
        const yNext = horizonY + (height - horizonY) * scaleNext;
        const halfWCurr = (roadWidth / 2) * scaleCurrent;
        const halfWNext = (roadWidth / 2) * scaleNext;

        ctx.strokeStyle = '#b026ff';
        ctx.beginPath();
        ctx.moveTo(width / 2 - halfWCurr, yCurr);
        ctx.lineTo(width / 2 - halfWNext, yNext);
        ctx.moveTo(width / 2 + halfWCurr, yCurr);
        ctx.lineTo(width / 2 + halfWNext, yNext);
        ctx.stroke();
      }

      // Draw shards
      let count = 0;
      shards.forEach(p => {
        p.x += p.vx * ticks;
        p.y += p.vy * ticks;
        p.z += p.vz * ticks;
        p.life -= p.decay * ticks;

        if (p.life > 0) {
          count++;
          const pScr = project(p.x, p.y, p.z);
          if (pScr.scale > 0) {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = p.life;
            ctx.shadowBlur = 8;
            ctx.shadowColor = p.color;
            ctx.beginPath();
            ctx.moveTo(pScr.x - 8 * pScr.scale, pScr.y - 4 * pScr.scale);
            ctx.lineTo(pScr.x + 8 * pScr.scale, pScr.y + 4 * pScr.scale);
            ctx.stroke();
          }
        }
      });
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;

      ctx.restore();

      // Red flash on crash
      if (flash > 0) {
        ctx.fillStyle = `rgba(255, 0, 255, ${flash * 0.5})`;
        ctx.fillRect(0, 0, width, height);
        flash -= 0.08 * ticks;
        if (flash < 0) flash = 0;
      }

      if (count > 0 || flash > 0 || shake > 0) {
        requestAnimationFrame(animateExplosion);
      } else {
        window.destroyEndlessRunner();
        if (onGameOver) onGameOver(score);
      }
    }

    requestAnimationFrame(animateExplosion);
  }

  // Start game loop
  requestAnimationFrame(loop);
};
