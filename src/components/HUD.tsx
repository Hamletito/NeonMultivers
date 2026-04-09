import { GameState } from '../game/types';
import { Pause, Volume2, VolumeX, Zap, Settings } from 'lucide-react';

interface Props {
  state: GameState;
  onPause: () => void;
  onActivatePower: (type: 'shield' | 'slowmo' | 'magnet') => void;
  onAdrenaline: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onSettings: () => void;
}

export default function HUD({ state, onPause, onActivatePower, onAdrenaline, isMuted, onToggleMute, onSettings }: Props) {
  if (state.screen !== 'playing') return null;

  const hasActive = (type: string) => state.activePowers.some(p => p.type === type);
  const adrenalineFull = state.adrenaline >= 100;

  return (
    <div className="fixed top-0 left-0 right-0 z-20 pointer-events-auto">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <button onClick={onPause} className="text-foreground/60 hover:text-foreground transition-colors">
            <Pause size={24} />
          </button>
          <button onClick={onToggleMute} className="text-foreground/60 hover:text-foreground transition-colors">
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onSettings(); }} className="text-foreground/60 hover:text-foreground transition-colors">
            <Settings size={18} />
          </button>
        </div>
        <div className="text-center">
          <p className="text-primary font-mono text-2xl font-bold drop-shadow-[0_0_10px_rgba(0,255,204,0.4)]">
            {state.score}
          </p>
          {state.settings.showStreak && state.streak > 0 && (
            <p className="text-primary/50 font-mono text-xs">
              🔥 {state.streak}
            </p>
          )}
          {state.settings.showAdrenaline && (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[9px] font-mono text-yellow-400/70">ADRENALINE</span>
              <div className="relative w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    adrenalineFull ? 'bg-yellow-400 animate-pulse' : 'bg-yellow-500/70'
                  }`}
                  style={{ width: `${state.adrenaline}%` }}
                />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onAdrenaline(); }}
                disabled={!adrenalineFull || state.adrenalineActive}
                className={`p-0.5 rounded transition-all ${
                  adrenalineFull && !state.adrenalineActive
                    ? 'text-yellow-400 hover:text-yellow-300 animate-pulse'
                    : 'text-white/20 cursor-not-allowed'
                }`}
              >
                <Zap size={14} />
              </button>
            </div>
          )}
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
      {/* Chaos mode indicator */}
      {state.chaosMode && (
        <div className="text-center mt-1">
          <span className="text-destructive font-mono text-[10px] animate-pulse">🔥 CHAOS MODE 🔥</span>
        </div>
      )}
    </div>
  );
}
