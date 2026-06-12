window.initFlappyRocket = function(canvas, onGameOver, onScoreUpdate) {
  const ctx = canvas.getContext('2d');
  
  // Set logical size for scaling
  const width = 640;
  const height = 480;
  canvas.width = width;
  canvas.height = height;

  let active = true;
  let score = 0;
  let frame = 0;
  
  // Physics & Entity states
  const gravity = 0.35;
  const lift = -6.5;
  let velocity = 0;
  let rocketY = height / 2;
  const rocketX = 120;
  const rocketWidth = 40;
  const rocketHeight = 24;
  
  // Obstacles (gates)
  const gates = [];
  const gateWidth = 50;
  const gateGap = 150;
  const gateInterval = 120; // frames
  
  // Background particles (Stars)
  const stars = [];
  for (let i = 0; i < 40; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 2 + 1
    });
  }
  
  // Flame particles
  const particles = [];
  
  // Setup inputs
  function handleInput(e) {
    if (!active) return;
    if (e.type === 'keydown' && e.code !== 'Space') return;
    e.preventDefault();
    velocity = lift;
    
    // Add thrust particles
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: rocketX - 10,
        y: rocketY + rocketHeight / 2,
        vx: -Math.random() * 3 - 2,
        vy: (Math.random() - 0.5) * 3,
        size: Math.random() * 4 + 2,
        life: 1,
        decay: Math.random() * 0.05 + 0.05,
        color: Math.random() > 0.3 ? '#ff007f' : '#ffea00'
      });
    }
  }
  
  window.addEventListener('keydown', handleInput);
  canvas.addEventListener('mousedown', handleInput);
  canvas.addEventListener('touchstart', handleInput, { passive: false });
  
  // Clean up function to prevent memory leaks when game is closed
  window.destroyFlappyRocket = function() {
    active = false;
    window.removeEventListener('keydown', handleInput);
    canvas.removeEventListener('mousedown', handleInput);
    canvas.removeEventListener('touchstart', handleInput);
  };
  
  // Main Game Loop
  function loop() {
    if (!active) return;
    
    // Update
    frame++;
    
    // 1. Stars Update
    stars.forEach(star => {
      star.x -= star.speed;
      if (star.x < 0) {
        star.x = width;
        star.y = Math.random() * height;
      }
    });
    
    // 2. Rocket Physics
    velocity += gravity;
    rocketY += velocity;
    
    // Boundary collision
    if (rocketY < 0) {
      rocketY = 0;
      velocity = 0;
    }
    if (rocketY + rocketHeight > height) {
      triggerGameOver();
      return;
    }
    
    // 3. Flame Particles Update
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
    
    // 4. Gates Logic
    if (frame % gateInterval === 0) {
      const minGateY = 50;
      const maxGateY = height - gateGap - 50;
      const gateTopY = Math.floor(Math.random() * (maxGateY - minGateY)) + minGateY;
      gates.push({
        x: width,
        topY: gateTopY,
        passed: false
      });
    }
    
    for (let i = gates.length - 1; i >= 0; i--) {
      const g = gates[i];
      g.x -= 3; // speed
      
      // Score tracking
      if (!g.passed && g.x + gateWidth < rocketX) {
        g.passed = true;
        score++;
        if (onScoreUpdate) onScoreUpdate(score);
      }
      
      // Collision detection
      if (
        rocketX + rocketWidth > g.x &&
        rocketX < g.x + gateWidth &&
        (rocketY < g.topY || rocketY + rocketHeight > g.topY + gateGap)
      ) {
        triggerGameOver();
        return;
      }
      
      // Remove offscreen gates
      if (g.x + gateWidth < 0) {
        gates.splice(i, 1);
      }
    }
    
    // Rendering
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, width, height);
    
    // Draw Stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    stars.forEach(star => {
      ctx.fillRect(star.x, star.y, star.size, star.size);
    });
    
    // Draw Flame Particles
    particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
    
    // Draw Gates
    gates.forEach(g => {
      // Create gradients for barriers
      const grad = ctx.createLinearGradient(g.x, 0, g.x + gateWidth, 0);
      grad.addColorStop(0, '#00f0ff');
      grad.addColorStop(1, '#b026ff');
      
      ctx.fillStyle = grad;
      // Top Obstacle
      ctx.fillRect(g.x, 0, gateWidth, g.topY);
      // Bottom Obstacle
      ctx.fillRect(g.x, g.topY + gateGap, gateWidth, height - (g.topY + gateGap));
      
      // Draw warning lights at the tips
      ctx.fillStyle = '#ff007f';
      ctx.fillRect(g.x - 2, g.topY - 8, gateWidth + 4, 8);
      ctx.fillRect(g.x - 2, g.topY + gateGap, gateWidth + 4, 8);
    });
    
    // Draw Rocket (Futuristic Vector Shape)
    ctx.save();
    ctx.translate(rocketX + rocketWidth / 2, rocketY + rocketHeight / 2);
    // Rotate slightly based on velocity
    let angle = Math.atan2(velocity, 8);
    ctx.rotate(angle);
    
    // Draw Body
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-rocketWidth / 2, -rocketHeight / 2);
    ctx.lineTo(rocketWidth / 2, 0);
    ctx.lineTo(-rocketWidth / 2, rocketHeight / 2);
    ctx.closePath();
    ctx.fill();
    
    // Neon details on ship
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw cockpit window
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.moveTo(rocketWidth / 6, -rocketHeight / 6);
    ctx.lineTo(rocketWidth / 3, 0);
    ctx.lineTo(rocketWidth / 6, rocketHeight / 6);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
    
    // Score board text
    ctx.fillStyle = '#ffffff';
    ctx.font = "800 24px 'Space Grotesk', sans-serif";
    ctx.fillText("SCORE: " + score, 20, 40);
    
    requestAnimationFrame(loop);
  }
  
  function triggerGameOver() {
    active = false;
    
    // Explosion particles
    const explosions = [];
    for (let i = 0; i < 30; i++) {
      explosions.push({
        x: rocketX + rocketWidth / 2,
        y: rocketY + rocketHeight / 2,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        size: Math.random() * 8 + 3,
        life: 1,
        decay: Math.random() * 0.02 + 0.015
      });
    }
    
    function drawExplosion() {
      ctx.fillStyle = '#05050f';
      ctx.fillRect(0, 0, width, height);
      
      // Draw gates one last static frame
      gates.forEach(g => {
        const grad = ctx.createLinearGradient(g.x, 0, g.x + gateWidth, 0);
        grad.addColorStop(0, '#00f0ff');
        grad.addColorStop(1, '#b026ff');
        ctx.fillStyle = grad;
        ctx.fillRect(g.x, 0, gateWidth, g.topY);
        ctx.fillRect(g.x, g.topY + gateGap, gateWidth, height - (g.topY + gateGap));
      });
      
      let elements = 0;
      explosions.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        
        if (p.life > 0) {
          elements++;
          ctx.fillStyle = `rgba(255, 0, 127, ${p.life})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      
      if (elements > 0) {
        requestAnimationFrame(drawExplosion);
      } else {
        // Clear listeners and trigger callback
        window.destroyFlappyRocket();
        if (onGameOver) onGameOver(score);
      }
    }
    
    drawExplosion();
  }
  
  // Start loop
  loop();
};
