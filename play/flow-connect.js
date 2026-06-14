window.initFlowConnect = function(canvas, onGameOver, onScoreUpdate) {
  const ctx = canvas.getContext('2d');
  
  const SIZE = 5;
  let TILE_SIZE = 60;
  let offsetX = 0;
  let offsetY = 0;
  
  let score = 0;
  let isGameOver = false;

  // Level data: each color has 2 endpoints
  const COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'];
  
  let endpoints = [
    {r: 0, c: 0, colorIdx: 0},
    {r: 4, c: 4, colorIdx: 0},
    
    {r: 1, c: 1, colorIdx: 1},
    {r: 4, c: 0, colorIdx: 1},
    
    {r: 0, c: 4, colorIdx: 2},
    {r: 3, c: 2, colorIdx: 2},
    
    {r: 1, c: 3, colorIdx: 3},
    {r: 4, c: 2, colorIdx: 3},
    
    {r: 0, c: 2, colorIdx: 4},
    {r: 2, c: 4, colorIdx: 4}
  ];

  // Grid to store current paths
  let paths = []; // array of {colorIdx, nodes: [{r,c}]}
  for(let i=0; i<COLORS.length; i++) {
     paths.push({colorIdx: i, nodes: []});
  }

  let activeColorIdx = -1;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    for (let r = 0; r <= SIZE; r++) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + r * TILE_SIZE);
      ctx.lineTo(offsetX + SIZE * TILE_SIZE, offsetY + r * TILE_SIZE);
      ctx.stroke();
    }
    for (let c = 0; c <= SIZE; c++) {
      ctx.beginPath();
      ctx.moveTo(offsetX + c * TILE_SIZE, offsetY);
      ctx.lineTo(offsetX + c * TILE_SIZE, offsetY + SIZE * TILE_SIZE);
      ctx.stroke();
    }

    // Draw Paths
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let p of paths) {
      if (p.nodes.length > 0) {
        ctx.strokeStyle = COLORS[p.colorIdx];
        ctx.lineWidth = TILE_SIZE * 0.3;
        ctx.beginPath();
        ctx.moveTo(offsetX + p.nodes[0].c * TILE_SIZE + TILE_SIZE / 2, 
                   offsetY + p.nodes[0].r * TILE_SIZE + TILE_SIZE / 2);
        for (let i = 1; i < p.nodes.length; i++) {
          ctx.lineTo(offsetX + p.nodes[i].c * TILE_SIZE + TILE_SIZE / 2, 
                     offsetY + p.nodes[i].r * TILE_SIZE + TILE_SIZE / 2);
        }
        ctx.stroke();
      }
    }

    // Draw Endpoints
    for (let ep of endpoints) {
      ctx.fillStyle = COLORS[ep.colorIdx];
      ctx.beginPath();
      ctx.arc(offsetX + ep.c * TILE_SIZE + TILE_SIZE / 2, 
              offsetY + ep.r * TILE_SIZE + TILE_SIZE / 2, 
              TILE_SIZE * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    if(isGameOver) {
       ctx.fillStyle = '#00FF00';
       ctx.font = 'bold 30px Arial';
       ctx.textAlign = 'center';
       ctx.fillText('LEVEL CLEARED!', canvas.width / 2, offsetY + SIZE * TILE_SIZE + 40);
    }
  }

  function resize() {
    const cw = canvas.width;
    const ch = canvas.height;
    
    TILE_SIZE = Math.min(cw * 0.8 / SIZE, ch * 0.7 / SIZE);
    
    offsetX = (cw - SIZE * TILE_SIZE) / 2;
    offsetY = (ch - SIZE * TILE_SIZE) / 2;
    
    draw();
  }

  window.addEventListener('resize', resize);

  function checkWin() {
    // Are all pairs connected?
    for (let i = 0; i < COLORS.length; i++) {
      const p = paths[i];
      if (p.nodes.length < 2) return false;
      const eps = endpoints.filter(e => e.colorIdx === i);
      
      const first = p.nodes[0];
      const last = p.nodes[p.nodes.length - 1];
      
      const match1 = (first.r === eps[0].r && first.c === eps[0].c && last.r === eps[1].r && last.c === eps[1].c);
      const match2 = (first.r === eps[1].r && first.c === eps[1].c && last.r === eps[0].r && last.c === eps[0].c);
      
      if (!match1 && !match2) return false;
    }
    return true;
  }

  function getGridCell(x, y) {
    if (x < offsetX || x > offsetX + SIZE * TILE_SIZE || 
        y < offsetY || y > offsetY + SIZE * TILE_SIZE) {
        return null;
    }
    return {
      c: Math.floor((x - offsetX) / TILE_SIZE),
      r: Math.floor((y - offsetY) / TILE_SIZE)
    };
  }

  const handleStart = (e) => {
    e.preventDefault();
    if(isGameOver) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const cell = getGridCell(x, y);
    if (!cell) return;

    // Is it an endpoint?
    const ep = endpoints.find(e => e.r === cell.r && e.c === cell.c);
    if (ep) {
      activeColorIdx = ep.colorIdx;
      paths[activeColorIdx].nodes = [{r: cell.r, c: cell.c}];
    } else {
      // Or is it on an existing path?
      for (let p of paths) {
        const idx = p.nodes.findIndex(n => n.r === cell.r && n.c === cell.c);
        if (idx !== -1) {
          activeColorIdx = p.colorIdx;
          p.nodes = p.nodes.slice(0, idx + 1); // truncate
          break;
        }
      }
    }
    draw();
  };

  const handleMove = (e) => {
    e.preventDefault();
    if(isGameOver || activeColorIdx === -1) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const cell = getGridCell(x, y);
    if (!cell) return;

    const p = paths[activeColorIdx];
    const lastNode = p.nodes[p.nodes.length - 1];
    
    // Check if cell is adjacent to lastNode
    if (lastNode && (Math.abs(lastNode.r - cell.r) + Math.abs(lastNode.c - cell.c) === 1)) {
      
      // Prevent running over other endpoints of different colors
      const ep = endpoints.find(e => e.r === cell.r && e.c === cell.c);
      if (ep && ep.colorIdx !== activeColorIdx) return;
      
      // If we are backing up on our own path, truncate
      if (p.nodes.length >= 2) {
        const prevNode = p.nodes[p.nodes.length - 2];
        if (prevNode.r === cell.r && prevNode.c === cell.c) {
          p.nodes.pop();
          draw();
          return;
        }
      }

      // If we intersect another path, break that path
      for (let other of paths) {
        if (other.colorIdx !== activeColorIdx) {
          const idx = other.nodes.findIndex(n => n.r === cell.r && n.c === cell.c);
          if (idx !== -1) {
            other.nodes = other.nodes.slice(0, idx); // break it before intersection
          }
        }
      }

      // Add to current path if it's not already in it (prevent loops)
      if (!p.nodes.find(n => n.r === cell.r && n.c === cell.c)) {
        p.nodes.push({r: cell.r, c: cell.c});
        
        // Stop drawing if we hit the other endpoint
        if (ep && ep.colorIdx === activeColorIdx) {
          activeColorIdx = -1; // path complete for now
          score += 100;
          onScoreUpdate(score);
          
          if (checkWin()) {
            isGameOver = true;
            onGameOver();
          }
        }
      }
      draw();
    }
  };

  const handleEnd = (e) => {
    e.preventDefault();
    activeColorIdx = -1;
  };

  canvas.addEventListener('mousedown', handleStart);
  window.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleEnd);

  canvas.addEventListener('touchstart', handleStart, {passive: false});
  canvas.addEventListener('touchmove', handleMove, {passive: false});
  canvas.addEventListener('touchend', handleEnd);

  resize();

  window.destroyFlowConnect = function() {
    isGameOver = true;
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('mousedown', handleStart);
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseup', handleEnd);
    canvas.removeEventListener('touchstart', handleStart);
    canvas.removeEventListener('touchmove', handleMove);
    canvas.removeEventListener('touchend', handleEnd);
  };
};
