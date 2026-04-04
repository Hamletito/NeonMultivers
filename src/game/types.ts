export interface Player {
  x: number;
  y: number;
  size: number;
  vy: number;
  isJumping: boolean;
  isAboveLine: boolean;
  // Animation state
  squashX: number;   // width scale (1 = normal)
  squashY: number;   // height scale (1 = normal)
  rotation: number;  // radians
  anticipation: number; // 0-1, jump anticipation squash timer
  landTimer: number;    // ms remaining of land squash
  wasJumping: boolean;  // track landing frame
}

export interface Obstacle {
  x: number;
  y: number;
  type: 'triangle' | 'circle' | 'star' | 'spike' | 'diamond' | 'spike_row' | 'bouncing_ball' | 'pendulum' | 'gap' | 'ceiling_spikes';
  size: number;
  isTop: boolean;
  // bouncing_ball
  bouncePhase?: number;
  bounceSpeed?: number;
  baseY?: number;
  // pendulum
  swingPhase?: number;
  swingSpeed?: number;
  anchorX?: number;
  pendulumLength?: number;
  // spike_row
  spikeCount?: number;
  // gap
  gapWidth?: number;
}

export interface Coin {
  x: number;
  y: number;
  collected: boolean;
  radius: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface PowerUpActive {
  type: 'shield' | 'slowmo' | 'magnet';
  remaining: number;
}

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  type: 'skin' | 'trail' | 'death' | 'powerup';
  color?: string;
  owned: boolean;
  equipped?: boolean;
}

export interface GameState {
  screen: 'menu' | 'playing' | 'gameover' | 'shop' | 'paused';
  score: number;
  bestScore: number;
  coins: number;
  totalCoins: number;
  distance: number;
  speed: number;
  baseSpeed: number;
  phase: 1 | 2;
  phaseThreshold: number;
  playerTop: Player;
  playerBottom: Player | null;
  obstacles: Obstacle[];
  coinItems: Coin[];
  particles: Particle[];
  activePowers: PowerUpActive[];
  hasShield: boolean;
  freeReviveUsed: boolean;
  removeAds: boolean;
  equippedSkin: string;
  equippedTrail: string;
  equippedDeath: string;
  screenShake: number;
  coinFlash: number;
  // Streak multiplier
  streak: number;
  streakMultiplier: number;
  // Taunt messages
  tauntText: string;
  tauntTimer: number;
  shownTaunts: Set<number>;
  newRecordShown: boolean;
}
