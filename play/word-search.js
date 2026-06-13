window.initWordSearch = function(canvas, onGameOver, onScoreUpdate) {
  const ctx = canvas.getContext('2d');
  const W = 640, H = 480;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  ctx.scale(dpr, dpr);

  let active = true;
  let score = 0;
  let timeLeft = 90; // seconds
  let lastSecond = performance.now();

  // Grid setup
  const COLS = 12, ROWS = 10;
  const CELL = 36;
  const GRID_X = 10;
  const GRID_Y = 60;

  const WORD_BANK = [
    'NEON', 'CYBER', 'PIXEL', 'RETRO', 'GAME', 'PLAY', 'STAR',
    'GLOW', 'PULSE', 'LASER', 'ZERO', 'RACE', 'JUMP', 'CODE',
    'HACK', 'LOOP', 'DATA', 'BYTE', 'GRID', 'WAVE'
  ];

  let grid = [];
  let foundWords = [];
  let targetWords = [];
  let wordPositions = []; // {word, cells:[{r,c}], found:false}
  let selecting = false;
  let selStart = null;
  let selEnd = null;
  let highlights = []; // found word highlights that persist
  let flashMsg = '';
  let flashTimer = 0;

  function buildGrid() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(''));
    targetWords = [];
    wordPositions = [];
    foundWords = [];

    // Pick 8 random words
    const shuffled = [...WORD_BANK].sort(() => Math.random() - 0.5).slice(0, 8);

    const DIRS = [
      [0, 1], [1, 0], [1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1], [-1, 1]
    ];

    shuffled.forEach(word => {
      let placed = false;
      for (let attempt = 0; attempt < 200 && !placed; attempt++) {
        const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
        const sr = Math.floor(Math.random() * ROWS);
        const sc = Math.floor(Math.random() * COLS);
        const cells = [];
        let fits = true;
        for (let i = 0; i < word.length; i++) {
          const r = sr + dir[0] * i;
          const c = sc + dir[1] * i;
          if (r < 0 || r >= ROWS || c < 0 || c >= COLS) { fits = false; break; }
          if (grid[r][c] !== '' && grid[r][c] !== word[i]) { fits = false; break; }
          cells.push({ r, c });
        }
        if (fits) {
          cells.forEach((cell, i) => { grid[cell.r][cell.c] = word[i]; });
          wordPositions.push({ word, cells, found: false });
          targetWords.push(word);
          placed = true;
        }
      }
    });

    // Fill remaining cells with random letters
    const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c] === '') grid[r][c] = ALPHA[Math.floor(Math.random() * 26)];
  }

  buildGrid();

  function cellFromXY(x, y) {
    const c = Math.floor((x - GRID_X) / CELL);
    const r = Math.floor((y - GRID_Y) / CELL);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return { r, c };
  }

  function getLineCells(a, b) {
    if (!a || !b) return [];
    const dr = b.r - a.r, dc = b.c - a.c;
    const len = Math.max(Math.abs(dr), Math.abs(dc));
    if (len === 0) return [a];
    const sr = Math.sign(dr), sc = Math.sign(dc);
    // Only allow straight or diagonal lines
    if (Math.abs(dr) !== 0 && Math.abs(dc) !== 0 && Math.abs(dr) !== Math.abs(dc)) return [];
    const cells = [];
    for (let i = 0; i <= len; i++)
      cells.push({ r: a.r + sr * i, c: a.c + sc * i });
    return cells;
  }

  function checkSelection(cells) {
    const word = cells.map(cell => grid[cell.r][cell.c]).join('');
    const revWord = word.split('').reverse().join('');
    for (let wp of wordPositions) {
      if (wp.found) continue;
      if (wp.word === word || wp.word === revWord) {
        wp.found = true;
        foundWords.push(wp.word);
        score += wp.word.length * 10;
        if (onScoreUpdate) onScoreUpdate(score);
        if (window.audioManager) window.audioManager.playScore();
        highlights.push({ cells: [...cells], color: '#39ff14' });
        flashMsg = `+${wp.word.length * 10} — "${wp.word}"`;
        flashTimer = 90;

        if (foundWords.length === targetWords.length) {
          // All found — bonus and rebuild
          score += 100;
          if (onScoreUpdate) onScoreUpdate(score);
          flashMsg = '✅ ALL FOUND! +100 BONUS!';
          flashTimer = 120;
          setTimeout(() => {
            if (active) { highlights = []; buildGrid(); }
          }, 1500);
        }
        return;
      }
    }
  }

  function handlePointerDown(e) {
    if (!active) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    const src = e.touches ? e.touches[0] : e;
    const x = (src.clientX - rect.left) * scaleX;
    const y = (src.clientY - rect.top) * scaleY;
    const cell = cellFromXY(x, y);
    if (cell) { selecting = true; selStart = cell; selEnd = cell; }
    e.preventDefault();
  }

  function handlePointerMove(e) {
    if (!active || !selecting) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    const src = e.touches ? e.touches[0] : e;
    const x = (src.clientX - rect.left) * scaleX;
    const y = (src.clientY - rect.top) * scaleY;
    const cell = cellFromXY(x, y);
    if (cell) selEnd = cell;
    e.preventDefault();
  }

  function handlePointerUp(e) {
    if (!active || !selecting) return;
    const cells = getLineCells(selStart, selEnd);
    if (cells.length > 1) checkSelection(cells);
    selecting = false;
    selStart = null;
    selEnd = null;
    e.preventDefault();
  }

  canvas.addEventListener('mousedown', handlePointerDown);
  canvas.addEventListener('mousemove', handlePointerMove);
  canvas.addEventListener('mouseup', handlePointerUp);
  canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
  canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
  canvas.addEventListener('touchend', handlePointerUp, { passive: false });

  window.destroyWordSearch = function() {
    active = false;
    canvas.removeEventListener('mousedown', handlePointerDown);
    canvas.removeEventListener('mousemove', handlePointerMove);
    canvas.removeEventListener('mouseup', handlePointerUp);
    canvas.removeEventListener('touchstart', handlePointerDown);
    canvas.removeEventListener('touchmove', handlePointerMove);
    canvas.removeEventListener('touchend', handlePointerUp);
  };

  function update() {
    const now = performance.now();
    if (now - lastSecond >= 1000) {
      timeLeft--;
      lastSecond = now;
      if (timeLeft <= 0) {
        active = false;
        if (onGameOver) onGameOver(score);
        return;
      }
    }
    if (flashTimer > 0) flashTimer--;
  }

  function render() {
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, W, H);

    // Title bar
    ctx.fillStyle = '#00f0ff';
    ctx.font = "bold 18px 'Space Grotesk', sans-serif";
    ctx.fillText('NEON WORD SLEUTH', GRID_X, 30);

    // Timer
    const timerColor = timeLeft < 20 ? '#ff007f' : '#fff';
    ctx.fillStyle = timerColor;
    ctx.font = "bold 20px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'right';
    ctx.fillText(`⏱ ${timeLeft}s`, W - 10, 30);
    ctx.textAlign = 'left';

    // Score
    ctx.fillStyle = '#ffea00';
    ctx.font = "bold 18px 'Space Grotesk', sans-serif";
    ctx.fillText(`SCORE: ${score}`, W / 2 - 50, 30);

    // Persistent found highlights
    highlights.forEach(h => {
      ctx.fillStyle = h.color + '44';
      h.cells.forEach(cell => {
        ctx.fillRect(GRID_X + cell.c * CELL + 1, GRID_Y + cell.r * CELL + 1, CELL - 2, CELL - 2);
      });
      ctx.strokeStyle = h.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        GRID_X + h.cells[0].c * CELL + 2, GRID_Y + h.cells[0].r * CELL + 2,
        (h.cells[h.cells.length-1].c - h.cells[0].c + 1) * CELL - 4,
        (h.cells[h.cells.length-1].r - h.cells[0].r + 1) * CELL - 4
      );
    });

    // Active selection
    if (selecting && selStart && selEnd) {
      const cells = getLineCells(selStart, selEnd);
      cells.forEach(cell => {
        ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
        ctx.fillRect(GRID_X + cell.c * CELL + 1, GRID_Y + cell.r * CELL + 1, CELL - 2, CELL - 2);
      });
    }

    // Grid letters
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = GRID_X + c * CELL;
        const y = GRID_Y + r * CELL;

        // Cell border
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, CELL, CELL);

        // Letter
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = "bold 16px 'Space Grotesk', monospace";
        ctx.textAlign = 'center';
        ctx.fillText(grid[r][c], x + CELL / 2, y + CELL / 2 + 6);
      }
    }
    ctx.textAlign = 'left';

    // Word list on right
    const listX = GRID_X + COLS * CELL + 14;
    ctx.font = "bold 13px 'Space Grotesk', sans-serif";
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('FIND:', listX, GRID_Y + 16);
    targetWords.forEach((word, i) => {
      const found = foundWords.includes(word);
      ctx.font = `${found ? 'italic' : 'bold'} 13px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = found ? '#39ff14' : '#fff';
      ctx.fillText((found ? '✓ ' : '• ') + word, listX, GRID_Y + 36 + i * 22);
    });

    // Flash message
    if (flashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, flashTimer / 30);
      ctx.font = "bold 20px 'Space Grotesk', sans-serif";
      ctx.fillStyle = '#39ff14';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#39ff14';
      ctx.textAlign = 'center';
      ctx.fillText(flashMsg, W / 2 - 30, H - 20);
      ctx.restore();
    }
  }

  function loop() {
    if (!active) return;
    update();
    render();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
};
