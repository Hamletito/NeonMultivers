export interface Player {
  x: number;
  y: number;
  size: number;
  vy: number;
  isJumping: boolean;
  isAboveLine: boolean; // true = top player, false would be bottom mirror
}

export interface Obstacle {
  x: number;
  y: number;
  type: 'triangle' | 'circle' | 'star' | 'spike';
  size: number;
  isTop: boolean; // which half
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
  remaining: number; // ms remaining
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
}
