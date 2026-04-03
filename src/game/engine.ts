import { GameState, Obstacle, Coin, Particle, Player } from './types';
import {
  BG_COLOR, LINE_COLOR, LINE_GLOW_COLOR, PLAYER_SIZE, GRAVITY, JUMP_FORCE,
  BASE_SPEED, SPEED_INCREMENT, MAX_SPEED, PHASE2_DISTANCE, OBSTACLE_MIN_GAP,
  COIN_RADIUS, BANNER_HEIGHT, SKIN_COLORS,
} from './constants';

function makePlayer(x: number, y: number, isAboveLine: boolean): Player {
  return {
    x, y, size: PLAYER_SIZE, vy: 0,
    isJumping: false, isAboveLine,
    squashX: 1, squashY: 1, rotation: 0,
    anticipation: 0, landTimer: 0, wasJumping: false,
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

function spawnObstacle(canvasW: number, lineY: number, isTop: boolean): Obstacle {
  const types: Obstacle['type'][] = ['triangle', 'circle', 'star', 'spike', 'diamond'];
  const type = types[Math.floor(Math.random() * types.length)];
  const size = 30 + Math.random() * 20;
  const y = isTop ? lineY - size / 2 : lineY + size / 2;
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
      life: 1, maxLife: 1, color,
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
    life: 0.6, maxLife: 0.6, color,
    size: 1.5 + Math.random() * 2,
  });
}

function addLandingParticles(particles: Particle[], p: Player, lineY: number, color: string) {
  const groundY = p.isAboveLine ? lineY : lineY;
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: p.x + (Math.random() - 0.5) * p.size,
      y: groundY,
      vx: (Math.random() - 0.5) * 4,
      vy: p.isAboveLine ? -(Math.random() * 2) : (Math.random() * 2),
      life: 0.5, maxLife: 0.5, color,
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
  // Land squash decay
  if (p.landTimer > 0) {
    p.landTimer = Math.max(0, p.landTimer - dt);
    const t = p.landTimer / 100; // 0→1 during squash
    p.squashX = 1 + 0.2 * t; // wider
    p.squashY = 1 - 0.15 * t; // shorter
  } else if (p.anticipation > 0) {
    // Jump anticipation squash (before launch)
    p.squashX = 1 + 0.1 * p.anticipation;
    p.squashY = 1 - 0.15 * p.anticipation;
    p.anticipation = Math.max(0, p.anticipation - dt / 80);
  } else if (p.isJumping) {
    // Airborne: stretch vertically, gentle rotation
    const stretchFactor = Math.min(1, Math.abs(p.vy) / 10);
    p.squashX = 1 - 0.12 * stretchFactor;
    p.squashY = 1 + 0.18 * stretchFactor;
    // Gentle tilt up to 15° based on vertical velocity
    const maxRot = 15 * Math.PI / 180;
    const dir = p.isAboveLine ? 1 : -1;
    p.rotation = dir * (p.vy / Math.abs(JUMP_FORCE)) * maxRot * 0.5;
  } else {
    // Grounded: subtle bob and forward lean
    const bobPhase = (Date.now() % 400) / 400;
    const bob = Math.sin(bobPhase * Math.PI * 2);
    p.squashX = 1 + bob * 0.01;
    p.squashY = 0.98 + bob * 0.02;
    // Slight forward lean + wobble
    const wobble = Math.sin((Date.now() % 600) / 600 * Math.PI * 2) * 0.02;
    p.rotation = 5 * Math.PI / 180 + wobble;
  }
}

let frameCount = 0;

export function resetSpawners() {
  frameCount = 0;
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

  // Phase check
  if (state.phase === 1 && state.distance >= state.phaseThreshold) {
    state.phase = 2;
    state.playerBottom = makePlayer(80, lineY + PLAYER_SIZE / 2, false);
  }

  const skinColor = SKIN_COLORS[state.equippedSkin] || '#00ffcc';

  // Player top physics
  const pt = state.playerTop;
  pt.y = pt.y || (lineY - PLAYER_SIZE / 2);
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
  // Landing detection
  if (ptWasJumping && !pt.isJumping) {
    pt.landTimer = 100;
    pt.rotation = 0;
    addLandingParticles(state.particles, pt, lineY, skinColor);
  }
  updatePlayerAnim(pt, dt);

  // Trail particles (every 3rd frame)
  if (frameCount % 3 === 0) {
    addTrailParticle(state.particles, pt, skinColor);
  }

  // Player bottom physics
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

  // Spawn obstacles
  const rightmostObs = state.obstacles.length > 0
    ? Math.max(...state.obstacles.map(o => o.x))
    : 0;
  const minSpawn = canvasW + 20;
  if (rightmostObs < minSpawn - OBSTACLE_MIN_GAP) {
    state.obstacles.push(spawnObstacle(canvasW, lineY, true));
    if (state.phase === 2) {
      state.obstacles.push(spawnObstacle(canvasW, lineY, false));
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
        state.coinFlash = 1;
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
          state.screenShake = 1;
          addParticles(state.particles, p.x, p.y, skinColor, 30);
          if (state.playerBottom) {
            addParticles(state.particles, state.playerBottom.x, state.playerBottom.y, skinColor, 30);
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

  let shakeX = 0, shakeY = 0;
  if (state.screenShake > 0) {
    const intensity = state.screenShake * 8;
    shakeX = (Math.random() - 0.5) * intensity;
    shakeY = (Math.random() - 0.5) * intensity;
  }

  ctx.save();
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

  // Grid
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

  const grad = ctx.createLinearGradient(0, lineY - 30, 0, lineY + 30);
  grad.addColorStop(0, 'rgba(0,255,204,0)');
  grad.addColorStop(0.5, 'rgba(0,255,204,0.08)');
  grad.addColorStop(1, 'rgba(0,255,204,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, lineY - 30, canvasW, 60);

  const skinColor = SKIN_COLORS[state.equippedSkin] || '#00ffcc';

  if (state.screen === 'menu') {
    // Idle breathing player on menu
    const breathe = 0.98 + 0.04 * Math.sin(Date.now() / 800 * Math.PI);
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

  // Draw players with squash/stretch/rotation
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

  // Draw obstacles with ground shadow
  for (const obs of state.obstacles) {
    ctx.save();

    // Ground shadow
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

  // Draw coins
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

  // Draw particles
  for (const p of state.particles) {
    ctx.save();
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
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

  ctx.restore(); // end shake

  // Banner ad area
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
    // Jump anticipation — quick squash then launch
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
