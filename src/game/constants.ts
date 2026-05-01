import { ShopItem } from './types';

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
export const OBSTACLE_MIN_GAP = PLAYER_SIZE * 2.5 + 40;
export const COIN_RADIUS = 14;
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
  coral: '#ff7f7f',
  mint: '#98ffc8',
  lavender: '#c4b5fd',
  skyblue: '#7dd3fc',
  lime: '#a3e635',
  galaxy: '#4c1d95',
  lava: '#dc2626',
  arctic: '#bae6fd',
};

export const SHOP_ITEMS: ShopItem[] = [
  // === SKINS ===
  // Common — 300
  { id: 'default', name: 'Neon Cyan', price: 0, type: 'skin', rarity: 'common', color: '#00ffcc', owned: true, equipped: true },
  { id: 'pink', name: 'Hot Pink', price: 300, type: 'skin', rarity: 'common', color: '#ff69b4', owned: false },
  { id: 'purple', name: 'Purple Rain', price: 300, type: 'skin', rarity: 'common', color: '#a855f7', owned: false },
  { id: 'coral', name: 'Coral', price: 300, type: 'skin', rarity: 'common', color: '#ff7f7f', owned: false },
  { id: 'mint', name: 'Mint', price: 300, type: 'skin', rarity: 'common', color: '#98ffc8', owned: false },
  { id: 'lavender', name: 'Lavender', price: 300, type: 'skin', rarity: 'common', color: '#c4b5fd', owned: false },
  { id: 'skyblue', name: 'Sky Blue', price: 300, type: 'skin', rarity: 'common', color: '#7dd3fc', owned: false },
  { id: 'lime', name: 'Lime', price: 300, type: 'skin', rarity: 'common', color: '#a3e635', owned: false },
  // Rare — 600
  { id: 'yellow', name: 'Golden', price: 600, type: 'skin', rarity: 'rare', color: '#facc15', owned: false },
  { id: 'orange', name: 'Blaze', price: 600, type: 'skin', rarity: 'rare', color: '#fb923c', owned: false },
  { id: 'red', name: 'Crimson', price: 600, type: 'skin', rarity: 'rare', color: '#ef4444', owned: false },
  { id: 'blue', name: 'Ocean', price: 600, type: 'skin', rarity: 'rare', color: '#3b82f6', owned: false },
  { id: 'galaxy', name: 'Galaxy', price: 600, type: 'skin', rarity: 'rare', color: '#4c1d95', owned: false },
  { id: 'lava', name: 'Lava', price: 600, type: 'skin', rarity: 'rare', color: '#dc2626', owned: false },
  { id: 'arctic', name: 'Arctic', price: 600, type: 'skin', rarity: 'rare', color: '#bae6fd', owned: false },
  // Epic — 1050
  { id: 'white', name: 'Ghost', price: 1050, type: 'skin', rarity: 'epic', color: '#ffffff', owned: false },
  { id: 'shape_circle', name: 'Circle Shape', price: 1050, type: 'skin', rarity: 'epic', color: '#00ffcc', owned: false },
  { id: 'shape_triangle', name: 'Triangle Shape', price: 1050, type: 'skin', rarity: 'epic', color: '#00ffcc', owned: false },
  { id: 'shape_star', name: 'Star Shape', price: 1050, type: 'skin', rarity: 'epic', color: '#00ffcc', owned: false },
  // Legendary — 5000 (now purchasable)
  { id: 'phantom', name: 'Phantom', price: 5000, type: 'skin', rarity: 'legendary', color: '#00ffcc', owned: false },
  { id: 'nova', name: 'Nova', price: 5000, type: 'skin', rarity: 'legendary', color: '#ffd700', owned: false },
  { id: 'prism', name: 'Prism', price: 5000, type: 'skin', rarity: 'legendary', color: '#ff00ff', owned: false },

  // === TRAILS ===
  { id: 'trail_fire', name: 'Fire Trail', price: 450, type: 'trail', rarity: 'common', owned: false },
  { id: 'trail_ice', name: 'Ice Trail', price: 450, type: 'trail', rarity: 'common', owned: false },
  { id: 'trail_smoke', name: 'Smoke Trail', price: 450, type: 'trail', rarity: 'common', owned: false },
  { id: 'trail_electric', name: 'Electric Trail', price: 600, type: 'trail', rarity: 'rare', owned: false },
  { id: 'trail_bubble', name: 'Bubble Trail', price: 600, type: 'trail', rarity: 'rare', owned: false },
  { id: 'trail_star', name: 'Star Trail', price: 750, type: 'trail', rarity: 'rare', owned: false },

  // === DEATH EFFECTS ===
  { id: 'death_confetti', name: 'Confetti Burst', price: 450, type: 'death', rarity: 'common', owned: false },
  { id: 'death_nuclear', name: 'Nuclear Explosion', price: 600, type: 'death', rarity: 'rare', owned: false },
  { id: 'death_diamond', name: 'Diamond Particles', price: 900, type: 'death', rarity: 'epic', owned: false },
  { id: 'death_firerain', name: 'Fire Rain', price: 900, type: 'death', rarity: 'epic', owned: false },

  // === JUMP EFFECTS ===
  { id: 'jump_rings', name: 'Energy Rings', price: 450, type: 'jump', rarity: 'common', owned: false },
  { id: 'jump_cloud', name: 'Cloud Puff', price: 450, type: 'jump', rarity: 'common', owned: false },
  { id: 'jump_spark', name: 'Spark Burst', price: 600, type: 'jump', rarity: 'rare', owned: false },
  { id: 'jump_shockwave', name: 'Shockwave', price: 750, type: 'jump', rarity: 'rare', owned: false },

  // === BACKGROUNDS ===
  { id: 'bg_stars', name: 'Moving Stars', price: 600, type: 'background', rarity: 'rare', owned: false },
  { id: 'bg_matrix', name: 'Matrix Rain', price: 900, type: 'background', rarity: 'epic', owned: false },
  { id: 'bg_galaxy', name: 'Galaxy Drift', price: 900, type: 'background', rarity: 'epic', owned: false },
  { id: 'bg_cyberpunk', name: 'Cyberpunk City', price: 1050, type: 'background', rarity: 'epic', owned: false },

  // === FLOOR EFFECTS ===
  { id: 'floor_electric', name: 'Electric Line', price: 600, type: 'floor', rarity: 'rare', owned: false },
  { id: 'floor_fire', name: 'Fire Line', price: 600, type: 'floor', rarity: 'rare', owned: false },
  { id: 'floor_ice', name: 'Ice Line', price: 600, type: 'floor', rarity: 'rare', owned: false },
  { id: 'floor_rainbow', name: 'Rainbow Line', price: 900, type: 'floor', rarity: 'epic', owned: false },

  // === POWER-UPS ===
  { id: 'powerup_shield', name: 'Shield', price: 50, type: 'powerup', rarity: 'common', owned: true },
  { id: 'powerup_slowmo', name: 'Slow Motion', price: 75, type: 'powerup', rarity: 'common', owned: true },
  { id: 'powerup_magnet', name: 'Coin Magnet', price: 60, type: 'powerup', rarity: 'common', owned: true },
  { id: 'powerup_goldshield', name: 'Golden Shield', price: 1200, type: 'powerup', rarity: 'epic', owned: false },
  { id: 'powerup_extremeslowmo', name: 'Extreme Slow-Mo', price: 1050, type: 'powerup', rarity: 'epic', owned: false },
  { id: 'powerup_megamagnet', name: 'Mega Magnet', price: 1200, type: 'powerup', rarity: 'epic', owned: false },
];
