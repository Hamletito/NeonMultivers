// Achievement definitions + progress tracking via localStorage.
// Counters tracked elsewhere in the engine:
//   achNearMisses, neonRunCount, bestScore, coins (totalCoins), bestStreak,
//   achTotalDistance, achTotalCoins, achDeaths, achMultiverseSurvived

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  goal: number;
  getProgress: () => number;
  reward: number; // coin reward
}

const num = (k: string) => {
  try { return parseInt(localStorage.getItem(k) || '0', 10) || 0; } catch { return 0; }
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_run',     name: 'First Steps',      description: 'Complete your first run',          icon: '🏁', goal: 1,    getProgress: () => num('neonRunCount'), reward: 50 },
  { id: 'runs_10',       name: 'Persistent',       description: 'Complete 10 runs',                 icon: '🔁', goal: 10,   getProgress: () => num('neonRunCount'), reward: 150 },
  { id: 'runs_50',       name: 'Marathoner',       description: 'Complete 50 runs',                 icon: '🏃', goal: 50,   getProgress: () => num('neonRunCount'), reward: 500 },
  { id: 'dist_500',      name: 'Half-K',           description: 'Reach 500 m in a single run',      icon: '📏', goal: 500,  getProgress: () => num('bestScore'),    reward: 100 },
  { id: 'dist_1000',     name: 'Kilometer Club',   description: 'Reach 1000 m in a single run',     icon: '🌟', goal: 1000, getProgress: () => num('bestScore'),    reward: 250 },
  { id: 'dist_2000',     name: 'Neon Legend',      description: 'Reach 2000 m in a single run',     icon: '👑', goal: 2000, getProgress: () => num('bestScore'),    reward: 500 },
  { id: 'coins_1000',    name: 'Coin Collector',   description: 'Earn 1000 total coins',            icon: '🪙', goal: 1000, getProgress: () => num('achTotalCoins'),reward: 100 },
  { id: 'coins_5000',    name: 'Treasure Hunter',  description: 'Earn 5000 total coins',            icon: '💰', goal: 5000, getProgress: () => num('achTotalCoins'),reward: 300 },
  { id: 'streak_30',     name: 'Untouchable',      description: 'Reach a 30-streak',                icon: '⚡', goal: 30,   getProgress: () => num('bestStreak'),   reward: 200 },
  { id: 'nearmiss_50',   name: 'Living on the Edge', description: 'Pull off 50 near-misses',        icon: '😎', goal: 50,   getProgress: () => num('achNearMisses'),reward: 150 },
  { id: 'multiverse_5',  name: 'Reality Bender',   description: 'Survive 5 multiverse events',     icon: '🌀', goal: 5,    getProgress: () => num('achMultiverseSurvived'), reward: 200 },
  { id: 'deaths_100',    name: 'Try Hard',         description: 'Die 100 times',                    icon: '💀', goal: 100,  getProgress: () => num('achDeaths'),    reward: 100 },
];

export function getClaimedSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem('achClaimed') || '[]')); } catch { return new Set(); }
}

export function claimAchievement(id: string): number {
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) return 0;
  if (a.getProgress() < a.goal) return 0;
  const claimed = getClaimedSet();
  if (claimed.has(id)) return 0;
  claimed.add(id);
  localStorage.setItem('achClaimed', JSON.stringify([...claimed]));
  // Pay reward
  const coins = num('coins') + a.reward;
  localStorage.setItem('coins', String(coins));
  return a.reward;
}
