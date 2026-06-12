window.initStackTower = function(canvas, onGameOver, onScoreUpdate) {
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
  let perfectStreak = 0;
  let floatingTexts = [];

  // Blocks definitions
  const blockHeight = 30;
  const initialWidth = 250;
  let stack = [];
  
  // Camera scroll
  let cameraY = 0;
  let targetCameraY = 0;

  // Game state variables
  let currentBlock = {
    x: 0,
    y: 0,
    width: initialWidth,
    direction: 1, // 1 for right, -1 for left
    speed: 3
  };
  
  // Slices falling down
  let fallingSlices = [];

  // Start building the base of the tower
  const baseWidth = initialWidth;
  const baseX = (width - baseWidth) / 2;
  const baseY = height - 60;
  stack.push({
    x: baseX,
    y: baseY,
    width: baseWidth,
    color: '#00f0ff' // Initial color
  });
  
  // Initialize first moving block
  resetMovingBlock();

  function resetMovingBlock() {
    const topBlock = stack[stack.length - 1];
    currentBlock.y = topBlock.y - blockHeight;
    currentBlock.width = topBlock.width;
    currentBlock.x = currentBlock.direction === 1 ? -currentBlock.width : width;
    // Speed increases slowly as the game progresses
    currentBlock.speed = 3 + Math.min(score * 0.15, 6);
  }

  // Handle Drop Action
  function dropBlock() {
    if (!active) return;
    
    const topBlock = stack[stack.length - 1];
    const leftBound = topBlock.x;
    const rightBound = topBlock.x + topBlock.width;
    
    // Check overlap
    const bLeft = currentBlock.x;
    const bRight = currentBlock.x + currentBlock.width;
    
    // Hit/Miss calculations
    if (bRight <= leftBound || bLeft >= rightBound) {
      // Complete miss
      triggerMissDrop();
      return;
    }
    
    // Calculate new block position and width
    let newX = Math.max(bLeft, leftBound);
    let newRight = Math.min(bRight, rightBound);
    let newWidth = newRight - newX;
    
    // Slice logic: check if there's an overhanging part
    let sliceX = 0;
    let sliceWidth = 0;
    
    if (bLeft < leftBound) {
      // Sliced on the left
      sliceX = bLeft;
      sliceWidth = leftBound - bLeft;
    } else if (bRight > rightBound) {
      // Sliced on the right
      sliceX = rightBound;
      sliceWidth = bRight - rightBound;
    }
    
    // Create falling slice if there's an overhang
    if (sliceWidth > 0) {
      perfectStreak = 0;
      if (window.audioManager) window.audioManager.playSlice();
      fallingSlices.push({
        x: sliceX,
        y: currentBlock.y,
        width: sliceWidth,
        vy: 0,
        color: getNeonColor(stack.length)
      });
      score++;
    } else {
      perfectStreak++;
      const bonus = 1 + Math.min(Math.floor(perfectStreak / 2), 3);
      score += bonus;
      
      if (window.audioManager) window.audioManager.playPerfect();
      
      const txt = perfectStreak >= 3 ? `PERFECT x${perfectStreak} (+${bonus})` : "PERFECT!";
      const col = perfectStreak >= 5 ? '#ffea00' : (perfectStreak >= 3 ? '#ff007f' : '#39ff14');
      floatingTexts.push({
        x: newX + newWidth / 2,
        y: currentBlock.y - 15,
        text: txt,
        color: col,
        life: 1.0
      });
    }
    
    // Add new block to the stack
    stack.push({
      x: newX,
      y: currentBlock.y,
      width: newWidth,
      color: getNeonColor(stack.length)
    });
    
    if (onScoreUpdate) onScoreUpdate(score);
    
    // Scroll camera up if the tower grows beyond height / 2
    if (currentBlock.y < height / 2) {
      targetCameraY += blockHeight;
    }
    
    // Move to next block
    currentBlock.direction = currentBlock.direction * -1;
    resetMovingBlock();
  }

  // Miss drop: block falls down completely
  function triggerMissDrop() {
    active = false;
    if (window.audioManager) window.audioManager.playExplosion();
    fallingSlices.push({
      x: currentBlock.x,
      y: currentBlock.y,
      width: currentBlock.width,
      vy: 0,
      color: getNeonColor(stack.length)
    });
    
    setTimeout(() => {
      window.destroyStackTower();
      if (onGameOver) onGameOver(score);
    }, 1000);
  }

  // Curated color palette that shifts dynamically
  function getNeonColor(index) {
    const colors = [
      '#ff007f', // Pink
      '#00f0ff', // Cyan
      '#39ff14', // Lime
      '#ffea00', // Yellow
      '#b026ff', // Purple
      '#ff5e00'  // Orange
    ];
    return colors[index % colors.length];
  }

  // Handle controls
  function handleInput(e) {
    if (!active) return;
    if (e.type === 'keydown' && e.code !== 'Space') return;
    e.preventDefault();
    dropBlock();
  }

  window.addEventListener('keydown', handleInput);
  canvas.addEventListener('mousedown', handleInput);
  canvas.addEventListener('touchstart', handleInput, { passive: false });

  window.destroyStackTower = function() {
    active = false;
    window.removeEventListener('keydown', handleInput);
    canvas.removeEventListener('mousedown', handleInput);
    canvas.removeEventListener('touchstart', handleInput);
  };

  // Main Loop decoupled from frame rate
  let lastTime = performance.now();
  let accumulator = 0;
  const timestep = 1000 / 60; // 60 updates per second

  function update() {
    // Scroll camera smoothly
    if (Math.abs(cameraY - targetCameraY) > 0.1) {
      cameraY += (targetCameraY - cameraY) * 0.1;
    }

    // Update moving block
    if (active) {
      currentBlock.x += currentBlock.speed * currentBlock.direction;
      
      // Ping pong back and forth
      if (currentBlock.direction === 1 && currentBlock.x > width - 50) {
        currentBlock.direction = -1;
      } else if (currentBlock.direction === -1 && currentBlock.x < -currentBlock.width + 50) {
        currentBlock.direction = 1;
      }
    }

    // Update falling slices
    fallingSlices.forEach(slice => {
      slice.vy += 0.5; // gravity
      slice.y += slice.vy;
    });

    // Update Floating texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y -= 0.8;
      ft.life -= 0.02;
      if (ft.life <= 0) {
        floatingTexts.splice(i, 1);
      }
    }
  }

  function render() {
    // Render Background
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, width, height);

    // Apply camera translate
    ctx.save();
    ctx.translate(0, cameraY);

    // Draw Stacked blocks
    stack.forEach(block => {
      ctx.fillStyle = block.color;
      
      // Shadow glow effect
      ctx.shadowBlur = 10;
      ctx.shadowColor = block.color;
      
      ctx.fillRect(block.x, block.y, block.width, blockHeight);
      
      // White top border highlight
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.3;
      ctx.fillRect(block.x, block.y, block.width, 3);
      ctx.globalAlpha = 1.0;
    });

    // Draw Falling slices
    ctx.shadowBlur = 5;
    fallingSlices.forEach(slice => {
      ctx.fillStyle = slice.color;
      ctx.shadowColor = slice.color;
      ctx.fillRect(slice.x, slice.y, slice.width, blockHeight);
    });

    // Draw Moving block
    if (active) {
      const color = getNeonColor(stack.length);
      ctx.fillStyle = color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
      ctx.fillRect(currentBlock.x, currentBlock.y, currentBlock.width, blockHeight);
      
      // Border highlight
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.3;
      ctx.fillRect(currentBlock.x, currentBlock.y, currentBlock.width, 3);
      ctx.globalAlpha = 1.0;
    }

    // Draw Floating texts
    ctx.shadowBlur = 0;
    floatingTexts.forEach(ft => {
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = ft.life;
      ctx.font = "800 20px 'Space Grotesk', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    });
    ctx.globalAlpha = 1.0;
    ctx.textAlign = 'left';

    ctx.restore();
    ctx.shadowBlur = 0; // Reset shadow

    // HUD Display
    ctx.fillStyle = '#ffffff';
    ctx.font = "800 24px 'Space Grotesk', sans-serif";
    ctx.fillText("TOWER DEPTH: " + score, 20, 40);
  }

  function loop(time) {
    let dt = time - lastTime;
    lastTime = time;
    if (dt > 250) dt = 250; // clamp spikes

    accumulator += dt;
    while (accumulator >= timestep) {
      update();
      accumulator -= timestep;
    }

    render();

    if (active || fallingSlices.some(s => s.y < height + 100)) {
      requestAnimationFrame(loop);
    }
  }

  // Run Game
  requestAnimationFrame(loop);
};
