document.addEventListener('DOMContentLoaded', () => {
  const gameGrid = document.getElementById('game-grid');
  const searchInput = document.getElementById('search-input');
  const filterGroup = document.querySelector('.filter-group');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalContainer = document.getElementById('modal-container');
  const modalCloseBtn = document.getElementById('modal-close');
  const muteBtn = document.getElementById('mute-btn');
  
  let activeCategory = 'all';
  let searchQuery = '';
  let activeGameInstance = null; // tracking active game destruction callback

  // Pre-populate mock leaderboards in LocalStorage if not present
  initializeLeaderboards();

  // Mute button handler
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      if (window.audioManager) {
        const isMuted = window.audioManager.toggleMute();
        muteBtn.innerHTML = isMuted ? 
          '<i class="fa-solid fa-volume-xmark"></i>' : 
          '<i class="fa-solid fa-volume-high"></i>';
      }
    });
  }

  // Initially render the list of games
  renderGames();

  // Search input change handler
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderGames();
  });

  // Filter button clicks
  filterGroup.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-btn')) {
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      activeCategory = e.target.getAttribute('data-category');
      renderGames();
    }
  });

  // Modal Close Action
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeModal);
  }
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // Render game list to DOM
  function renderGames() {
    gameGrid.innerHTML = '';
    
    const filteredGames = gamesData.filter(game => {
      const matchesCategory = activeCategory === 'all' || game.category.toLowerCase() === activeCategory.toLowerCase();
      const matchesSearch = game.title.toLowerCase().includes(searchQuery) || game.description.toLowerCase().includes(searchQuery);
      return matchesCategory && matchesSearch;
    });

    if (filteredGames.length === 0) {
      gameGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem 0; color: var(--text-secondary);">
          <p style="font-size: 1.2rem;">No games found matching "${searchQuery}".</p>
        </div>
      `;
      return;
    }

    filteredGames.forEach(game => {
      const card = document.createElement('div');
      card.className = 'game-card';
      card.style.setProperty('--card-accent', game.color);
      
      // Parse RGB values for shadow glow
      const accentRgb = game.accent === '#ff007f' ? '255, 0, 127' :
                         game.accent === '#00f0ff' ? '0, 240, 255' :
                         game.accent === '#39ff14' ? '57, 255, 20' :
                         game.accent === '#b026ff' ? '176, 38, 255' : '255, 234, 0';
      card.style.setProperty('--card-accent-rgb', accentRgb);

      card.innerHTML = `
        <div class="card-top">
          <div class="card-icon-wrapper">${game.icon}</div>
          <span class="card-badge ${game.playable ? 'badge-playable' : ''}">${game.playable ? 'Playable' : 'Demo'}</span>
        </div>
        <div class="card-body">
          <h3 class="card-title">${game.title}</h3>
          <p class="card-desc">${game.description}</p>
        </div>
        <div class="card-footer">
          <span class="card-rating">★ ${game.rating.toFixed(1)}</span>
          <span class="card-difficulty">${game.difficulty}</span>
        </div>
      `;

      card.addEventListener('click', () => openGameDetail(game));
      gameGrid.appendChild(card);
    });
  }

  // Open Game detail panel / overlay
  function openGameDetail(game) {
    // Stop any existing game before launching a new one
    stopActiveGame();
    
    // Set custom accent variables for modal
    modalOverlay.style.setProperty('--modal-accent', game.color);
    const accentRgb = game.accent === '#ff007f' ? '255, 0, 127' :
                       game.accent === '#00f0ff' ? '0, 240, 255' :
                       game.accent === '#39ff14' ? '57, 255, 20' :
                       game.accent === '#b026ff' ? '176, 38, 255' : '255, 234, 0';
    modalOverlay.style.setProperty('--modal-accent-rgb', accentRgb);

    // Render Modal interior structure
    modalContainer.innerHTML = `
      <button class="modal-close-btn" id="modal-inner-close" aria-label="Close modal">&times;</button>
      <div class="modal-main">
        <div class="modal-game-viewport" id="game-viewport">
          <!-- Game Canvas or Coming Soon Screen -->
        </div>
      </div>
      <div class="modal-sidebar">
        <h2 class="sidebar-title">${game.title}</h2>
        <div class="info-section">
          <div class="info-label">Category</div>
          <div class="info-value">${game.category}</div>
        </div>
        <div class="info-section">
          <div class="info-label">Difficulty</div>
          <div class="info-value">${game.difficulty}</div>
        </div>
        <div class="info-section">
          <div class="info-label">Controls</div>
          <div class="info-value">${game.mechanics}</div>
        </div>
        <div class="info-section" style="flex: 1;">
          <div class="info-label">Top Leaderboard</div>
          <div class="leaderboard-list" id="modal-leaderboard">
            <!-- Dynamically populated scores -->
          </div>
        </div>
      </div>
    `;

    // Rebind inner close button
    document.getElementById('modal-inner-close').addEventListener('click', closeModal);

    // Populate Leaderboard list
    updateLeaderboardView(game.id);

    const viewport = document.getElementById('game-viewport');

    if (game.playable) {
      // Show start game overlay
      viewport.innerHTML = `
        <div class="game-intro-overlay" id="game-intro">
          <div class="game-intro-icon">${game.icon}</div>
          <h1 class="game-intro-title">${game.title}</h1>
          <p class="game-intro-desc">${game.description}</p>
          <button class="btn btn-primary" id="btn-start-game" style="background:${game.accent}; box-shadow:0 0 15px ${game.accent}80;">
            ⚡ TAP TO PLAY
          </button>
        </div>
        <div class="game-canvas-container" style="display:none;" id="canvas-container">
          <canvas id="game-canvas"></canvas>
        </div>
      `;

      document.getElementById('btn-start-game').addEventListener('click', () => {
        launchPlayableGame(game);
      });

    } else {
      // Game under development panel
      viewport.innerHTML = `
        <div class="game-intro-overlay" style="background:#020207;">
          <div class="game-intro-icon">${game.icon}</div>
          <h1 class="game-intro-title" style="color:var(--text-secondary);">${game.title}</h1>
          <h2 style="font-family:var(--font-display); color:var(--modal-accent); margin-bottom:1rem;">DEMO PREVIEW</h2>
          <p class="game-intro-desc">This title is currently under production by Kid's PlayZone development crew. Stay tuned for the upcoming alpha release!</p>
          <div style="background:rgba(255,255,255,0.03); border:1px dashed var(--border-color); padding:1rem 2rem; border-radius:12px; font-size:0.9rem;">
            Estimated Launch: <strong>Sprint 3 (Q3 2026)</strong>
          </div>
        </div>
      `;
    }

    // Open Modal display
    modalOverlay.classList.add('open');
  }

  // Load and launch one of the active games
  function launchPlayableGame(game) {
    const intro = document.getElementById('game-intro');
    const canvasContainer = document.getElementById('canvas-container');
    const canvas = document.getElementById('game-canvas');

    intro.style.display = 'none';
    canvasContainer.style.display = 'flex';

    // Inject mobile touch overlays
    if (game.id === 'retro-snake') {
      const controlsDiv = document.createElement('div');
      controlsDiv.className = 'mobile-controls mobile-dpad-overlay';
      controlsDiv.id = 'mobile-dpad';
      controlsDiv.innerHTML = `
        <button class="mobile-btn dpad-up" id="dpad-up" aria-label="Up"><i class="fa-solid fa-caret-up"></i></button>
        <div class="dpad-row">
          <button class="mobile-btn dpad-left" id="dpad-left" aria-label="Left"><i class="fa-solid fa-caret-left"></i></button>
          <div class="dpad-center"></div>
          <button class="mobile-btn dpad-right" id="dpad-right" aria-label="Right"><i class="fa-solid fa-caret-right"></i></button>
        </div>
        <button class="mobile-btn dpad-down" id="dpad-down" aria-label="Down"><i class="fa-solid fa-caret-down"></i></button>
      `;
      canvasContainer.appendChild(controlsDiv);
    } else if (game.id === 'reflex-racer') {
      const controlsDiv = document.createElement('div');
      controlsDiv.className = 'mobile-controls mobile-steer-overlay';
      controlsDiv.id = 'mobile-steer';
      controlsDiv.innerHTML = `
        <button class="mobile-btn steer-left" id="steer-left" aria-label="Steer Left"><i class="fa-solid fa-arrow-left"></i></button>
        <button class="mobile-btn steer-right" id="steer-right" aria-label="Steer Right"><i class="fa-solid fa-arrow-right"></i></button>
      `;
      canvasContainer.appendChild(controlsDiv);
    }

    // Inject game script dynamically
    const scriptId = `script-game-${game.id}`;
    let script = document.getElementById(scriptId);

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `play/${game.id}.js`;
      script.onload = () => runGameInitializer(game.id, canvas);
      document.body.appendChild(script);
    } else {
      runGameInitializer(game.id, canvas);
    }
  }

  // Initialize specific game loop functions
  function runGameInitializer(gameId, canvas) {
    // Ensure existing instances are stopped
    stopActiveGame();

    if (window.audioManager) {
      window.audioManager.init();
      window.audioManager.startMusic();
    }

    const onGameOver = (score) => {
      if (window.audioManager) {
        window.audioManager.stopMusic();
        window.audioManager.playGameOver();
      }
      savePlayerScore(gameId, score);
      showGameOverOverlay(gameId, score);
    };

    const onScoreUpdate = (currentScore) => {
      // Optional HUD hook
    };

    if (gameId === 'flappy-rocket' && typeof window.initFlappyRocket === 'function') {
      window.initFlappyRocket(canvas, onGameOver, onScoreUpdate);
      activeGameInstance = { destroy: window.destroyFlappyRocket };
    } else if (gameId === 'stack-tower' && typeof window.initStackTower === 'function') {
      window.initStackTower(canvas, onGameOver, onScoreUpdate);
      activeGameInstance = { destroy: window.destroyStackTower };
    } else if (gameId === 'reflex-racer' && typeof window.initReflexRacer === 'function') {
      window.initReflexRacer(canvas, onGameOver, onScoreUpdate);
      activeGameInstance = { destroy: window.destroyReflexRacer };
    } else if (gameId === 'retro-snake' && typeof window.initRetroSnake === 'function') {
      window.initRetroSnake(canvas, onGameOver, onScoreUpdate);
      activeGameInstance = { destroy: window.destroyRetroSnake };
    }
  }

  // Show a clean game over overlay with score report and restart button
  function showGameOverOverlay(gameId, score) {
    const viewport = document.getElementById('game-viewport');
    const game = gamesData.find(g => g.id === gameId);

    // Refresh sidebar leaderboard to show new scores immediately
    updateLeaderboardView(gameId);

    viewport.innerHTML = `
      <div class="game-intro-overlay" style="background:rgba(5, 5, 12, 0.95);">
        <h2 style="color:var(--neon-pink); font-family:var(--font-display); font-size:2.5rem; font-weight:800; margin-bottom:0.5rem; letter-spacing:1px;">GAME OVER</h2>
        <p style="font-size:1.1rem; color:var(--text-secondary); margin-bottom:1.5rem;">You completed the run with score:</p>
        <div style="font-family:var(--font-display); font-size:4.5rem; font-weight:800; color:#fff; text-shadow:0 0 20px rgba(255,255,255,0.2); margin-bottom:2rem;">
          ${score}
        </div>
        <div style="display:flex; gap:1rem;">
          <button class="btn btn-primary" id="btn-restart-game" style="background:${game.accent}; box-shadow:0 0 15px ${game.accent}80;">
            🎮 PLAY AGAIN
          </button>
          <button class="btn" id="btn-back-menu" style="background:rgba(255,255,255,0.05); color:#fff; border:1px solid var(--border-color);">
            ↩ BACK TO MENU
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-restart-game').addEventListener('click', () => {
      openGameDetail(game);
      setTimeout(() => {
        const startBtn = document.getElementById('btn-start-game');
        if (startBtn) startBtn.click();
      }, 100);
    });

    document.getElementById('btn-back-menu').addEventListener('click', closeModal);
  }

  // Cleanup helper
  function stopActiveGame() {
    if (window.audioManager) {
      window.audioManager.stopMusic();
    }
    if (activeGameInstance && typeof activeGameInstance.destroy === 'function') {
      activeGameInstance.destroy();
      activeGameInstance = null;
    }
  }

  function closeModal() {
    stopActiveGame();
    modalOverlay.classList.remove('open');
    // Clear canvas / content inside viewport
    setTimeout(() => {
      const viewport = document.getElementById('game-viewport');
      if (viewport) viewport.innerHTML = '';
    }, 300);
  }

  // Score Management Logic
  function initializeLeaderboards() {
    if (localStorage.getItem('kids_playzone_leaderboards')) return;

    // curating mockup database
    const initialScores = {
      'flappy-rocket': [
        { name: 'AlphaPlayer', score: 32 },
        { name: 'X-Wing', score: 25 },
        { name: 'CosmoJet', score: 18 },
        { name: 'Nebula', score: 12 },
        { name: 'Pioneer', score: 8 }
      ],
      'stack-tower': [
        { name: 'BlockBuilder', score: 45 },
        { name: 'Skyscraper', score: 38 },
        { name: 'GridLock', score: 30 },
        { name: 'AlignPro', score: 22 },
        { name: 'Basement', score: 15 }
      ],
      'reflex-racer': [
        { name: 'SpeedyG', score: 52 },
        { name: 'TurboDrift', score: 40 },
        { name: 'GridRider', score: 33 },
        { name: 'DodgeMaster', score: 24 },
        { name: 'SlowLane', score: 14 }
      ]
    };

    // fill dummy scores for other non-playable games just for immersion
    gamesData.forEach(game => {
      if (!initialScores[game.id]) {
        initialScores[game.id] = [
          { name: 'CyberHero', score: Math.floor(Math.random() * 50) + 50 },
          { name: 'NeoGamer', score: Math.floor(Math.random() * 40) + 30 },
          { name: 'PixelPro', score: Math.floor(Math.random() * 30) + 15 }
        ];
      }
    });

    localStorage.setItem('kids_playzone_leaderboards', JSON.stringify(initialScores));
  }

  function getScoresForGame(gameId) {
    const data = localStorage.getItem('kids_playzone_leaderboards');
    if (!data) return [];
    const scores = JSON.parse(data);
    return scores[gameId] || [];
  }

  function savePlayerScore(gameId, score) {
    const data = localStorage.getItem('kids_playzone_leaderboards');
    if (!data) return;
    const allScores = JSON.parse(data);
    const gameScores = allScores[gameId] || [];
    
    // check if it fits leaderboard or if we should add it
    gameScores.push({ name: 'You (Player)', score: score, isPlayer: true });
    
    // Sort in descending order
    gameScores.sort((a, b) => b.score - a.score);
    
    // Keep top 5 scores
    allScores[gameId] = gameScores.slice(0, 5);
    localStorage.setItem('kids_playzone_leaderboards', JSON.stringify(allScores));
  }

  function updateLeaderboardView(gameId) {
    const list = document.getElementById('modal-leaderboard');
    if (!list) return;

    const scores = getScoresForGame(gameId);
    list.innerHTML = '';

    if (scores.length === 0) {
      list.innerHTML = `<div style="font-size:0.9rem; color:var(--text-secondary);">No scores recorded.</div>`;
      return;
    }

    scores.forEach((entry, idx) => {
      const row = document.createElement('div');
      row.className = `leaderboard-row ${entry.isPlayer ? 'highlight' : ''}`;
      row.innerHTML = `
        <span class="leaderboard-rank">#${idx + 1}</span>
        <span class="leaderboard-name">${entry.name}</span>
        <span class="leaderboard-score">${entry.score}</span>
      `;
      list.appendChild(row);
    });
  }
});
