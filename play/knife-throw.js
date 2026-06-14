window.initKnifeThrow = function(canvas, onGameOver, onScoreUpdate) {
  const ctx = canvas.getContext('2d');
  
  let score = 0;
  let isGameOver = false;
  let targetRotation = 0;
  let rotationSpeed = 0.02;
  
  const targetRadius = 60;
  const targetX = canvas.width / 2;
  const targetY = canvas.height / 3;
  
  let knives = []; // Angles at which knives are stuck
  let isThrowing = false;
  let knifeY = 0;
  const knifeStart_Y = canvas.height * 0.8;
  const knifeSpeed = 25;
  const knifeWidth = 8;
  const knifeHeight = 40;

  let lastTime = 0;
  let animationId;

  function resetThrowingKnife() {
    isThrowing = false;
    knifeY = knifeStart_Y;
  }

  resetThrowingKnife();

  function drawKnife(x, y, angle = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    // Blade
    ctx.fillStyle = '#CCCCCC';
    ctx.beginPath();
    ctx.moveTo(0, -knifeHeight / 2);
    ctx.lineTo(knifeWidth / 2, -knifeHeight / 4);
    ctx.lineTo(knifeWidth / 2, knifeHeight / 2);
    ctx.lineTo(-knifeWidth / 2, knifeHeight / 2);
    ctx.lineTo(-knifeWidth / 2, -knifeHeight / 4);
    ctx.closePath();
    ctx.fill();

    // Handle
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-knifeWidth / 2 + 1, knifeHeight / 2, knifeWidth - 2, 15);
    
    ctx.restore();
  }

  function drawTarget() {
    ctx.save();
    ctx.translate(targetX, targetY);
    ctx.rotate(targetRotation);
    
    // Wood texture simulation
    ctx.fillStyle = '#D2B48C';
    ctx.beginPath();
    ctx.arc(0, 0, targetRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Rings
    ctx.beginPath();
    ctx.arc(0, 0, targetRadius * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, targetRadius * 0.4, 0, Math.PI * 2);
    ctx.stroke();

    // Stuck knives
    for (let i = 0; i < knives.length; i++) {
      drawKnife(0, targetRadius + knifeHeight / 2, knives[i]);
    }
    
    ctx.restore();
  }

  function draw() {
    // Clear canvas, but we'll use a dynamic center
    const tx = canvas.width / 2;
    const ty = canvas.height / 3;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawTarget();
    
    // Draw throwing knife
    drawKnife(tx, knifeY);
    
    if (isGameOver) {
      ctx.fillStyle = '#FF0000';
      ctx.font = 'bold 40px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('CRASH!', tx, canvas.height / 2 + 50);
    }
  }

  function update(time = 0) {
    if (isGameOver) return;
    const deltaTime = time - lastTime;
    lastTime = time;

    // Rotate target
    targetRotation += rotationSpeed;

    if (isThrowing) {
      knifeY -= knifeSpeed;
      
      // Check collision
      if (knifeY - knifeHeight / 2 <= targetY + targetRadius) {
        // Knife hit target!
        const hitAngle = (-targetRotation) % (Math.PI * 2);
        const normalizedHitAngle = hitAngle < 0 ? hitAngle + Math.PI * 2 : hitAngle;
        
        let crash = false;
        // Check for overlaps with stuck knives
        const tolerance = 0.25; // radians
        for (let i = 0; i < knives.length; i++) {
          let diff = Math.abs(knives[i] - normalizedHitAngle);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;
          if (diff < tolerance) {
            crash = true;
            break;
          }
        }
        
        if (crash) {
          isGameOver = true;
          onGameOver();
        } else {
          knives.push(normalizedHitAngle);
          score += 10;
          onScoreUpdate(score);
          resetThrowingKnife();
          
          // Next level variation if enough knives
          if (knives.length > 7) {
            knives = [];
            score += 50; // Level up bonus
            onScoreUpdate(score);
            rotationSpeed = (Math.random() > 0.5 ? 1 : -1) * (0.02 + Math.random() * 0.04);
          }
        }
      }
    }

    draw();
    animationId = requestAnimationFrame(update);
  }

  const handleInput = (e) => {
    e.preventDefault();
    if (isGameOver) return;
    if (!isThrowing) {
      isThrowing = true;
    }
  };

  canvas.addEventListener('mousedown', handleInput);
  canvas.addEventListener('touchstart', handleInput, {passive: false});

  // initial draw
  draw();
  update();

  window.destroyKnifeThrow = function() {
    isGameOver = true;
    cancelAnimationFrame(animationId);
    canvas.removeEventListener('mousedown', handleInput);
    canvas.removeEventListener('touchstart', handleInput);
  };
};
