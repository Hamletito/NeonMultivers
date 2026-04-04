import { GameState, Obstacle, Coin, Particle, Player } from './types';
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

const MAX_VISIBLE_OBSTACLES = 3;
const OBSTACLE_SPAWN_X_OFFSET = 64;
const COIN_SAFE_CLEARANCE_X = 110;
const COIN_MIN_WINDOW_WIDTH = 140;
const SAFE_SPAWN_ZONE = 300;

let frameCount = 0;
let forceEasyFollowUp = false;
let nextPhase2ObstacleOnTop = true;
let isFirstObstacle = true;
let lastMilestone = 0;
let milestoneFlashTimer = 0;
let milestoneFlashScore = 0;
let patternCount = 0;
let patternGapPending = false;

// Taunt messages by distance
const TAUNT_MESSAGES: Record<number, string> = {
  100: "Is that all you got?",
  300: "Not bad... for now",
  500: "Things are about to get worse",
  750: "You're actually good",
  1000: "MONSTER",
};

function makePlayer(x: number, y: number, isAboveLine: boolean): Player {
  return {
    x, y, size: PLAYER_SIZE, vy: 0, isJumping: false, isAboveLine,
    squashX: 1, squashY: 1, rotation: 0, anticipation: 0, landTimer: 0, wasJumping: false,
  };
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function getJumpHeight() {
  return (Math.abs(JUMP_FORCE) * Math.abs(JUMP_FORCE)) / (2 * GRAVITY);
}

function getPhase(distance: number): 1 | 2 | 3 | 4 {
  if (distance < 100) return 1;
  if (distance < 300) return 2;
  if (distance < 600) return 3;
  return 4;
}

function getSpawnProfile(distance: number) {
  const phase = getPhase(distance);
  switch (phase) {
    case 1: return { minGap: 500, maxGap: 700, maxSize: 35, speedMult: 1.0, hardChance: 0, maxBurst: 1 };
    case 2: return { minGap: 350, maxGap: 500, maxSize: 40, speedMult: 1.2, hardChance: 0.1, maxBurst: 2 };
    case 3: return { minGap: 250, maxGap: 380, maxSize: 50, speedMult: 1.4, hardChance: 0.2, maxBurst: 3 };
    case 4: return { minGap: 180, maxGap: 280, maxSize: 50, speedMult: 1.65, hardChance: 0.3, maxBurst: 4 };
  }
}

function getObstacleSizeCap(type: Obstacle['type'], distance: number) {
  const jumpLimitedCap = getJumpHeight() * 0.6;
  const profile = getSpawnProfile(distance);
  const typeCap =
    type === 'triangle' ? Math.min(45, profile.maxSize)
    : type === 'circle' ? Math.min(40, profile.maxSize)
    : Math.min(40, profile.maxSize);
  return Math.min(typeCap, jumpLimitedCap);
}

function chooseObstacleType(distance: number, mustBeEasy: boolean): Obstacle['type'] {
  const phase = getPhase(distance);

  if (mustBeEasy || phase === 1) {
    return randomFrom(['triangle', 'diamond']);
  }

  if (phase === 2) {
    const types: Obstacle['type'][] = ['triangle', 'diamond', 'circle', 'star'];
    if (distance >= 300) types.push('gap');
    return randomFrom(types);
  }

  // Phase 3 & 4: all types including new ones
  const types: Obstacle['type'][] = ['triangle', 'circle', 'diamond', 'spike', 'star', 'spike_row', 'bouncing_ball'];
  if (distance >= 300) types.push('gap');
  if (distance >= 400) types.push('pendulum');
  if (distance >= 500) types.push('ceiling_spikes');
  return randomFrom(types);
}

function getObstacleSize(type: Obstacle['type'], distance: number, mustBeEasy: boolean) {
  // New obstacle types have fixed/special sizing
  if (type === 'spike_row' || type === 'bouncing_ball' || type === 'pendulum' || type === 'gap' || type === 'ceiling_spikes') {
    return 30; // base size, specifics handled in createObstacle
  }
  const cap = getObstacleSizeCap(type, distance);
  const phase = getPhase(distance);
  let minSize = type === 'triangle' || type === 'spike' ? 24 : 22;
  let maxSize = cap;
  if (phase === 1) maxSize = Math.min(maxSize, 35);
  if (mustBeEasy) maxSize = Math.min(maxSize, 32);
  maxSize = Math.max(maxSize, minSize + 2);
  return randomBetween(minSize, maxSize);
}

function isHardObstacle(obstacle: Obstacle) {
  return (obstacle.type === 'circle' || obstacle.type === 'star' || obstacle.type === 'spike_row' || obstacle.type === 'bouncing_ball') && obstacle.size >= 30;
}

function createObstacle(
  canvasW: number,
  lineY: number,
  isTop: boolean,
  distance: number,
  mustBeEasy: boolean,
  canvasH: number,
): Obstacle {
  const type = chooseObstacleType(distance, mustBeEasy);
  const size = getObstacleSize(type, distance, mustBeEasy);
  const spawnX = canvasW + OBSTACLE_SPAWN_X_OFFSET;

  if (type === 'spike_row') {
    const count = 3 + Math.floor(Math.random() * 3); // 3-5
    return {
      x: spawnX, y: isTop ? lineY - 12 : lineY + 12,
      type, size: 24, isTop, spikeCount: count,
    };
  }

  if (type === 'bouncing_ball') {
    return {
      x: spawnX, y: lineY - 20, type, size: 18, isTop: true,
      bouncePhase: Math.random() * Math.PI * 2,
      bounceSpeed: 0.004,
      baseY: lineY,
    };
  }

  if (type === 'pendulum') {
    const pLen = 100 + Math.random() * 60;
    return {
      x: spawnX, y: 0, type, size: 20, isTop: true,
      swingPhase: Math.random() * Math.PI * 2,
      swingSpeed: 0.003,
      anchorX: spawnX,
      pendulumLength: pLen,
    };
  }

  if (type === 'gap') {
    const gw = 80 + Math.random() * 40; // 80-120px
    return {
      x: spawnX, y: lineY, type, size: gw, isTop: true, gapWidth: gw,
    };
  }

  if (type === 'ceiling_spikes') {
    return {
      x: spawnX, y: 30, type, size: 35, isTop: true,
    };
  }

  const y = isTop ? lineY - size / 2 : lineY + size / 2;
  return { x: spawnX, y, type, size, isTop };
}

function buildSafeCoinWindows(obstacles: Obstacle[], playerX: number, canvasW: number) {
  const start = playerX + 220;
  const end = canvasW - 96;
  if (end - start < COIN_MIN_WINDOW_WIDTH) return [] as Array<[number, number]>;
  const blocked = obstacles
    .filter(o => o.x + o.size / 2 > start && o.x - o.size / 2 < end)
    .map(o => [
      Math.max(start, o.x - o.size / 2 - COIN_SAFE_CLEARANCE_X),
      Math.min(end, o.x + o.size / 2 + COIN_SAFE_CLEARANCE_X),
    ] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [left, right] of blocked) {
    const last = merged[merged.length - 1];
    if (!last || left > last[1]) merged.push([left, right]);
    else last[1] = Math.max(last[1], right);
  }
  const windows: Array<[number, number]> = [];
  let cursor = start;
  for (const [left, right] of merged) {
    if (left - cursor >= COIN_MIN_WINDOW_WIDTH) windows.push([cursor, left]);
    cursor = Math.max(cursor, right);
  }
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

export function createInitialState(): GameState {
  return {
    screen: 'menu',
    score: 0,
    bestScore: parseInt(localStorage.getItem('bestScore') || '0'),
    coins: parseInt(localStorage.getItem('coins') || '0'),
    totalCoins: parseInt(localStorage.getItem('coins') || '0'),
    distance: 0,
    speed: BASE_SPEED,
    baseSpeed: BASE_SPEED,
    phase: 1,
    phaseThreshold: PHASE2_DISTANCE,
    playerTop: makePlayer(80, 0, true),
    playerBottom: null,
    obstacles: [],
    coinItems: [],
    particles: [],
    activePowers: [],
    hasShield: false,
    freeReviveUsed: false,
    removeAds: localStorage.getItem('removeAds') === 'true',
    equippedSkin: localStorage.getItem('equippedSkin') || 'default',
    equippedTrail: localStorage.getItem('equippedTrail') || '',
    equippedDeath: localStorage.getItem('equippedDeath') || '',
    screenShake: 0,
    coinFlash: 0,
    streak: 0,
    streakMultiplier: 1,
    tauntText: '',
    tauntTimer: 0,
    shownTaunts: new Set(),
    newRecordShown: false,
  };
}

export function resetForNewGame(state: GameState): GameState {
  return {
    ...state,
    screen: 'playing',
    score: 0,
    distance: 0,
    speed: BASE_SPEED,
    baseSpeed: BASE_SPEED,
    phase: 1,
    playerTop: makePlayer(80, 0, true),
    playerBottom: null,
    obstacles: [],
    coinItems: [],
    particles: [],
    activePowers: [],
    hasShield: false,
    freeReviveUsed: false,
    screenShake: 0,
    coinFlash: 0,
    streak: 0,
    streakMultiplier: 1,
    tauntText: '',
    tauntTimer: 0,
    shownTaunts: new Set(),
    newRecordShown: false,
  };
}

function addParticles(particles: Particle[], x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6,
      life: 1, maxLife: 1, color, size: 2 + Math.random() * 3,
    });
  }
}

function addTrailParticle(particles: Particle[], p: Player, color: string) {
  particles.push({
    x: p.x - p.size / 2 - 2, y: p.y + (Math.random() - 0.5) * p.size * 0.5,
    vx: -1 - Math.random(), vy: (Math.random() - 0.5) * 0.5,
    life: 0.6, maxLife: 0.6, color, size: 1.5 + Math.random() * 2,
  });
}

function addLandingParticles(particles: Particle[], p: Player, lineY: number, color: string) {
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: p.x + (Math.random() - 0.5) * p.size, y: lineY,
      vx: (Math.random() - 0.5) * 4, vy: p.isAboveLine ? -(Math.random() * 2) : Math.random() * 2,
      life: 0.5, maxLife: 0.5, color, size: 1.5 + Math.random() * 2,
    });
  }
}

function checkCollision(player: Player, obs: Obstacle, lineY: number): boolean {
  const shrink = 0.85;

  // Gap: player falls if on ground and within gap horizontal range
  if (obs.type === 'gap') {
    const gw = obs.gapWidth || 100;
    const inGapX = player.x > obs.x - gw / 2 && player.x < obs.x + gw / 2;
    if (inGapX && !player.isJumping) return true;
    return false;
  }

  // Spike row: wide hitbox
  if (obs.type === 'spike_row') {
    const count = obs.spikeCount || 3;
    const totalWidth = count * 16;
    const dx = Math.abs(player.x - obs.x);
    const dy = Math.abs(player.y - obs.y);
    return dx < (player.size / 2 + totalWidth / 2) * shrink && dy < (player.size / 2 + obs.size / 2) * shrink;
  }

  // Bouncing ball: circle collision using current y
  if (obs.type === 'bouncing_ball') {
    const dx = player.x - obs.x;
    const dy = player.y - obs.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < (player.size / 2 + obs.size / 2) * shrink;
  }

  // Pendulum: rect collision at current position
  if (obs.type === 'pendulum') {
    const dx = Math.abs(player.x - obs.x);
    const dy = Math.abs(player.y - obs.y);
    return dx < (player.size / 2 + obs.size / 2) * shrink && dy < (player.size / 2 + (obs.pendulumLength || 100) * 0.15) * shrink;
  }

  // Ceiling spikes: only hit if player jumps too high
  if (obs.type === 'ceiling_spikes') {
    const dx = Math.abs(player.x - obs.x);
    const dy = Math.abs(player.y - obs.y);
    return dx < (player.size / 2 + obs.size / 2) * shrink && dy < (player.size / 2 + 20) * shrink;
  }

  const dx = Math.abs(player.x - obs.x);
  const dy = Math.abs(player.y - obs.y);
  return dx < (player.size / 2 + obs.size / 2) * shrink && dy < (player.size / 2 + obs.size / 2) * shrink;
}

function updatePlayerAnim(p: Player, dt: number) {
  if (p.landTimer > 0) {
    p.landTimer = Math.max(0, p.landTimer - dt);
    const t = p.landTimer / 100;
    p.squashX = 1 + 0.2 * t;
    p.squashY = 1 - 0.15 * t;
  } else if (p.anticipation > 0) {
    p.squashX = 1 + 0.1 * p.anticipation;
    p.squashY = 1 - 0.15 * p.anticipation;
    p.anticipation = Math.max(0, p.anticipation - dt / 80);
  } else if (p.isJumping) {
    const stretchFactor = Math.min(1, Math.abs(p.vy) / 10);
    p.squashX = 1 - 0.12 * stretchFactor;
    p.squashY = 1 + 0.18 * stretchFactor;
    const maxRot = (15 * Math.PI) / 180;
    const dir = p.isAboveLine ? 1 : -1;
    p.rotation = dir * (p.vy / Math.abs(JUMP_FORCE)) * maxRot * 0.5;
  } else {
    const bobPhase = (Date.now() % 400) / 400;
    const bob = Math.sin(bobPhase * Math.PI * 2);
    p.squashX = 1 + bob * 0.01;
    p.squashY = 0.98 + bob * 0.02;
    const wobble = Math.sin(((Date.now() % 600) / 600) * Math.PI * 2) * 0.02;
    p.rotation = (5 * Math.PI) / 180 + wobble;
  }
}

export function resetSpawners() {
  frameCount = 0;
  forceEasyFollowUp = false;
  nextPhase2ObstacleOnTop = true;
  isFirstObstacle = true;
  lastMilestone = 0;
  milestoneFlashTimer = 0;
  milestoneFlashScore = 0;
  patternCount = 0;
  patternGapPending = false;
}

// Track which obstacles the player has passed for streak counting
let passedObstacleIds = new Set<number>();
let obstacleIdCounter = 0;

export function update(state: GameState, canvasW: number, canvasH: number, dt: number): GameState {
  if (state.screen !== 'playing') return state;

  const lineY = (canvasH - BANNER_HEIGHT) / 2;
  frameCount++;

  const spawnProfile = getSpawnProfile(state.distance);
  state.speed = Math.min(MAX_SPEED, state.baseSpeed * spawnProfile.speedMult + state.distance * SPEED_INCREMENT * 0.3);

  let effectiveSpeed = state.speed;
  const slowmo = state.activePowers.find(p => p.type === 'slowmo');
  if (slowmo) effectiveSpeed *= 0.5;

  state.activePowers = state.activePowers
    .map(p => ({ ...p, remaining: p.remaining - dt }))
    .filter(p => p.remaining > 0);

  state.distance += effectiveSpeed * 0.1;
  state.score = Math.floor(state.distance);

  // Taunt messages
  for (const [dist, msg] of Object.entries(TAUNT_MESSAGES)) {
    const d = parseInt(dist);
    if (state.distance >= d && !state.shownTaunts.has(d)) {
      state.shownTaunts.add(d);
      state.tauntText = msg;
      state.tauntTimer = 1.5;
    }
  }
  // New record taunt
  if (state.score > state.bestScore && !state.newRecordShown) {
    state.newRecordShown = true;
    state.tauntText = 'NEW RECORD 🔥';
    state.tauntTimer = 1.5;
  }
  if (state.tauntTimer > 0) state.tauntTimer = Math.max(0, state.tauntTimer - dt / 1000);

  // Milestone flash every 100m
  const currentMilestone = Math.floor(state.distance / 100) * 100;
  if (currentMilestone > lastMilestone && currentMilestone > 0) {
    lastMilestone = currentMilestone;
    milestoneFlashTimer = 1.5;
    milestoneFlashScore = currentMilestone;
  }
  if (milestoneFlashTimer > 0) milestoneFlashTimer = Math.max(0, milestoneFlashTimer - dt / 1000);

  if (state.screenShake > 0) state.screenShake = Math.max(0, state.screenShake - dt * 0.01);
  if (state.coinFlash > 0) state.coinFlash = Math.max(0, state.coinFlash - dt * 0.005);

  if (state.phase === 1 && state.distance >= state.phaseThreshold) {
    state.phase = 2;
    state.playerBottom = makePlayer(80, lineY + PLAYER_SIZE / 2, false);
  }

  const skinColor = SKIN_COLORS[state.equippedSkin] || '#00ffcc';

  const pt = state.playerTop;
  pt.y = pt.y || lineY - PLAYER_SIZE / 2;
  const ptWasJumping = pt.isJumping;
  if (pt.isJumping) {
    pt.vy += GRAVITY;
    pt.y += pt.vy;
    if (pt.y >= lineY - PLAYER_SIZE / 2) {
      pt.y = lineY - PLAYER_SIZE / 2;
      pt.vy = 0;
      pt.isJumping = false;
    }
  } else {
    pt.y = lineY - PLAYER_SIZE / 2;
  }
  if (ptWasJumping && !pt.isJumping) {
    pt.landTimer = 100;
    pt.rotation = 0;
    addLandingParticles(state.particles, pt, lineY, skinColor);
  }
  updatePlayerAnim(pt, dt);
  if (frameCount % 3 === 0) addTrailParticle(state.particles, pt, skinColor);

  if (state.playerBottom) {
    const pb = state.playerBottom;
    const pbWasJumping = pb.isJumping;
    if (pb.isJumping) {
      pb.vy -= GRAVITY;
      pb.y += pb.vy;
      if (pb.y <= lineY + PLAYER_SIZE / 2) {
        pb.y = lineY + PLAYER_SIZE / 2;
        pb.vy = 0;
        pb.isJumping = false;
      }
    } else {
      pb.y = lineY + PLAYER_SIZE / 2;
    }
    if (pbWasJumping && !pb.isJumping) {
      pb.landTimer = 100;
      pb.rotation = 0;
      addLandingParticles(state.particles, pb, lineY, skinColor);
    }
    updatePlayerAnim(pb, dt);
    if (frameCount % 3 === 0) addTrailParticle(state.particles, pb, skinColor);
  }

  // Update bouncing balls and pendulums
  for (const obs of state.obstacles) {
    if (obs.type === 'bouncing_ball' && obs.bouncePhase !== undefined && obs.baseY !== undefined) {
      obs.bouncePhase += (obs.bounceSpeed || 0.004) * dt;
      const bounceHeight = canvasH * 0.4;
      obs.y = obs.baseY - Math.abs(Math.sin(obs.bouncePhase)) * bounceHeight;
    }
    if (obs.type === 'pendulum' && obs.swingPhase !== undefined && obs.anchorX !== undefined) {
      obs.swingPhase += (obs.swingSpeed || 0.003) * dt;
      const swingAngle = Math.sin(obs.swingPhase) * 0.6; // ~35 degrees
      const pLen = obs.pendulumLength || 120;
      obs.x = obs.anchorX + Math.sin(swingAngle) * pLen;
      obs.y = Math.cos(swingAngle) * pLen;
    }
  }

  const visibleObstacleCount = state.obstacles.filter(
    o => o.x + o.size / 2 >= 0 && o.x - o.size / 2 <= canvasW,
  ).length;

  if (visibleObstacleCount < MAX_VISIBLE_OBSTACLES) {
    const mustBeEasy = forceEasyFollowUp || patternGapPending;
    const spawnOnTop = state.phase === 1 ? true : nextPhase2ObstacleOnTop;

    let candidate: Obstacle;
    if (isFirstObstacle) {
      candidate = {
        x: canvasW + OBSTACLE_SPAWN_X_OFFSET,
        y: (canvasH - BANNER_HEIGHT) / 2 - 15,
        type: 'triangle', size: 28, isTop: true,
      };
    } else {
      candidate = createObstacle(canvasW, (canvasH - BANNER_HEIGHT) / 2, spawnOnTop, state.distance, mustBeEasy, canvasH);
    }

    let requiredGapPx: number;
    if (patternGapPending) {
      requiredGapPx = spawnProfile.maxGap * 1.3;
    } else {
      requiredGapPx = randomBetween(spawnProfile.minGap, spawnProfile.maxGap);
    }
    if (isFirstObstacle) requiredGapPx = Math.max(requiredGapPx, SAFE_SPAWN_ZONE);

    const rightmostObstacleRightEdge = state.obstacles.length > 0
      ? Math.max(...state.obstacles.map(o => o.x + o.size / 2))
      : state.playerTop.x - SAFE_SPAWN_ZONE;
    const hasEnoughGap = state.obstacles.length === 0
      || rightmostObstacleRightEdge <= candidate.x - candidate.size / 2 - requiredGapPx;

    if (hasEnoughGap) {
      // Assign unique ID for streak tracking
      (candidate as any)._id = obstacleIdCounter++;
      state.obstacles.push(candidate);
      isFirstObstacle = false;

      if (patternGapPending) {
        patternGapPending = false;
        patternCount = 0;
      }
      patternCount++;
      if (patternCount >= spawnProfile.maxBurst) patternGapPending = true;

      forceEasyFollowUp = isHardObstacle(candidate);
      if (state.phase === 2) nextPhase2ObstacleOnTop = !nextPhase2ObstacleOnTop;
    }
  }

  if (state.coinItems.length < 2 && Math.random() < 0.012) {
    const safeCoin = spawnSafeCoin(state, canvasW, lineY);
    if (safeCoin) state.coinItems.push(safeCoin);
  }

  // Move obstacles (except pendulum x which is computed from swing)
  state.obstacles = state.obstacles
    .map(o => {
      if (o.type === 'pendulum' && o.anchorX !== undefined) {
        o.anchorX -= effectiveSpeed;
        return o;
      }
      return { ...o, x: o.x - effectiveSpeed };
    })
    .filter(o => o.x > -120);

  const magnet = state.activePowers.find(p => p.type === 'magnet');
  state.coinItems = state.coinItems
    .map(c => {
      let newX = c.x - effectiveSpeed;
      let newY = c.y;
      if (magnet && !c.collected) {
        const target = c.y < lineY ? pt : (state.playerBottom || pt);
        const dx = target.x - newX;
        const dy = target.y - newY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          newX += dx * 0.15;
          newY += dy * 0.15;
        }
      }
      return { ...c, x: newX, y: newY };
    })
    .filter(c => c.x > -50 && !c.collected);

  // Streak: track obstacles that pass behind the player
  for (const obs of state.obstacles) {
    const obsId = (obs as any)._id as number;
    if (obsId !== undefined && obs.x + obs.size / 2 < pt.x && !passedObstacleIds.has(obsId)) {
      passedObstacleIds.add(obsId);
      state.streak++;
      if (state.streak >= 30) state.streakMultiplier = 4;
      else if (state.streak >= 20) state.streakMultiplier = 3;
      else if (state.streak >= 10) state.streakMultiplier = 2;
      else state.streakMultiplier = 1;
    }
  }

  for (const coin of state.coinItems) {
    if (coin.collected) continue;
    const players = [pt, state.playerBottom].filter(Boolean) as Player[];
    for (const p of players) {
      const dx = p.x - coin.x;
      const dy = p.y - coin.y;
      if (Math.sqrt(dx * dx + dy * dy) < p.size / 2 + coin.radius) {
        coin.collected = true;
        const earned = state.streakMultiplier;
        state.coins += earned;
        state.totalCoins += earned;
        state.coinFlash = 1;
        addParticles(state.particles, coin.x, coin.y, '#facc15', 12);
      }
    }
  }

  for (const obs of state.obstacles) {
    const players = obs.isTop ? [pt] : (state.playerBottom ? [state.playerBottom] : []);
    // Gap and ceiling_spikes affect top player regardless
    if (obs.type === 'gap' || obs.type === 'ceiling_spikes' || obs.type === 'bouncing_ball') {
      const allPlayers = [pt, state.playerBottom].filter(Boolean) as Player[];
      for (const p of allPlayers) {
        if (checkCollision(p, obs, lineY)) {
          if (state.hasShield) {
            state.hasShield = false;
            state.obstacles = state.obstacles.filter(o => o !== obs);
            addParticles(state.particles, p.x, p.y, '#00ffcc', 15);
          } else {
            handleDeath(state, p, skinColor, lineY);
          }
          break;
        }
      }
    } else {
      for (const p of players) {
        if (checkCollision(p, obs, lineY)) {
          if (state.hasShield) {
            state.hasShield = false;
            state.obstacles = state.obstacles.filter(o => o !== obs);
            addParticles(state.particles, p.x, p.y, '#00ffcc', 15);
          } else {
            handleDeath(state, p, skinColor, lineY);
          }
          break;
        }
      }
    }
    if ((state as any).screen === 'gameover') break;
  }

  state.particles = state.particles
    .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 0.02 }))
    .filter(p => p.life > 0);

  return state;
}

function handleDeath(state: GameState, p: Player, skinColor: string, _lineY: number) {
  addParticles(state.particles, p.x, p.y, skinColor, 30);
  if (state.playerBottom) {
    addParticles(state.particles, state.playerBottom.x, state.playerBottom.y, skinColor, 30);
  }
  state.screenShake = 0;
  state.screen = 'gameover';
  state.streak = 0;
  state.streakMultiplier = 1;
  const distCoins = Math.floor(state.distance / 10);
  state.coins += distCoins;
  state.totalCoins += distCoins;
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    localStorage.setItem('bestScore', String(state.bestScore));
  }
  localStorage.setItem('coins', String(state.totalCoins));
  passedObstacleIds.clear();
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasW: number,
  canvasH: number,
) {
  const h = canvasH - BANNER_HEIGHT;
  const lineY = h / 2;

  let shakeX = 0, shakeY = 0;
  if (state.screen === 'playing' && state.screenShake > 0) {
    const intensity = state.screenShake * 8;
    shakeX = (Math.random() - 0.5) * intensity;
    shakeY = (Math.random() - 0.5) * intensity;
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(shakeX, shakeY);

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(-10, -10, canvasW + 20, canvasH + 20);

  if (state.coinFlash > 0) {
    ctx.save();
    ctx.globalAlpha = state.coinFlash * 0.15;
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, canvasW, h);
    ctx.restore();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = (frameCount * 2) % 60; x < canvasW; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }

  // Draw ground line with gaps
  const gaps = state.obstacles.filter(o => o.type === 'gap');
  ctx.shadowColor = LINE_COLOR;
  ctx.shadowBlur = 20;
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = 2;
  
  if (gaps.length > 0) {
    // Draw line segments avoiding gaps
    const sortedGaps = gaps.map(g => ({ left: g.x - (g.gapWidth || 100) / 2, right: g.x + (g.gapWidth || 100) / 2 })).sort((a, b) => a.left - b.left);
    let cursorX = 0;
    for (const gap of sortedGaps) {
      if (cursorX < gap.left) {
        ctx.beginPath(); ctx.moveTo(cursorX, lineY); ctx.lineTo(gap.left, lineY); ctx.stroke();
      }
      cursorX = gap.right;
    }
    if (cursorX < canvasW) {
      ctx.beginPath(); ctx.moveTo(cursorX, lineY); ctx.lineTo(canvasW, lineY); ctx.stroke();
    }
  } else {
    ctx.beginPath(); ctx.moveTo(0, lineY); ctx.lineTo(canvasW, lineY); ctx.stroke();
  }
  ctx.shadowBlur = 0;

  const grad = ctx.createLinearGradient(0, lineY - 30, 0, lineY + 30);
  grad.addColorStop(0, 'rgba(0,255,204,0)');
  grad.addColorStop(0.5, 'rgba(0,255,204,0.08)');
  grad.addColorStop(1, 'rgba(0,255,204,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, lineY - 30, canvasW, 60);

  const skinColor = SKIN_COLORS[state.equippedSkin] || '#00ffcc';

  if (state.screen === 'menu') {
    const breathe = 0.98 + 0.04 * Math.sin((Date.now() / 800) * Math.PI);
    const px = canvasW / 2;
    const py = lineY - PLAYER_SIZE / 2;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(breathe, breathe);
    ctx.shadowColor = skinColor;
    ctx.shadowBlur = 20;
    ctx.fillStyle = skinColor;
    ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
    ctx.restore();
    ctx.restore();
    return;
  }

  const drawPlayer = (p: Player) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.scale(p.squashX, p.squashY);

    // Golden glow at 30+ streak
    if (state.streak >= 30) {
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 25;
    } else {
      ctx.shadowColor = skinColor;
      ctx.shadowBlur = 15;
    }
    ctx.fillStyle = state.streak >= 30 ? '#ffd700' : skinColor;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    if (state.hasShield) {
      ctx.strokeStyle = 'rgba(0,255,204,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  };

  drawPlayer(state.playerTop);
  if (state.playerBottom) drawPlayer(state.playerBottom);

  for (const obs of state.obstacles) {
    ctx.save();

    // Ground shadow (not for gap/ceiling/pendulum)
    if (obs.type !== 'gap' && obs.type !== 'ceiling_spikes' && obs.type !== 'pendulum') {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ff3366';
      ctx.beginPath();
      ctx.ellipse(obs.x, lineY, obs.size / 2 + 4, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = '#ff3366';
    ctx.shadowColor = '#ff3366';
    ctx.shadowBlur = 10;

    const half = obs.size / 2;
    switch (obs.type) {
      case 'triangle': {
        ctx.beginPath();
        if (obs.isTop) {
          ctx.moveTo(obs.x, obs.y - half); ctx.lineTo(obs.x + half, obs.y + half); ctx.lineTo(obs.x - half, obs.y + half);
        } else {
          ctx.moveTo(obs.x, obs.y + half); ctx.lineTo(obs.x + half, obs.y - half); ctx.lineTo(obs.x - half, obs.y - half);
        }
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'circle': {
        ctx.beginPath(); ctx.arc(obs.x, obs.y, half, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'star': {
        drawStar(ctx, obs.x, obs.y, 5, half, half / 2);
        break;
      }
      case 'spike': {
        ctx.beginPath();
        if (obs.isTop) {
          ctx.moveTo(obs.x - half, obs.y + half); ctx.lineTo(obs.x, obs.y - half); ctx.lineTo(obs.x + half, obs.y + half); ctx.lineTo(obs.x, obs.y + half * 0.5);
        } else {
          ctx.moveTo(obs.x - half, obs.y - half); ctx.lineTo(obs.x, obs.y + half); ctx.lineTo(obs.x + half, obs.y - half); ctx.lineTo(obs.x, obs.y - half * 0.5);
        }
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'diamond': {
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y - half); ctx.lineTo(obs.x + half, obs.y); ctx.lineTo(obs.x, obs.y + half); ctx.lineTo(obs.x - half, obs.y);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'spike_row': {
        const count = obs.spikeCount || 3;
        const spikeW = 14;
        const spikeH = obs.size;
        const startX = obs.x - (count * spikeW) / 2;
        for (let i = 0; i < count; i++) {
          const sx = startX + i * spikeW + spikeW / 2;
          ctx.beginPath();
          ctx.moveTo(sx - spikeW / 2, lineY);
          ctx.lineTo(sx, lineY - spikeH);
          ctx.lineTo(sx + spikeW / 2, lineY);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case 'bouncing_ball': {
        ctx.fillStyle = '#ff6644';
        ctx.shadowColor = '#ff6644';
        ctx.beginPath(); ctx.arc(obs.x, obs.y, obs.size, 0, Math.PI * 2); ctx.fill();
        // Draw a subtle "bounce shadow" on line
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.beginPath(); ctx.ellipse(obs.x, lineY, obs.size, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
      }
      case 'pendulum': {
        const pLen = obs.pendulumLength || 120;
        const anchorY = 0;
        // Draw rope
        ctx.strokeStyle = '#ff3366';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obs.x, anchorY);
        ctx.lineTo(obs.x, obs.y);
        ctx.stroke();
        // Draw bob (rectangle)
        ctx.fillStyle = '#ff3366';
        const bobW = obs.size;
        const bobH = pLen * 0.15;
        ctx.fillRect(obs.x - bobW / 2, obs.y - bobH / 2, bobW, bobH);
        break;
      }
      case 'gap': {
        // Draw danger indicators at gap edges
        const gw = obs.gapWidth || 100;
        ctx.fillStyle = '#ff3366';
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(Date.now() * 0.005);
        // Warning triangles at edges
        const triSize = 8;
        ctx.beginPath();
        ctx.moveTo(obs.x - gw / 2, lineY - triSize); ctx.lineTo(obs.x - gw / 2 + triSize, lineY); ctx.lineTo(obs.x - gw / 2, lineY + triSize);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(obs.x + gw / 2, lineY - triSize); ctx.lineTo(obs.x + gw / 2 - triSize, lineY); ctx.lineTo(obs.x + gw / 2, lineY + triSize);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'ceiling_spikes': {
        ctx.fillStyle = '#ff3366';
        const ceilCount = 5;
        const ceilSpikeW = 14;
        const ceilSpikeH = 35;
        const ceilStartX = obs.x - (ceilCount * ceilSpikeW) / 2;
        for (let i = 0; i < ceilCount; i++) {
          const sx = ceilStartX + i * ceilSpikeW + ceilSpikeW / 2;
          ctx.beginPath();
          ctx.moveTo(sx - ceilSpikeW / 2, 0);
          ctx.lineTo(sx, ceilSpikeH);
          ctx.lineTo(sx + ceilSpikeW / 2, 0);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
    }
    ctx.restore();
  }

  for (const coin of state.coinItems) {
    if (coin.collected) continue;
    ctx.save();
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#facc15';
    ctx.beginPath(); ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2); ctx.fill();
    const coinGrad = ctx.createRadialGradient(coin.x - 2, coin.y - 2, 1, coin.x, coin.y, coin.radius);
    coinGrad.addColorStop(0, 'rgba(255,255,255,0.6)');
    coinGrad.addColorStop(0.5, 'rgba(250,204,21,0.8)');
    coinGrad.addColorStop(1, '#d97706');
    ctx.fillStyle = coinGrad;
    ctx.beginPath(); ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0f0f1a';
    ctx.font = `bold ${coin.radius}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$', coin.x, coin.y + 1);
    ctx.restore();
  }

  for (const p of state.particles) {
    ctx.save();
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  if (state.activePowers.length > 0) {
    ctx.save();
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    let py = 80;
    for (const pow of state.activePowers) {
      const label = pow.type === 'shield' ? '🛡️ Shield' : pow.type === 'slowmo' ? '🐌 Slow-Mo' : '🧲 Magnet';
      const secs = Math.ceil(pow.remaining / 1000);
      ctx.fillStyle = 'rgba(0,255,204,0.8)';
      ctx.fillText(`${label} ${secs}s`, 12, py);
      py += 18;
    }
    ctx.restore();
  }

  if (state.phase === 2 && state.distance < state.phaseThreshold + 100) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - (state.distance - state.phaseThreshold) / 100);
    ctx.fillStyle = '#a855f7';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PHASE 2!', canvasW / 2, 60);
    ctx.restore();
  }

  // Milestone flash
  if (milestoneFlashTimer > 0 && state.screen === 'playing') {
    ctx.save();
    ctx.globalAlpha = Math.min(1, milestoneFlashTimer);
    ctx.fillStyle = '#00ffcc';
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur = 30;
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${milestoneFlashScore}m`, canvasW / 2, h / 2 - 80);
    ctx.restore();
  }

  // Taunt message
  if (state.tauntTimer > 0 && state.tauntText && state.screen === 'playing') {
    ctx.save();
    // Fade in first 0.3s, hold, fade out last 0.3s
    let alpha: number;
    const elapsed = 1.5 - state.tauntTimer;
    if (elapsed < 0.3) alpha = elapsed / 0.3;
    else if (state.tauntTimer < 0.3) alpha = state.tauntTimer / 0.3;
    else alpha = 1;
    ctx.globalAlpha = alpha * 0.85;

    const isRecord = state.tauntText.includes('RECORD');
    ctx.fillStyle = isRecord ? '#ffd700' : '#00ffcc';
    ctx.shadowColor = isRecord ? '#ffd700' : '#00ffcc';
    ctx.shadowBlur = 25;
    ctx.font = `bold ${isRecord ? 28 : 22}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(state.tauntText, canvasW / 2, h / 2 - 40);
    ctx.restore();
  }

  // Streak badge
  if (state.streak >= 10 && state.screen === 'playing') {
    ctx.save();
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    const badge = state.streakMultiplier >= 4 ? 'x4' : state.streakMultiplier >= 3 ? 'x3' : 'x2';
    ctx.fillStyle = state.streakMultiplier >= 4 ? '#ffd700' : state.streakMultiplier >= 3 ? '#ff69b4' : '#00ffcc';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.fillText(badge, canvasW / 2 + 50, 30);
    ctx.restore();
  }

  ctx.restore();

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, h, canvasW, BANNER_HEIGHT);
  if (!state.removeAds) {
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ADVERTISEMENT', canvasW / 2, h + BANNER_HEIGHT / 2 + 4);
  }
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerR: number, innerR: number) {
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
    rot += step;
  }
  ctx.closePath();
  ctx.fill();
}

export function handleInput(state: GameState): GameState {
  if (state.screen !== 'playing') return state;

  const pt = state.playerTop;
  if (!pt.isJumping) {
    pt.anticipation = 1;
    pt.vy = JUMP_FORCE;
    pt.isJumping = true;
  } else {
    pt.vy = Math.abs(JUMP_FORCE);
  }

  if (state.playerBottom) {
    const pb = state.playerBottom;
    if (!pb.isJumping) {
      pb.anticipation = 1;
      pb.vy = -JUMP_FORCE;
      pb.isJumping = true;
    } else {
      pb.vy = -Math.abs(JUMP_FORCE);
    }
  }

  return state;
}
