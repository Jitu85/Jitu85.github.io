window.initReflexRacer = function(canvas, onGameOver, onScoreUpdate) {
  const ctx = canvas.getContext('2d');
  
  // Set dimensions
  const width = 640;
  const height = 480;
  canvas.width = width;
  canvas.height = height;

  let active = true;
  let score = 0;
  let frame = 0;

  // Road configuration
  const lanesX = [170, 320, 470]; // center X coordinates for lanes 0, 1, 2
  const laneWidth = 120;
  let roadScrollY = 0;
  let roadSpeed = 5;

  // Player car
  let playerLane = 1; // Start in center lane
  const carWidth = 50;
  const carHeight = 85;
  let playerCarY = height - 120;
  let targetCarX = lanesX[playerLane];
  let playerCarX = targetCarX;

  // Obstacles (hovercars)
  const obstacles = [];
  let obstacleSpawnRate = 90; // spawn every N frames
  
  // Particles
  const particles = [];

  // Controls input handler
  function moveLeft() {
    if (playerLane > 0) {
      playerLane--;
      targetCarX = lanesX[playerLane];
    }
  }

  function moveRight() {
    if (playerLane < 2) {
      playerLane++;
      targetCarX = lanesX[playerLane];
    }
  }

  function handleInput(e) {
    if (!active) return;
    if (e.type === 'keydown') {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        e.preventDefault();
        moveLeft();
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        e.preventDefault();
        moveRight();
      }
    } else if (e.type === 'mousedown' || e.type === 'touchstart') {
      // Get click position relative to canvas
      const rect = canvas.getBoundingClientRect();
      const clickX = ((e.clientX || e.touches[0].clientX) - rect.left) * (width / rect.width);
      e.preventDefault();
      
      // If clicked on left side, move left; if right side, move right
      if (clickX < width / 2) {
        moveLeft();
      } else {
        moveRight();
      }
    }
  }

  window.addEventListener('keydown', handleInput);
  canvas.addEventListener('mousedown', handleInput);
  canvas.addEventListener('touchstart', handleInput, { passive: false });

  window.destroyReflexRacer = function() {
    active = false;
    window.removeEventListener('keydown', handleInput);
    canvas.removeEventListener('mousedown', handleInput);
    canvas.removeEventListener('touchstart', handleInput);
  };

  // Generate neon obstacle colors
  function getRandomObstacleColor() {
    const colors = ['#ff007f', '#ffea00', '#b026ff', '#ff5e00'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Game Loop
  function loop() {
    if (!active) return;
    frame++;

    // Speed up and spawn obstacles faster over time
    roadSpeed = 5 + Math.min(score * 0.25, 10);
    obstacleSpawnRate = Math.max(90 - Math.floor(score * 2), 40);

    // 1. Smoothly interpolate player position
    playerCarX += (targetCarX - playerCarX) * 0.25;

    // 2. Scroll road
    roadScrollY = (roadScrollY + roadSpeed) % 60;

    // 3. Spawn Obstacles
    if (frame % obstacleSpawnRate === 0) {
      // Pick random lane
      const lane = Math.floor(Math.random() * 3);
      
      // Avoid spawning on top of another obstacle in the same lane
      const tooClose = obstacles.some(o => o.lane === lane && o.y < 150);
      if (!tooClose) {
        obstacles.push({
          lane: lane,
          y: -100,
          color: getRandomObstacleColor(),
          passed: false,
          speedOffset: Math.random() * 1.5 - 0.5 // minor variance in speed
        });
      }
    }

    // 4. Update Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.y += roadSpeed * 0.75 + o.speedOffset;

      // Track score
      if (!o.passed && o.y > playerCarY + carHeight) {
        o.passed = true;
        score++;
        if (onScoreUpdate) onScoreUpdate(score);
      }

      // Check collision
      const oX = lanesX[o.lane];
      if (
        o.y + carHeight > playerCarY &&
        o.y < playerCarY + carHeight &&
        Math.abs(playerCarX - oX) < 45
      ) {
        triggerCollision();
        return;
      }

      // Remove offscreen
      if (o.y > height + 50) {
        obstacles.splice(i, 1);
      }
    }

    // 5. Ambient tailpipe sparks
    if (frame % 3 === 0) {
      particles.push({
        x: playerCarX + (Math.random() - 0.5) * 15,
        y: playerCarY + carHeight - 5,
        vx: (Math.random() - 0.5) * 1.5,
        vy: Math.random() * 2 + 1,
        life: 1.0,
        decay: 0.05,
        color: '#00f0ff'
      });
    }

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }

    // --- RENDER GAME ---
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, width, height);

    // Draw Highway Lanes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 4;
    // Outer boundaries
    ctx.beginPath();
    ctx.moveTo(110, 0); ctx.lineTo(110, height);
    ctx.moveTo(530, 0); ctx.lineTo(530, height);
    ctx.stroke();

    // Dotted lane lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#00f0ff';
    ctx.setLineDash([30, 30]);
    ctx.lineDashOffset = -roadScrollY;
    
    ctx.beginPath();
    ctx.moveTo(245, 0); ctx.lineTo(245, height);
    ctx.moveTo(395, 0); ctx.lineTo(395, height);
    ctx.stroke();
    
    ctx.setLineDash([]); // Reset dash
    ctx.shadowBlur = 0; // Reset shadow

    // Draw Obstacles
    obstacles.forEach(o => {
      const oX = lanesX[o.lane];
      
      // Draw hovercar shape
      ctx.fillStyle = o.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = o.color;
      
      // Outer body
      ctx.beginPath();
      ctx.roundRect(oX - carWidth / 2, o.y, carWidth, carHeight, 10);
      ctx.fill();

      // Windshield
      ctx.fillStyle = '#05051a';
      ctx.fillRect(oX - carWidth / 2.6, o.y + carHeight / 3.5, carWidth / 1.3, carHeight / 5);

      // Warning lights
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(oX - carWidth / 2.5, o.y + carHeight - 6, 8, 4);
      ctx.fillRect(oX + carWidth / 2.5 - 8, o.y + carHeight - 6, 8, 4);
    });

    // Draw Player Car (Neon Cyan Supercar)
    ctx.fillStyle = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00f0ff';
    
    // Body Shape
    ctx.beginPath();
    ctx.roundRect(playerCarX - carWidth / 2, playerCarY, carWidth, carHeight, 12);
    ctx.fill();

    // Neon stripe detail
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playerCarX - 10, playerCarY + 15);
    ctx.lineTo(playerCarX, playerCarY + 5);
    ctx.lineTo(playerCarX + 10, playerCarY + 15);
    ctx.stroke();

    // Windshield
    ctx.fillStyle = '#05051a';
    ctx.fillRect(playerCarX - carWidth / 2.6, playerCarY + carHeight / 2.2, carWidth / 1.3, carHeight / 55);
    ctx.fillRect(playerCarX - carWidth / 2.6, playerCarY + carHeight / 5, carWidth / 1.3, carHeight / 4.5);

    // Headlights (cyan glow)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(playerCarX - carWidth / 2.5, playerCarY + 4, 8, 5);
    ctx.fillRect(playerCarX + carWidth / 2.5 - 8, playerCarY + 4, 8, 5);

    // Tailpipe Sparks / Jet Glow
    particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0; // Reset glow

    // Draw Score
    ctx.fillStyle = '#ffffff';
    ctx.font = "800 24px 'Space Grotesk', sans-serif";
    ctx.fillText("RACER SCORE: " + score, 20, 40);

    requestAnimationFrame(loop);
  }

  function triggerCollision() {
    active = false;

    // Explosion particles
    const explosions = [];
    for (let i = 0; i < 40; i++) {
      explosions.push({
        x: playerCarX,
        y: playerCarY + 30,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        size: Math.random() * 10 + 4,
        life: 1.0,
        decay: Math.random() * 0.03 + 0.015,
        color: Math.random() > 0.4 ? '#39ff14' : '#ffea00'
      });
    }

    function animateExplosion() {
      ctx.fillStyle = '#05050f';
      ctx.fillRect(0, 0, width, height);

      let count = 0;
      explosions.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        
        if (p.life > 0) {
          count++;
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;

      if (count > 0) {
        requestAnimationFrame(animateExplosion);
      } else {
        window.destroyReflexRacer();
        if (onGameOver) onGameOver(score);
      }
    }

    animateExplosion();
  }

  // Start game loop
  loop();
};
