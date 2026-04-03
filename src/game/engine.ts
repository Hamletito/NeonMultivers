import { GameState, Obstacle, Coin, Particle, Player } from './types';
import {
  BG_COLOR, LINE_COLOR, LINE_GLOW_COLOR, PLAYER_SIZE, GRAVITY, JUMP_FORCE,
  BASE_SPEED, SPEED_INCREMENT, MAX_SPEED, PHASE2_DISTANCE, OBSTACLE_MIN_GAP,
  COIN_RADIUS, BANNER_HEIGHT, SKIN_COLORS,
} from './constants';

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
    playerTop: { x: 80, y: 0, size: PLAYER_SIZE, vy: 0, isJumping: false, isAboveLine: true },
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
    playerTop: { x: 80, y: 0, size: PLAYER_SIZE, vy: 0, isJumping: false, isAboveLine: true },
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

function spawnObstacle(canvasW: number, lineY: number, isTop: boolean): Obstacle {
  const types: Obstacle['type'][] = ['triangle', 'circle', 'star', 'spike', 'diamond'];
  const type = types[Math.floor(Math.random() * types.length)];
  const size = 30 + Math.random() * 20; // 30-50px consistent height
  // Position so the base sits exactly on the line
  const y = isTop
    ? lineY - size / 2  // top half: center above line so bottom edge touches line
    : lineY + size / 2; // bottom half: center below line so top edge touches line
  return { x: canvasW + 50, y, type, size, isTop };
}

function spawnCoin(canvasW: number, lineY: number, phase: 1 | 2): Coin {
  const isTop = phase === 1 ? true : Math.random() > 0.5;
  const y = isTop
    ? lineY - 30 - Math.random() * 60
    : lineY + 30 + Math.random() * 60;
  return { x: canvasW + 50 + Math.random() * 200, y, collected: false, radius: COIN_RADIUS };
}

function addParticles(particles: Particle[], x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      life: 1,
      maxLife: 1,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

function checkCollision(player: Player, obs: Obstacle): boolean {
  const dx = Math.abs(player.x - obs.x);
  const dy = Math.abs(player.y - obs.y);
  return dx < (player.size / 2 + obs.size / 2) && dy < (player.size / 2 + obs.size / 2);
}

let lastObstacleX = 0;
let lastCoinX = 0;
let frameCount = 0;

export function resetSpawners() {
  lastObstacleX = 0;
  lastCoinX = 0;
  frameCount = 0;
}

export function update(state: GameState, canvasW: number, canvasH: number, dt: number): GameState {
  if (state.screen !== 'playing') return state;

  const lineY = (canvasH - BANNER_HEIGHT) / 2;
  frameCount++;

  // Speed increase
  state.speed = Math.min(MAX_SPEED, state.baseSpeed + state.distance * SPEED_INCREMENT);

  // Slow motion power
  let effectiveSpeed = state.speed;
  const slowmo = state.activePowers.find(p => p.type === 'slowmo');
  if (slowmo) effectiveSpeed *= 0.5;

  // Update active powers
  state.activePowers = state.activePowers
    .map(p => ({ ...p, remaining: p.remaining - dt }))
    .filter(p => p.remaining > 0);

  state.distance += effectiveSpeed * 0.1;
  state.score = Math.floor(state.distance);

  // Decay screen shake & coin flash
  if (state.screenShake > 0) state.screenShake = Math.max(0, state.screenShake - dt * 0.01);
  if (state.coinFlash > 0) state.coinFlash = Math.max(0, state.coinFlash - dt * 0.005);

  // Phase check
  if (state.phase === 1 && state.distance >= state.phaseThreshold) {
    state.phase = 2;
    state.playerBottom = {
      x: 80, y: lineY + PLAYER_SIZE / 2, size: PLAYER_SIZE,
      vy: 0, isJumping: false, isAboveLine: false,
    };
  }

  // Player top physics
  const pt = state.playerTop;
  pt.y = pt.y || (lineY - PLAYER_SIZE / 2);
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

  // Player bottom physics (mirrored gravity)
  if (state.playerBottom) {
    const pb = state.playerBottom;
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
  }

  // Spawn obstacles
  const rightmostObs = state.obstacles.length > 0
    ? Math.max(...state.obstacles.map(o => o.x))
    : 0;
  if (rightmostObs < canvasW + 50 || frameCount % Math.max(30, 60 - Math.floor(state.distance / 50)) === 0) {
    if (rightmostObs < canvasW - OBSTACLE_MIN_GAP + Math.random() * 100) {
      state.obstacles.push(spawnObstacle(canvasW, lineY, true));
      if (state.phase === 2) {
        state.obstacles.push(spawnObstacle(canvasW, lineY, false));
      }
    }
  }

  // Spawn coins
  if (Math.random() < 0.02) {
    state.coinItems.push(spawnCoin(canvasW, lineY, state.phase));
  }

  // Move obstacles
  state.obstacles = state.obstacles
    .map(o => ({ ...o, x: o.x - effectiveSpeed }))
    .filter(o => o.x > -50);

  // Move coins with magnet
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

  // Coin collection
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
        state.coinFlash = 1; // trigger flash
        addParticles(state.particles, coin.x, coin.y, '#facc15', 12);
      }
    }
  }

  // Collision detection
  for (const obs of state.obstacles) {
    const players = obs.isTop ? [pt] : (state.playerBottom ? [state.playerBottom] : []);
    for (const p of players) {
      if (checkCollision(p, obs)) {
        if (state.hasShield) {
          state.hasShield = false;
          state.obstacles = state.obstacles.filter(o => o !== obs);
          addParticles(state.particles, p.x, p.y, '#00ffcc', 15);
        } else {
          // Death — screen shake
          state.screenShake = 1;
          addParticles(state.particles, p.x, p.y, SKIN_COLORS[state.equippedSkin] || '#00ffcc', 30);
          if (state.playerBottom) {
            addParticles(state.particles, state.playerBottom.x, state.playerBottom.y, SKIN_COLORS[state.equippedSkin] || '#00ffcc', 30);
          }
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

  // Update particles
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

  // Screen shake offset
  let shakeX = 0, shakeY = 0;
  if (state.screenShake > 0) {
    const intensity = state.screenShake * 8;
    shakeX = (Math.random() - 0.5) * intensity;
    shakeY = (Math.random() - 0.5) * intensity;
  }

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(-10, -10, canvasW + 20, canvasH + 20);

  // Coin flash overlay
  if (state.coinFlash > 0) {
    ctx.save();
    ctx.globalAlpha = state.coinFlash * 0.15;
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, canvasW, h);
    ctx.restore();
  }

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = (frameCount * 2) % 60; x < canvasW; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  // Glowing line
  ctx.shadowColor = LINE_COLOR;
  ctx.shadowBlur = 20;
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, lineY);
  ctx.lineTo(canvasW, lineY);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Glow spread
  const grad = ctx.createLinearGradient(0, lineY - 30, 0, lineY + 30);
  grad.addColorStop(0, 'rgba(0,255,204,0)');
  grad.addColorStop(0.5, 'rgba(0,255,204,0.08)');
  grad.addColorStop(1, 'rgba(0,255,204,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, lineY - 30, canvasW, 60);

  if (state.screen === 'menu') {
    ctx.restore();
    return;
  }

  const skinColor = SKIN_COLORS[state.equippedSkin] || '#00ffcc';

  // Draw players
  const drawPlayer = (p: Player) => {
    ctx.save();
    ctx.shadowColor = skinColor;
    ctx.shadowBlur = 15;
    ctx.fillStyle = skinColor;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    if (state.hasShield) {
      ctx.strokeStyle = 'rgba(0,255,204,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  };

  drawPlayer(state.playerTop);
  if (state.playerBottom) drawPlayer(state.playerBottom);

  // Draw obstacles
  for (const obs of state.obstacles) {
    ctx.save();
    ctx.fillStyle = '#ff3366';
    ctx.shadowColor = '#ff3366';
    ctx.shadowBlur = 10;
    switch (obs.type) {
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y - obs.size / 2);
        ctx.lineTo(obs.x + obs.size / 2, obs.y + obs.size / 2);
        ctx.lineTo(obs.x - obs.size / 2, obs.y + obs.size / 2);
        ctx.closePath();
        ctx.fill();
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.size / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'star':
        drawStar(ctx, obs.x, obs.y, 5, obs.size / 2, obs.size / 4);
        break;
      case 'spike':
        ctx.beginPath();
        ctx.moveTo(obs.x - obs.size / 2, obs.y + obs.size / 2);
        ctx.lineTo(obs.x, obs.y - obs.size / 2);
        ctx.lineTo(obs.x + obs.size / 2, obs.y + obs.size / 2);
        ctx.lineTo(obs.x, obs.y + obs.size / 4);
        ctx.closePath();
        ctx.fill();
        break;
      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y - obs.size / 2);
        ctx.lineTo(obs.x + obs.size / 2, obs.y);
        ctx.lineTo(obs.x, obs.y + obs.size / 2);
        ctx.lineTo(obs.x - obs.size / 2, obs.y);
        ctx.closePath();
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  // Draw coins — larger with glow
  for (const coin of state.coinItems) {
    if (coin.collected) continue;
    ctx.save();
    // Outer glow
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
    ctx.fill();
    // Inner highlight
    const coinGrad = ctx.createRadialGradient(coin.x - 2, coin.y - 2, 1, coin.x, coin.y, coin.radius);
    coinGrad.addColorStop(0, 'rgba(255,255,255,0.6)');
    coinGrad.addColorStop(0.5, 'rgba(250,204,21,0.8)');
    coinGrad.addColorStop(1, '#d97706');
    ctx.fillStyle = coinGrad;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
    ctx.fill();
    // $ symbol
    ctx.fillStyle = '#0f0f1a';
    ctx.font = `bold ${coin.radius}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', coin.x, coin.y + 1);
    ctx.restore();
  }

  // Draw particles
  for (const p of state.particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Active power-up indicators
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

  // Phase 2 indicator
  if (state.phase === 2 && state.distance < state.phaseThreshold + 100) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - (state.distance - state.phaseThreshold) / 100);
    ctx.fillStyle = '#a855f7';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PHASE 2!', canvasW / 2, 60);
    ctx.restore();
  }

  ctx.restore(); // end shake transform

  // Banner ad area (outside shake)
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
  let rot = Math.PI / 2 * 3;
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
    pt.vy = JUMP_FORCE;
    pt.isJumping = true;
  } else {
    pt.vy = Math.abs(JUMP_FORCE);
  }

  if (state.playerBottom) {
    const pb = state.playerBottom;
    if (!pb.isJumping) {
      pb.vy = -JUMP_FORCE;
      pb.isJumping = true;
    } else {
      pb.vy = -Math.abs(JUMP_FORCE);
    }
  }

  return state;
}
