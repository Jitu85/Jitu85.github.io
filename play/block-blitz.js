window.initBlockBlitz = function(canvas, onGameOver, onScoreUpdate) {
  const ctx = canvas.getContext('2d');
  
  const COLS = 10;
  const ROWS = 20;
  let BLOCK_SIZE = 32;

  let grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid.push(new Array(COLS).fill(0));
  }

  const COLORS = [
    null,
    '#00FFFF', // I - Cyan
    '#0000FF', // J - Blue
    '#FFA500', // L - Orange
    '#FFFF00', // O - Yellow
    '#00FF00', // S - Green
    '#800080', // T - Purple
    '#FF0000'  // Z - Red
  ];

  const TETROMINOES = [
    [],
    [[1,1,1,1]], // I
    [[2,0,0], [2,2,2]], // J
    [[0,0,3], [3,3,3]], // L
    [[4,4], [4,4]], // O
    [[0,5,5], [5,5,0]], // S
    [[0,6,0], [6,6,6]], // T
    [[7,7,0], [0,7,7]]  // Z
  ];

  let currentPiece = null;
  let currentX = 0;
  let currentY = 0;
  
  let score = 0;
  let isGameOver = false;
  let dropCounter = 0;
  let dropInterval = 1000;
  let lastTime = 0;
  let animationId;

  function createPiece() {
    const type = Math.floor(Math.random() * 7) + 1;
    const matrix = TETROMINOES[type];
    const x = Math.floor(COLS / 2) - Math.floor(matrix[0].length / 2);
    const y = 0;
    
    currentPiece = { matrix, type };
    currentX = x;
    currentY = y;

    if (collide(grid, currentPiece, currentX, currentY)) {
      isGameOver = true;
      onGameOver();
    }
  }

  function collide(board, piece, x, y) {
    const m = piece.matrix;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c] !== 0) {
          if (board[y + r] && board[y + r][x + c] !== 0) {
            return true;
          }
          if (y + r >= ROWS || x + c < 0 || x + c >= COLS) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function merge(board, piece, x, y) {
    const m = piece.matrix;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c] !== 0) {
          board[y + r][x + c] = piece.type;
        }
      }
    }
  }

  function rotate(matrix) {
    const N = matrix.length;
    const M = matrix[0].length;
    let res = new Array(M).fill(0).map(() => new Array(N).fill(0));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < M; c++) {
        res[c][N - 1 - r] = matrix[r][c];
      }
    }
    return res;
  }

  function playerRotate() {
    const original = currentPiece.matrix;
    currentPiece.matrix = rotate(currentPiece.matrix);
    let offset = 1;
    let pos = currentX;
    // Wall kick
    while (collide(grid, currentPiece, currentX, currentY)) {
      currentX += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (offset > currentPiece.matrix[0].length) {
        currentPiece.matrix = original;
        currentX = pos;
        return;
      }
    }
  }

  function playerMove(dir) {
    currentX += dir;
    if (collide(grid, currentPiece, currentX, currentY)) {
      currentX -= dir;
    }
  }

  function playerDrop() {
    currentY++;
    if (collide(grid, currentPiece, currentX, currentY)) {
      currentY--;
      merge(grid, currentPiece, currentX, currentY);
      clearLines();
      createPiece();
    }
    dropCounter = 0;
  }

  function clearLines() {
    let linesCleared = 0;
    outer: for (let r = ROWS - 1; r >= 0; r--) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === 0) {
          continue outer;
        }
      }
      const row = grid.splice(r, 1)[0].fill(0);
      grid.unshift(row);
      r++; // Check the new row at the same position
      linesCleared++;
    }
    
    if (linesCleared > 0) {
      const points = [0, 100, 300, 500, 800];
      score += points[linesCleared];
      onScoreUpdate(score);
      // Speed up
      dropInterval = Math.max(100, dropInterval - 50);
    }
  }

  function drawMatrix(matrix, offsetX, offsetY) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          ctx.fillStyle = COLORS[matrix[r][c]];
          ctx.fillRect((offsetX + c) * BLOCK_SIZE, (offsetY + r) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
          
          // Glossy effect
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.fillRect((offsetX + c) * BLOCK_SIZE, (offsetY + r) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE / 3);
          
          // Border
          ctx.strokeStyle = '#000';
          ctx.strokeRect((offsetX + c) * BLOCK_SIZE, (offsetY + r) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    for(let r=0; r<=ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK_SIZE);
      ctx.lineTo(COLS * BLOCK_SIZE, r * BLOCK_SIZE);
      ctx.stroke();
    }
    for(let c=0; c<=COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK_SIZE, 0);
      ctx.lineTo(c * BLOCK_SIZE, ROWS * BLOCK_SIZE);
      ctx.stroke();
    }

    drawMatrix(grid, 0, 0);
    if (currentPiece) {
      drawMatrix(currentPiece.matrix, currentX, currentY);
    }
  }

  function update(time = 0) {
    if (isGameOver) return;
    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
      playerDrop();
    }

    draw();
    animationId = requestAnimationFrame(update);
  }

  // Calculate block size to fit the canvas and keep it centered
  let offsetX = 0;
  let offsetY = 0;
  function resize() {
    const cw = canvas.width;
    const ch = canvas.height;
    
    BLOCK_SIZE = Math.min(cw / COLS, ch / ROWS);
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    
    // Center it horizontally
    offsetX = (cw - COLS * BLOCK_SIZE) / 2;
    // Align to top or center vertically depending on preference, let's align top but centered horizontal
    offsetY = (ch - ROWS * BLOCK_SIZE) / 2;
    ctx.translate(offsetX, Math.max(0, offsetY));
  }

  window.addEventListener('resize', resize);
  // initial sizing
  resize();

  // Inputs
  const handleKeyDown = (e) => {
    if(isGameOver) return;
    if (e.key === 'ArrowLeft') {
      playerMove(-1);
    } else if (e.key === 'ArrowRight') {
      playerMove(1);
    } else if (e.key === 'ArrowDown') {
      playerDrop();
    } else if (e.key === 'ArrowUp') {
      playerRotate();
    } else if (e.key === ' ') {
      // Hard drop
      while(!collide(grid, currentPiece, currentX, currentY + 1)) {
        currentY++;
      }
      playerDrop();
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  // Touch and Mouse swipe inputs
  let startX = 0;
  let startY = 0;
  let isDown = false;
  
  const handleInputStart = (e) => {
    if(isGameOver) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Only accept input inside the canvas bounds
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (clientX - rect.left) * scaleX;
    const cy = (clientY - rect.top) * scaleY;

    if (cx >= offsetX && cx <= offsetX + COLS * BLOCK_SIZE && 
        cy >= Math.max(0, offsetY) && cy <= Math.max(0, offsetY) + ROWS * BLOCK_SIZE) {
       startX = clientX;
       startY = clientY;
       isDown = true;
    }
  };

  const handleInputMove = (e) => {
    if(!isDown || isGameOver) return;
    e.preventDefault(); // prevent scrolling
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const dx = clientX - startX;
    const dy = clientY - startY;

    if (Math.abs(dx) > 30) {
      if (dx > 0) playerMove(1);
      else playerMove(-1);
      startX = clientX; // reset startX to allow multiple moves in one swipe
    }

    if (dy > 40) {
      playerDrop();
      startY = clientY;
    }
  };

  const handleInputEnd = (e) => {
    if(!isDown || isGameOver) return;
    isDown = false;
    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    
    const dx = clientX - startX;
    const dy = clientY - startY;
    
    // Tap to rotate
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      playerRotate();
    }
  };

  canvas.addEventListener('touchstart', handleInputStart, {passive: false});
  canvas.addEventListener('touchmove', handleInputMove, {passive: false});
  canvas.addEventListener('touchend', handleInputEnd);
  
  canvas.addEventListener('mousedown', handleInputStart);
  window.addEventListener('mousemove', handleInputMove);
  window.addEventListener('mouseup', handleInputEnd);


  createPiece();
  update();

  window.destroyBlockBlitz = function() {
    isGameOver = true;
    cancelAnimationFrame(animationId);
    window.removeEventListener('resize', resize);
    document.removeEventListener('keydown', handleKeyDown);
    canvas.removeEventListener('touchstart', handleInputStart);
    canvas.removeEventListener('touchmove', handleInputMove);
    canvas.removeEventListener('touchend', handleInputEnd);
    canvas.removeEventListener('mousedown', handleInputStart);
    window.removeEventListener('mousemove', handleInputMove);
    window.removeEventListener('mouseup', handleInputEnd);
  };
};
