export const BG_COLOR = '#0f0f1a';
export const LINE_COLOR = '#00ffcc';
export const LINE_GLOW_COLOR = 'rgba(0, 255, 204, 0.3)';
export const PLAYER_SIZE = 28;
export const GRAVITY = 0.6;
export const JUMP_FORCE = -12;
export const BASE_SPEED = 4;
export const SPEED_INCREMENT = 0.0003;
export const MAX_SPEED = 14;
export const PHASE2_DISTANCE = 200;
export const OBSTACLE_MIN_GAP = 180;
export const COIN_RADIUS = 10;
export const BANNER_HEIGHT = 60;

export const SKIN_COLORS: Record<string, string> = {
  default: '#00ffcc',
  pink: '#ff69b4',
  purple: '#a855f7',
  yellow: '#facc15',
  orange: '#fb923c',
  red: '#ef4444',
  blue: '#3b82f6',
  white: '#ffffff',
};

export const SHOP_ITEMS = [
  // Skins
  { id: 'default', name: 'Neon Cyan', price: 0, type: 'skin' as const, color: '#00ffcc', owned: true, equipped: true },
  { id: 'pink', name: 'Hot Pink', price: 100, type: 'skin' as const, color: '#ff69b4', owned: false },
  { id: 'purple', name: 'Purple Rain', price: 100, type: 'skin' as const, color: '#a855f7', owned: false },
  { id: 'yellow', name: 'Golden', price: 150, type: 'skin' as const, color: '#facc15', owned: false },
  { id: 'orange', name: 'Blaze', price: 150, type: 'skin' as const, color: '#fb923c', owned: false },
  { id: 'red', name: 'Crimson', price: 200, type: 'skin' as const, color: '#ef4444', owned: false },
  { id: 'blue', name: 'Ocean', price: 200, type: 'skin' as const, color: '#3b82f6', owned: false },
  { id: 'white', name: 'Ghost', price: 300, type: 'skin' as const, color: '#ffffff', owned: false },
  // Trails
  { id: 'trail_spark', name: 'Spark Trail', price: 200, type: 'trail' as const, owned: false },
  { id: 'trail_rainbow', name: 'Rainbow Trail', price: 350, type: 'trail' as const, owned: false },
  // Death effects
  { id: 'death_explode', name: 'Explosion', price: 150, type: 'death' as const, owned: false },
  { id: 'death_shatter', name: 'Shatter', price: 250, type: 'death' as const, owned: false },
  // Power-ups
  { id: 'powerup_shield', name: 'Shield', price: 50, type: 'powerup' as const, owned: true },
  { id: 'powerup_slowmo', name: 'Slow Motion', price: 75, type: 'powerup' as const, owned: true },
  { id: 'powerup_magnet', name: 'Coin Magnet', price: 60, type: 'powerup' as const, owned: true },
];
