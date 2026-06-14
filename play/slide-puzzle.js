window.initSlidePuzzle = function(canvas, onGameOver, onScoreUpdate) {
  const ctx = canvas.getContext('2d');
  
  const SIZE = 4;
  let TILE_SIZE = 80;
  let offsetX = 0;
  let offsetY = 0;
  
  let grid = [];
  let emptyRow = SIZE - 1;
  let emptyCol = SIZE - 1;
  let moves = 0;
  let isGameOver = false;

  // Initialize ordered grid
  for (let r = 0; r < SIZE; r++) {
    let row = [];
    for (let c = 0; c < SIZE; c++) {
      row.push(r * SIZE + c + 1);
    }
    grid.push(row);
  }
  grid[SIZE - 1][SIZE - 1] = 0; // 0 represents the empty space

  function shuffle() {
    // Perform random valid moves to ensure solvability
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    let lastDir = null;
    for (let i = 0; i < 200; i++) {
      const validDirs = dirs.filter(d => {
        const nr = emptyRow + d[0];
        const nc = emptyCol + d[1];
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
           // don't immediately undo the last move
           if (lastDir && d[0] === -lastDir[0] && d[1] === -lastDir[1]) return false;
           return true;
        }
        return false;
      });
      if(validDirs.length === 0) continue;
      const d = validDirs[Math.floor(Math.random() * validDirs.length)];
      
      const nr = emptyRow + d[0];
      const nc = emptyCol + d[1];
      
      // Swap
      grid[emptyRow][emptyCol] = grid[nr][nc];
      grid[nr][nc] = 0;
      emptyRow = nr;
      emptyCol = nc;
      lastDir = d;
    }
    moves = 0;
  }

  function checkWin() {
    let count = 1;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (r === SIZE - 1 && c === SIZE - 1) {
          if (grid[r][c] !== 0) return false;
        } else {
          if (grid[r][c] !== count) return false;
        }
        count++;
      }
    }
    return true;
  }

  function handleInteraction(x, y) {
    if (isGameOver) return;
    
    // Check if within bounds
    if (x < offsetX || x > offsetX + SIZE * TILE_SIZE || 
        y < offsetY || y > offsetY + SIZE * TILE_SIZE) {
        return;
    }

    const c = Math.floor((x - offsetX) / TILE_SIZE);
    const r = Math.floor((y - offsetY) / TILE_SIZE);
    
    // Check if adjacent to empty tile
    if (Math.abs(r - emptyRow) + Math.abs(c - emptyCol) === 1) {
      grid[emptyRow][emptyCol] = grid[r][c];
      grid[r][c] = 0;
      emptyRow = r;
      emptyCol = c;
      moves++;
      onScoreUpdate(moves);
      
      if (checkWin()) {
        isGameOver = true;
        onGameOver();
      }
      draw();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const val = grid[r][c];
        const cx = offsetX + c * TILE_SIZE;
        const cy = offsetY + r * TILE_SIZE;
        
        if (val !== 0) {
          // Tile background
          ctx.fillStyle = '#1A1A2E';
          ctx.strokeStyle = '#00FFFF';
          ctx.lineWidth = 2;
          
          ctx.beginPath();
          ctx.roundRect(cx + 2, cy + 2, TILE_SIZE - 4, TILE_SIZE - 4, 8);
          ctx.fill();
          ctx.stroke();

          // Highlight
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.beginPath();
          ctx.roundRect(cx + 2, cy + 2, TILE_SIZE - 4, (TILE_SIZE - 4) / 2, 8);
          ctx.fill();
          
          // Text
          ctx.fillStyle = '#00FFFF';
          ctx.font = `bold ${TILE_SIZE * 0.4}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(val, cx + TILE_SIZE / 2, cy + TILE_SIZE / 2);
        } else {
          // Empty space marker
          ctx.fillStyle = 'rgba(0, 255, 255, 0.05)';
          ctx.beginPath();
          ctx.roundRect(cx + 2, cy + 2, TILE_SIZE - 4, TILE_SIZE - 4, 8);
          ctx.fill();
        }
      }
    }
    
    // Draw moves
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Moves: ${moves}`, canvas.width / 2, offsetY - 20);
    
    if(isGameOver) {
       ctx.fillStyle = '#00FF00';
       ctx.font = 'bold 30px Arial';
       ctx.fillText('SOLVED!', canvas.width / 2, offsetY + SIZE * TILE_SIZE + 40);
    }
  }

  function resize() {
    const cw = canvas.width;
    const ch = canvas.height;
    
    // Fit the grid in the screen with some margin
    TILE_SIZE = Math.min(cw * 0.8 / SIZE, ch * 0.7 / SIZE);
    
    // Center it
    offsetX = (cw - SIZE * TILE_SIZE) / 2;
    offsetY = (ch - SIZE * TILE_SIZE) / 2;
    
    draw();
  }

  window.addEventListener('resize', resize);

  const handlePointerDown = (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e.touches) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    handleInteraction(x, y);
  };

  canvas.addEventListener('mousedown', handlePointerDown);
  canvas.addEventListener('touchstart', handlePointerDown, {passive: false});

  shuffle();
  resize();

  window.destroySlidePuzzle = function() {
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('mousedown', handlePointerDown);
    canvas.removeEventListener('touchstart', handlePointerDown);
  };
};
