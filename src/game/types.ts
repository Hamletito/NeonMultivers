export interface Player {
  x: number;
  y: number;
  size: number;
  vy: number;
  isJumping: boolean;
  isAboveLine: boolean;
  squashX: number;
  squashY: number;
  rotation: number;
  anticipation: number;
  landTimer: number;
  wasJumping: boolean;
}

export interface Obstacle {
  x: number;
  y: number;
  type: 'triangle' | 'circle' | 'star' | 'spike' | 'diamond' | 'spike_row' | 'bouncing_ball' | 'pendulum' | 'gap' | 'ceiling_spikes' | 'expanding' | 'intermittent';
  size: number;
  isTop: boolean;
  bouncePhase?: number;
  bounceSpeed?: number;
  baseY?: number;
  swingPhase?: number;
  swingSpeed?: number;
  anchorX?: number;
  pendulumLength?: number;
  spikeCount?: number;
  gapWidth?: number;
  expandPhase?: number;
  expandBaseSize?: number;
  expandMaxSize?: number;
  intermittentPhase?: number;
  intermittentVisible?: boolean;
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
  isDeathPiece?: boolean;
  width?: number;
  height?: number;
  rotationSpeed?: number;
  angle?: number;
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

export interface DeathAnimation {
  type: 'triangle_split' | 'circle_bounce' | 'ball_flatten' | 'spike_shatter' | 'gap_fall' | 'default';
  timer: number;
  x: number;
  y: number;
  color: string;
}

export interface GhostFrame {
  distance: number;
  y: number;
  isJumping: boolean;
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
  streak: number;
  streakMultiplier: number;
  tauntText: string;
  tauntTimer: number;
  shownTaunts: Set<number>;
  newRecordShown: boolean;
  // Color shift & disruption
  colorShiftIndex: number;
  colorShiftTransition: number;
  disruptionType: number;
  disruptionTimer: number;
  lastColorShiftAt: number;
  lastDisruptionAt: number;
  // Death animation
  deathAnim: DeathAnimation | null;
  // Audio events for this frame
  audioEvents: string[];
  // Run count for invisible tutorial
  runCount: number;
  // Ghost replay
  ghostFrames: GhostFrame[];
  bestGhostFrames: GhostFrame[];
  ghostIndex: number;
  // Adrenaline
  adrenaline: number; // 0-100
  adrenalineActive: boolean;
  adrenalineTimer: number;
  lastDodgeTime: number;
  // Cinematic new record
  cinematicSlowMo: number; // remaining ms, 0 = inactive
  cinematicTriggered: boolean;
  // Multiverse
  multiverseActive: boolean;
  multiverseTimer: number;
  multiverseDuration: number;
  nextMultiverseAt: number;
  multiverseOffsets: number[];
  multiverseTextTimer: number; // "MULTIVERSE" intro text
  multiverseMergeTimer: number; // merge-back animation
}
