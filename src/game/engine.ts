import { GameState, Obstacle, Coin, Particle, Player, DeathAnimation, GhostFrame, GameSettings, SpecialEvent } from './types';
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
import { playJump, playLand, playCoin, playDeath, playStreakChime, playWhoosh, updateMusicTempo, stopMusic, playMultiverseActivate, playMultiverseWarning, playAdrenalineActivate } from './audio';

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

const SPECIAL_EVENT_TYPES: SpecialEvent['type'][] = [
  'gravity_flip', 'line_rotation', 'black_white', 'mirror', 'matrix_mode',
  'invisible_floor', 'speed_surge', 'zoom_out', 'glitch'
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

let mvObstacleCounters = [0, 0, 0];
let mvLastSpawnX = [0, 0, 0];

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

function getFrequencyMultiplier(distance: number, chaosMode: boolean): number {
  let mult = 1;
  if (distance >= 2000) mult = 0.5;
  else if (distance >= 1000) mult = 0.7;
  else if (distance >= 500) mult = 0.85;
  if (chaosMode) mult *= mult; // Double the reduction (square it)
  return mult;
}

function getSpawnProfile(distance: number, runCount: number, chaosMode: boolean = false) {
  const phase = getPhase(distance);
  const freqMult = getFrequencyMultiplier(distance, chaosMode);
  
  if (runCount <= 1) return { minGap: 600, maxGap: Math.floor(700 * freqMult), maxSize: 30, speedMult: 0.85, hardChance: 0, maxBurst: 1 };
  if (runCount === 2) {
    return phase <= 2
      ? { minGap: 500, maxGap: Math.floor(600 * freqMult), maxSize: 35, speedMult: 0.95, hardChance: 0, maxBurst: 1 }
      : { minGap: 400, maxGap: Math.floor(500 * freqMult), maxSize: 40, speedMult: 1.0, hardChance: 0.05, maxBurst: 2 };
  }
  if (runCount === 3) {
    return phase <= 2
      ? { minGap: 400, maxGap: Math.floor(550 * freqMult), maxSize: 38, speedMult: 1.0, hardChance: 0.05, maxBurst: 2 }
      : { minGap: 300, maxGap: Math.floor(450 * freqMult), maxSize: 45, speedMult: 1.2, hardChance: 0.15, maxBurst: 3 };
  }
  switch (phase) {
    case 1: return { minGap: 500, maxGap: Math.floor(700 * freqMult), maxSize: 35, speedMult: 1.0, hardChance: 0, maxBurst: 1 };
    case 2: return { minGap: 350, maxGap: Math.floor(500 * freqMult), maxSize: 40, speedMult: 1.2, hardChance: 0.1, maxBurst: 2 };
    case 3: return { minGap: 250, maxGap: Math.floor(380 * freqMult), maxSize: 50, speedMult: 1.4, hardChance: 0.2, maxBurst: 3 };
    case 4: return { minGap: 180, maxGap: Math.floor(280 * freqMult), maxSize: 50, speedMult: 1.65, hardChance: 0.3, maxBurst: 4 };
  }
}

function getObstacleSizeCap(type: Obstacle['type'], distance: number, runCount: number) {
  const jumpLimitedCap = getJumpHeight() * 0.6;
  const profile = getSpawnProfile(distance, runCount);
  const typeCap = type === 'triangle' ? Math.min(45, profile.maxSize) : Math.min(40, profile.maxSize);
  return Math.min(typeCap, jumpLimitedCap);
}

function chooseObstacleType(distance: number, mustBeEasy: boolean, runCount: number, chaosMode: boolean = false): Obstacle['type'] {
  const phase = getPhase(distance);
  if (runCount <= 1) return randomFrom(['triangle', 'diamond']);
  if (runCount === 2) {
    if (mustBeEasy || phase === 1) return randomFrom(['triangle', 'diamond']);
    return randomFrom(['triangle', 'diamond', 'spike_row', 'bouncing_ball']);
  }
  if (runCount === 3) {
    if (mustBeEasy || phase === 1) return randomFrom(['triangle', 'diamond']);
    const types: Obstacle['type'][] = ['triangle', 'circle', 'diamond', 'spike', 'star', 'spike_row', 'bouncing_ball', 'expanding', 'intermittent'];
    if (distance >= 300) types.push('gap');
    if (distance >= 400) { types.push('wall_gap'); types.push('rolling_rock'); }
    if (distance >= 500) { types.push('ceiling_spikes'); types.push('ceiling_spike_trap'); types.push('bouncing_mine'); }
    return randomFrom(types);
  }
  if (mustBeEasy || phase === 1) return randomFrom(['triangle', 'diamond']);
  if (phase === 2) {
    const types: Obstacle['type'][] = ['triangle', 'diamond', 'circle', 'star', 'expanding', 'intermittent'];
    if (distance >= 300) types.push('gap');
    if (distance >= 400) types.push('rolling_rock');
    return randomFrom(types);
  }
  const types: Obstacle['type'][] = ['triangle', 'circle', 'diamond', 'spike', 'star', 'spike_row', 'bouncing_ball', 'expanding', 'intermittent'];
  if (distance >= 300) types.push('gap');
  if (distance >= 400) { types.push('pendulum'); types.push('wall_gap'); types.push('rolling_rock'); types.push('speed_pad'); }
  if (distance >= 500) { types.push('ceiling_spikes'); types.push('ceiling_spike_trap'); types.push('bouncing_mine'); }
  if (distance >= 600) types.push('laser_beam');
  if (distance >= 700) { types.push('double_jump'); types.push('zip_zap'); types.push('shrinking_platform'); }
  if (distance >= 800) { types.push('spinning_blade'); types.push('ghost_obstacle'); }
  if (distance >= 1000) types.push('fake');
  return randomFrom(types);
}

function getObstacleSize(type: Obstacle['type'], distance: number, mustBeEasy: boolean, runCount: number) {
  const fixedTypes: Obstacle['type'][] = ['spike_row', 'bouncing_ball', 'pendulum', 'gap', 'ceiling_spikes', 'expanding', 'intermittent', 'wall_gap', 'meteor', 'spinning_blade', 'fake', 'speed_pad', 'double_jump', 'ceiling_spike_trap', 'rolling_rock', 'laser_beam', 'zip_zap', 'ghost_obstacle', 'bouncing_mine', 'shrinking_platform'];
  if (fixedTypes.includes(type)) return 30;
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
  return (obstacle.type === 'circle' || obstacle.type === 'star' || obstacle.type === 'spike_row' || obstacle.type === 'bouncing_ball' || obstacle.type === 'wall_gap' || obstacle.type === 'double_jump' || obstacle.type === 'spinning_blade' || obstacle.type === 'laser_beam' || obstacle.type === 'zip_zap') && obstacle.size >= 30;
}

function createObstacle(canvasW: number, lineY: number, isTop: boolean, distance: number, mustBeEasy: boolean, canvasH: number, runCount: number, chaosMode: boolean = false): Obstacle {
  const type = chooseObstacleType(distance, mustBeEasy, runCount, chaosMode);
  const size = getObstacleSize(type, distance, mustBeEasy, runCount);
  const spawnX = canvasW + OBSTACLE_SPAWN_X_OFFSET;
  if (type === 'spike_row') { const count = 3 + Math.floor(Math.random() * 3); return { x: spawnX, y: lineY - 12, type, size: 24, isTop: true, spikeCount: count }; }
  if (type === 'bouncing_ball') return { x: spawnX, y: lineY - 20, type, size: 18, isTop: true, bouncePhase: Math.random() * Math.PI * 2, bounceSpeed: 0.004, baseY: lineY };
  if (type === 'pendulum') { const jumpH = getJumpHeight(); const pLen = lineY - jumpH; return { x: spawnX, y: 0, type, size: 20, isTop: true, swingPhase: Math.random() * Math.PI * 2, swingSpeed: 0.003, anchorX: spawnX, pendulumLength: Math.max(60, pLen) }; }
  if (type === 'gap') { const gw = 80 + Math.random() * 40; return { x: spawnX, y: lineY, type, size: gw, isTop: true, gapWidth: gw }; }
  if (type === 'ceiling_spikes') return { x: spawnX, y: 30, type, size: 35, isTop: true };
  if (type === 'expanding') { const baseS = 12; const maxS = 28 + Math.random() * 16; return { x: spawnX, y: lineY - baseS / 2, type, size: baseS, isTop: true, expandPhase: 0, expandBaseSize: baseS, expandMaxSize: maxS }; }
  if (type === 'intermittent') return { x: spawnX, y: lineY - size / 2, type, size: 26, isTop: true, intermittentPhase: 0, intermittentVisible: true };
  if (type === 'wall_gap') {
    const gapPos = Math.random() > 0.5 ? 'top' : 'bottom';
    return { x: spawnX, y: lineY, type, size: 30, isTop: true, wallGapPosition: gapPos, wallWidth: 20 };
  }
  if (type === 'spinning_blade') return { x: spawnX, y: lineY, type, size: 30, isTop: true, bladeAngle: 0 };
  if (type === 'fake') return { x: spawnX, y: lineY - 15, type, size: 28, isTop: true, isFake: true };
  if (type === 'speed_pad') return { x: spawnX, y: lineY, type, size: 40, isTop: true, speedPadActive: true };
  if (type === 'double_jump') return { x: spawnX, y: lineY - 35, type, size: 45, isTop: true };
  // New obstacles
  if (type === 'ceiling_spike_trap') return { x: spawnX, y: 0, type, size: 30, isTop: true, meteorVy: 8 + Math.random() * 4 };
  if (type === 'rolling_rock') return { x: spawnX, y: lineY - 20, type, size: 22, isTop: true, rockSpeed: 1 + Math.random() * 2 };
  if (type === 'laser_beam') return { x: spawnX, y: lineY - 40, type, size: 30, isTop: true, laserSweepPhase: 0, laserSweepDir: 1 };
  if (type === 'zip_zap') return { x: spawnX, y: lineY - 30, type, size: 30, isTop: true };
  if (type === 'ghost_obstacle') return { x: spawnX, y: lineY - 15, type, size: 28, isTop: true, ghostSolid: Math.random() > 0.5, ghostPhase: 0 };
  if (type === 'bouncing_mine') return { x: spawnX, y: lineY - 15, type, size: 12, isTop: true, bouncePhase: Math.random() * Math.PI * 2, mineVy: -3 - Math.random() * 3, mineVx: 0 };
  if (type === 'shrinking_platform') return { x: spawnX, y: lineY, type, size: 60, isTop: true, shrinkAmount: 0 };
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

function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem('gameSettings');
    if (raw) return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch {}
  return defaultSettings();
}

function defaultSettings(): GameSettings {
  return {
    masterVolume: 1, musicEnabled: true, sfxEnabled: true, particlesEnabled: true,
    screenShakeEnabled: true, bgAnimEnabled: true, showDistance: true, showStreak: true,
    showAdrenaline: true, controlSensitivity: 'normal', dailyNotifications: true,
    seasonAlerts: true, playerName: 'Runner',
  };
}

export function createInitialState(): GameState {
  const runCount = getRunCount();
  const settings = loadSettings();
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
    equippedJump: localStorage.getItem('equippedJump') || '',
    equippedBackground: localStorage.getItem('equippedBackground') || '',
    equippedFloor: localStorage.getItem('equippedFloor') || '',
    screenShake: 0, coinFlash: 0, streak: 0, streakMultiplier: 1,
    tauntText: '', tauntTimer: 0, shownTaunts: new Set(), newRecordShown: false,
    ...defaultExtraState(),
    runCount,
    ghostMode: false, ghostFrames: [], bestGhostFrames: loadBestGhost(), ghostIndex: 0,
    adrenaline: 0, adrenalineActive: false, adrenalineTimer: 0, lastDodgeTime: 0,
    cinematicSlowMo: 0, cinematicTriggered: false,
    multiverseActive: false, multiverseTimer: 0, multiverseDuration: 0,
    nextMultiverseAt: 300 + Math.random() * 200,
    multiverseOffsets: [0, 80, -60, 40],
    multiverseTextTimer: 0, multiverseMergeTimer: 0,
    multiverseObstacles: [[], [], []], multiverseCount: 0, multiverseWarningTimer: 0,
    floorWaveTimer: 0, floorWavePhase: 0, nextFloorWaveAt: 300 + Math.random() * 100,
    meteorShowerTimer: 0, nextMeteorAt: 500 + Math.random() * 100,
    tunnelTimer: 0, nextTunnelAt: 600 + Math.random() * 100, tunnelAmount: 0,
    speedBoostTimer: 0, speedBoostSlowTimer: 0,
    chaosMode: false, chaosUnlocked: localStorage.getItem('chaosUnlocked') === 'true',
    settings,
    specialEvent: null,
    nextSpecialEventAt: 300 + Math.random() * 200,
    lastSpecialEventDist: 0,
    chaosObstacleStormTimer: 0, chaosMirrorFlipTimer: 0,
    chaosSpeedSpikeTimer: 0, chaosInvisibleFloorTimer: 0,
    nextChaosEventAt: 300, chaosFlickerTimer: 0,
    dyingTimer: 0, invincibleTimer: 0,
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
    ghostFrames: [], bestGhostFrames: loadBestGhost(), ghostIndex: 0,
    adrenaline: 0, adrenalineActive: false, adrenalineTimer: 0, lastDodgeTime: 0,
    cinematicSlowMo: 0, cinematicTriggered: false,
    multiverseActive: false, multiverseTimer: 0, multiverseDuration: 0,
    nextMultiverseAt: state.chaosMode ? (150 + Math.random() * 100) : (300 + Math.random() * 200),
    multiverseOffsets: [0, 60 + Math.random() * 60, -(60 + Math.random() * 60), 30 + Math.random() * 50],
    multiverseTextTimer: 0, multiverseMergeTimer: 0,
    multiverseObstacles: [[], [], []], multiverseCount: 0, multiverseWarningTimer: 0,
    floorWaveTimer: 0, floorWavePhase: 0, nextFloorWaveAt: 300 + Math.random() * 100,
    meteorShowerTimer: 0, nextMeteorAt: 500 + Math.random() * 100,
    tunnelTimer: 0, nextTunnelAt: 600 + Math.random() * 100, tunnelAmount: 0,
    speedBoostTimer: 0, speedBoostSlowTimer: 0,
    specialEvent: null,
    nextSpecialEventAt: 300 + Math.random() * 200,
    lastSpecialEventDist: 0,
    chaosObstacleStormTimer: 0, chaosMirrorFlipTimer: 0,
    chaosSpeedSpikeTimer: 0, chaosInvisibleFloorTimer: 0,
    nextChaosEventAt: 300, chaosFlickerTimer: 0,
    dyingTimer: 0, invincibleTimer: 0,
  };
}

function addParticles(particles: Particle[], x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 1, maxLife: 1, color, size: 2 + Math.random() * 3 });
}

function addTrailParticle(particles: Particle[], p: Player, color: string, trailType: string) {
  let pc = color; let sz = 1.5 + Math.random() * 2; let vxMod = -1 - Math.random(); let vyMod = (Math.random() - 0.5) * 0.5; let life = 0.6;
  switch (trailType) {
    case 'trail_fire': pc = randomFrom(['#ff4400', '#ff8800', '#ffcc00']); sz = 2 + Math.random() * 3; life = 0.4; break;
    case 'trail_ice': pc = randomFrom(['#88ddff', '#aaeeff', '#ffffff']); sz = 1.5 + Math.random() * 2; break;
    case 'trail_electric': pc = randomFrom(['#00ffff', '#88ffff', '#ffff00']); vxMod = -2 - Math.random() * 2; vyMod = (Math.random() - 0.5) * 3; sz = 1 + Math.random() * 2; life = 0.3; break;
    case 'trail_bubble': pc = randomFrom(['#88ccff', '#aaddff', '#cceeFF']); sz = 3 + Math.random() * 3; vyMod = -0.5 - Math.random() * 0.5; life = 0.8; break;
    case 'trail_star': pc = randomFrom(['#ffdd00', '#ffaa00', '#ffffff']); sz = 2 + Math.random() * 2; break;
    case 'trail_smoke': pc = randomFrom(['#666666', '#888888', '#aaaaaa']); sz = 3 + Math.random() * 4; life = 0.8; vyMod = -0.3 - Math.random() * 0.3; break;
  }
  particles.push({ x: p.x - p.size / 2 - 2, y: p.y + (Math.random() - 0.5) * p.size * 0.5, vx: vxMod, vy: vyMod, life, maxLife: life, color: pc, size: sz });
}

function addJumpEffect(particles: Particle[], p: Player, jumpType: string) {
  switch (jumpType) {
    case 'jump_rings':
      for (let i = 0; i < 12; i++) { const angle = (i / 12) * Math.PI * 2; particles.push({ x: p.x + Math.cos(angle) * 15, y: p.y + Math.sin(angle) * 15, vx: Math.cos(angle) * 2, vy: Math.sin(angle) * 2, life: 0.5, maxLife: 0.5, color: '#00ffcc', size: 2 }); }
      break;
    case 'jump_cloud':
      for (let i = 0; i < 6; i++) { particles.push({ x: p.x + (Math.random() - 0.5) * 20, y: p.y + p.size / 2, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 1, life: 0.6, maxLife: 0.6, color: '#cccccc', size: 4 + Math.random() * 4 }); }
      break;
    case 'jump_spark':
      for (let i = 0; i < 8; i++) { particles.push({ x: p.x, y: p.y + p.size / 2, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 3, life: 0.3, maxLife: 0.3, color: randomFrom(['#ffdd00', '#ff8800', '#ffffff']), size: 1.5 + Math.random() * 2 }); }
      break;
    case 'jump_shockwave':
      for (let i = 0; i < 16; i++) { const angle = (i / 16) * Math.PI * 2; particles.push({ x: p.x + Math.cos(angle) * 10, y: p.y + Math.sin(angle) * 10, vx: Math.cos(angle) * 4, vy: Math.sin(angle) * 4, life: 0.3, maxLife: 0.3, color: '#88ccff', size: 2 }); }
      break;
  }
}

function addDeathEffect(particles: Particle[], x: number, y: number, color: string, deathType: string) {
  switch (deathType) {
    case 'death_confetti':
      for (let i = 0; i < 30; i++) { particles.push({ x, y, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, life: 1.5, maxLife: 1.5, color: randomFrom(['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']), size: 3 + Math.random() * 3 }); }
      break;
    case 'death_nuclear':
      for (let i = 0; i < 40; i++) { const angle = (i / 40) * Math.PI * 2; const speed = 3 + Math.random() * 5; particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.5, maxLife: 1.5, color: randomFrom(['#ff4400', '#ff8800', '#ffcc00', '#ffffff']), size: 2 + Math.random() * 4 }); }
      break;
    case 'death_diamond':
      for (let i = 0; i < 20; i++) { particles.push({ x, y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, life: 1.2, maxLife: 1.2, color: randomFrom(['#88ddff', '#aaeeff', '#ffffff', '#ccddff']), size: 3 + Math.random() * 3, isDeathPiece: true, width: 6, height: 6, rotationSpeed: (Math.random() - 0.5) * 8, angle: Math.random() * Math.PI * 2 }); }
      break;
    case 'death_firerain':
      for (let i = 0; i < 25; i++) { particles.push({ x: x + (Math.random() - 0.5) * 60, y: y - 50 - Math.random() * 100, vx: (Math.random() - 0.5) * 2, vy: 3 + Math.random() * 5, life: 1.5, maxLife: 1.5, color: randomFrom(['#ff4400', '#ff8800', '#ffcc00']), size: 2 + Math.random() * 3 }); }
      break;
  }
}

function addLandingParticles(particles: Particle[], p: Player, lineY: number, color: string) {
  for (let i = 0; i < 8; i++) particles.push({ x: p.x + (Math.random() - 0.5) * p.size, y: lineY, vx: (Math.random() - 0.5) * 4, vy: p.isAboveLine ? -(Math.random() * 2) : Math.random() * 2, life: 0.5, maxLife: 0.5, color, size: 1.5 + Math.random() * 2 });
}

function checkCollision(player: Player, obs: Obstacle, lineY: number): boolean {
  if (obs.type === 'fake') return false;
  if (obs.type === 'ghost_obstacle' && !obs.ghostSolid) return false;
  if (obs.type === 'speed_pad') {
    const dx = Math.abs(player.x - obs.x);
    return dx < (player.size / 2 + obs.size / 2) * 0.85 && !player.isJumping;
  }
  if (obs.type === 'shrinking_platform') return false; // Non-lethal
  const shrink = 0.85;
  if (obs.type === 'gap') { const gw = obs.gapWidth || 100; return player.x > obs.x - gw / 2 && player.x < obs.x + gw / 2 && !player.isJumping; }
  if (obs.type === 'intermittent' && !obs.intermittentVisible) return false;
  if (obs.type === 'spike_row') { const totalWidth = (obs.spikeCount || 3) * 16; const dx = Math.abs(player.x - obs.x); const dy = Math.abs(player.y - obs.y); return dx < (player.size / 2 + totalWidth / 2) * shrink && dy < (player.size / 2 + obs.size / 2) * shrink; }
  if (obs.type === 'bouncing_ball' || obs.type === 'rolling_rock') { const dx = player.x - obs.x; const dy = player.y - obs.y; return Math.sqrt(dx * dx + dy * dy) < (player.size / 2 + obs.size / 2) * shrink; }
  if (obs.type === 'bouncing_mine') { const dx = player.x - obs.x; const dy = player.y - obs.y; return Math.sqrt(dx * dx + dy * dy) < (player.size / 2 + obs.size / 2) * shrink; }
  if (obs.type === 'pendulum') { const bh = (obs.pendulumLength || 120) * 0.15; const dx = Math.abs(player.x - obs.x); const dy = Math.abs(player.y - obs.y); return dx < (player.size / 2 + obs.size / 2) * shrink && dy < (player.size / 2 + bh / 2) * shrink; }
  if (obs.type === 'ceiling_spikes' || obs.type === 'ceiling_spike_trap') { const dx = Math.abs(player.x - obs.x); const dy = Math.abs(player.y - obs.y); return dx < (player.size / 2 + obs.size / 2) * shrink && dy < (player.size / 2 + 20) * shrink; }
  if (obs.type === 'expanding') { const s = obs.size; const dx = Math.abs(player.x - obs.x); const dy = Math.abs(player.y - (lineY - s / 2)); return dx < (player.size / 2 + s / 2) * shrink && dy < (player.size / 2 + s / 2) * shrink; }
  if (obs.type === 'wall_gap') {
    const ww = obs.wallWidth || 20;
    const dx = Math.abs(player.x - obs.x);
    if (dx > (player.size / 2 + ww / 2) * shrink) return false;
    if (obs.wallGapPosition === 'bottom') return player.isJumping;
    else return !player.isJumping;
  }
  if (obs.type === 'meteor') { const dx = player.x - obs.x; const dy = player.y - obs.y; return Math.sqrt(dx * dx + dy * dy) < (player.size / 2 + obs.size / 2) * shrink; }
  if (obs.type === 'spinning_blade') {
    const bladeRadius = 25; const angle = obs.bladeAngle || 0;
    const tipX = obs.x + Math.cos(angle) * bladeRadius; const tipY = (lineY - 15) + Math.sin(angle) * bladeRadius;
    const dx = player.x - tipX; const dy = player.y - tipY;
    if (Math.sqrt(dx * dx + dy * dy) < (player.size / 2 + 8) * shrink) return true;
    const tipX2 = obs.x + Math.cos(angle + Math.PI) * bladeRadius; const tipY2 = (lineY - 15) + Math.sin(angle + Math.PI) * bladeRadius;
    const dx2 = player.x - tipX2; const dy2 = player.y - tipY2;
    return Math.sqrt(dx2 * dx2 + dy2 * dy2) < (player.size / 2 + 8) * shrink;
  }
  if (obs.type === 'double_jump') { const dx = Math.abs(player.x - obs.x); const dy = Math.abs(player.y - obs.y); return dx < (player.size / 2 + 15) * shrink && dy < (player.size / 2 + obs.size / 2) * shrink; }
  if (obs.type === 'laser_beam') {
    // Laser is a horizontal beam sweeping vertically
    const beamY = obs.y + Math.sin(obs.laserSweepPhase || 0) * 60;
    const dy = Math.abs(player.y - beamY);
    const dx = Math.abs(player.x - obs.x);
    return dx < 100 && dy < (player.size / 2 + 4) * shrink;
  }
  if (obs.type === 'zip_zap') {
    // Two obstacles stacked with small gap
    const gapCenter = obs.y;
    const gapHalf = PLAYER_SIZE * 0.8;
    const dx = Math.abs(player.x - obs.x);
    if (dx > (player.size / 2 + 15) * shrink) return false;
    return Math.abs(player.y - gapCenter) > gapHalf;
  }
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
    case 'bouncing_ball': case 'rolling_rock': return 'ball_flatten';
    case 'spike_row': case 'spike': case 'ceiling_spikes': case 'expanding': case 'intermittent': case 'wall_gap': case 'meteor': case 'spinning_blade': case 'double_jump': case 'ceiling_spike_trap': case 'laser_beam': case 'zip_zap': case 'ghost_obstacle': case 'bouncing_mine': return 'spike_shatter';
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
    case 'circle_bounce': particles.push({ x, y, vx: -3, vy: -5, life: 2, maxLife: 2, color, size, isDeathPiece: true, width: size, height: size, rotationSpeed: 0, angle: 0 }); break;
    case 'ball_flatten': particles.push({ x, y, vx: 0, vy: 0, life: 1, maxLife: 1, color, size, isDeathPiece: true, width: size * 2, height: 2, rotationSpeed: 0, angle: 0 }); break;
    case 'spike_shatter':
      for (let i = 0; i < 12; i++) { particles.push({ x: x + (Math.random() - 0.5) * size, y: y + (Math.random() - 0.5) * size, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, life: 1.2, maxLife: 1.2, color, size: 3 + Math.random() * 4, isDeathPiece: true, width: 4, height: 4, rotationSpeed: (Math.random() - 0.5) * 10, angle: Math.random() * Math.PI * 2 }); }
      break;
    case 'gap_fall': particles.push({ x, y, vx: 0, vy: 8, life: 2, maxLife: 2, color, size, isDeathPiece: true, width: size, height: size, rotationSpeed: 2, angle: 0 }); break;
    default: break;
  }
}

export function resetSpawners() {
  frameCount = 0; forceEasyFollowUp = false; nextPhase2ObstacleOnTop = true; isFirstObstacle = true;
  lastMilestone = 0; milestoneFlashTimer = 0; milestoneFlashScore = 0; patternCount = 0; patternGapPending = false;
  passedObstacleIds.clear(); obstacleIdCounter = 0; prevStreakMult = 1;
  mvObstacleCounters = [0, 0, 0]; mvLastSpawnX = [0, 0, 0];
}

function handleDeath(state: GameState, p: Player, skinColor: string, _lineY: number, obsType: Obstacle['type']) {
  if (state.dyingTimer > 0) return; // already dying
  const deathType = getDeathType(obsType);
  addDeathParticles(state.particles, deathType, p.x, p.y, skinColor, p.size);
  if (state.equippedDeath) addDeathEffect(state.particles, p.x, p.y, skinColor, state.equippedDeath);
  if (state.playerBottom) addParticles(state.particles, state.playerBottom.x, state.playerBottom.y, skinColor, 30);
  state.deathAnim = { type: deathType, timer: 1.5, x: p.x, y: p.y, color: skinColor };
  state.screenShake = 1.2;
  // Stay in 'playing' for 1.5s of death animation; gameover triggered by dyingTimer reaching 0
  state.dyingTimer = 1500;
  state.streak = 0; state.streakMultiplier = 1;
  const distCoins = Math.floor(state.distance / 10 * 0.4); // 60% reduction
  state.coins += distCoins; state.totalCoins += distCoins;
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    localStorage.setItem('bestScore', String(state.bestScore));
    saveBestGhost(state.ghostFrames);
  }
  localStorage.setItem('coins', String(state.totalCoins));
  passedObstacleIds.clear();
  playDeath(); stopMusic();
}

export function activateAdrenaline(state: GameState): GameState {
  if (state.adrenaline < 100 || state.adrenalineActive) return state;
  state.adrenalineActive = true; state.adrenalineTimer = 3000; state.adrenaline = 0;
  playAdrenalineActivate();
  return state;
}

export function update(state: GameState, canvasW: number, canvasH: number, dt: number): GameState {
  if (state.screen !== 'playing') return state;

  // Death freeze: play out death anim before transitioning to gameover
  if (state.dyingTimer > 0) {
    state.dyingTimer = Math.max(0, state.dyingTimer - dt);
    // Tick particles only so the death effect animates
    if (state.settings.particlesEnabled) {
      state.particles = state.particles.map(p => {
        const np = { ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 0.02 };
        if (p.isDeathPiece) { np.vy = (np.vy || 0) + 0.15; if (p.angle !== undefined && p.rotationSpeed) np.angle = p.angle + p.rotationSpeed * 0.016; }
        return np;
      }).filter(p => p.life > 0);
    }
    if (state.screenShake > 0) state.screenShake = Math.max(0, state.screenShake - dt * 0.005);
    if (state.dyingTimer <= 0) {
      (state as any).screen = 'gameover';
    }
    return state;
  }

  // Tick post-revive invincibility
  if (state.invincibleTimer > 0) state.invincibleTimer = Math.max(0, state.invincibleTimer - dt);

  const baseLineY = (canvasH - BANNER_HEIGHT) / 2;
  let lineY = baseLineY;
  if (state.floorWaveTimer > 0) lineY = baseLineY + Math.sin(state.floorWavePhase) * 30;
  // Special event: gravity flip adjusts lineY conceptually but we handle it in rendering
  const hasGravityFlip = state.specialEvent?.type === 'gravity_flip';

  frameCount++;
  state.audioEvents = [];
  const runCount = state.runCount;

  const spawnProfile = getSpawnProfile(state.distance, runCount, state.chaosMode);
  let speedMult = spawnProfile.speedMult;
  if (state.chaosMode) speedMult *= 1.2;
  state.speed = Math.min(MAX_SPEED, state.baseSpeed * speedMult + state.distance * SPEED_INCREMENT * (state.chaosMode ? 0.5 : 0.3));
  updateMusicTempo(speedMult);

  let effectiveSpeed = state.speed;
  const slowmo = state.activePowers.find(p => p.type === 'slowmo');
  if (slowmo) effectiveSpeed *= 0.5;
  if (state.adrenalineActive) effectiveSpeed *= 0.5;
  if (state.cinematicSlowMo > 0) effectiveSpeed *= 0.5;
  if (state.speedBoostTimer > 0) effectiveSpeed *= 1.5;
  if (state.speedBoostSlowTimer > 0) effectiveSpeed *= 0.7;
  // Special event speed surge
  if (state.specialEvent?.type === 'speed_surge') effectiveSpeed *= 2;
  // Chaos speed spike
  if (state.chaosSpeedSpikeTimer > 0) effectiveSpeed *= 2;

  state.activePowers = state.activePowers.map(p => ({ ...p, remaining: p.remaining - dt })).filter(p => p.remaining > 0);
  state.distance += effectiveSpeed * 0.1;
  state.score = Math.floor(state.distance);

  // Speed boost timers
  if (state.speedBoostTimer > 0) { state.speedBoostTimer = Math.max(0, state.speedBoostTimer - dt); if (state.speedBoostTimer <= 0) state.speedBoostSlowTimer = 1000; }
  if (state.speedBoostSlowTimer > 0) state.speedBoostSlowTimer = Math.max(0, state.speedBoostSlowTimer - dt);

  // Adrenaline timer
  if (state.adrenalineActive) { state.adrenalineTimer = Math.max(0, state.adrenalineTimer - dt); if (state.adrenalineTimer <= 0) state.adrenalineActive = false; }
  if (!state.adrenalineActive && state.adrenaline > 0) {
    const timeSinceDodge = Date.now() - state.lastDodgeTime;
    if (timeSinceDodge > 3000) state.adrenaline = Math.max(0, state.adrenaline - dt * 0.01);
  }

  // Cinematic slow-mo
  if (state.cinematicSlowMo > 0) state.cinematicSlowMo = Math.max(0, state.cinematicSlowMo - dt);
  if (state.score > state.bestScore && !state.cinematicTriggered) {
    state.cinematicTriggered = true; state.cinematicSlowMo = 2000;
    state.tauntText = 'NEW RECORD'; state.tauntTimer = 2.0;
    state.newRecordShown = true; playWhoosh();
  }

  // === SPECIAL EVENTS ===
  if (state.distance >= state.nextSpecialEventAt && !state.specialEvent && !state.multiverseActive) {
    const minGap = state.chaosMode ? 150 : 300;
    if (state.distance - state.lastSpecialEventDist >= minGap) {
      const eventType = randomFrom(SPECIAL_EVENT_TYPES);
      let duration = 0;
      switch (eventType) {
        case 'gravity_flip': duration = 5000; break;
        case 'line_rotation': duration = 4000; break;
        case 'black_white': duration = state.chaosMode ? 20000 : 15000; break;
        case 'mirror': duration = state.chaosMode ? 12000 : 8000; break;
        case 'matrix_mode': duration = state.chaosMode ? 15000 : 10000; break;
        case 'invisible_floor': duration = state.chaosMode ? 9000 : 6000; break;
        case 'speed_surge': duration = state.chaosMode ? 6000 : 4000; break;
        case 'zoom_out': duration = state.chaosMode ? 12000 : 8000; break;
        case 'glitch': duration = state.chaosMode ? 5000 : 3000; break;
        default: duration = 5000;
      }
      state.specialEvent = { type: eventType, timer: duration, duration };
      state.lastSpecialEventDist = state.distance;
      state.tauntText = `⚡ ${eventType.toUpperCase().replace('_', ' ')}`;
      state.tauntTimer = 1.0;
    }
  }
  if (state.specialEvent) {
    state.specialEvent.timer -= dt;
    if (state.specialEvent.timer <= 0) {
      state.specialEvent = null;
      state.nextSpecialEventAt = state.distance + (state.chaosMode ? 100 + Math.random() * 150 : 200 + Math.random() * 300);
    }
  }

  // Chaos-specific timers
  if (state.chaosMode) {
    if (state.chaosSpeedSpikeTimer > 0) state.chaosSpeedSpikeTimer = Math.max(0, state.chaosSpeedSpikeTimer - dt);
    if (state.chaosInvisibleFloorTimer > 0) state.chaosInvisibleFloorTimer = Math.max(0, state.chaosInvisibleFloorTimer - dt);
    if (state.chaosMirrorFlipTimer > 0) state.chaosMirrorFlipTimer = Math.max(0, state.chaosMirrorFlipTimer - dt);
    if (state.chaosObstacleStormTimer > 0) state.chaosObstacleStormTimer = Math.max(0, state.chaosObstacleStormTimer - dt);
    // Chaos bg flicker
    state.chaosFlickerTimer -= dt;
    if (state.chaosFlickerTimer <= 0) state.chaosFlickerTimer = 500 + Math.random() * 2000;
  }

  // === EVENTS ===

  // Floor wave event (after 300m)
  if (state.distance >= state.nextFloorWaveAt && state.floorWaveTimer <= 0 && !state.multiverseActive) {
    state.floorWaveTimer = 3000; state.floorWavePhase = 0;
  }
  if (state.floorWaveTimer > 0) {
    state.floorWaveTimer -= dt; state.floorWavePhase += dt * 0.005;
    if (state.floorWaveTimer <= 0) { state.floorWaveTimer = 0; state.nextFloorWaveAt = state.distance + 200 + Math.random() * 200; }
  }

  // Meteor shower (after 500m)
  if (state.distance >= state.nextMeteorAt && state.meteorShowerTimer <= 0 && !state.multiverseActive) state.meteorShowerTimer = 3000;
  if (state.meteorShowerTimer > 0) {
    state.meteorShowerTimer -= dt;
    if (Math.random() < 0.08) state.obstacles.push({ x: Math.random() * canvasW, y: -20, type: 'meteor', size: 12 + Math.random() * 10, isTop: true, meteorVy: 3 + Math.random() * 3 });
    if (state.meteorShowerTimer <= 0) { state.meteorShowerTimer = 0; state.nextMeteorAt = state.distance + 300 + Math.random() * 200; }
  }

  // Tunnel (after 600m)
  if (state.distance >= state.nextTunnelAt && state.tunnelTimer <= 0 && !state.multiverseActive) { state.tunnelTimer = 2000; state.tunnelAmount = 0; }
  if (state.tunnelTimer > 0) {
    state.tunnelTimer -= dt;
    const progress = 1 - state.tunnelTimer / 2000;
    if (progress < 0.2) state.tunnelAmount = progress / 0.2;
    else if (progress > 0.8) state.tunnelAmount = (1 - progress) / 0.2;
    else state.tunnelAmount = 1;
    if (state.tunnelAmount > 0.5 && state.playerTop.isJumping) {
      const ceilingY = lineY - PLAYER_SIZE * 1.5 * (1 - state.tunnelAmount * 0.6);
      if (state.playerTop.y < ceilingY) {
        const skinColor = SKIN_COLORS[state.equippedSkin] || '#00ffcc';
        handleDeath(state, state.playerTop, skinColor, lineY, 'ceiling_spikes');
        return state;
      }
    }
    if (state.tunnelTimer <= 0) { state.tunnelTimer = 0; state.tunnelAmount = 0; state.nextTunnelAt = state.distance + 300 + Math.random() * 200; }
  }

  // Multiverse warning + activation
  if (state.distance >= state.nextMultiverseAt && !state.multiverseActive && state.multiverseMergeTimer <= 0 && state.multiverseWarningTimer <= 0) {
    const warningDur = state.chaosMode ? 1000 : 3000;
    state.multiverseWarningTimer = warningDur;
    playMultiverseWarning();
  }
  if (state.multiverseWarningTimer > 0) {
    state.multiverseWarningTimer -= dt;
    if (state.settings.screenShakeEnabled) state.screenShake = Math.max(state.screenShake, 0.3);
    if (state.multiverseWarningTimer <= 0) {
      state.multiverseActive = true;
      const baseDur = state.chaosMode ? 15000 : 10000;
      const extraDur = state.chaosMode ? 15000 : 10000;
      state.multiverseDuration = baseDur + Math.random() * extraDur;
      state.multiverseTimer = state.multiverseDuration;
      state.multiverseOffsets = [0, 60 + Math.random() * 80, -(50 + Math.random() * 70), 30 + Math.random() * 60];
      state.multiverseTextTimer = 1000;
      state.multiverseObstacles = [[], [], []];
      mvObstacleCounters = [0, 0, 0];
      mvLastSpawnX = [canvasW, canvasW, canvasW];
      state.multiverseCount++;
      playMultiverseActivate();
    }
  }
  if (state.multiverseTextTimer > 0) state.multiverseTextTimer = Math.max(0, state.multiverseTextTimer - dt);
  if (state.multiverseActive) {
    state.multiverseTimer -= dt;

    // In normal mode: all quadrants use main obstacles (identical)
    // In chaos mode: fully independent obstacles
    if (state.chaosMode) {
      for (let qi = 0; qi < 3; qi++) {
        const qObs = state.multiverseObstacles[qi];
        const visCount = qObs.filter(o => o.x > -60 && o.x < canvasW + 60).length;
        if (visCount < MAX_VISIBLE_OBSTACLES) {
          const minGap = spawnProfile.minGap;
          const rightmost = qObs.length > 0 ? Math.max(...qObs.map(o => o.x + o.size / 2)) : 0;
          const spawnX = canvasW + OBSTACLE_SPAWN_X_OFFSET;
          if (qObs.length === 0 || rightmost <= spawnX - minGap) {
            const obs = createObstacle(canvasW, baseLineY, true, state.distance, false, canvasH, runCount, true);
            qObs.push(obs);
          }
        }
        // Move with slightly different speeds in chaos
        const qSpeed = effectiveSpeed * (1 + (qi - 1) * 0.1);
        for (const o of qObs) {
          if (o.type === 'pendulum' && o.anchorX !== undefined) o.anchorX -= qSpeed;
          else if (o.type !== 'meteor') o.x -= qSpeed;
        }
        state.multiverseObstacles[qi] = qObs.filter(o => o.x > -120);
      }
    }

    // Collision check for multiverse obstacles (chaos mode)
    if (state.chaosMode) {
      const skinColor = SKIN_COLORS[state.equippedSkin] || '#00ffcc';
      for (let qi = 0; qi < 3; qi++) {
        for (const obs of state.multiverseObstacles[qi]) {
          if (obs.type === 'fake' || obs.type === 'speed_pad') continue;
          if (checkCollision(state.playerTop, obs, baseLineY)) {
            if (state.invincibleTimer > 0) { state.multiverseObstacles[qi] = state.multiverseObstacles[qi].filter(o => o !== obs); }
            else if (state.hasShield) { state.hasShield = false; state.multiverseObstacles[qi] = state.multiverseObstacles[qi].filter(o => o !== obs); }
            else { handleDeath(state, state.playerTop, skinColor, baseLineY, obs.type); return state; }
          }
        }
      }
    }

    if (state.multiverseTimer <= 0) {
      state.multiverseActive = false;
      state.multiverseMergeTimer = 500;
      const nextDist = state.chaosMode ? (state.distance + 200 + Math.random() * 200) : (state.distance + 300 + Math.random() * 300);
      state.nextMultiverseAt = nextDist;
      state.multiverseObstacles = [[], [], []];
    }
  }
  if (state.multiverseMergeTimer > 0) state.multiverseMergeTimer = Math.max(0, state.multiverseMergeTimer - dt);

  // Record ghost frame
  if (frameCount % 3 === 0) state.ghostFrames.push({ distance: state.distance, y: state.playerTop.y, isJumping: state.playerTop.isJumping });

  // Color shift
  const colorShiftInterval = state.chaosMode ? 100 : 200;
  const colorIdx = Math.floor(state.distance / colorShiftInterval) % COLOR_THEMES.length;
  if (colorIdx !== state.colorShiftIndex) {
    if (state.lastColorShiftAt !== colorIdx) { state.lastColorShiftAt = colorIdx; state.colorShiftTransition = 0; }
    state.colorShiftIndex = colorIdx;
  }
  if (state.colorShiftTransition < 1) state.colorShiftTransition = Math.min(1, state.colorShiftTransition + dt / 2000);

  // Visual disruption
  const disruptInterval = state.chaosMode ? 300 : 500;
  const disruptIdx = Math.floor(state.distance / disruptInterval);
  if (disruptIdx > 0 && disruptIdx !== state.lastDisruptionAt && state.disruptionTimer <= 0) {
    state.lastDisruptionAt = disruptIdx;
    state.disruptionType = ((disruptIdx - 1) % 3) + 1;
    state.disruptionTimer = 3;
  }
  if (state.disruptionTimer > 0) { state.disruptionTimer = Math.max(0, state.disruptionTimer - dt / 1000); if (state.disruptionTimer <= 0) state.disruptionType = 0; }

  // Taunts
  if (state.cinematicSlowMo <= 0) {
    for (const [dist, msg] of Object.entries(TAUNT_MESSAGES)) {
      const d = parseInt(dist);
      if (state.distance >= d && !state.shownTaunts.has(d)) { state.shownTaunts.add(d); state.tauntText = msg; state.tauntTimer = 1.5; playWhoosh(); }
    }
  }
  if (state.tauntTimer > 0) state.tauntTimer = Math.max(0, state.tauntTimer - dt / 1000);

  const currentMilestone = Math.floor(state.distance / 100) * 100;
  if (currentMilestone > lastMilestone && currentMilestone > 0) { lastMilestone = currentMilestone; milestoneFlashTimer = 1.5; milestoneFlashScore = currentMilestone; }
  if (milestoneFlashTimer > 0) milestoneFlashTimer = Math.max(0, milestoneFlashTimer - dt / 1000);
  if (state.screenShake > 0 && state.settings.screenShakeEnabled) state.screenShake = Math.max(0, state.screenShake - dt * 0.01);
  else if (!state.settings.screenShakeEnabled) state.screenShake = 0;
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
  if (!ptWasJumping && pt.isJumping && state.equippedJump && state.settings.particlesEnabled) addJumpEffect(state.particles, pt, state.equippedJump);
  updatePlayerAnim(pt, dt);
  if (frameCount % 3 === 0 && state.settings.particlesEnabled) addTrailParticle(state.particles, pt, skinColor, state.equippedTrail);

  if (state.playerBottom) {
    const pb = state.playerBottom;
    const pbWas = pb.isJumping;
    if (pb.isJumping) { pb.vy -= GRAVITY; pb.y += pb.vy; if (pb.y <= lineY + PLAYER_SIZE / 2) { pb.y = lineY + PLAYER_SIZE / 2; pb.vy = 0; pb.isJumping = false; } }
    else pb.y = lineY + PLAYER_SIZE / 2;
    if (pbWas && !pb.isJumping) { pb.landTimer = 100; pb.rotation = 0; addLandingParticles(state.particles, pb, lineY, skinColor); }
    if (!pbWas && pb.isJumping && state.equippedJump && state.settings.particlesEnabled) addJumpEffect(state.particles, pb, state.equippedJump);
    updatePlayerAnim(pb, dt);
    if (frameCount % 3 === 0 && state.settings.particlesEnabled) addTrailParticle(state.particles, pb, skinColor, state.equippedTrail);
  }

  // Update obstacles
  for (const obs of state.obstacles) {
    if (obs.type === 'bouncing_ball' && obs.bouncePhase !== undefined && obs.baseY !== undefined) { obs.bouncePhase += (obs.bounceSpeed || 0.004) * dt; obs.y = obs.baseY - Math.abs(Math.sin(obs.bouncePhase)) * canvasH * 0.5; }
    if (obs.type === 'pendulum' && obs.swingPhase !== undefined && obs.anchorX !== undefined) { obs.swingPhase += (obs.swingSpeed || 0.003) * dt; const a = Math.sin(obs.swingPhase) * 0.6; const pLen = obs.pendulumLength || 120; obs.x = obs.anchorX + Math.sin(a) * pLen; obs.y = Math.cos(a) * pLen; }
    if (obs.type === 'expanding' && obs.expandBaseSize !== undefined && obs.expandMaxSize !== undefined) {
      obs.expandPhase = (obs.expandPhase || 0) + dt * 0.002;
      const t = (Math.sin(obs.expandPhase) + 1) / 2;
      obs.size = obs.expandBaseSize + t * (obs.expandMaxSize - obs.expandBaseSize);
      obs.y = lineY - obs.size / 2;
    }
    if (obs.type === 'intermittent') { obs.intermittentPhase = (obs.intermittentPhase || 0) + dt; if (obs.intermittentPhase >= 800) { obs.intermittentPhase = 0; obs.intermittentVisible = !obs.intermittentVisible; } }
    if (obs.type === 'meteor' && obs.meteorVy) obs.y += obs.meteorVy;
    if (obs.type === 'spinning_blade') obs.bladeAngle = (obs.bladeAngle || 0) + dt * 0.005;
    if (obs.type === 'ceiling_spike_trap' && obs.meteorVy) obs.y += obs.meteorVy;
    if (obs.type === 'rolling_rock') {
      // Rolls along ground, extra speed
      const extraSpeed = obs.rockSpeed || 1;
      obs.x -= extraSpeed;
    }
    if (obs.type === 'laser_beam') obs.laserSweepPhase = (obs.laserSweepPhase || 0) + dt * 0.003;
    if (obs.type === 'ghost_obstacle') {
      obs.ghostPhase = (obs.ghostPhase || 0) + dt;
      if (obs.ghostPhase >= 1500) { obs.ghostPhase = 0; obs.ghostSolid = !obs.ghostSolid; }
    }
    if (obs.type === 'bouncing_mine') {
      obs.mineVy = (obs.mineVy || 0) + 0.15;
      obs.y += obs.mineVy;
      if (obs.y >= lineY - obs.size / 2) { obs.y = lineY - obs.size / 2; obs.mineVy = -(3 + Math.random() * 4); }
    }
    if (obs.type === 'shrinking_platform') {
      obs.shrinkAmount = Math.min(1, (obs.shrinkAmount || 0) + dt * 0.0005);
    }
  }

  // Spawning
  const visibleCount = state.obstacles.filter(o => o.x + o.size / 2 >= 0 && o.x - o.size / 2 <= canvasW && o.type !== 'meteor' && o.type !== 'ceiling_spike_trap').length;
  if (visibleCount < MAX_VISIBLE_OBSTACLES) {
    const mustBeEasy = forceEasyFollowUp || patternGapPending;
    const spawnOnTop = state.phase === 1 ? true : nextPhase2ObstacleOnTop;
    let candidate: Obstacle;
    if (isFirstObstacle) candidate = { x: canvasW + OBSTACLE_SPAWN_X_OFFSET, y: baseLineY - 15, type: 'triangle', size: 28, isTop: true };
    else candidate = createObstacle(canvasW, baseLineY, spawnOnTop, state.distance, mustBeEasy, canvasH, runCount, state.chaosMode);

    const MIN_ABSOLUTE_GAP = 350 - Math.min(150, state.distance * 0.15);
    let requiredGapPx = patternGapPending ? spawnProfile.maxGap * 1.3 : randomBetween(spawnProfile.minGap, spawnProfile.maxGap);
    requiredGapPx = Math.max(requiredGapPx, MIN_ABSOLUTE_GAP);
    if (isFirstObstacle) requiredGapPx = Math.max(requiredGapPx, SAFE_SPAWN_ZONE);
    const nonMeteors = state.obstacles.filter(o => o.type !== 'meteor' && o.type !== 'ceiling_spike_trap');
    const rightmost = nonMeteors.length > 0 ? Math.max(...nonMeteors.map(o => o.x + o.size / 2)) : state.playerTop.x - SAFE_SPAWN_ZONE;
    if (nonMeteors.length === 0 || rightmost <= candidate.x - candidate.size / 2 - requiredGapPx) {
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

  // Coin spawning — 60% reduction overall; chaos mode 50% more on top
  const coinChance = (state.chaosMode ? 0.018 : 0.012) * 0.4;
  if (state.coinItems.length < 2 && Math.random() < coinChance) { const c = spawnSafeCoin(state, canvasW, lineY); if (c) state.coinItems.push(c); }

  state.obstacles = state.obstacles.map(o => {
    if (o.type === 'pendulum' && o.anchorX !== undefined) { o.anchorX -= effectiveSpeed; return o; }
    if (o.type === 'meteor' || o.type === 'ceiling_spike_trap') return o;
    return { ...o, x: o.x - effectiveSpeed };
  }).filter(o => o.x > -120 && (o.type !== 'meteor' || o.y < canvasH + 50) && (o.type !== 'ceiling_spike_trap' || o.y < canvasH + 50));

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
      passedObstacleIds.add(oid); state.streak++;
      state.lastDodgeTime = Date.now();
      if (!state.adrenalineActive) state.adrenaline = Math.min(100, state.adrenaline + 15);
      if (state.streak >= 30) state.streakMultiplier = 4;
      else if (state.streak >= 20) state.streakMultiplier = 3;
      else if (state.streak >= 10) state.streakMultiplier = 2;
      else state.streakMultiplier = 1;
      if (state.streakMultiplier > prevStreakMult) { playStreakChime(state.streakMultiplier); prevStreakMult = state.streakMultiplier; }
    }
  }

  const mvMult = state.multiverseActive ? 2 : 1;

  for (const coin of state.coinItems) {
    if (coin.collected) continue;
    for (const p of [pt, state.playerBottom].filter(Boolean) as Player[]) {
      const dx = p.x - coin.x, dy = p.y - coin.y;
      if (Math.sqrt(dx * dx + dy * dy) < p.size / 2 + coin.radius) {
        coin.collected = true;
        const gain = state.streakMultiplier * mvMult;
        state.coins += gain; state.totalCoins += gain;
        state.coinFlash = 1; addParticles(state.particles, coin.x, coin.y, '#facc15', 16);
        playCoin();
      }
    }
  }

  // Collision check for main obstacles
  for (const obs of state.obstacles) {
    if (obs.type === 'fake') continue;
    if (obs.type === 'shrinking_platform') continue;
    if (obs.type === 'speed_pad') {
      if (checkCollision(pt, obs, lineY)) {
        state.speedBoostTimer = 2000;
        state.obstacles = state.obstacles.filter(o => o !== obs);
        addParticles(state.particles, pt.x, pt.y, '#00ff00', 10);
      }
      continue;
    }
    const allPlayers = obs.isTop ? [pt] : (state.playerBottom ? [state.playerBottom] : []);
    // For special types, check all players
    const specialTypes: Obstacle['type'][] = ['gap', 'ceiling_spikes', 'bouncing_ball', 'pendulum', 'expanding', 'intermittent', 'wall_gap', 'meteor', 'spinning_blade', 'double_jump', 'ceiling_spike_trap', 'rolling_rock', 'laser_beam', 'zip_zap', 'ghost_obstacle', 'bouncing_mine'];
    const players = specialTypes.includes(obs.type) ? [pt, state.playerBottom].filter(Boolean) as Player[] : allPlayers;
    
    for (const p of players) {
      if (checkCollision(p, obs, lineY)) {
        if (state.invincibleTimer > 0) { state.obstacles = state.obstacles.filter(o => o !== obs); addParticles(state.particles, p.x, p.y, '#ffffff', 10); }
        else if (state.hasShield) { state.hasShield = false; state.obstacles = state.obstacles.filter(o => o !== obs); addParticles(state.particles, p.x, p.y, '#00ffcc', 15); }
        else handleDeath(state, p, skinColor, lineY, obs.type);
        break;
      }
    }
    if (state.dyingTimer > 0) break;
  }

  if (state.settings.particlesEnabled) {
    state.particles = state.particles.map(p => {
      const np = { ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 0.02 };
      if (p.isDeathPiece) { np.vy = (np.vy || 0) + 0.15; if (p.angle !== undefined && p.rotationSpeed) np.angle = p.angle + p.rotationSpeed * 0.016; }
      return np;
    }).filter(p => p.life > 0);
  } else { state.particles = []; }

  return state;
}

function lerpColor(a: string, b: string, t: number): string {
  const parseHex = (h: string) => { const c = h.replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; };
  const [ar, ag, ab] = parseHex(a); const [br, bg, bb] = parseHex(b);
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
}

function getCurrentTheme(state: GameState) {
  const idx = state.colorShiftIndex;
  const prevIdx = (idx - 1 + COLOR_THEMES.length) % COLOR_THEMES.length;
  const t = state.colorShiftTransition;
  const prev = COLOR_THEMES[prevIdx]; const curr = COLOR_THEMES[idx];
  return { line: lerpColor(prev.line, curr.line, t), obstacle: lerpColor(prev.obstacle, curr.obstacle, t), bg: lerpColor(prev.bg, curr.bg, t) };
}

function getEquippedBgColor(bgId: string, theme: { bg: string }): string {
  switch (bgId) {
    case 'bg_stars': return '#0a0a1a';
    case 'bg_matrix': return '#000a00';
    case 'bg_galaxy': return '#0a0020';
    case 'bg_cyberpunk': return '#0a0a15';
    default: return theme.bg;
  }
}

function renderEquippedBackground(ctx: CanvasRenderingContext2D, bgId: string, canvasW: number, h: number) {
  switch (bgId) {
    case 'bg_stars':
      for (let i = 0; i < 40; i++) { const sx = (i * 97 + frameCount * 0.3) % canvasW; const sy = (i * 73) % h; ctx.globalAlpha = 0.3 + 0.7 * Math.sin(frameCount * 0.02 + i); ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, sy, 2, 2); }
      ctx.globalAlpha = 1; break;
    case 'bg_matrix':
      ctx.globalAlpha = 0.15; ctx.fillStyle = '#00ff00'; ctx.font = '12px monospace';
      for (let col = 0; col < canvasW / 14; col++) { const chars = 'アイウエオカキクケコ0123456789'; const y = ((frameCount * 2 + col * 37) % (h + 100)) - 50; ctx.fillText(chars[col % chars.length], col * 14, y); }
      ctx.globalAlpha = 1; break;
    case 'bg_galaxy':
      ctx.globalAlpha = 0.1; const grd = ctx.createRadialGradient(canvasW / 2, h / 2, 50, canvasW / 2, h / 2, h);
      grd.addColorStop(0, '#6600cc'); grd.addColorStop(0.5, '#330066'); grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, canvasW, h); ctx.globalAlpha = 1; break;
    case 'bg_cyberpunk':
      ctx.globalAlpha = 0.08; ctx.fillStyle = '#ff00ff';
      for (let i = 0; i < 15; i++) { const bw = 30 + (i * 17) % 40; const bh = 60 + (i * 31) % 120; ctx.fillRect((i * 67) % canvasW, h - bh, bw, bh); }
      ctx.globalAlpha = 1; break;
  }
}

function renderEquippedFloor(ctx: CanvasRenderingContext2D, floorId: string, lineY: number, canvasW: number, _theme: { line: string }) {
  switch (floorId) {
    case 'floor_electric':
      ctx.strokeStyle = '#00ffff'; ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 15; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, lineY);
      for (let x = 0; x < canvasW; x += 10) ctx.lineTo(x, lineY + (Math.random() - 0.5) * 6);
      ctx.stroke(); ctx.shadowBlur = 0; return true;
    case 'floor_fire':
      ctx.strokeStyle = '#ff4400'; ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 15; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, lineY); ctx.lineTo(canvasW, lineY); ctx.stroke();
      ctx.globalAlpha = 0.4;
      for (let x = 0; x < canvasW; x += 20) { const fh = 5 + Math.sin(x * 0.1 + frameCount * 0.05) * 5; ctx.fillStyle = Math.random() > 0.5 ? '#ff4400' : '#ffcc00'; ctx.beginPath(); ctx.moveTo(x, lineY); ctx.lineTo(x + 5, lineY - fh); ctx.lineTo(x + 10, lineY); ctx.fill(); }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0; return true;
    case 'floor_ice':
      ctx.strokeStyle = '#88ddff'; ctx.shadowColor = '#88ddff'; ctx.shadowBlur = 15; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, lineY); ctx.lineTo(canvasW, lineY); ctx.stroke();
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#aaeeff';
      for (let x = 0; x < canvasW; x += 30) { ctx.beginPath(); ctx.moveTo(x, lineY - 3); ctx.lineTo(x + 3, lineY - 8); ctx.lineTo(x + 6, lineY - 3); ctx.closePath(); ctx.fill(); }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0; return true;
    case 'floor_rainbow':
      const colors = ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#0088ff', '#8800ff'];
      const segW = canvasW / colors.length; ctx.lineWidth = 3; ctx.shadowBlur = 10;
      colors.forEach((color, i) => { const offset = (frameCount * 2) % canvasW; const sx = ((i * segW + offset) % canvasW); ctx.strokeStyle = color; ctx.shadowColor = color; ctx.beginPath(); ctx.moveTo(sx, lineY); ctx.lineTo(Math.min(sx + segW, canvasW), lineY); ctx.stroke(); });
      ctx.shadowBlur = 0; return true;
  }
  return false;
}

function drawPlayerShape(ctx: CanvasRenderingContext2D, skinId: string, size: number, skinColor: string) {
  const half = size / 2;
  if (skinId === 'shape_circle') { ctx.beginPath(); ctx.arc(0, 0, half, 0, Math.PI * 2); ctx.fill(); }
  else if (skinId === 'shape_triangle') { ctx.beginPath(); ctx.moveTo(0, -half); ctx.lineTo(half, half); ctx.lineTo(-half, half); ctx.closePath(); ctx.fill(); }
  else if (skinId === 'shape_star') { drawStar(ctx, 0, 0, 5, half, half / 2); }
  else if (skinId === 'phantom') { ctx.strokeStyle = skinColor; ctx.lineWidth = 2; ctx.shadowColor = skinColor; ctx.shadowBlur = 20; ctx.strokeRect(-half, -half, size, size); return; }
  else if (skinId === 'nova') { ctx.fillRect(-half, -half, size, size); ctx.globalAlpha = 0.3 + 0.2 * Math.sin(Date.now() * 0.008); ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 40; ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.arc(0, 0, half * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; return; }
  else if (skinId === 'prism') { const hue = (Date.now() * 0.1) % 360; ctx.fillStyle = `hsl(${hue}, 100%, 60%)`; ctx.shadowColor = `hsl(${hue}, 100%, 60%)`; ctx.fillRect(-half, -half, size, size); return; }
  else { ctx.fillRect(-half, -half, size, size); }
}

export function render(ctx: CanvasRenderingContext2D, state: GameState, canvasW: number, canvasH: number) {
  const h = canvasH - BANNER_HEIGHT;
  const baseLineY = h / 2;
  let lineY = baseLineY;
  if (state.floorWaveTimer > 0) lineY = baseLineY + Math.sin(state.floorWavePhase) * 30;
  const theme = getCurrentTheme(state);

  // Special event effects
  const hasBlackWhite = state.specialEvent?.type === 'black_white';
  const hasMirror = state.specialEvent?.type === 'mirror';
  const hasZoomOut = state.specialEvent?.type === 'zoom_out';
  const hasGlitch = state.specialEvent?.type === 'glitch';
  const hasInvisibleFloor = state.specialEvent?.type === 'invisible_floor';

  let shakeX = 0, shakeY = 0;
  if (state.screen === 'playing' && state.screenShake > 0 && state.settings.screenShakeEnabled) { const i = state.screenShake * 8; shakeX = (Math.random() - 0.5) * i; shakeY = (Math.random() - 0.5) * i; }
  if (state.multiverseWarningTimer > 0 && state.settings.screenShakeEnabled) { const wIntensity = 2 + Math.sin(state.multiverseWarningTimer * 0.01) * 2; shakeX += (Math.random() - 0.5) * wIntensity; shakeY += (Math.random() - 0.5) * wIntensity; }
  if (hasGlitch && state.settings.screenShakeEnabled) { shakeX += (Math.random() - 0.5) * 12; shakeY += (Math.random() - 0.5) * 12; }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(shakeX, shakeY);

  // Mirror effect
  if (hasMirror && state.screen === 'playing') { ctx.translate(canvasW, 0); ctx.scale(-1, 1); }
  // Zoom out effect
  if (hasZoomOut && state.screen === 'playing') { const zoomScale = 0.7; ctx.translate(canvasW * (1 - zoomScale) / 2, h * (1 - zoomScale) / 2); ctx.scale(zoomScale, zoomScale); }

  const invertActive = state.disruptionType === 2 && state.disruptionTimer > 0;
  const invisibleObs = state.disruptionType === 1 && state.disruptionTimer > 0;
  const noLine = (state.disruptionType === 3 && state.disruptionTimer > 0) || hasInvisibleFloor;

  // Background
  let bgColor = state.equippedBackground ? getEquippedBgColor(state.equippedBackground, theme) : (invertActive ? '#e0e0e0' : theme.bg);
  if (hasBlackWhite) bgColor = '#111111';
  // Chaos bg flicker
  if (state.chaosMode && state.chaosFlickerTimer < 50 && state.screen === 'playing') bgColor = '#1a1a3a';
  ctx.fillStyle = bgColor;
  ctx.fillRect(-10, -10, canvasW + 20, canvasH + 20);

  if (state.equippedBackground && state.settings.bgAnimEnabled && state.screen === 'playing' && !hasBlackWhite) renderEquippedBackground(ctx, state.equippedBackground, canvasW, h);

  if (invertActive && state.disruptionTimer > 2.7) { ctx.save(); ctx.globalAlpha = (state.disruptionTimer - 2.7) / 0.3; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvasW, h); ctx.restore(); }
  if (state.coinFlash > 0) { ctx.save(); ctx.globalAlpha = state.coinFlash * 0.15; ctx.fillStyle = '#facc15'; ctx.fillRect(0, 0, canvasW, h); ctx.restore(); }

  if (state.settings.bgAnimEnabled) {
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
    for (let x = (frameCount * 2) % 60; x < canvasW; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  }

  // Tunnel rendering
  if (state.tunnelTimer > 0 && state.screen === 'playing') {
    const ta = state.tunnelAmount;
    const ceilingY = ta * (lineY - PLAYER_SIZE * 1.8); const floorY = h - ta * (h - lineY - PLAYER_SIZE * 1.8);
    ctx.save(); ctx.fillStyle = invertActive ? '#333' : theme.obstacle; ctx.globalAlpha = 0.6;
    ctx.fillRect(0, 0, canvasW, ceilingY); ctx.fillRect(0, floorY, canvasW, h - floorY);
    ctx.strokeStyle = theme.line; ctx.lineWidth = 2; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(0, ceilingY); ctx.lineTo(canvasW, ceilingY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(canvasW, floorY); ctx.stroke();
    ctx.restore();
  }

  // Floor line
  if (!noLine) {
    let customFloor = false;
    if (state.equippedFloor && state.screen === 'playing') customFloor = renderEquippedFloor(ctx, state.equippedFloor, lineY, canvasW, theme);
    if (!customFloor) {
      const gaps = state.obstacles.filter(o => o.type === 'gap');
      const lineColor = hasBlackWhite ? '#666' : (invertActive ? '#333' : theme.line);
      ctx.shadowColor = lineColor; ctx.shadowBlur = 20; ctx.strokeStyle = lineColor; ctx.lineWidth = 2;
      if (gaps.length > 0) {
        const sorted = gaps.map(g => ({ left: g.x - (g.gapWidth || 100) / 2, right: g.x + (g.gapWidth || 100) / 2 })).sort((a, b) => a.left - b.left);
        let cx = 0;
        for (const gap of sorted) { if (cx < gap.left) { ctx.beginPath(); ctx.moveTo(cx, lineY); ctx.lineTo(gap.left, lineY); ctx.stroke(); } cx = gap.right; }
        if (cx < canvasW) { ctx.beginPath(); ctx.moveTo(cx, lineY); ctx.lineTo(canvasW, lineY); ctx.stroke(); }
      } else { ctx.beginPath(); ctx.moveTo(0, lineY); ctx.lineTo(canvasW, lineY); ctx.stroke(); }
      ctx.shadowBlur = 0;
    }
  }

  const skinColor = hasBlackWhite ? '#cccccc' : (SKIN_COLORS[state.equippedSkin] || '#00ffcc');

  if (state.screen === 'menu') {
    const breathe = 0.98 + 0.04 * Math.sin((Date.now() / 800) * Math.PI);
    ctx.save(); ctx.translate(canvasW / 2, lineY - PLAYER_SIZE / 2); ctx.scale(breathe, breathe);
    ctx.shadowColor = skinColor; ctx.shadowBlur = 20; ctx.fillStyle = skinColor;
    drawPlayerShape(ctx, state.equippedSkin, PLAYER_SIZE, skinColor);
    ctx.restore(); ctx.restore(); return;
  }

  // Ghost replay — only in ghostMode
  if (state.ghostMode && state.bestGhostFrames.length > 0 && state.screen === 'playing') {
    let gi = state.ghostIndex;
    while (gi < state.bestGhostFrames.length - 1 && state.bestGhostFrames[gi].distance < state.distance) gi++;
    state.ghostIndex = gi;
    const gf = state.bestGhostFrames[gi];
    if (gf) {
      ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 8;
      ctx.fillRect(80 - PLAYER_SIZE / 2, gf.y - PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
      ctx.globalAlpha = 0.5; ctx.font = '9px monospace'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
      ctx.fillText('👻 BEST', 80, gf.y - PLAYER_SIZE / 2 - 6);
      ctx.restore();
    }
  }

  // Speed boost visual
  if (state.speedBoostTimer > 0 && state.screen === 'playing') { ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = '#00ff00'; ctx.fillRect(0, 0, canvasW, h); ctx.restore(); }

  const drawPlayer = (p: Player) => {
    const isInvincible = state.invincibleTimer > 0;
    // Rapid flash visibility
    const flashOn = isInvincible ? (Math.floor(Date.now() / 80) % 2 === 0) : true;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.scale(p.squashX, p.squashY);
    if (state.adrenalineActive) { ctx.shadowColor = skinColor; ctx.shadowBlur = 40; }
    else if (state.streak >= 30) { ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 25; }
    else { ctx.shadowColor = skinColor; ctx.shadowBlur = 15; }
    ctx.fillStyle = state.adrenalineActive ? skinColor : (state.streak >= 30 ? '#ffd700' : skinColor);
    ctx.globalAlpha = flashOn ? 1 : 0.3;
    drawPlayerShape(ctx, state.equippedSkin, p.size, skinColor);
    ctx.globalAlpha = 1;
    if (state.adrenalineActive) { ctx.globalAlpha = 0.3 + 0.2 * Math.sin(Date.now() * 0.01); ctx.fillStyle = '#ffffff'; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.globalAlpha = 1; }
    if (state.hasShield) { ctx.strokeStyle = 'rgba(0,255,204,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, p.size * 0.8, 0, Math.PI * 2); ctx.stroke(); }
    if (isInvincible) {
      // Rotating shield ring matching shape
      ctx.rotate(Date.now() * 0.005);
      ctx.strokeStyle = '#ffd700'; ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 12; ctx.lineWidth = 2;
      const r = p.size * 0.95;
      const shapeId = state.equippedSkin;
      ctx.beginPath();
      if (shapeId === 'shape_circle') { ctx.arc(0, 0, r, 0, Math.PI * 2); }
      else if (shapeId === 'shape_triangle') { ctx.moveTo(0, -r); ctx.lineTo(r, r * 0.85); ctx.lineTo(-r, r * 0.85); ctx.closePath(); }
      else if (shapeId === 'shape_star') {
        let rot = -Math.PI / 2; const step = Math.PI / 5;
        ctx.moveTo(Math.cos(rot) * r, Math.sin(rot) * r);
        for (let i = 0; i < 5; i++) { rot += step; ctx.lineTo(Math.cos(rot) * r * 0.45, Math.sin(rot) * r * 0.45); rot += step; ctx.lineTo(Math.cos(rot) * r, Math.sin(rot) * r); }
        ctx.closePath();
      } else { ctx.rect(-r, -r, r * 2, r * 2); }
      ctx.stroke();
      // Countdown number
      ctx.rotate(-Date.now() * 0.005);
      ctx.fillStyle = '#ffd700'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowBlur = 0;
      ctx.fillText(String(Math.ceil(state.invincibleTimer / 1000)), 0, -p.size - 8);
    }
    ctx.restore();
  };
  drawPlayer(state.playerTop);
  if (state.playerBottom) drawPlayer(state.playerBottom);

  // Obstacles
  const obsColor = hasBlackWhite ? '#888' : (invisibleObs ? theme.bg : (invertActive ? '#222' : theme.obstacle));
  for (const obs of state.obstacles) {
    if (obs.type === 'intermittent' && !obs.intermittentVisible) { ctx.save(); ctx.globalAlpha = 0.15; ctx.strokeStyle = obsColor; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(obs.x, obs.y, obs.size / 2, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); continue; }
    ctx.save();
    if (obs.type !== 'gap' && obs.type !== 'ceiling_spikes' && obs.type !== 'pendulum' && obs.type !== 'wall_gap' && obs.type !== 'meteor' && obs.type !== 'speed_pad' && obs.type !== 'ceiling_spike_trap' && obs.type !== 'laser_beam' && obs.type !== 'shrinking_platform') {
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
      case 'expanding': ctx.fillStyle = obsColor; ctx.fillRect(obs.x - obs.size / 2, lineY - obs.size, obs.size, obs.size); break;
      case 'intermittent': ctx.fillStyle = obsColor; ctx.fillRect(obs.x - obs.size / 2, obs.y - obs.size / 2, obs.size, obs.size); break;
      case 'wall_gap': { const ww = obs.wallWidth || 20; const gapH = PLAYER_SIZE * 2.5; ctx.fillStyle = obsColor; if (obs.wallGapPosition === 'bottom') ctx.fillRect(obs.x - ww / 2, 0, ww, lineY - gapH); else ctx.fillRect(obs.x - ww / 2, lineY - gapH + PLAYER_SIZE * 2, ww, h - lineY + gapH); ctx.save(); ctx.globalAlpha = 0.3; ctx.strokeStyle = theme.line; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; if (obs.wallGapPosition === 'bottom') ctx.strokeRect(obs.x - ww / 2, lineY - gapH, ww, gapH); else ctx.strokeRect(obs.x - ww / 2, lineY - gapH - PLAYER_SIZE, ww, gapH); ctx.setLineDash([]); ctx.restore(); break; }
      case 'meteor': { ctx.fillStyle = '#ff4444'; ctx.shadowColor = '#ff4444'; ctx.shadowBlur = 15; ctx.beginPath(); ctx.arc(obs.x, obs.y, obs.size / 2, 0, Math.PI * 2); ctx.fill(); ctx.save(); ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.moveTo(obs.x - obs.size / 3, obs.y - obs.size / 2); ctx.lineTo(obs.x, obs.y - obs.size * 1.5); ctx.lineTo(obs.x + obs.size / 3, obs.y - obs.size / 2); ctx.closePath(); ctx.fill(); ctx.restore(); break; }
      case 'spinning_blade': { const bladeR = 25; const angle = obs.bladeAngle || 0; const cy = lineY - 15; ctx.fillStyle = obsColor; ctx.beginPath(); ctx.arc(obs.x, cy, 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = obsColor; ctx.lineWidth = 4; ctx.shadowBlur = 12; for (let b = 0; b < 4; b++) { const a = angle + (b * Math.PI / 2); ctx.beginPath(); ctx.moveTo(obs.x, cy); ctx.lineTo(obs.x + Math.cos(a) * bladeR, cy + Math.sin(a) * bladeR); ctx.stroke(); ctx.fillStyle = obsColor; ctx.beginPath(); ctx.arc(obs.x + Math.cos(a) * bladeR, cy + Math.sin(a) * bladeR, 4, 0, Math.PI * 2); ctx.fill(); } break; }
      case 'fake': { ctx.fillStyle = obsColor; ctx.globalAlpha = invisibleObs ? 0.05 : 0.8; ctx.beginPath(); ctx.moveTo(obs.x, obs.y - half); ctx.lineTo(obs.x + half, obs.y + half); ctx.lineTo(obs.x - half, obs.y + half); ctx.closePath(); ctx.fill(); break; }
      case 'speed_pad': { ctx.fillStyle = '#00ff44'; ctx.shadowColor = '#00ff44'; ctx.shadowBlur = 15; ctx.globalAlpha = 0.7; ctx.fillRect(obs.x - obs.size / 2, lineY - 3, obs.size, 6); ctx.globalAlpha = 0.9; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText('>>>', obs.x, lineY - 6); break; }
      case 'double_jump': { ctx.fillStyle = obsColor; ctx.fillRect(obs.x - 12, lineY - obs.size, 24, obs.size); ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText('!!', obs.x, lineY - obs.size - 5); ctx.restore(); break; }
      // New obstacles
      case 'ceiling_spike_trap': { ctx.fillStyle = '#ff4444'; ctx.shadowColor = '#ff4444'; ctx.shadowBlur = 10; const cc = 3; const sw = 16; const sx = obs.x - (cc * sw) / 2; for (let i = 0; i < cc; i++) { const x = sx + i * sw + sw / 2; ctx.beginPath(); ctx.moveTo(x - sw / 2, obs.y); ctx.lineTo(x, obs.y + 25); ctx.lineTo(x + sw / 2, obs.y); ctx.closePath(); ctx.fill(); } break; }
      case 'rolling_rock': { ctx.fillStyle = '#8B7355'; ctx.shadowColor = '#8B7355'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(obs.x, lineY - obs.size, obs.size, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#6B5335'; ctx.lineWidth = 2; ctx.stroke(); break; }
      case 'laser_beam': { const beamY = obs.y + Math.sin(obs.laserSweepPhase || 0) * 60; ctx.strokeStyle = '#ff0000'; ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 20; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(obs.x - 80, beamY); ctx.lineTo(obs.x + 80, beamY); ctx.stroke(); ctx.globalAlpha = 0.3; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(obs.x - 80, beamY); ctx.lineTo(obs.x + 80, beamY); ctx.stroke(); break; }
      case 'zip_zap': { const gapCenter = obs.y; const gapH = PLAYER_SIZE * 0.8; ctx.fillStyle = obsColor; ctx.fillRect(obs.x - 15, gapCenter - gapH - 30, 30, 30); ctx.fillRect(obs.x - 15, gapCenter + gapH, 30, 30); ctx.save(); ctx.globalAlpha = 0.2; ctx.strokeStyle = '#00ff00'; ctx.setLineDash([4, 4]); ctx.strokeRect(obs.x - 15, gapCenter - gapH, 30, gapH * 2); ctx.setLineDash([]); ctx.restore(); break; }
      case 'ghost_obstacle': { ctx.globalAlpha = obs.ghostSolid ? 0.8 : 0.2; ctx.fillStyle = obs.ghostSolid ? obsColor : '#888888'; ctx.beginPath(); ctx.moveTo(obs.x, obs.y - half); ctx.lineTo(obs.x + half, obs.y + half); ctx.lineTo(obs.x - half, obs.y + half); ctx.closePath(); ctx.fill(); if (!obs.ghostSolid) { ctx.setLineDash([3, 3]); ctx.strokeStyle = '#888'; ctx.stroke(); ctx.setLineDash([]); } break; }
      case 'bouncing_mine': { ctx.fillStyle = '#ff6600'; ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(obs.x, obs.y, obs.size, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.fillText('💣', obs.x, obs.y + 3); break; }
      case 'shrinking_platform': { const amt = obs.shrinkAmount || 0; const platW = obs.size * (1 - amt * 0.7); ctx.strokeStyle = '#ff8800'; ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 8; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(obs.x - platW / 2, lineY); ctx.lineTo(obs.x + platW / 2, lineY); ctx.stroke(); break; }
    }
    ctx.restore();
  }

  // Multiverse rendering
  const mvActive = state.multiverseActive && state.screen === 'playing';
  const mvMerging = !state.multiverseActive && state.multiverseMergeTimer > 0 && state.screen === 'playing';
  if (mvActive || mvMerging) {
    const fadeIn = mvActive ? Math.min(1, (state.multiverseDuration - state.multiverseTimer) / 500) : 0;
    const fadeOut = mvActive ? Math.min(1, state.multiverseTimer / 500) : 0;
    const mergeProgress = mvMerging ? 1 - state.multiverseMergeTimer / 500 : 0;
    const splitAlpha = mvActive ? Math.min(fadeIn, fadeOut) : (1 - mergeProgress);

    const QUAD_TINTS = ['rgba(0,255,204,0.06)', 'rgba(168,85,247,0.06)', 'rgba(251,146,60,0.06)', 'rgba(239,68,68,0.06)'];
    const QUAD_NEON = ['#00ffcc', '#a855f7', '#fb923c', '#ef4444'];

    const scale = mvMerging ? (1 - mergeProgress) : splitAlpha;
    ctx.save();
    const qw = canvasW / 2; const qh = h / 2;
    const quadrantDefs = [{ ox: 0, oy: 0 }, { ox: qw, oy: 0 }, { ox: 0, oy: qh }, { ox: qw, oy: qh }];

    for (let qi = 0; qi < 4; qi++) {
      const qd = quadrantDefs[qi];
      ctx.save(); ctx.globalAlpha = scale; ctx.fillStyle = QUAD_TINTS[qi]; ctx.fillRect(qd.ox, qd.oy, qw, qh); ctx.restore();
    }

    for (let qi = 0; qi < 4; qi++) {
      const qd = quadrantDefs[qi];
      // Normal mode: all quadrants use main obstacles (identical)
      // Chaos mode: each has independent obstacles
      let qObs: Obstacle[];
      if (state.chaosMode) {
        qObs = qi === 0 ? state.obstacles : (state.multiverseObstacles[qi - 1] || []);
      } else {
        qObs = state.obstacles; // All identical in normal mode
      }

      ctx.save(); ctx.globalAlpha = scale * 0.95;
      ctx.beginPath(); ctx.rect(qd.ox, qd.oy, qw, qh); ctx.clip();
      ctx.translate(qd.ox, qd.oy); ctx.scale(0.5, 0.5);

      // Equipped background per quadrant (fill bg)
      if (state.equippedBackground) {
        const qBg = getEquippedBgColor(state.equippedBackground, theme);
        ctx.fillStyle = qBg; ctx.fillRect(0, 0, canvasW, h);
        if (state.settings.bgAnimEnabled) renderEquippedBackground(ctx, state.equippedBackground, canvasW, h);
      }

      // Equipped floor per quadrant (fallback to neon line)
      let drewCustomFloor = false;
      if (state.equippedFloor) drewCustomFloor = renderEquippedFloor(ctx, state.equippedFloor, baseLineY, canvasW, theme);
      if (!drewCustomFloor) {
        ctx.strokeStyle = QUAD_NEON[qi]; ctx.lineWidth = 2; ctx.shadowColor = QUAD_NEON[qi]; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(0, baseLineY); ctx.lineTo(canvasW, baseLineY); ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // Obstacles tinted with quadrant color
      for (const obs of qObs) {
        if (obs.type === 'intermittent' && !obs.intermittentVisible) continue;
        if (obs.type === 'meteor' || obs.type === 'ceiling_spike_trap') continue;
        ctx.fillStyle = QUAD_NEON[qi]; ctx.shadowColor = QUAD_NEON[qi]; ctx.shadowBlur = 6;
        const half2 = obs.size / 2;
        switch (obs.type) {
          case 'triangle': case 'fake': ctx.beginPath(); ctx.moveTo(obs.x, obs.y - half2); ctx.lineTo(obs.x + half2, obs.y + half2); ctx.lineTo(obs.x - half2, obs.y + half2); ctx.closePath(); ctx.fill(); break;
          case 'circle': ctx.beginPath(); ctx.arc(obs.x, obs.y, half2, 0, Math.PI * 2); ctx.fill(); break;
          case 'diamond': ctx.beginPath(); ctx.moveTo(obs.x, obs.y - half2); ctx.lineTo(obs.x + half2, obs.y); ctx.lineTo(obs.x, obs.y + half2); ctx.lineTo(obs.x - half2, obs.y); ctx.closePath(); ctx.fill(); break;
          case 'spike_row': { const c = obs.spikeCount || 3; const sw = 14; for (let i = 0; i < c; i++) { const sx = obs.x - (c * sw) / 2 + i * sw + sw / 2; ctx.beginPath(); ctx.moveTo(sx - sw / 2, baseLineY); ctx.lineTo(sx, baseLineY - obs.size); ctx.lineTo(sx + sw / 2, baseLineY); ctx.closePath(); ctx.fill(); } break; }
          case 'bouncing_ball': case 'rolling_rock': ctx.beginPath(); ctx.arc(obs.x, obs.y, obs.size, 0, Math.PI * 2); ctx.fill(); break;
          case 'wall_gap': { const ww2 = obs.wallWidth || 20; ctx.fillRect(obs.x - ww2 / 2, 0, ww2, baseLineY * 0.7); break; }
          case 'speed_pad': ctx.fillStyle = '#00ff44'; ctx.fillRect(obs.x - obs.size / 2, baseLineY - 2, obs.size, 4); break;
          case 'double_jump': ctx.fillRect(obs.x - 10, baseLineY - obs.size, 20, obs.size); break;
          case 'spinning_blade': ctx.beginPath(); ctx.arc(obs.x, baseLineY - 15, 15, 0, Math.PI * 2); ctx.stroke(); break;
          default: ctx.fillRect(obs.x - half2, obs.y - half2, obs.size, obs.size); break;
        }
        ctx.shadowBlur = 0;
      }

      // Player with equipped skin shape + color
      const ptRef = state.playerTop;
      ctx.save();
      ctx.translate(ptRef.x, ptRef.y);
      ctx.fillStyle = skinColor; ctx.shadowColor = skinColor; ctx.shadowBlur = 14;
      drawPlayerShape(ctx, state.equippedSkin, ptRef.size, skinColor);
      ctx.restore();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    ctx.globalAlpha = scale;
    ctx.strokeStyle = '#00ffcc'; ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 15; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(canvasW / 2, 0); ctx.lineTo(canvasW / 2, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(canvasW, h / 2); ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.globalAlpha = scale;
    ctx.fillStyle = '#ffd700'; ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 10;
    ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
    ctx.fillText('SCORE x2', canvasW / 2, h - 12);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Multiverse warning text
  if (state.multiverseWarningTimer > 0 && state.screen === 'playing') {
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.01);
    ctx.save(); ctx.globalAlpha = pulse; ctx.fillStyle = '#ff4400'; ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 30;
    ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⚠️ MULTIVERSO ENTRANTE', canvasW / 2, h / 2); ctx.restore();
  }

  // Multiverse intro text
  if (state.multiverseTextTimer > 0 && state.screen === 'playing') {
    const textAlpha = state.multiverseTextTimer > 700 ? (1000 - state.multiverseTextTimer) / 300 : state.multiverseTextTimer / 700;
    ctx.save(); ctx.globalAlpha = Math.max(0, textAlpha);
    ctx.fillStyle = '#00ffcc'; ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 40;
    ctx.font = 'bold 42px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('MULTIVERSE', canvasW / 2, h / 2);
    if (state.multiverseTextTimer > 900) { ctx.globalAlpha = (state.multiverseTextTimer - 900) / 100; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvasW, h); }
    ctx.restore();
  }

  // Event warnings
  if (state.meteorShowerTimer > 2500 && state.screen === 'playing') { ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = '#ff4444'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.fillText('⚠ METEOR SHOWER ⚠', canvasW / 2, 50); ctx.restore(); }
  if (state.floorWaveTimer > 0 && state.screen === 'playing') { ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = theme.line; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText('~ FLOOR WAVE ~', canvasW / 2, 50); ctx.restore(); }
  if (state.tunnelTimer > 0 && state.screen === 'playing') { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#ff6600'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.fillText('🚧 TUNNEL — DON\'T JUMP 🚧', canvasW / 2, 50); ctx.restore(); }
  if (state.speedBoostTimer > 0 && state.screen === 'playing') { ctx.save(); ctx.globalAlpha = 0.7; ctx.fillStyle = '#00ff44'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.fillText('⚡ SPEED BOOST ⚡', canvasW / 2, 50); ctx.restore(); }

  // Special event indicator
  if (state.specialEvent && state.screen === 'playing') {
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#ff00ff'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`⚡ ${state.specialEvent.type.toUpperCase().replace('_', ' ')} ⚡`, canvasW / 2, 70);
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
    if (p.isDeathPiece && p.width && p.height) { ctx.fillStyle = p.color; ctx.translate(p.x, p.y); if (p.angle) ctx.rotate(p.angle); ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height); }
    else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2); ctx.fill(); }
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

  if (state.cinematicSlowMo > 0 && state.screen === 'playing') {
    const vigAlpha = Math.min(0.4, (2000 - state.cinematicSlowMo) / 1000) * Math.min(1, state.cinematicSlowMo / 500);
    ctx.save();
    const gradient = ctx.createRadialGradient(canvasW / 2, h / 2, h * 0.3, canvasW / 2, h / 2, h * 0.8);
    gradient.addColorStop(0, 'rgba(255,215,0,0)'); gradient.addColorStop(1, `rgba(255,215,0,${vigAlpha})`);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvasW, h); ctx.restore();
  }

  if (state.streak >= 10 && state.screen === 'playing' && state.settings.showStreak) {
    ctx.save(); ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
    const badge = state.streakMultiplier >= 4 ? 'x4' : state.streakMultiplier >= 3 ? 'x3' : 'x2';
    ctx.fillStyle = state.streakMultiplier >= 4 ? '#ffd700' : state.streakMultiplier >= 3 ? '#ff69b4' : theme.line;
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
    ctx.fillText(badge, canvasW / 2 + 50, 30); ctx.restore();
  }

  if (state.disruptionTimer > 0) { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#ff0000'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText('⚠ DISRUPTION ⚠', canvasW / 2, 20); ctx.restore(); }

  // Glitch visual effect
  if (hasGlitch && state.screen === 'playing') {
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const gy = Math.random() * h; const gh = 2 + Math.random() * 8;
      ctx.globalAlpha = 0.3; ctx.fillStyle = randomFrom(['#ff0000', '#00ff00', '#0000ff']);
      ctx.fillRect(Math.random() * 20 - 10, gy, canvasW, gh);
    }
    ctx.restore();
  }

  // Matrix mode overlay
  if (state.specialEvent?.type === 'matrix_mode' && state.screen === 'playing') {
    ctx.save(); ctx.globalAlpha = 0.1; ctx.fillStyle = '#00ff00'; ctx.font = '10px monospace';
    for (let col = 0; col < canvasW / 12; col++) {
      const chars = '01アイウ'; const y = ((frameCount * 3 + col * 29) % (h + 50)) - 25;
      ctx.fillText(chars[col % chars.length], col * 12, y);
    }
    ctx.restore();
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
  state.ghostFrames.push({ distance: state.distance, y: pt.y, isJumping: true });
  return state;
}
