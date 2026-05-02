import { useState } from 'react';
import { ACHIEVEMENTS, getClaimedSet, claimAchievement } from '../game/achievements';

interface Props {
  onBack: () => void;
  onCoinsUpdate: (coins: number) => void;
}

export default function AchievementsScreen({ onBack, onCoinsUpdate }: Props) {
  const [, setTick] = useState(0);
  const claimed = getClaimedSet();

  const handleClaim = (id: string) => {
    const reward = claimAchievement(id);
    if (reward > 0) {
      const coins = parseInt(localStorage.getItem('coins') || '0', 10);
      onCoinsUpdate(coins);
      setTick(t => t + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-30 bg-background/95 backdrop-blur overflow-y-auto pointer-events-auto">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-mono text-primary drop-shadow-[0_0_15px_rgba(0,255,204,0.5)]">🏆 ACHIEVEMENTS</h2>
          <button onClick={onBack} className="px-4 py-2 border border-primary/40 text-primary font-mono text-sm rounded hover:bg-primary/10">← BACK</button>
        </div>

        <div className="grid gap-3">
          {ACHIEVEMENTS.map(a => {
            const progress = a.getProgress();
            const pct = Math.min(100, (progress / a.goal) * 100);
            const done = progress >= a.goal;
            const isClaimed = claimed.has(a.id);
            return (
              <div key={a.id} className={`border rounded-lg p-4 font-mono ${isClaimed ? 'border-primary/60 bg-primary/5' : done ? 'border-yellow-400/60 bg-yellow-400/5 animate-pulse' : 'border-muted/30 bg-muted/5'}`}>
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{a.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm text-foreground">{a.name}</h3>
                      <span className="text-xs text-yellow-400">+{a.reward} 🪙</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{a.description}</p>
                    <div className="mt-2 h-2 bg-background rounded-full overflow-hidden border border-muted/30">
                      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] text-muted-foreground">{Math.min(progress, a.goal)} / {a.goal}</span>
                      {isClaimed ? (
                        <span className="text-[10px] text-primary">✓ CLAIMED</span>
                      ) : done ? (
                        <button onClick={() => handleClaim(a.id)} className="px-3 py-1 bg-yellow-400/20 border border-yellow-400 text-yellow-400 text-[10px] rounded hover:bg-yellow-400/30">CLAIM</button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Locked</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
