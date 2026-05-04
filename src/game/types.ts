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
  type: 'triangle' | 'circle' | 'star' | 'spike' | 'diamond' | 'spike_row' | 'bouncing_ball' | 'pendulum' | 'gap' | 'ceiling_spikes' | 'expanding' | 'intermittent' | 'wall_gap' | 'meteor' | 'spinning_blade' | 'fake' | 'speed_pad' | 'double_jump' | 'ceiling_spike_trap' | 'rolling_rock' | 'laser_beam' | 'zip_zap' | 'ghost_obstacle' | 'bouncing_mine' | 'shrinking_platform';
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
  wallGapPosition?: 'top' | 'bottom';
  wallWidth?: number;
  meteorVy?: number;
  bladeAngle?: number;
  isFake?: boolean;
  speedPadActive?: boolean;
  // New obstacle properties
  laserSweepPhase?: number;
  laserSweepDir?: number;
  ghostSolid?: boolean;
  ghostPhase?: number;
  mineVy?: number;
  mineVx?: number;
  shrinkAmount?: number;
  rockSpeed?: number;
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
  type: 'skin' | 'trail' | 'death' | 'powerup' | 'jump' | 'background' | 'floor';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
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

export interface GameSettings {
  masterVolume: number;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  particlesEnabled: boolean;
  screenShakeEnabled: boolean;
  bgAnimEnabled: boolean;
  showDistance: boolean;
  showStreak: boolean;
  showAdrenaline: boolean;
  controlSensitivity: 'normal' | 'high';
  dailyNotifications: boolean;
  seasonAlerts: boolean;
  playerName: string;
}

export interface PlayerProfile {
  name: string;
  shape: string;
  color: string;
  created: boolean;
}

export interface SpecialEvent {
  type: 'floor_wave' | 'gravity_flip' | 'line_rotation' | 'black_white' | 'mirror' | 'matrix_mode' | 'invisible_floor' | 'speed_surge' | 'zoom_out' | 'glitch';
  timer: number;
  duration: number;
}

export interface GameState {
  screen: 'menu' | 'playing' | 'gameover' | 'shop' | 'paused' | 'settings';
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
  equippedJump: string;
  equippedBackground: string;
  equippedFloor: string;
  screenShake: number;
  coinFlash: number;
  streak: number;
  streakMultiplier: number;
  tauntText: string;
  tauntTimer: number;
  shownTaunts: Set<number>;
  newRecordShown: boolean;
  colorShiftIndex: number;
  colorShiftTransition: number;
  disruptionType: number;
  disruptionTimer: number;
  lastColorShiftAt: number;
  lastDisruptionAt: number;
  deathAnim: DeathAnimation | null;
  audioEvents: string[];
  runCount: number;
  // Ghost
  ghostMode: boolean;
  ghostFrames: GhostFrame[];
  bestGhostFrames: GhostFrame[];
  ghostIndex: number;
  // Adrenaline
  adrenaline: number;
  adrenalineActive: boolean;
  adrenalineTimer: number;
  lastDodgeTime: number;
  // Cinematic
  cinematicSlowMo: number;
  cinematicTriggered: boolean;
  // Multiverse
  multiverseActive: boolean;
  multiverseTimer: number;
  multiverseDuration: number;
  nextMultiverseAt: number;
  multiverseOffsets: number[];
  multiverseTextTimer: number;
  multiverseMergeTimer: number;
  multiverseObstacles: Obstacle[][];
  multiverseCount: number;
  multiverseWarningTimer: number;
  // Events
  floorWaveTimer: number;
  floorWavePhase: number;
  nextFloorWaveAt: number;
  meteorShowerTimer: number;
  nextMeteorAt: number;
  tunnelTimer: number;
  nextTunnelAt: number;
  tunnelAmount: number;
  // Speed boost
  speedBoostTimer: number;
  speedBoostSlowTimer: number;
  // Chaos mode
  chaosMode: boolean;
  chaosUnlocked: boolean;
  // Settings
  settings: GameSettings;
  // Special events
  specialEvent: SpecialEvent | null;
  nextSpecialEventAt: number;
  lastSpecialEventDist: number;
  // Chaos-specific
  chaosObstacleStormTimer: number;
  chaosMirrorFlipTimer: number;
  chaosSpeedSpikeTimer: number;
  chaosInvisibleFloorTimer: number;
  nextChaosEventAt: number;
  // Chaos bg flicker
  chaosFlickerTimer: number;
  // Death animation gating + post-revive invincibility
  dyingTimer: number; // ms remaining before transitioning to gameover
  invincibleTimer: number; // ms remaining of post-revive invincibility
  // Ads / economy
  coinsEarnedThisRun: number;
  doubledCoinsUsed: boolean;
  powerUpAdsUsedThisRun: number;
}
