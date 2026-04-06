import { GameState, Obstacle, Coin, Particle, Player, DeathAnimation, GhostFrame } from './types';
import {
  BG_COLOR,
  LINE_COLOR,
  PLAYER_SIZE,
  GRAVITY,
  JUMP_FORCE,
  BASE_SPEED,
  SPEED_INCREMENT,
  MAX_SPEED,
  PHASE2_DISTANCE,
  COIN_RADIUS,
  BANNER_HEIGHT,
  SKIN_COLORS,
} from './constants';
import { playJump, playLand, playCoin, playDeath, playStreakChime, playWhoosh, updateMusicTempo, stopMusic, playMultiverseActivate, playAdrenalineActivate } from './audio';

const MAX_VISIBLE_OBSTACLES = 3;
const OBSTACLE_SPAWN_X_OFFSET = 64;
const COIN_SAFE_CLEARANCE_X = 110;
const COIN_MIN_WINDOW_WIDTH = 140;
const SAFE_SPAWN_ZONE = 300;

const COLOR_THEMES = [
  { line: '#00ffcc', obstacle: '#ff3366', bg: '#0f0f1a', glow: 'rgba(0,255,204,' },
  { line: '#a855f7', obstacle: '#f472b6', bg: '#1a0f2e', glow: 'rgba(168,85,247,' },
  { line: '#fb923c', obstacle: '#ef4444', bg: '#1a150f', glow: 'rgba(251,146,60,' },
  { line: '#ef4444', obstacle: '#fbbf24', bg: '#1a0f0f', glow: 'rgba(239,68,68,' },
  { line: '#38bdf8', obstacle: '#818cf8', bg: '#0f1a2e', glow: 'rgba(56,189,248,' },
  { line: '#fbbf24', obstacle: '#f97316', bg: '#1a1a0f', glow: 'rgba(251,191,36,' },
];

let frameCount = 0;
let forceEasyFollowUp = false;
let nextPhase2ObstacleOnTop = true;
let isFirstObstacle = true;
let lastMilestone = 0;
let milestoneFlashTimer = 0;
let milestoneFlashScore = 0;
let patternCount = 0;
let patternGapPending = false;
let passedObstacleIds = new Set<number>();
let obstacleIdCounter = 0;
let prevStreakMult = 1;

const TAUNT_MESSAGES: Record<number, string> = {
  100: "Is that all you got?",
  300: "Not bad... for now",
  500: "Things are about to get worse",
  750: "You're actually good",
  1000: "MONSTER",
};

function makePlayer(x: number, y: number, isAboveLine: boolean): Player {
  return { x, y, size: PLAYER_SIZE, vy: 0, isJumping: false, isAboveLine, squashX: 1, squashY: 1, rotation: 0, anticipation: 0, landTimer: 0, wasJumping: false };
}
function randomBetween(min: number, max: number) { return min + Math.random() * (max - min); }
function randomFrom<T>(items: T[]): T { return items[Math.floor(Math.random() * items.length)]; }
function getJumpHeight() { return (Math.abs(JUMP_FORCE) * Math.abs(JUMP_FORCE)) / (2 * GRAVITY); }

function getPhase(distance: number): 1 | 2 | 3 | 4 {
  if (distance < 100) return 1;
  if (distance < 300) return 2;
  if (distance < 600) return 3;
  return 4;
}

function getRunCount(): number {
  return parseInt(localStorage.getItem('neonRunCount') || '0');
}

function incrementRunCount() {
  const c = getRunCount() + 1;
  localStorage.setItem('neonRunCount', String(c));
  return c;
}

function getSpawnProfile(distance: number, runCount: number) {
  const phase = getPhase(distance);
  // Tutorial overrides for first 3 runs
  if (runCount <= 1) {
    return { minGap: 600, maxGap: 700, maxSize: 30, speedMult: 0.85, hardChance: 0, maxBurst: 1 };
  }
  if (runCount === 2) {
    const p = phase <= 2
      ? { minGap: 500, maxGap: 600, maxSize: 35, speedMult: 0.95, hardChance: 0, maxBurst: 1 }
      : { minGap: 400, maxGap: 500, maxSize: 40, speedMult: 1.0, hardChance: 0.05, maxBurst: 2 };
    return p;
  }
  if (runCount === 3) {
    const p = phase <= 2
      ? { minGap: 400, maxGap: 550, maxSize: 38, speedMult: 1.0, hardChance: 0.05, maxBurst: 2 }
      : { minGap: 300, maxGap: 450, maxSize: 45, speedMult: 1.2, hardChance: 0.15, maxBurst: 3 };
    return p;
  }
  // Normal game
  switch (phase) {
    case 1: return { minGap: 500, maxGap: 700, maxSize: 35, speedMult: 1.0, hardChance: 0, maxBurst: 1 };
    case 2: return { minGap: 350, maxGap: 500, maxSize: 40, speedMult: 1.2, hardChance: 0.1, maxBurst: 2 };
    case 3: return { minGap: 250, maxGap: 380, maxSize: 50, speedMult: 1.4, hardChance: 0.2, maxBurst: 3 };
    case 4: return { minGap: 180, maxGap: 280, maxSize: 50, speedMult: 1.65, hardChance: 0.3, maxBurst: 4 };
  }
}

function getObstacleSizeCap(type: Obstacle['type'], distance: number, runCount: number) {
  const jumpLimitedCap = getJumpHeight() * 0.6;
  const profile = getSpawnProfile(distance, runCount);
  const typeCap = type === 'triangle' ? Math.min(45, profile.maxSize) : type === 'circle' ? Math.min(40, profile.maxSize) : Math.min(40, profile.maxSize);
  return Math.min(typeCap, jumpLimitedCap);
}

function chooseObstacleType(distance: number, mustBeEasy: boolean, runCount: number): Obstacle['type'] {
  const phase = getPhase(distance);
  // Run 1: only triangles and diamonds
  if (runCount <= 1) return randomFrom(['triangle', 'diamond']);
  // Run 2: add spike_row and bouncing_ball
  if (runCount === 2) {
    if (mustBeEasy || phase === 1) return randomFrom(['triangle', 'diamond']);
    return randomFrom(['triangle', 'diamond', 'spike_row', 'bouncing_ball']);
  }
  // Run 3: all except pendulum
  if (runCount === 3) {
    if (mustBeEasy || phase === 1) return randomFrom(['triangle', 'diamond']);
    const types: Obstacle['type'][] = ['triangle', 'circle', 'diamond', 'spike', 'star', 'spike_row', 'bouncing_ball', 'expanding', 'intermittent'];
    if (distance >= 300) types.push('gap');
    if (distance >= 500) types.push('ceiling_spikes');
    return randomFrom(types);
  }
  // Run 4+: full game
  if (mustBeEasy || phase === 1) return randomFrom(['triangle', 'diamond']);
  if (phase === 2) {
    const types: Obstacle['type'][] = ['triangle', 'diamond', 'circle', 'star', 'expanding', 'intermittent'];
    if (distance >= 300) types.push('gap');
    return randomFrom(types);
  }
  const types: Obstacle['type'][] = ['triangle', 'circle', 'diamond', 'spike', 'star', 'spike_row', 'bouncing_ball', 'expanding', 'intermittent'];
  if (distance >= 300) types.push('gap');
  if (distance >= 400) types.push('pendulum');
  if (distance >= 500) types.push('ceiling_spikes');
  return randomFrom(types);
}

function getObstacleSize(type: Obstacle['type'], distance: number, mustBeEasy: boolean, runCount: number) {
  if (type === 'spike_row' || type === 'bouncing_ball' || type === 'pendulum' || type === 'gap' || type === 'ceiling_spikes' || type === 'expanding' || type === 'intermittent') return 30;
  const cap = getObstacleSizeCap(type, distance, runCount);
  const phase = getPhase(distance);
  let minSize = type === 'triangle' || type === 'spike' ? 24 : 22;
  let maxSize = cap;
  if (phase === 1) maxSize = Math.min(maxSize, 35);
  if (mustBeEasy) maxSize = Math.min(maxSize, 32);
  if (runCount <= 1) maxSize = Math.min(maxSize, 30);
  maxSize = Math.max(maxSize, minSize + 2);
  return randomBetween(minSize, maxSize);
}

function isHardObstacle(obstacle: Obstacle) {
  return (obstacle.type === 'circle' || obstacle.type === 'star' || obstacle.type === 'spike_row' || obstacle.type === 'bouncing_ball') && obstacle.size >= 30;
}

function createObstacle(canvasW: number, lineY: number, isTop: boolean, distance: number, mustBeEasy: boolean, canvasH: number, runCount: number): Obstacle {
  const type = chooseObstacleType(distance, mustBeEasy, runCount);
  const size = getObstacleSize(type, distance, mustBeEasy, runCount);
  const spawnX = canvasW + OBSTACLE_SPAWN_X_OFFSET;
  if (type === 'spike_row') { const count = 3 + Math.floor(Math.random() * 3); return { x: spawnX, y: lineY - 12, type, size: 24, isTop: true, spikeCount: count }; }
  if (type === 'bouncing_ball') return { x: spawnX, y: lineY - 20, type, size: 18, isTop: true, bouncePhase: Math.random() * Math.PI * 2, bounceSpeed: 0.004, baseY: lineY };
  if (type === 'pendulum') { const jumpH = getJumpHeight(); const pLen = lineY - jumpH; return { x: spawnX, y: 0, type, size: 20, isTop: true, swingPhase: Math.random() * Math.PI * 2, swingSpeed: 0.003, anchorX: spawnX, pendulumLength: Math.max(60, pLen) }; }
  if (type === 'gap') { const gw = 80 + Math.random() * 40; return { x: spawnX, y: lineY, type, size: gw, isTop: true, gapWidth: gw }; }
  if (type === 'ceiling_spikes') return { x: spawnX, y: 30, type, size: 35, isTop: true };
  if (type === 'expanding') { const baseS = 12; const maxS = 28 + Math.random() * 16; return { x: spawnX, y: lineY - baseS / 2, type, size: baseS, isTop: true, expandPhase: 0, expandBaseSize: baseS, expandMaxSize: maxS }; }
  if (type === 'intermittent') return { x: spawnX, y: lineY - size / 2, type, size: 26, isTop: true, intermittentPhase: 0, intermittentVisible: true };
  const y = isTop ? lineY - size / 2 : lineY + size / 2;
  return { x: spawnX, y, type, size, isTop };
}

function buildSafeCoinWindows(obstacles: Obstacle[], playerX: number, canvasW: number) {
  const start = playerX + 220; const end = canvasW - 96;
  if (end - start < COIN_MIN_WINDOW_WIDTH) return [] as Array<[number, number]>;
  const blocked = obstacles.filter(o => o.x + o.size / 2 > start && o.x - o.size / 2 < end).map(o => [Math.max(start, o.x - o.size / 2 - COIN_SAFE_CLEARANCE_X), Math.min(end, o.x + o.size / 2 + COIN_SAFE_CLEARANCE_X)] as [number, number]).sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [left, right] of blocked) { const last = merged[merged.length - 1]; if (!last || left > last[1]) merged.push([left, right]); else last[1] = Math.max(last[1], right); }
  const windows: Array<[number, number]> = []; let cursor = start;
  for (const [left, right] of merged) { if (left - cursor >= COIN_MIN_WINDOW_WIDTH) windows.push([cursor, left]); cursor = Math.max(cursor, right); }
  if (end - cursor >= COIN_MIN_WINDOW_WIDTH) windows.push([cursor, end]);
  return windows;
}

function spawnSafeCoin(state: GameState, canvasW: number, lineY: number): Coin | null {
  const windows = buildSafeCoinWindows(state.obstacles, state.playerTop.x, canvasW);
  if (windows.length === 0) return null;
  const [left, right] = randomFrom(windows);
  const x = (left + right) / 2;
  const verticalOffset = PLAYER_SIZE + 34 + Math.random() * 10;
  const isTop = state.phase === 1 ? true : Math.random() > 0.5;
  const y = isTop ? lineY - verticalOffset : lineY + verticalOffset;
  return { x, y, collected: false, radius: COIN_RADIUS };
}

function defaultExtraState() {
  return {
    colorShiftIndex: 0, colorShiftTransition: 0, disruptionType: 0, disruptionTimer: 0,
    lastColorShiftAt: 0, lastDisruptionAt: 0, deathAnim: null as DeathAnimation | null, audioEvents: [] as string[],
  };
}

function loadBestGhost(): GhostFrame[] {
  try {
    const raw = localStorage.getItem('bestGhostJumps');
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveBestGhost(frames: GhostFrame[]) {
  try { localStorage.setItem('bestGhostJumps', JSON.stringify(frames)); } catch {}
}

export function createInitialState(): GameState {
  const runCount = getRunCount();
  return {
    screen: 'menu', score: 0, bestScore: parseInt(localStorage.getItem('bestScore') || '0'),
    coins: parseInt(localStorage.getItem('coins') || '0'), totalCoins: parseInt(localStorage.getItem('coins') || '0'),
    distance: 0, speed: BASE_SPEED, baseSpeed: BASE_SPEED, phase: 1, phaseThreshold: PHASE2_DISTANCE,
    playerTop: makePlayer(80, 0, true), playerBottom: null, obstacles: [], coinItems: [], particles: [],
    activePowers: [], hasShield: false, freeReviveUsed: false,
    removeAds: localStorage.getItem('removeAds') === 'true',
    equippedSkin: localStorage.getItem('equippedSkin') || 'default',
    equippedTrail: localStorage.getItem('equippedTrail') || '',
    equippedDeath: localStorage.getItem('equippedDeath') || '',
    screenShake: 0, coinFlash: 0, streak: 0, streakMultiplier: 1,
    tauntText: '', tauntTimer: 0, shownTaunts: new Set(), newRecordShown: false,
    ...defaultExtraState(),
    runCount,
    ghostFrames: [],
    bestGhostFrames: loadBestGhost(),
    ghostIndex: 0,
    adrenaline: 0,
    adrenalineActive: false,
    adrenalineTimer: 0,
    lastDodgeTime: 0,
    cinematicSlowMo: 0,
    cinematicTriggered: false,
    multiverseActive: false,
    multiverseTimer: 0,
    multiverseDuration: 0,
    nextMultiverseAt: 300 + Math.random() * 200,
    multiverseOffsets: [0, 80, -60, 40],
    multiverseTextTimer: 0,
    multiverseMergeTimer: 0,
  };
}

export function resetForNewGame(state: GameState): GameState {
  prevStreakMult = 1;
  const newRunCount = incrementRunCount();
  return {
    ...state, screen: 'playing', score: 0, distance: 0, speed: BASE_SPEED, baseSpeed: BASE_SPEED, phase: 1,
    playerTop: makePlayer(80, 0, true), playerBottom: null, obstacles: [], coinItems: [], particles: [],
    activePowers: [], hasShield: false, freeReviveUsed: false, screenShake: 0, coinFlash: 0,
    streak: 0, streakMultiplier: 1, tauntText: '', tauntTimer: 0, shownTaunts: new Set(), newRecordShown: false,
    ...defaultExtraState(),
    runCount: newRunCount,
    ghostFrames: [],
    bestGhostFrames: loadBestGhost(),
    ghostIndex: 0,
    adrenaline: 0,
    adrenalineActive: false,
    adrenalineTimer: 0,
    lastDodgeTime: 0,
    cinematicSlowMo: 0,
    cinematicTriggered: false,
    multiverseActive: false,
    multiverseTimer: 0,
    multiverseDuration: 0,
    nextMultiverseAt: 300 + Math.random() * 200,
    multiverseOffsets: [0, 60 + Math.random() * 60, -(60 + Math.random() * 60), 30 + Math.random() * 50],
    multiverseTextTimer: 0,
    multiverseMergeTimer: 0,
  };
}

function addParticles(particles: Particle[], x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 1, maxLife: 1, color, size: 2 + Math.random() * 3 });
}

function addTrailParticle(particles: Particle[], p: Player, color: string) {
  particles.push({ x: p.x - p.size / 2 - 2, y: p.y + (Math.random() - 0.5) * p.size * 0.5, vx: -1 - Math.random(), vy: (Math.random() - 0.5) * 0.5, life: 0.6, maxLife: 0.6, color, size: 1.5 + Math.random() * 2 });
}

function addLandingParticles(particles: Particle[], p: Player, lineY: number, color: string) {
  for (let i = 0; i < 8; i++) particles.push({ x: p.x + (Math.random() - 0.5) * p.size, y: lineY, vx: (Math.random() - 0.5) * 4, vy: p.isAboveLine ? -(Math.random() * 2) : Math.random() * 2, life: 0.5, maxLife: 0.5, color, size: 1.5 + Math.random() * 2 });
}

function checkCollision(player: Player, obs: Obstacle, lineY: number): boolean {
  const shrink = 0.85;
  if (obs.type === 'gap') { const gw = obs.gapWidth || 100; return player.x > obs.x - gw / 2 && player.x < obs.x + gw / 2 && !player.isJumping; }
  if (obs.type === 'intermittent' && !obs.intermittentVisible) return false;
  if (obs.type === 'spike_row') { const totalWidth = (obs.spikeCount || 3) * 16; const dx = Math.abs(player.x - obs.x); const dy = Math.abs(player.y - obs.y); return dx < (player.size / 2 + totalWidth / 2) * shrink && dy < (player.size / 2 + obs.size / 2) * shrink; }
  if (obs.type === 'bouncing_ball') { const dx = player.x - obs.x; const dy = player.y - obs.y; return Math.sqrt(dx * dx + dy * dy) < (player.size / 2 + obs.size / 2) * shrink; }
  if (obs.type === 'pendulum') { const bh = (obs.pendulumLength || 120) * 0.15; const dx = Math.abs(player.x - obs.x); const dy = Math.abs(player.y - obs.y); return dx < (player.size / 2 + obs.size / 2) * shrink && dy < (player.size / 2 + bh / 2) * shrink; }
  if (obs.type === 'ceiling_spikes') { const dx = Math.abs(player.x - obs.x); const dy = Math.abs(player.y - obs.y); return dx < (player.size / 2 + obs.size / 2) * shrink && dy < (player.size / 2 + 20) * shrink; }
  if (obs.type === 'expanding') { const s = obs.size; const dx = Math.abs(player.x - obs.x); const dy = Math.abs(player.y - (lineY - s / 2)); return dx < (player.size / 2 + s / 2) * shrink && dy < (player.size / 2 + s / 2) * shrink; }
  const dx = Math.abs(player.x - obs.x); const dy = Math.abs(player.y - obs.y);
  return dx < (player.size / 2 + obs.size / 2) * shrink && dy < (player.size / 2 + obs.size / 2) * shrink;
}

function updatePlayerAnim(p: Player, dt: number) {
  if (p.landTimer > 0) { p.landTimer = Math.max(0, p.landTimer - dt); const t = p.landTimer / 100; p.squashX = 1 + 0.2 * t; p.squashY = 1 - 0.15 * t; }
  else if (p.anticipation > 0) { p.squashX = 1 + 0.1 * p.anticipation; p.squashY = 1 - 0.15 * p.anticipation; p.anticipation = Math.max(0, p.anticipation - dt / 80); }
  else if (p.isJumping) { const sf = Math.min(1, Math.abs(p.vy) / 10); p.squashX = 1 - 0.12 * sf; p.squashY = 1 + 0.18 * sf; const maxRot = (15 * Math.PI) / 180; const dir = p.isAboveLine ? 1 : -1; p.rotation = dir * (p.vy / Math.abs(JUMP_FORCE)) * maxRot * 0.5; }
  else { const bob = Math.sin(((Date.now() % 400) / 400) * Math.PI * 2); p.squashX = 1 + bob * 0.01; p.squashY = 0.98 + bob * 0.02; p.rotation = (5 * Math.PI) / 180 + Math.sin(((Date.now() % 600) / 600) * Math.PI * 2) * 0.02; }
}

function getDeathType(obsType: Obstacle['type']): DeathAnimation['type'] {
  switch (obsType) {
    case 'triangle': return 'triangle_split';
    case 'circle': return 'circle_bounce';
    case 'bouncing_ball': return 'ball_flatten';
    case 'spike_row': case 'spike': case 'ceiling_spikes': case 'expanding': case 'intermittent': return 'spike_shatter';
    case 'gap': return 'gap_fall';
    default: return 'default';
  }
}

function addDeathParticles(particles: Particle[], deathType: DeathAnimation['type'], x: number, y: number, color: string, size: number) {
  addParticles(particles, x, y, color, 20);
  switch (deathType) {
    case 'triangle_split':
      particles.push({ x: x - 5, y, vx: -4, vy: -3, life: 1.5, maxLife: 1.5, color, size: size * 0.6, isDeathPiece: true, width: size, height: size / 2, rotationSpeed: -3, angle: 0 });
      particles.push({ x: x + 5, y, vx: 4, vy: -2, life: 1.5, maxLife: 1.5, color, size: size * 0.6, isDeathPiece: true, width: size, height: size / 2, rotationSpeed: 3, angle: 0 });
      break;
    case 'circle_bounce':
      particles.push({ x, y, vx: -3, vy: -5, life: 2, maxLife: 2, color, size: size, isDeathPiece: true, width: size, height: size, rotationSpeed: 0, angle: 0 });
      break;
    case 'ball_flatten':
      particles.push({ x, y, vx: 0, vy: 0, life: 1, maxLife: 1, color, size: size, isDeathPiece: true, width: size * 2, height: 2, rotationSpeed: 0, angle: 0 });
      break;
    case 'spike_shatter':
      for (let i = 0; i < 12; i++) {
        particles.push({ x: x + (Math.random() - 0.5) * size, y: y + (Math.random() - 0.5) * size, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, life: 1.2, maxLife: 1.2, color, size: 3 + Math.random() * 4, isDeathPiece: true, width: 4, height: 4, rotationSpeed: (Math.random() - 0.5) * 10, angle: Math.random() * Math.PI * 2 });
      }
      break;
    case 'gap_fall':
      particles.push({ x, y, vx: 0, vy: 8, life: 2, maxLife: 2, color, size: size, isDeathPiece: true, width: size, height: size, rotationSpeed: 2, angle: 0 });
      break;
    default: break;
  }
}

export function resetSpawners() {
  frameCount = 0; forceEasyFollowUp = false; nextPhase2ObstacleOnTop = true; isFirstObstacle = true;
  lastMilestone = 0; milestoneFlashTimer = 0; milestoneFlashScore = 0; patternCount = 0; patternGapPending = false;
  passedObstacleIds.clear(); obstacleIdCounter = 0; prevStreakMult = 1;
}

function handleDeath(state: GameState, p: Player, skinColor: string, _lineY: number, obsType: Obstacle['type']) {
  const deathType = getDeathType(obsType);
  addDeathParticles(state.particles, deathType, p.x, p.y, skinColor, p.size);
  if (state.playerBottom) addParticles(state.particles, state.playerBottom.x, state.playerBottom.y, skinColor, 30);
  state.deathAnim = { type: deathType, timer: 1.5, x: p.x, y: p.y, color: skinColor };
  state.screenShake = 0;
  state.screen = 'gameover' as any;
  state.streak = 0; state.streakMultiplier = 1;
  const distCoins = Math.floor(state.distance / 10);
  state.coins += distCoins; state.totalCoins += distCoins;
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    localStorage.setItem('bestScore', String(state.bestScore));
    // Save ghost of this best run
    saveBestGhost(state.ghostFrames);
  }
  localStorage.setItem('coins', String(state.totalCoins));
  passedObstacleIds.clear();
  playDeath();
  stopMusic();
}

export function activateAdrenaline(state: GameState): GameState {
  if (state.adrenaline < 100 || state.adrenalineActive) return state;
  state.adrenalineActive = true;
  state.adrenalineTimer = 3000;
  state.adrenaline = 0;
  playAdrenalineActivate();
  return state;
}

export function update(state: GameState, canvasW: number, canvasH: number, dt: number): GameState {
  if (state.screen !== 'playing') return state;

  const lineY = (canvasH - BANNER_HEIGHT) / 2;
  frameCount++;
  state.audioEvents = [];
  const runCount = state.runCount;

  const spawnProfile = getSpawnProfile(state.distance, runCount);
  state.speed = Math.min(MAX_SPEED, state.baseSpeed * spawnProfile.speedMult + state.distance * SPEED_INCREMENT * 0.3);
  updateMusicTempo(spawnProfile.speedMult);

  let effectiveSpeed = state.speed;
  const slowmo = state.activePowers.find(p => p.type === 'slowmo');
  if (slowmo) effectiveSpeed *= 0.5;
  // Adrenaline slow-mo
  if (state.adrenalineActive) effectiveSpeed *= 0.5;
  // Cinematic slow-mo
  if (state.cinematicSlowMo > 0) effectiveSpeed *= 0.5;

  state.activePowers = state.activePowers.map(p => ({ ...p, remaining: p.remaining - dt })).filter(p => p.remaining > 0);
  state.distance += effectiveSpeed * 0.1;
  state.score = Math.floor(state.distance);

  // Adrenaline timer
  if (state.adrenalineActive) {
    state.adrenalineTimer = Math.max(0, state.adrenalineTimer - dt);
    if (state.adrenalineTimer <= 0) state.adrenalineActive = false;
  }

  // Adrenaline drain if no dodges for 3 seconds
  if (!state.adrenalineActive && state.adrenaline > 0) {
    const timeSinceDodge = Date.now() - state.lastDodgeTime;
    if (timeSinceDodge > 3000) {
      state.adrenaline = Math.max(0, state.adrenaline - dt * 0.01);
    }
  }

  // Cinematic slow-mo for new record
  if (state.cinematicSlowMo > 0) {
    state.cinematicSlowMo = Math.max(0, state.cinematicSlowMo - dt);
  }

  // Cinematic trigger on new best
  if (state.score > state.bestScore && !state.cinematicTriggered) {
    state.cinematicTriggered = true;
    state.cinematicSlowMo = 2000;
    state.tauntText = 'NEW RECORD'; state.tauntTimer = 2.0;
    state.newRecordShown = true;
    playWhoosh();
  }

  // Multiverse mode
  if (state.distance >= state.nextMultiverseAt && !state.multiverseActive) {
    state.multiverseActive = true;
    state.multiverseDuration = 10000 + Math.random() * 10000;
    state.multiverseTimer = state.multiverseDuration;
    state.multiverseOffsets = [0, 60 + Math.random() * 60, -(60 + Math.random() * 60), 30 + Math.random() * 50];
    playMultiverseActivate();
  }
  if (state.multiverseActive) {
    state.multiverseTimer -= dt;
    if (state.multiverseTimer <= 0) {
      state.multiverseActive = false;
      state.nextMultiverseAt = state.distance + 300 + Math.random() * 300;
    }
  }

  // Record ghost frame
  if (frameCount % 3 === 0) {
    state.ghostFrames.push({ distance: state.distance, y: state.playerTop.y, isJumping: state.playerTop.isJumping });
  }

  // Color shift every 200m
  const colorIdx = Math.floor(state.distance / 200) % COLOR_THEMES.length;
  if (colorIdx !== state.colorShiftIndex) {
    if (state.lastColorShiftAt !== colorIdx) {
      state.lastColorShiftAt = colorIdx;
      state.colorShiftTransition = 0;
    }
    state.colorShiftIndex = colorIdx;
  }
  if (state.colorShiftTransition < 1) state.colorShiftTransition = Math.min(1, state.colorShiftTransition + dt / 2000);

  // Visual disruption every 500m
  const disruptIdx = Math.floor(state.distance / 500);
  if (disruptIdx > 0 && disruptIdx !== state.lastDisruptionAt && state.disruptionTimer <= 0) {
    state.lastDisruptionAt = disruptIdx;
    state.disruptionType = ((disruptIdx - 1) % 3) + 1;
    state.disruptionTimer = 3;
  }
  if (state.disruptionTimer > 0) {
    state.disruptionTimer = Math.max(0, state.disruptionTimer - dt / 1000);
    if (state.disruptionTimer <= 0) state.disruptionType = 0;
  }

  // Taunts (skip if cinematic is active — it has its own text)
  if (state.cinematicSlowMo <= 0) {
    for (const [dist, msg] of Object.entries(TAUNT_MESSAGES)) {
      const d = parseInt(dist);
      if (state.distance >= d && !state.shownTaunts.has(d)) {
        state.shownTaunts.add(d); state.tauntText = msg; state.tauntTimer = 1.5;
        playWhoosh();
      }
    }
  }
  if (state.tauntTimer > 0) state.tauntTimer = Math.max(0, state.tauntTimer - dt / 1000);

  const currentMilestone = Math.floor(state.distance / 100) * 100;
  if (currentMilestone > lastMilestone && currentMilestone > 0) { lastMilestone = currentMilestone; milestoneFlashTimer = 1.5; milestoneFlashScore = currentMilestone; }
  if (milestoneFlashTimer > 0) milestoneFlashTimer = Math.max(0, milestoneFlashTimer - dt / 1000);
  if (state.screenShake > 0) state.screenShake = Math.max(0, state.screenShake - dt * 0.01);
  if (state.coinFlash > 0) state.coinFlash = Math.max(0, state.coinFlash - dt * 0.005);

  if (state.phase === 1 && state.distance >= state.phaseThreshold) {
    state.phase = 2; state.playerBottom = makePlayer(80, lineY + PLAYER_SIZE / 2, false);
  }

  const skinColor = SKIN_COLORS[state.equippedSkin] || '#00ffcc';
  const pt = state.playerTop;
  pt.y = pt.y || lineY - PLAYER_SIZE / 2;
  const ptWasJumping = pt.isJumping;
  if (pt.isJumping) { pt.vy += GRAVITY; pt.y += pt.vy; if (pt.y >= lineY - PLAYER_SIZE / 2) { pt.y = lineY - PLAYER_SIZE / 2; pt.vy = 0; pt.isJumping = false; } }
  else pt.y = lineY - PLAYER_SIZE / 2;
  if (ptWasJumping && !pt.isJumping) { pt.landTimer = 100; pt.rotation = 0; addLandingParticles(state.particles, pt, lineY, skinColor); playLand(); }
  updatePlayerAnim(pt, dt);
  if (frameCount % 3 === 0) addTrailParticle(state.particles, pt, skinColor);

  if (state.playerBottom) {
    const pb = state.playerBottom;
    const pbWas = pb.isJumping;
    if (pb.isJumping) { pb.vy -= GRAVITY; pb.y += pb.vy; if (pb.y <= lineY + PLAYER_SIZE / 2) { pb.y = lineY + PLAYER_SIZE / 2; pb.vy = 0; pb.isJumping = false; } }
    else pb.y = lineY + PLAYER_SIZE / 2;
    if (pbWas && !pb.isJumping) { pb.landTimer = 100; pb.rotation = 0; addLandingParticles(state.particles, pb, lineY, skinColor); }
    updatePlayerAnim(pb, dt);
    if (frameCount % 3 === 0) addTrailParticle(state.particles, pb, skinColor);
  }

  for (const obs of state.obstacles) {
    if (obs.type === 'bouncing_ball' && obs.bouncePhase !== undefined && obs.baseY !== undefined) { obs.bouncePhase += (obs.bounceSpeed || 0.004) * dt; obs.y = obs.baseY - Math.abs(Math.sin(obs.bouncePhase)) * canvasH * 0.5; }
    if (obs.type === 'pendulum' && obs.swingPhase !== undefined && obs.anchorX !== undefined) { obs.swingPhase += (obs.swingSpeed || 0.003) * dt; const a = Math.sin(obs.swingPhase) * 0.6; const pLen = obs.pendulumLength || 120; obs.x = obs.anchorX + Math.sin(a) * pLen; obs.y = Math.cos(a) * pLen; }
    if (obs.type === 'expanding' && obs.expandBaseSize !== undefined && obs.expandMaxSize !== undefined) {
      obs.expandPhase = (obs.expandPhase || 0) + dt * 0.002;
      const t = (Math.sin(obs.expandPhase) + 1) / 2;
      obs.size = obs.expandBaseSize + t * (obs.expandMaxSize - obs.expandBaseSize);
      obs.y = lineY - obs.size / 2;
    }
    if (obs.type === 'intermittent') {
      obs.intermittentPhase = (obs.intermittentPhase || 0) + dt;
      if (obs.intermittentPhase >= 800) { obs.intermittentPhase = 0; obs.intermittentVisible = !obs.intermittentVisible; }
    }
  }

  // Spawning — completely independent from visual effects
  const visibleCount = state.obstacles.filter(o => o.x + o.size / 2 >= 0 && o.x - o.size / 2 <= canvasW).length;
  if (visibleCount < MAX_VISIBLE_OBSTACLES) {
    const mustBeEasy = forceEasyFollowUp || patternGapPending;
    const spawnOnTop = state.phase === 1 ? true : nextPhase2ObstacleOnTop;
    let candidate: Obstacle;
    if (isFirstObstacle) candidate = { x: canvasW + OBSTACLE_SPAWN_X_OFFSET, y: (canvasH - BANNER_HEIGHT) / 2 - 15, type: 'triangle', size: 28, isTop: true };
    else candidate = createObstacle(canvasW, (canvasH - BANNER_HEIGHT) / 2, spawnOnTop, state.distance, mustBeEasy, canvasH, runCount);

    const MIN_ABSOLUTE_GAP = 350 - Math.min(150, state.distance * 0.15);
    let requiredGapPx = patternGapPending ? spawnProfile.maxGap * 1.3 : randomBetween(spawnProfile.minGap, spawnProfile.maxGap);
    requiredGapPx = Math.max(requiredGapPx, MIN_ABSOLUTE_GAP);
    if (isFirstObstacle) requiredGapPx = Math.max(requiredGapPx, SAFE_SPAWN_ZONE);
    const rightmost = state.obstacles.length > 0 ? Math.max(...state.obstacles.map(o => o.x + o.size / 2)) : state.playerTop.x - SAFE_SPAWN_ZONE;
    if (state.obstacles.length === 0 || rightmost <= candidate.x - candidate.size / 2 - requiredGapPx) {
      (candidate as any)._id = obstacleIdCounter++;
      state.obstacles.push(candidate);
      isFirstObstacle = false;
      if (patternGapPending) { patternGapPending = false; patternCount = 0; }
      patternCount++;
      if (patternCount >= spawnProfile.maxBurst) patternGapPending = true;
      forceEasyFollowUp = isHardObstacle(candidate);
      if (state.phase === 2) nextPhase2ObstacleOnTop = !nextPhase2ObstacleOnTop;
    }
  }

  if (state.coinItems.length < 2 && Math.random() < 0.012) { const c = spawnSafeCoin(state, canvasW, lineY); if (c) state.coinItems.push(c); }

  state.obstacles = state.obstacles.map(o => {
    if (o.type === 'pendulum' && o.anchorX !== undefined) { o.anchorX -= effectiveSpeed; return o; }
    return { ...o, x: o.x - effectiveSpeed };
  }).filter(o => o.x > -120);

  const magnet = state.activePowers.find(p => p.type === 'magnet');
  state.coinItems = state.coinItems.map(c => {
    let nx = c.x - effectiveSpeed, ny = c.y;
    if (magnet && !c.collected) { const t = c.y < lineY ? pt : (state.playerBottom || pt); const dx = t.x - nx, dy = t.y - ny, d = Math.sqrt(dx * dx + dy * dy); if (d < 200) { nx += dx * 0.15; ny += dy * 0.15; } }
    return { ...c, x: nx, y: ny };
  }).filter(c => c.x > -50 && !c.collected);

  // Streak tracking + adrenaline fill
  for (const obs of state.obstacles) {
    const oid = (obs as any)._id as number;
    if (oid !== undefined && obs.x + obs.size / 2 < pt.x && !passedObstacleIds.has(oid)) {
      passedObstacleIds.add(oid);
      state.streak++;
      state.lastDodgeTime = Date.now();
      // Adrenaline fill (not during adrenaline active)
      if (!state.adrenalineActive) {
        state.adrenaline = Math.min(100, state.adrenaline + 15);
      }
      if (state.streak >= 30) state.streakMultiplier = 4;
      else if (state.streak >= 20) state.streakMultiplier = 3;
      else if (state.streak >= 10) state.streakMultiplier = 2;
      else state.streakMultiplier = 1;
      if (state.streakMultiplier > prevStreakMult) { playStreakChime(state.streakMultiplier); prevStreakMult = state.streakMultiplier; }
    }
  }

  // Multiverse x2 score multiplier
  const mvMult = state.multiverseActive ? 2 : 1;

  for (const coin of state.coinItems) {
    if (coin.collected) continue;
    for (const p of [pt, state.playerBottom].filter(Boolean) as Player[]) {
      const dx = p.x - coin.x, dy = p.y - coin.y;
      if (Math.sqrt(dx * dx + dy * dy) < p.size / 2 + coin.radius) {
        coin.collected = true;
        const gain = state.streakMultiplier * mvMult;
        state.coins += gain; state.totalCoins += gain;
        state.coinFlash = 1; addParticles(state.particles, coin.x, coin.y, '#facc15', 12);
        playCoin();
      }
    }
  }

  for (const obs of state.obstacles) {
    if (obs.type === 'gap' || obs.type === 'ceiling_spikes' || obs.type === 'bouncing_ball' || obs.type === 'pendulum' || obs.type === 'expanding' || obs.type === 'intermittent') {
      for (const p of [pt, state.playerBottom].filter(Boolean) as Player[]) {
        if (checkCollision(p, obs, lineY)) {
          if (state.hasShield) { state.hasShield = false; state.obstacles = state.obstacles.filter(o => o !== obs); addParticles(state.particles, p.x, p.y, '#00ffcc', 15); }
          else handleDeath(state, p, skinColor, lineY, obs.type);
          break;
        }
      }
    } else {
      const players = obs.isTop ? [pt] : (state.playerBottom ? [state.playerBottom] : []);
      for (const p of players) {
        if (checkCollision(p, obs, lineY)) {
          if (state.hasShield) { state.hasShield = false; state.obstacles = state.obstacles.filter(o => o !== obs); addParticles(state.particles, p.x, p.y, '#00ffcc', 15); }
          else handleDeath(state, p, skinColor, lineY, obs.type);
          break;
        }
      }
    }
    if ((state as any).screen === 'gameover') break;
  }

  state.particles = state.particles.map(p => {
    const np = { ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 0.02 };
    if (p.isDeathPiece) { np.vy = (np.vy || 0) + 0.15; if (p.angle !== undefined && p.rotationSpeed) np.angle = p.angle + p.rotationSpeed * 0.016; }
    return np;
  }).filter(p => p.life > 0);

  return state;
}

function lerpColor(a: string, b: string, t: number): string {
  const parseHex = (h: string) => {
    const c = h.replace('#', '');
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  };
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

function getCurrentTheme(state: GameState) {
  const idx = state.colorShiftIndex;
  const prevIdx = (idx - 1 + COLOR_THEMES.length) % COLOR_THEMES.length;
  const t = state.colorShiftTransition;
  const prev = COLOR_THEMES[prevIdx];
  const curr = COLOR_THEMES[idx];
  return {
    line: lerpColor(prev.line, curr.line, t),
    obstacle: lerpColor(prev.obstacle, curr.obstacle, t),
    bg: lerpColor(prev.bg, curr.bg, t),
  };
}

export function render(ctx: CanvasRenderingContext2D, state: GameState, canvasW: number, canvasH: number) {
  const h = canvasH - BANNER_HEIGHT;
  const lineY = h / 2;
  const theme = getCurrentTheme(state);

  let shakeX = 0, shakeY = 0;
  if (state.screen === 'playing' && state.screenShake > 0) { const i = state.screenShake * 8; shakeX = (Math.random() - 0.5) * i; shakeY = (Math.random() - 0.5) * i; }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(shakeX, shakeY);

  const invertActive = state.disruptionType === 2 && state.disruptionTimer > 0;
  const invisibleObs = state.disruptionType === 1 && state.disruptionTimer > 0;
  const noLine = state.disruptionType === 3 && state.disruptionTimer > 0;

  ctx.fillStyle = invertActive ? '#e0e0e0' : theme.bg;
  ctx.fillRect(-10, -10, canvasW + 20, canvasH + 20);

  if (invertActive && state.disruptionTimer > 2.7) {
    ctx.save(); ctx.globalAlpha = (state.disruptionTimer - 2.7) / 0.3; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvasW, h); ctx.restore();
  }

  if (state.coinFlash > 0) { ctx.save(); ctx.globalAlpha = state.coinFlash * 0.15; ctx.fillStyle = '#facc15'; ctx.fillRect(0, 0, canvasW, h); ctx.restore(); }

  ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
  for (let x = (frameCount * 2) % 60; x < canvasW; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }

  if (!noLine) {
    const gaps = state.obstacles.filter(o => o.type === 'gap');
    const lineColor = invertActive ? '#333' : theme.line;
    ctx.shadowColor = lineColor; ctx.shadowBlur = 20; ctx.strokeStyle = lineColor; ctx.lineWidth = 2;
    if (gaps.length > 0) {
      const sorted = gaps.map(g => ({ left: g.x - (g.gapWidth || 100) / 2, right: g.x + (g.gapWidth || 100) / 2 })).sort((a, b) => a.left - b.left);
      let cx = 0;
      for (const gap of sorted) { if (cx < gap.left) { ctx.beginPath(); ctx.moveTo(cx, lineY); ctx.lineTo(gap.left, lineY); ctx.stroke(); } cx = gap.right; }
      if (cx < canvasW) { ctx.beginPath(); ctx.moveTo(cx, lineY); ctx.lineTo(canvasW, lineY); ctx.stroke(); }
    } else { ctx.beginPath(); ctx.moveTo(0, lineY); ctx.lineTo(canvasW, lineY); ctx.stroke(); }
    ctx.shadowBlur = 0;
  }

  const skinColor = SKIN_COLORS[state.equippedSkin] || '#00ffcc';

  if (state.screen === 'menu') {
    const breathe = 0.98 + 0.04 * Math.sin((Date.now() / 800) * Math.PI);
    ctx.save(); ctx.translate(canvasW / 2, lineY - PLAYER_SIZE / 2); ctx.scale(breathe, breathe);
    ctx.shadowColor = skinColor; ctx.shadowBlur = 20; ctx.fillStyle = skinColor;
    ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
    ctx.restore(); ctx.restore(); return;
  }

  // Ghost replay
  if (state.bestGhostFrames.length > 0 && state.screen === 'playing') {
    // Find ghost frame closest to current distance
    let gi = state.ghostIndex;
    while (gi < state.bestGhostFrames.length - 1 && state.bestGhostFrames[gi].distance < state.distance) gi++;
    state.ghostIndex = gi;
    const gf = state.bestGhostFrames[gi];
    if (gf) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.fillRect(80 - PLAYER_SIZE / 2, gf.y - PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
      // Label
      ctx.globalAlpha = 0.5;
      ctx.font = '9px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('👻 BEST', 80, gf.y - PLAYER_SIZE / 2 - 6);
      ctx.restore();
    }
  }

  const drawPlayer = (p: Player) => {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.scale(p.squashX, p.squashY);
    if (state.adrenalineActive) {
      ctx.shadowColor = skinColor; ctx.shadowBlur = 40;
    } else if (state.streak >= 30) {
      ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 25;
    } else {
      ctx.shadowColor = skinColor; ctx.shadowBlur = 15;
    }
    ctx.fillStyle = state.adrenalineActive ? skinColor : (state.streak >= 30 ? '#ffd700' : skinColor);
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    if (state.adrenalineActive) {
      // Intense glow overlay
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(Date.now() * 0.01);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
    }
    if (state.hasShield) { ctx.strokeStyle = 'rgba(0,255,204,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, p.size * 0.8, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  };
  drawPlayer(state.playerTop);
  if (state.playerBottom) drawPlayer(state.playerBottom);

  // Obstacles
  const obsColor = invisibleObs ? theme.bg : (invertActive ? '#222' : theme.obstacle);
  for (const obs of state.obstacles) {
    if (obs.type === 'intermittent' && !obs.intermittentVisible) { ctx.save(); ctx.globalAlpha = 0.15; ctx.strokeStyle = obsColor; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(obs.x, obs.y, obs.size / 2, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); continue; }
    ctx.save();
    if (obs.type !== 'gap' && obs.type !== 'ceiling_spikes' && obs.type !== 'pendulum') {
      ctx.save(); ctx.globalAlpha = invisibleObs ? 0.35 : 0.25; ctx.fillStyle = invisibleObs ? 'rgba(0,0,0,0.6)' : obsColor;
      ctx.beginPath(); ctx.ellipse(obs.x, lineY, obs.size / 2 + 4, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = obsColor; ctx.shadowColor = obsColor; ctx.shadowBlur = invisibleObs ? 0 : 10;
    if (invisibleObs) ctx.globalAlpha = 0.05;

    const half = obs.size / 2;
    switch (obs.type) {
      case 'triangle': ctx.beginPath(); if (obs.isTop) { ctx.moveTo(obs.x, obs.y - half); ctx.lineTo(obs.x + half, obs.y + half); ctx.lineTo(obs.x - half, obs.y + half); } else { ctx.moveTo(obs.x, obs.y + half); ctx.lineTo(obs.x + half, obs.y - half); ctx.lineTo(obs.x - half, obs.y - half); } ctx.closePath(); ctx.fill(); break;
      case 'circle': ctx.beginPath(); ctx.arc(obs.x, obs.y, half, 0, Math.PI * 2); ctx.fill(); break;
      case 'star': drawStar(ctx, obs.x, obs.y, 5, half, half / 2); break;
      case 'spike': ctx.beginPath(); if (obs.isTop) { ctx.moveTo(obs.x - half, obs.y + half); ctx.lineTo(obs.x, obs.y - half); ctx.lineTo(obs.x + half, obs.y + half); ctx.lineTo(obs.x, obs.y + half * 0.5); } else { ctx.moveTo(obs.x - half, obs.y - half); ctx.lineTo(obs.x, obs.y + half); ctx.lineTo(obs.x + half, obs.y - half); ctx.lineTo(obs.x, obs.y - half * 0.5); } ctx.closePath(); ctx.fill(); break;
      case 'diamond': ctx.beginPath(); ctx.moveTo(obs.x, obs.y - half); ctx.lineTo(obs.x + half, obs.y); ctx.lineTo(obs.x, obs.y + half); ctx.lineTo(obs.x - half, obs.y); ctx.closePath(); ctx.fill(); break;
      case 'spike_row': { const c = obs.spikeCount || 3; const sw = 14; const sh = obs.size; const sx = obs.x - (c * sw) / 2; for (let i = 0; i < c; i++) { const x = sx + i * sw + sw / 2; ctx.beginPath(); ctx.moveTo(x - sw / 2, lineY); ctx.lineTo(x, lineY - sh); ctx.lineTo(x + sw / 2, lineY); ctx.closePath(); ctx.fill(); } break; }
      case 'bouncing_ball': ctx.fillStyle = invisibleObs ? theme.bg : '#ff6644'; ctx.shadowColor = invisibleObs ? theme.bg : '#ff6644'; ctx.beginPath(); ctx.arc(obs.x, obs.y, obs.size, 0, Math.PI * 2); ctx.fill(); ctx.save(); ctx.globalAlpha = 0.2; ctx.beginPath(); ctx.ellipse(obs.x, lineY, obs.size, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); break;
      case 'pendulum': { const anchorY = 0; ctx.strokeStyle = obsColor; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(obs.x, anchorY); ctx.lineTo(obs.x, obs.y); ctx.stroke(); ctx.fillStyle = obsColor; const bw = obs.size; const bh = (obs.pendulumLength || 120) * 0.15; ctx.fillRect(obs.x - bw / 2, obs.y - bh / 2, bw, bh); break; }
      case 'gap': { const gw = obs.gapWidth || 100; ctx.fillStyle = obsColor; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(Date.now() * 0.005); const ts = 8; ctx.beginPath(); ctx.moveTo(obs.x - gw / 2, lineY - ts); ctx.lineTo(obs.x - gw / 2 + ts, lineY); ctx.lineTo(obs.x - gw / 2, lineY + ts); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(obs.x + gw / 2, lineY - ts); ctx.lineTo(obs.x + gw / 2 - ts, lineY); ctx.lineTo(obs.x + gw / 2, lineY + ts); ctx.closePath(); ctx.fill(); break; }
      case 'ceiling_spikes': { ctx.fillStyle = obsColor; const cc = 5; const csw = 14; const csh = 35; const csx = obs.x - (cc * csw) / 2; for (let i = 0; i < cc; i++) { const x = csx + i * csw + csw / 2; ctx.beginPath(); ctx.moveTo(x - csw / 2, 0); ctx.lineTo(x, csh); ctx.lineTo(x + csw / 2, 0); ctx.closePath(); ctx.fill(); } break; }
      case 'expanding': { ctx.fillStyle = obsColor; ctx.fillRect(obs.x - obs.size / 2, lineY - obs.size, obs.size, obs.size); break; }
      case 'intermittent': { ctx.fillStyle = obsColor; ctx.fillRect(obs.x - obs.size / 2, obs.y - obs.size / 2, obs.size, obs.size); break; }
    }
    ctx.restore();
  }

  // Multiverse visual overlay
  if (state.multiverseActive && state.screen === 'playing') {
    const fadeIn = Math.min(1, (state.multiverseDuration - state.multiverseTimer) / 500);
    const fadeOut = Math.min(1, state.multiverseTimer / 500);
    const alpha = Math.min(fadeIn, fadeOut) * 0.3;
    // Draw split lines
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(canvasW / 2, 0); ctx.lineTo(canvasW / 2, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(canvasW, h / 2); ctx.stroke();
    // Draw ghost players in other quadrants
    const quadrants = [
      { x: canvasW / 4, y: h / 4 },
      { x: canvasW * 3 / 4, y: h / 4 },
      { x: canvasW / 4, y: h * 3 / 4 },
    ];
    for (let i = 0; i < 3; i++) {
      const q = quadrants[i];
      const offset = state.multiverseOffsets[i + 1] || 0;
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = skinColor;
      ctx.shadowColor = skinColor;
      ctx.shadowBlur = 10;
      const gy = state.playerTop.y + (q.y - h / 2) * 0.3;
      ctx.fillRect(q.x - PLAYER_SIZE / 2 + offset * 0.2, gy - PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
    }
    // Multiverse label
    ctx.globalAlpha = alpha * 2;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ MULTIVERSE ⚡', canvasW / 2, 18);
    // x2 indicator
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('SCORE x2', canvasW / 2, 34);
    ctx.restore();
  }

  // Coins
  for (const coin of state.coinItems) {
    if (coin.collected) continue;
    ctx.save(); ctx.shadowColor = '#facc15'; ctx.shadowBlur = 18; ctx.fillStyle = '#facc15';
    ctx.beginPath(); ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2); ctx.fill();
    const cg = ctx.createRadialGradient(coin.x - 2, coin.y - 2, 1, coin.x, coin.y, coin.radius);
    cg.addColorStop(0, 'rgba(255,255,255,0.6)'); cg.addColorStop(0.5, 'rgba(250,204,21,0.8)'); cg.addColorStop(1, '#d97706');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0f0f1a'; ctx.font = `bold ${coin.radius}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$', coin.x, coin.y + 1); ctx.restore();
  }

  // Particles
  for (const p of state.particles) {
    ctx.save(); ctx.globalAlpha = p.life / p.maxLife;
    if (p.isDeathPiece && p.width && p.height) {
      ctx.fillStyle = p.color; ctx.translate(p.x, p.y);
      if (p.angle) ctx.rotate(p.angle);
      ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
    } else {
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  if (state.activePowers.length > 0) {
    ctx.save(); ctx.font = '11px monospace'; ctx.textAlign = 'left'; let py = 80;
    for (const pow of state.activePowers) {
      const label = pow.type === 'shield' ? '🛡️ Shield' : pow.type === 'slowmo' ? '🐌 Slow-Mo' : '🧲 Magnet';
      ctx.fillStyle = 'rgba(0,255,204,0.8)'; ctx.fillText(`${label} ${Math.ceil(pow.remaining / 1000)}s`, 12, py); py += 18;
    }
    ctx.restore();
  }

  if (state.phase === 2 && state.distance < state.phaseThreshold + 100) {
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - (state.distance - state.phaseThreshold) / 100);
    ctx.fillStyle = '#a855f7'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
    ctx.fillText('PHASE 2!', canvasW / 2, 60); ctx.restore();
  }

  if (milestoneFlashTimer > 0 && state.screen === 'playing') {
    ctx.save(); ctx.globalAlpha = Math.min(1, milestoneFlashTimer); ctx.fillStyle = theme.line; ctx.shadowColor = theme.line; ctx.shadowBlur = 30;
    ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${milestoneFlashScore}m`, canvasW / 2, h / 2 - 80); ctx.restore();
  }

  // Taunt / cinematic new record
  if (state.tauntTimer > 0 && state.tauntText && state.screen === 'playing') {
    ctx.save();
    const elapsed = (state.tauntText === 'NEW RECORD' ? 2.0 : 1.5) - state.tauntTimer;
    const fadeTime = 0.3;
    let alpha = elapsed < fadeTime ? elapsed / fadeTime : state.tauntTimer < fadeTime ? state.tauntTimer / fadeTime : 1;
    const isCinematic = state.tauntText === 'NEW RECORD';
    ctx.globalAlpha = alpha * (isCinematic ? 1 : 0.85);
    ctx.fillStyle = isCinematic ? '#ffd700' : (state.tauntText.includes('RECORD') ? '#ffd700' : theme.line);
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = isCinematic ? 40 : 25;
    ctx.font = `bold ${isCinematic ? 36 : 22}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(state.tauntText, canvasW / 2, h / 2 - 40);
    ctx.restore();
  }

  // Cinematic golden vignette
  if (state.cinematicSlowMo > 0 && state.screen === 'playing') {
    const vigAlpha = Math.min(0.4, (2000 - state.cinematicSlowMo) / 1000) * Math.min(1, state.cinematicSlowMo / 500);
    ctx.save();
    const gradient = ctx.createRadialGradient(canvasW / 2, h / 2, h * 0.3, canvasW / 2, h / 2, h * 0.8);
    gradient.addColorStop(0, 'rgba(255,215,0,0)');
    gradient.addColorStop(1, `rgba(255,215,0,${vigAlpha})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasW, h);
    ctx.restore();
  }

  if (state.streak >= 10 && state.screen === 'playing') {
    ctx.save(); ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
    const badge = state.streakMultiplier >= 4 ? 'x4' : state.streakMultiplier >= 3 ? 'x3' : 'x2';
    ctx.fillStyle = state.streakMultiplier >= 4 ? '#ffd700' : state.streakMultiplier >= 3 ? '#ff69b4' : theme.line;
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
    ctx.fillText(badge, canvasW / 2 + 50, 30); ctx.restore();
  }

  if (state.disruptionTimer > 0) {
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#ff0000'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
    ctx.fillText('⚠ DISRUPTION ⚠', canvasW / 2, 20); ctx.restore();
  }

  // Darkness mode overlay
  if (state.darknessFade > 0 && state.screen === 'playing') {
    ctx.save();
    // Create darkness mask — black everywhere except around player
    const playerX = state.playerTop.x;
    const playerY = state.playerTop.y;
    const radius = 80;
    ctx.globalAlpha = state.darknessFade * 0.95;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasW, h);
    // Cut out circle around player
    ctx.globalCompositeOperation = 'destination-out';
    const grad = ctx.createRadialGradient(playerX, playerY, 0, playerX, playerY, radius);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.7, 'rgba(0,0,0,0.8)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(playerX - radius, playerY - radius, radius * 2, radius * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  // Darkness warning flicker
  if (state.darknessWarning > 0 && state.screen === 'playing') {
    const flicker = Math.sin(Date.now() * 0.02) > 0 ? 0.1 : 0;
    ctx.save(); ctx.globalAlpha = flicker; ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, canvasW, h); ctx.restore();
  }

  ctx.restore();

  ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, h, canvasW, BANNER_HEIGHT);
  if (!state.removeAds) { ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = '12px monospace'; ctx.textAlign = 'center'; ctx.fillText('ADVERTISEMENT', canvasW / 2, h + BANNER_HEIGHT / 2 + 4); }
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerR: number, innerR: number) {
  let rot = (Math.PI / 2) * 3; const step = Math.PI / spikes;
  ctx.beginPath(); ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) { ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR); rot += step; ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR); rot += step; }
  ctx.closePath(); ctx.fill();
}

export function handleInput(state: GameState): GameState {
  if (state.screen !== 'playing') return state;
  playJump();
  const pt = state.playerTop;
  if (!pt.isJumping) { pt.anticipation = 1; pt.vy = JUMP_FORCE; pt.isJumping = true; } else { pt.vy = Math.abs(JUMP_FORCE); }
  if (state.playerBottom) { const pb = state.playerBottom; if (!pb.isJumping) { pb.anticipation = 1; pb.vy = -JUMP_FORCE; pb.isJumping = true; } else { pb.vy = -Math.abs(JUMP_FORCE); } }
  // Record jump for ghost
  state.ghostFrames.push({ distance: state.distance, y: pt.y, isJumping: true });
  return state;
}
