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
const MIN_OBSTACLE_SPACING_PX = 400;
const OBSTACLE_SPAWN_X_OFFSET = 64;
const COIN_SAFE_CLEARANCE_X = 110;
const COIN_MIN_WINDOW_WIDTH = 140;

let frameCount = 0;
let forceEasyFollowUp = false;
let nextPhase2ObstacleOnTop = true;

function makePlayer(x: number, y: number, isAboveLine: boolean): Player {
  return {
    x,
    y,
    size: PLAYER_SIZE,
    vy: 0,
    isJumping: false,
    isAboveLine,
    squashX: 1,
    squashY: 1,
    rotation: 0,
    anticipation: 0,
    landTimer: 0,
    wasJumping: false,
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

function getSpawnProfile(distance: number) {
  if (distance < 100) {
    return { gapPx: 560, easyGapPx: 660, sizeScale: 0.72, hardChance: 0 };
  }
  if (distance < 200) {
    return { gapPx: 500, easyGapPx: 600, sizeScale: 0.82, hardChance: 0 };
  }
  if (distance < 350) {
    return { gapPx: 450, easyGapPx: 540, sizeScale: 0.92, hardChance: 0.12 };
  }
  return { gapPx: 400, easyGapPx: 500, sizeScale: 1, hardChance: 0.2 };
}

function getObstacleSizeCap(type: Obstacle['type']) {
  const jumpLimitedCap = getJumpHeight() * 0.6;
  const typeCap =
    type === 'triangle'
      ? 45
      : type === 'circle'
        ? 40
        : type === 'star' || type === 'diamond'
          ? 40
          : 40;

  return Math.min(typeCap, jumpLimitedCap);
}

function chooseObstacleType(distance: number, mustBeEasy: boolean): Obstacle['type'] {
  if (mustBeEasy) {
    return randomFrom(['triangle', 'diamond', 'spike']);
  }

  const profile = getSpawnProfile(distance);

  if (distance >= 200 && Math.random() < profile.hardChance) {
    return randomFrom(['circle', 'star']);
  }

  if (distance < 100) {
    return randomFrom(['triangle', 'diamond', 'circle']);
  }

  return randomFrom(['triangle', 'circle', 'diamond', 'spike']);
}

function getObstacleSize(type: Obstacle['type'], distance: number, mustBeEasy: boolean) {
  const profile = getSpawnProfile(distance);
  const cap = getObstacleSizeCap(type);
  const isPotentialHardType = type === 'circle' || type === 'star';

  let minSize = type === 'triangle' || type === 'spike' ? 28 : 24;
  let maxSize = cap * profile.sizeScale;

  if (distance < 100) {
    maxSize = Math.min(maxSize, type === 'triangle' || type === 'spike' ? 34 : 30);
  }

  if (mustBeEasy) {
    maxSize = Math.min(maxSize, type === 'triangle' || type === 'spike' ? 34 : 30);
  }

  if (!mustBeEasy && distance >= 200 && isPotentialHardType) {
    minSize = Math.max(minSize, 34);
    maxSize = cap;
  }

  maxSize = Math.max(maxSize, minSize + 2);

  return randomBetween(minSize, maxSize);
}

function isHardObstacle(obstacle: Obstacle) {
  return (obstacle.type === 'circle' || obstacle.type === 'star') && obstacle.size >= 34;
}

function createObstacle(
  canvasW: number,
  lineY: number,
  isTop: boolean,
  distance: number,
  mustBeEasy: boolean,
): Obstacle {
  const type = chooseObstacleType(distance, mustBeEasy);
  const size = getObstacleSize(type, distance, mustBeEasy);
  const y = isTop ? lineY - size / 2 : lineY + size / 2;

  return {
    x: canvasW + OBSTACLE_SPAWN_X_OFFSET,
    y,
    type,
    size,
    isTop,
  };
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
    if (!last || left > last[1]) {
      merged.push([left, right]);
    } else {
      last[1] = Math.max(last[1], right);
    }
  }

  const windows: Array<[number, number]> = [];
  let cursor = start;

  for (const [left, right] of merged) {
    if (left - cursor >= COIN_MIN_WINDOW_WIDTH) {
      windows.push([cursor, left]);
    }
    cursor = Math.max(cursor, right);
  }

  if (end - cursor >= COIN_MIN_WINDOW_WIDTH) {
    windows.push([cursor, end]);
  }

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

  return {
    x,
    y,
    collected: false,
    radius: COIN_RADIUS,
  };
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
  };
}

function addParticles(particles: Particle[], x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      life: 1,
      maxLife: 1,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

function addTrailParticle(particles: Particle[], p: Player, color: string) {
  particles.push({
    x: p.x - p.size / 2 - 2,
    y: p.y + (Math.random() - 0.5) * p.size * 0.5,
    vx: -1 - Math.random(),
    vy: (Math.random() - 0.5) * 0.5,
    life: 0.6,
    maxLife: 0.6,
    color,
    size: 1.5 + Math.random() * 2,
  });
}

function addLandingParticles(particles: Particle[], p: Player, lineY: number, color: string) {
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: p.x + (Math.random() - 0.5) * p.size,
      y: lineY,
      vx: (Math.random() - 0.5) * 4,
      vy: p.isAboveLine ? -(Math.random() * 2) : Math.random() * 2,
      life: 0.5,
      maxLife: 0.5,
      color,
      size: 1.5 + Math.random() * 2,
    });
  }
}

function checkCollision(player: Player, obs: Obstacle): boolean {
  const shrink = 0.85;
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
}

export function update(state: GameState, canvasW: number, canvasH: number, dt: number): GameState {
  if (state.screen !== 'playing') return state;

  const lineY = (canvasH - BANNER_HEIGHT) / 2;
  frameCount++;

  state.speed = Math.min(MAX_SPEED, state.baseSpeed + state.distance * SPEED_INCREMENT);

  let effectiveSpeed = state.speed;
  const slowmo = state.activePowers.find(p => p.type === 'slowmo');
  if (slowmo) effectiveSpeed *= 0.5;

  state.activePowers = state.activePowers
    .map(p => ({ ...p, remaining: p.remaining - dt }))
    .filter(p => p.remaining > 0);

  state.distance += effectiveSpeed * 0.1;
  state.score = Math.floor(state.distance);

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
  if (frameCount % 3 === 0) {
    addTrailParticle(state.particles, pt, skinColor);
  }

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
    if (frameCount % 3 === 0) {
      addTrailParticle(state.particles, pb, skinColor);
    }
  }

  const spawnProfile = getSpawnProfile(state.distance);
  const visibleObstacleCount = state.obstacles.filter(
    o => o.x + o.size / 2 >= 0 && o.x - o.size / 2 <= canvasW,
  ).length;

  if (visibleObstacleCount < MAX_VISIBLE_OBSTACLES) {
    const spawnOnTop = state.phase === 1 ? true : nextPhase2ObstacleOnTop;
    const candidate = createObstacle(canvasW, lineY, spawnOnTop, state.distance, forceEasyFollowUp);
    const requiredGapPx = Math.max(
      MIN_OBSTACLE_SPACING_PX,
      forceEasyFollowUp ? spawnProfile.easyGapPx : spawnProfile.gapPx,
    );
    const rightmostObstacleRightEdge = state.obstacles.length > 0
      ? Math.max(...state.obstacles.map(o => o.x + o.size / 2))
      : Number.NEGATIVE_INFINITY;
    const hasEnoughGap = state.obstacles.length === 0
      || rightmostObstacleRightEdge <= candidate.x - candidate.size / 2 - requiredGapPx;

    if (hasEnoughGap) {
      state.obstacles.push(candidate);
      forceEasyFollowUp = isHardObstacle(candidate);
      if (state.phase === 2) {
        nextPhase2ObstacleOnTop = !nextPhase2ObstacleOnTop;
      }
    }
  }

  if (state.coinItems.length < 2 && Math.random() < 0.012) {
    const safeCoin = spawnSafeCoin(state, canvasW, lineY);
    if (safeCoin) {
      state.coinItems.push(safeCoin);
    }
  }

  state.obstacles = state.obstacles
    .map(o => ({ ...o, x: o.x - effectiveSpeed }))
    .filter(o => o.x > -60);

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

  for (const coin of state.coinItems) {
    if (coin.collected) continue;
    const players = [pt, state.playerBottom].filter(Boolean) as Player[];
    for (const p of players) {
      const dx = p.x - coin.x;
      const dy = p.y - coin.y;
      if (Math.sqrt(dx * dx + dy * dy) < p.size / 2 + coin.radius) {
        coin.collected = true;
        state.coins++;
        state.totalCoins++;
        state.coinFlash = 1;
        addParticles(state.particles, coin.x, coin.y, '#facc15', 12);
      }
    }
  }

  for (const obs of state.obstacles) {
    const players = obs.isTop ? [pt] : (state.playerBottom ? [state.playerBottom] : []);
    for (const p of players) {
      if (checkCollision(p, obs)) {
        if (state.hasShield) {
          state.hasShield = false;
          state.obstacles = state.obstacles.filter(o => o !== obs);
          addParticles(state.particles, p.x, p.y, '#00ffcc', 15);
        } else {
          addParticles(state.particles, p.x, p.y, skinColor, 30);
          if (state.playerBottom) {
            addParticles(state.particles, state.playerBottom.x, state.playerBottom.y, skinColor, 30);
          }
          state.screenShake = 0;
          state.screen = 'gameover';
          const distCoins = Math.floor(state.distance / 10);
          state.coins += distCoins;
          state.totalCoins += distCoins;
          if (state.score > state.bestScore) {
            state.bestScore = state.score;
            localStorage.setItem('bestScore', String(state.bestScore));
          }
          localStorage.setItem('coins', String(state.totalCoins));
        }
        break;
      }
    }
    if (state.screen === 'gameover') break;
  }

  state.particles = state.particles
    .map(p => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      life: p.life - 0.02,
    }))
    .filter(p => p.life > 0);

  return state;
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasW: number,
  canvasH: number,
) {
  const h = canvasH - BANNER_HEIGHT;
  const lineY = h / 2;

  // Shake is strictly scoped to playing state
  let shakeX = 0;
  let shakeY = 0;
  if (state.screen === 'playing' && state.screenShake > 0) {
    const intensity = state.screenShake * 8;
    shakeX = (Math.random() - 0.5) * intensity;
    shakeY = (Math.random() - 0.5) * intensity;
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // hard reset
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
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  ctx.shadowColor = LINE_COLOR;
  ctx.shadowBlur = 20;
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, lineY);
  ctx.lineTo(canvasW, lineY);
  ctx.stroke();
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
    ctx.shadowColor = skinColor;
    ctx.shadowBlur = 15;
    ctx.fillStyle = skinColor;
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

    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ff3366';
    ctx.beginPath();
    ctx.ellipse(obs.x, lineY, obs.size / 2 + 4, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#ff3366';
    ctx.shadowColor = '#ff3366';
    ctx.shadowBlur = 10;

    const half = obs.size / 2;
    switch (obs.type) {
      case 'triangle':
        ctx.beginPath();
        if (obs.isTop) {
          ctx.moveTo(obs.x, obs.y - half);
          ctx.lineTo(obs.x + half, obs.y + half);
          ctx.lineTo(obs.x - half, obs.y + half);
        } else {
          ctx.moveTo(obs.x, obs.y + half);
          ctx.lineTo(obs.x + half, obs.y - half);
          ctx.lineTo(obs.x - half, obs.y - half);
        }
        ctx.closePath();
        ctx.fill();
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, half, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'star':
        drawStar(ctx, obs.x, obs.y, 5, half, half / 2);
        break;
      case 'spike':
        ctx.beginPath();
        if (obs.isTop) {
          ctx.moveTo(obs.x - half, obs.y + half);
          ctx.lineTo(obs.x, obs.y - half);
          ctx.lineTo(obs.x + half, obs.y + half);
          ctx.lineTo(obs.x, obs.y + half * 0.5);
        } else {
          ctx.moveTo(obs.x - half, obs.y - half);
          ctx.lineTo(obs.x, obs.y + half);
          ctx.lineTo(obs.x + half, obs.y - half);
          ctx.lineTo(obs.x, obs.y - half * 0.5);
        }
        ctx.closePath();
        ctx.fill();
        break;
      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y - half);
        ctx.lineTo(obs.x + half, obs.y);
        ctx.lineTo(obs.x, obs.y + half);
        ctx.lineTo(obs.x - half, obs.y);
        ctx.closePath();
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  for (const coin of state.coinItems) {
    if (coin.collected) continue;
    ctx.save();
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
    ctx.fill();
    const coinGrad = ctx.createRadialGradient(coin.x - 2, coin.y - 2, 1, coin.x, coin.y, coin.radius);
    coinGrad.addColorStop(0, 'rgba(255,255,255,0.6)');
    coinGrad.addColorStop(0.5, 'rgba(250,204,21,0.8)');
    coinGrad.addColorStop(1, '#d97706');
    ctx.fillStyle = coinGrad;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f0f1a';
    ctx.font = `bold ${coin.radius}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', coin.x, coin.y + 1);
    ctx.restore();
  }

  for (const p of state.particles) {
    ctx.save();
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
    ctx.fill();
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
