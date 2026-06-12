window.audioManager = (function() {
  let ctx = null;
  let masterVolume = null;
  let isMuted = false;
  let musicInterval = null;
  let musicStep = 0;
  
  function init() {
    if (ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioContextClass();
    masterVolume = ctx.createGain();
    masterVolume.gain.value = 0.12; // comfortable volume
    masterVolume.connect(ctx.destination);
  }

  function playTone(freq, type, duration, glideTo = null) {
    if (!ctx) init();
    if (isMuted) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (glideTo) {
        osc.frequency.exponentialRampToValueAtTime(glideTo, ctx.currentTime + duration);
      }
      
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(masterVolume);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  function playNoise(duration, lowPassFreq = 1000) {
    if (!ctx) init();
    if (isMuted) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    try {
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(lowPassFreq, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterVolume);

      noise.start();
      noise.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Noise audio error:", e);
    }
  }

  // Retro Chiptune Loop
  // Chord progression: Am -> F -> C -> G
  const bassline = [
    110.00, 110.00, 110.00, 110.00, // A2 (Am)
    87.31, 87.31, 87.31, 87.31,     // F2 (F)
    130.81, 130.81, 130.81, 130.81, // C3 (C)
    98.00, 98.00, 98.00, 98.00      // G2 (G)
  ];

  const melodyNotes = [
    [220.00, 261.63, 293.66, 329.63], // Am: A, C, D, E
    [261.63, 349.23, 392.00, 440.00], // F: C, F, G, A
    [261.63, 329.63, 392.00, 523.25], // C: C, E, G, C
    [293.66, 392.00, 440.00, 493.88]  // G: D, G, A, B
  ];

  function startMusic() {
    if (!ctx) init();
    if (musicInterval) return;

    musicStep = 0;
    const stepDuration = 180; // ms (Tempo ≈ 83 BPM, eighth notes)

    musicInterval = setInterval(() => {
      if (isMuted) return;
      if (ctx.state === 'suspended') return;

      const measure = Math.floor(musicStep / 8) % 4;
      const step = musicStep % 8;

      try {
        // 1. Play bass oscillator (steps 0, 3, 6)
        if (step === 0 || step === 3 || step === 6) {
          const freq = bassline[measure * 4 + Math.floor(step / 2)];
          playTone(freq, 'triangle', 0.28);
        }

        // 2. Play synthesized snare noise (steps 2, 6)
        if (step === 2 || step === 6) {
          playNoise(0.06, 800);
        }

        // 3. Play randomized melody notes (steps 0, 2, 4, 5, 7)
        if ([0, 2, 4, 5, 7].includes(step) && Math.random() > 0.3) {
          const notes = melodyNotes[measure];
          const freq = notes[Math.floor(Math.random() * notes.length)];
          playTone(freq, 'sine', 0.15);
        }
      } catch (e) {
        console.warn("Music loop step error:", e);
      }

      musicStep++;
    }, stepDuration);
  }

  function stopMusic() {
    if (musicInterval) {
      clearInterval(musicInterval);
      musicInterval = null;
    }
  }

  return {
    init: init,
    toggleMute: function() {
      isMuted = !isMuted;
      return isMuted;
    },
    isMuted: function() {
      return isMuted;
    },
    // Flappy Rocket sounds
    playThrust: () => playTone(140, 'sawtooth', 0.12, 60),
    playScore: () => {
      playTone(523.25, 'sine', 0.08); // C5
      setTimeout(() => playTone(659.25, 'sine', 0.14), 70); // E5
    },
    playExplosion: () => {
      playNoise(0.55, 350);
      playTone(180, 'sawtooth', 0.35, 45);
    },
    // Stack Tower sounds
    playBlip: () => playTone(392.00, 'triangle', 0.06), // G4
    playSlice: () => playNoise(0.12, 1800),
    playPerfect: () => {
      const chords = [523.25, 659.25, 783.99, 1046.50]; // Ascending C Major chord
      chords.forEach((n, idx) => {
        setTimeout(() => playTone(n, 'sine', 0.12), idx * 50);
      });
    },
    playGameOver: () => {
      playTone(392.00, 'sawtooth', 0.18, 293.66);
      setTimeout(() => playTone(293.66, 'sawtooth', 0.35, 196.00), 180);
    },
    // Reflex Racer sounds
    playLaneChange: () => playTone(300, 'sine', 0.08, 550),
    // UI hover tick sound
    playHover: () => {
      if (!ctx) init();
      if (isMuted) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(650, ctx.currentTime);
        gain.gain.setValueAtTime(0.015, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(masterVolume);
        osc.start();
        osc.stop(ctx.currentTime + 0.04);
      } catch (e) {}
    },
    startMusic: startMusic,
    stopMusic: stopMusic
  };
})();
