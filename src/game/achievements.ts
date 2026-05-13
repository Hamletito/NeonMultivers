// Achievement definitions + progress tracking via localStorage.
// Counters tracked elsewhere in the engine:
//   achNearMisses, neonRunCount, bestScore, coins (totalCoins), bestStreak,
//   achTotalDistance, achTotalCoins, achDeaths, achMultiverseSurvived,
//   achTimeWarp, achGhostWave, achShrinking, achComboX5, achCheckpointRevive,
//   achFrenzyBest, achBossesDefeated, achLongRunMs, achNoPowerup2k

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  goal: number;
  getProgress: () => number;
  reward: number; // coin reward
  secret?: boolean;
}

const num = (k: string) => {
  try { return parseInt(localStorage.getItem(k) || '0', 10) || 0; } catch { return 0; }
};

export const ACHIEVEMENTS: Achievement[] = [
  // === Original visible ===
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

  // === New visible (Phase 3) ===
  { id: 'mv_50',         name: 'Multiverse Veteran', description: 'Survive 50 multiverse events',   icon: '🌀', goal: 50,   getProgress: () => num('achMultiverseSurvived'), reward: 400 },
  { id: 'timewarp_20',   name: 'Time Warper',      description: 'Survive 20 time-warp events',      icon: '⚡', goal: 20,   getProgress: () => num('achTimeWarp'),  reward: 300 },
  { id: 'ghostwave_10',  name: 'Ghost Whisperer',  description: 'Survive 10 ghost waves',           icon: '👻', goal: 10,   getProgress: () => num('achGhostWave'), reward: 250 },
  { id: 'shrink_20',     name: 'World Shrinker',   description: 'Survive 20 shrinking-world events',icon: '🌍', goal: 20,   getProgress: () => num('achShrinking'), reward: 300 },
  { id: 'combo_x5_10',   name: 'Combo King',       description: 'Reach x5 combo 10 times',          icon: '💫', goal: 10,   getProgress: () => num('achComboX5'),   reward: 250 },
  { id: 'checkpoint_10', name: 'Checkpoint Charlie', description: 'Use a checkpoint revive 10 times', icon: '🏁', goal: 10, getProgress: () => num('achCheckpointRevive'), reward: 200 },
  { id: 'frenzy_50',     name: 'Frenzy Master',    description: 'Collect 50 coins in a single coin frenzy', icon: '💰', goal: 50, getProgress: () => num('achFrenzyBest'), reward: 300 },
  { id: 'insane_10k',    name: 'Insane',           description: 'Reach 10000 m in a single run',    icon: '👑', goal: 10000, getProgress: () => num('bestScore'),  reward: 1000 },
  { id: 'streak_x4_30',  name: 'On a Roll',        description: 'Maintain x4 streak for 30 obstacles', icon: '🔥', goal: 30, getProgress: () => num('achX4Run'),  reward: 250 },
  { id: 'boss_50',       name: 'Boss Slayer',      description: 'Defeat 50 bosses total',           icon: '🗡️', goal: 50,  getProgress: () => num('achBossesDefeated'), reward: 500 },
  { id: 'boss_all',      name: 'Boss Hunter',      description: 'Defeat every boss type at least once', icon: '🗡️', goal: 5, getProgress: () => num('achBossTypes'), reward: 400 },
  { id: 'rainbow_50',    name: 'Rainbow Runner',   description: 'Reach x5 combo 50 times total',    icon: '🌈', goal: 50,   getProgress: () => num('achComboX5'),   reward: 500 },
  { id: 'survivor_10m',  name: 'Survivor',         description: 'Play a single run for over 10 min',icon: '⏱️', goal: 600000, getProgress: () => num('achLongRunMs'), reward: 400 },
  { id: 'perfect_2k',    name: 'Perfectionist',    description: 'Reach 2000 m without using power-ups', icon: '🎯', goal: 1, getProgress: () => num('achNoPowerup2k'), reward: 500 },

  // === Secret achievements ===
  { id: 'sec_blackout5', secret: true, name: '???', description: 'Survive the Blackout boss without dying 5 times', icon: '⬛', goal: 5, getProgress: () => num('achBlackoutSurvive'), reward: 500 },
  { id: 'sec_warp_x5',   secret: true, name: '???', description: 'Reach x5 combo during a Time Warp event', icon: '⚡', goal: 1, getProgress: () => num('achWarpComboX5'), reward: 500 },
  { id: 'sec_frenzy100', secret: true, name: '???', description: 'Collect 100 coins in a single coin frenzy', icon: '💰', goal: 100, getProgress: () => num('achFrenzyBest'), reward: 750 },
  { id: 'sec_die_milestones', secret: true, name: '???', description: 'Die exactly at 1000, 2000 and 3000 m', icon: '💀', goal: 3, getProgress: () => num('achMilestoneDeaths'), reward: 500 },
  { id: 'sec_mirror_10', secret: true, name: '???', description: 'Survive Mirror Run 10 times without dying', icon: '🪞', goal: 10, getProgress: () => num('achMirrorSurvive'), reward: 500 },
  { id: 'sec_insane',    secret: true, name: '???', description: 'Reach Insane Mode (10000 m)', icon: '👑', goal: 10000, getProgress: () => num('bestScore'), reward: 1000 },
  { id: 'sec_5_in_a_row', secret: true, name: '???', description: 'Play 5 runs in a row without closing the app', icon: '🔥', goal: 5, getProgress: () => num('achSessionRuns'), reward: 500 },
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
