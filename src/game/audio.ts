// Procedural Web Audio API sound system for Neon Run

let ctx: AudioContext | null = null;
let muted = false;
let musicPlaying = false;
let musicGain: GainNode | null = null;
let musicInterval: number | null = null;
let currentBPM = 90;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function isMuted() { return muted; }

export function toggleMute() {
  muted = !muted;
  if (musicGain) musicGain.gain.value = muted ? 0 : 0.08;
  return muted;
}

export function playJump() {
  if (muted) return;
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, c.currentTime);
  osc.frequency.linearRampToValueAtTime(600, c.currentTime + 0.15);
  gain.gain.setValueAtTime(0.12, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.15);
}

export function playLand() {
  if (muted) return;
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(120, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.08);
  gain.gain.setValueAtTime(0.15, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.08);
}

export function playCoin() {
  if (muted) return;
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, c.currentTime);
  osc.frequency.linearRampToValueAtTime(1760, c.currentTime + 0.05);
  osc.frequency.linearRampToValueAtTime(1320, c.currentTime + 0.1);
  gain.gain.setValueAtTime(0.1, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.1);
}

export function playDeath() {
  if (muted) return;
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(400, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.4);
  gain.gain.setValueAtTime(0.15, c.currentTime);
  gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.4);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.4);
}

export function playStreakChime(multiplier: number) {
  if (muted) return;
  const c = getCtx();
  const baseFreq = 400 + (multiplier - 2) * 200;
  const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5];
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = c.currentTime + i * 0.08;
    gain.gain.setValueAtTime(0.08, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.15);
  });
}

export function playWhoosh() {
  if (muted) return;
  const c = getCtx();
  const bufferSize = c.sampleRate * 0.15;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const source = c.createBufferSource();
  source.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1000;
  filter.Q.value = 0.5;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.06, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
  source.connect(filter).connect(gain).connect(c.destination);
  source.start(c.currentTime);
}


export function playMultiverseActivate() {
  if (muted) return;
  const c = getCtx();
  // Dramatic ascending chord
  const freqs = [200, 300, 400, 600];
  freqs.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = c.currentTime + i * 0.05;
    gain.gain.setValueAtTime(0.08, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}

export function playAdrenalineActivate() {
  if (muted) return;
  const c = getCtx();
  // Power-up whoosh + ascending tone
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, c.currentTime);
  osc.frequency.linearRampToValueAtTime(800, c.currentTime + 0.3);
  gain.gain.setValueAtTime(0.1, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.3);
}

// Procedural lofi background music
export function startMusic(speedMultiplier: number = 1) {
  if (musicPlaying) {
    updateMusicTempo(speedMultiplier);
    return;
  }
  musicPlaying = true;
  const c = getCtx();
  musicGain = c.createGain();
  musicGain.gain.value = muted ? 0 : 0.08;
  musicGain.connect(c.destination);

  currentBPM = 90;
  scheduleBeats(c, musicGain);
}

function scheduleBeats(c: AudioContext, masterGain: GainNode) {
  const notes = [130.81, 164.81, 196.00, 220.00, 261.63, 196.00, 164.81, 146.83];
  let beatIndex = 0;

  const playBeat = () => {
    if (!musicPlaying) return;
    const now = c.currentTime;
    const note = notes[beatIndex % notes.length];
    
    const bass = c.createOscillator();
    const bassGain = c.createGain();
    bass.type = 'triangle';
    bass.frequency.value = note;
    bassGain.gain.setValueAtTime(0.12, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    bass.connect(bassGain).connect(masterGain);
    bass.start(now);
    bass.stop(now + 0.2);

    if (beatIndex % 2 === 0) {
      const kick = c.createOscillator();
      const kickGain = c.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(150, now);
      kick.frequency.exponentialRampToValueAtTime(30, now + 0.1);
      kickGain.gain.setValueAtTime(0.2, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      kick.connect(kickGain).connect(masterGain);
      kick.start(now);
      kick.stop(now + 0.12);
    }

    if (beatIndex % 2 === 1) {
      const bufLen = c.sampleRate * 0.04;
      const buf = c.createBuffer(1, bufLen, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
      const hat = c.createBufferSource();
      hat.buffer = buf;
      const hatFilter = c.createBiquadFilter();
      hatFilter.type = 'highpass';
      hatFilter.frequency.value = 8000;
      const hatGain = c.createGain();
      hatGain.gain.setValueAtTime(0.06, now);
      hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      hat.connect(hatFilter).connect(hatGain).connect(masterGain);
      hat.start(now);
    }

    beatIndex++;
    const beatDuration = 60000 / currentBPM;
    musicInterval = window.setTimeout(playBeat, beatDuration);
  };

  playBeat();
}

export function updateMusicTempo(speedMultiplier: number) {
  currentBPM = Math.min(160, 90 + (speedMultiplier - 1) * 60);
}

export function stopMusic() {
  musicPlaying = false;
  if (musicInterval !== null) {
    clearTimeout(musicInterval);
    musicInterval = null;
  }
}
