window.initRetroSnake = function(canvas, onGameOver, onScoreUpdate) {
  const ctx = canvas.getContext('2d');
  
  // Set dimensions
  const width = 640;
  const height = 480;
  canvas.width = width;
  canvas.height = height;

  let active = true;
  let score = 0;
  let frame = 0;

  // Grid settings
  const grid = 20;
  const cols = width / grid;
  const rows = height / grid;

  // Snake body
  let snake = [
    { x: 10, y: 12 },
    { x: 9, y: 12 },
    { x: 8, y: 12 }
  ];
  let dx = 1;
  let dy = 0;
  let nextDx = 1;
  let nextDy = 0;

  // Food positioning
  let food = { x: 0, y: 0 };
  spawnFood();

  // Speed controls (frames per update)
  let speedDelay = 8; 

  // Touch arrows D-pad geometry for mobile overlay
  const dpadX = width - 110;
  const dpadY = height - 110;
  const dpadBtnSize = 35;
  const showDpad = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  // Input Handling
  function changeDirection(newDx, newDy) {
    // Avoid running directly back into tail
    if (newDx !== 0 && dx === 0) {
      nextDx = newDx;
      nextDy = 0;
    } else if (newDy !== 0 && dy === 0) {
      nextDx = 0;
      nextDy = newDy;
    }
  }

  function handleKeydown(e) {
    if (!active) return;
    switch(e.key) {
      case 'ArrowUp':
      case 'w':
        e.preventDefault(); changeDirection(0, -1); break;
      case 'ArrowDown':
      case 's':
        e.preventDefault(); changeDirection(0, 1); break;
      case 'ArrowLeft':
      case 'a':
        e.preventDefault(); changeDirection(-1, 0); break;
      case 'ArrowRight':
      case 'd':
        e.preventDefault(); changeDirection(1, 0); break;
    }
  }

  // Pointer/Touch clicks for virtual D-pad
  function handlePointerDown(e) {
    if (!active) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    if (!clientX || !clientY) return;

    const canvasX = (clientX - rect.left) * (width / rect.width);
    const canvasY = (clientY - rect.top) * (height / rect.height);
    
    e.preventDefault();

    // Check virtual D-pad buttons
    // Up Button
    if (canvasX > dpadX && canvasX < dpadX + dpadBtnSize && canvasY > dpadY - dpadBtnSize && canvasY < dpadY) {
      changeDirection(0, -1);
    }
    // Down Button
    else if (canvasX > dpadX && canvasX < dpadX + dpadBtnSize && canvasY > dpadY + dpadBtnSize && canvasY < dpadY + dpadBtnSize * 2) {
      changeDirection(0, 1);
    }
    // Left Button
    else if (canvasX > dpadX - dpadBtnSize && canvasX < dpadX && canvasY > dpadY && canvasY < dpadY + dpadBtnSize) {
      changeDirection(-1, 0);
    }
    // Right Button
    else if (canvasX > dpadX + dpadBtnSize && canvasX < dpadX + dpadBtnSize * 2 && canvasY > dpadY && canvasY < dpadY + dpadBtnSize) {
      changeDirection(1, 0);
    }
  }

  window.addEventListener('keydown', handleKeydown);
  canvas.addEventListener('mousedown', handlePointerDown);
  canvas.addEventListener('touchstart', handlePointerDown, { passive: false });

  window.destroyRetroSnake = function() {
    active = false;
    window.removeEventListener('keydown', handleKeydown);
    canvas.removeEventListener('mousedown', handlePointerDown);
    canvas.removeEventListener('touchstart', handlePointerDown);
  };

  function spawnFood() {
    let attempts = 0;
    while (attempts < 100) {
      const rx = Math.floor(Math.random() * cols);
      const ry = Math.floor(Math.random() * rows);
      // Avoid spawning food on top of the snake body
      const onSnake = snake.some(part => part.x === rx && part.y === ry);
      if (!onSnake) {
        food.x = rx;
        food.y = ry;
        return;
      }
      attempts++;
    }
  }

  function triggerCrash() {
    active = false;
    if (window.audioManager) window.audioManager.playExplosion();

    // Flash & Shake on snake crash
    let shake = 18;
    let flash = 0.85;

    function animateCrash() {
      ctx.save();
      if (shake > 0) {
        const dx = (Math.random() - 0.5) * shake;
        const dy = (Math.random() - 0.5) * shake;
        ctx.translate(dx, dy);
        shake *= 0.88;
        if (shake < 0.5) shake = 0;
      }

      ctx.fillStyle = '#05050f';
      ctx.fillRect(0, 0, width, height);

      // Draw static snake body
      snake.forEach((part, idx) => {
        ctx.fillStyle = idx === 0 ? '#00f0ff' : 'rgba(0, 240, 255, 0.4)';
        ctx.fillRect(part.x * grid, part.y * grid, grid - 1, grid - 1);
      });

      ctx.restore();

      // Red Flash
      if (flash > 0) {
        ctx.fillStyle = `rgba(255, 0, 0, ${flash * 0.55})`;
        ctx.fillRect(0, 0, width, height);
        flash -= 0.08;
      }

      if (flash > 0 || shake > 0) {
        requestAnimationFrame(animateCrash);
      } else {
        window.destroyRetroSnake();
        if (onGameOver) onGameOver(score);
      }
    }

    animateCrash();
  }

  // Game Loop
  function loop() {
    if (!active) return;
    frame++;

    // Update snake position according to speed delay
    if (frame % speedDelay === 0) {
      dx = nextDx;
      dy = nextDy;

      const head = { x: snake[0].x + dx, y: snake[0].y + dy };

      // Wall collision checks
      if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
        triggerCrash();
        return;
      }

      // Self collision checks
      const selfCollide = snake.some(part => part.x === head.x && part.y === head.y);
      if (selfCollide) {
        triggerCrash();
        return;
      }

      // Add new head
      snake.unshift(head);

      // Check food collection
      if (head.x === food.x && head.y === food.y) {
        score++;
        if (window.audioManager) window.audioManager.playScore();
        if (onScoreUpdate) onScoreUpdate(score);
        
        // Slightly speed up game over time
        speedDelay = Math.max(8 - Math.floor(score / 5), 4);
        spawnFood();
      } else {
        // Remove tail
        snake.pop();
      }
    }

    // --- RENDER SECTION ---
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, width, height);

    // Draw grid guide lines (faint)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
    ctx.lineWidth = 0.5;
    for (let c = 0; c < cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * grid, 0); ctx.lineTo(c * grid, height);
      ctx.stroke();
    }
    for (let r = 0; r < rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * grid); ctx.lineTo(width, r * grid);
      ctx.stroke();
    }

    // Draw Food (Vibrant glowing pulse)
    ctx.fillStyle = '#ff007f';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff007f';
    ctx.beginPath();
    ctx.arc(food.x * grid + grid / 2, food.y * grid + grid / 2, grid / 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Draw Snake (Glowing Neon Cyan vectors)
    snake.forEach((part, idx) => {
      ctx.fillStyle = idx === 0 ? '#ffffff' : '#00f0ff';
      ctx.shadowBlur = idx === 0 ? 12 : 8;
      ctx.shadowColor = '#00f0ff';
      
      // Rounded head or rectangles
      ctx.beginPath();
      ctx.roundRect(part.x * grid + 1, part.y * grid + 1, grid - 2, grid - 2, idx === 0 ? 6 : 3);
      ctx.fill();
    });
    ctx.shadowBlur = 0; // Reset shadows

    // HUD Display
    ctx.fillStyle = '#ffffff';
    ctx.font = "800 24px 'Space Grotesk', sans-serif";
    ctx.fillText("SNAKE SCORE: " + score, 20, 40);

    // Render virtual D-pad on mobile device triggers
    if (showDpad) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffffff';
      
      // Up button
      ctx.beginPath();
      ctx.roundRect(dpadX, dpadY - dpadBtnSize, dpadBtnSize, dpadBtnSize, 6);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.font = "800 16px 'Space Grotesk', sans-serif";
      ctx.fillText("▲", dpadX + 11, dpadY - dpadBtnSize + 22);

      // Down button
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(dpadX, dpadY + dpadBtnSize, dpadBtnSize, dpadBtnSize, 6);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.fillText("▼", dpadX + 11, dpadY + dpadBtnSize + 22);

      // Left button
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(dpadX - dpadBtnSize, dpadY, dpadBtnSize, dpadBtnSize, 6);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.fillText("◀", dpadX - dpadBtnSize + 11, dpadY + 22);

      // Right button
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(dpadX + dpadBtnSize, dpadY, dpadBtnSize, dpadBtnSize, 6);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.fillText("▶", dpadX + dpadBtnSize + 11, dpadY + 22);

      ctx.globalAlpha = 1.0;
    }

    requestAnimationFrame(loop);
  }

  // Run loop
  loop();
};
