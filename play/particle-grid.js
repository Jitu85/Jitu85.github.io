(function() {
  const canvas = document.createElement('canvas');
  canvas.id = 'bg-particle-canvas';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.zIndex = '-1';
  canvas.style.pointerEvents = 'none';
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let width = window.innerWidth;
  let height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;

  const particles = [];
  const maxParticles = width < 768 ? 20 : 50;
  const connectionDist = width < 768 ? 80 : 110;
  
  // Track mouse coordinates
  let mouse = { x: null, y: null, radius: 150 };
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    
    // Spawn glowing cyber-sparks on cursor move (max particle count to prevent lag)
    if (particles.length < 150) {
      for (let i = 0; i < 2; i++) {
        particles.push(new Particle(true, mouse.x, mouse.y));
      }
    }
  });

  window.addEventListener('mouseout', () => {
    mouse.x = null;
    mouse.y = null;
  });

  window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  });

  class Particle {
    constructor(isSpark = false, x, y) {
      this.isSpark = isSpark;
      this.x = x !== undefined ? x : Math.random() * width;
      this.y = y !== undefined ? y : Math.random() * height;
      this.vx = (Math.random() - 0.5) * (isSpark ? 1.4 : 0.6);
      this.vy = (Math.random() - 0.5) * (isSpark ? 1.4 : 0.6);
      this.size = isSpark ? (Math.random() * 1.5 + 0.6) : (Math.random() * 2 + 1);
      this.color = Math.random() > 0.5 ? '#00f0ff' : '#ff007f'; // cyan and pink dots
      if (isSpark) {
        this.life = 1.0;
        this.decay = Math.random() * 0.02 + 0.012; // slowly decays
      }
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      // Bounce off boundaries
      if (this.x < 0 || this.x > width) this.vx *= -1;
      if (this.y < 0 || this.y > height) this.vy *= -1;

      // Mouse interactive push force (only regular particles repel)
      if (!this.isSpark && mouse.x !== null && mouse.y !== null) {
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          const angle = Math.atan2(dy, dx);
          this.x += Math.cos(angle) * force * 1.5;
          this.y += Math.sin(angle) * force * 1.5;
        }
      }
    }

    draw() {
      ctx.fillStyle = this.color;
      ctx.globalAlpha = this.isSpark ? this.life : 1.0;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  }

  // Populate particles array
  for (let i = 0; i < maxParticles; i++) {
    particles.push(new Particle());
  }

  // Draw connections between dots
  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const p1 = particles[i];
        const p2 = particles[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < connectionDist) {
          // Fade connection lines as particles drift apart and as sparks decay
          let alpha = (connectionDist - dist) / connectionDist * 0.12;
          if (p1.isSpark) alpha *= p1.life;
          if (p2.isSpark) alpha *= p2.life;

          ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }
  }

  // Animation loop
  function animate() {
    ctx.clearRect(0, 0, width, height);
    
    // Draw background grid effect
    drawConnections();
    
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.update();
      p.draw();

      // Filter out and splice decayed sparks
      if (p.isSpark) {
        p.life -= p.decay;
        if (p.life <= 0) {
          particles.splice(i, 1);
        }
      }
    }

    requestAnimationFrame(animate);
  }

  animate();
})();
