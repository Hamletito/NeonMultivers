import { GameState } from '../game/types';
import { Pause } from 'lucide-react';

interface Props {
  state: GameState;
  onPause: () => void;
  onActivatePower: (type: 'shield' | 'slowmo' | 'magnet') => void;
}

export default function HUD({ state, onPause, onActivatePower }: Props) {
  if (state.screen !== 'playing') return null;

  const hasActive = (type: string) => state.activePowers.some(p => p.type === type);

  return (
    <div className="fixed top-0 left-0 right-0 z-20 pointer-events-auto">
      <div className="flex items-center justify-between p-4">
        <button onClick={onPause} className="text-foreground/60 hover:text-foreground transition-colors">
          <Pause size={24} />
        </button>
        <div className="text-center">
          <p className="text-primary font-mono text-2xl font-bold drop-shadow-[0_0_10px_rgba(0,255,204,0.4)]">
            {state.score}
          </p>
        </div>
        <div className="flex items-center gap-1 text-neon-yellow font-mono text-sm">
          <span>💰</span>
          <span>{state.coins}</span>
        </div>
      </div>
      {/* Power-up buttons */}
      <div className="flex justify-center gap-2 px-4">
        {!state.hasShield && !hasActive('shield') && (
          <button
            onClick={() => onActivatePower('shield')}
            className="px-3 py-1 bg-primary/10 border border-primary/40 text-primary font-mono text-xs rounded-lg hover:bg-primary/20 transition-all"
          >
            🛡️ Shield
          </button>
        )}
        {!hasActive('slowmo') && (
          <button
            onClick={() => onActivatePower('slowmo')}
            className="px-3 py-1 bg-primary/10 border border-primary/40 text-primary font-mono text-xs rounded-lg hover:bg-primary/20 transition-all"
          >
            🐌 Slow-Mo
          </button>
        )}
        {!hasActive('magnet') && (
          <button
            onClick={() => onActivatePower('magnet')}
            className="px-3 py-1 bg-primary/10 border border-primary/40 text-primary font-mono text-xs rounded-lg hover:bg-primary/20 transition-all"
          >
            🧲 Magnet
          </button>
        )}
      </div>
    </div>
  );
}
