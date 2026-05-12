import { GameState } from '../game/types';
import { Pause, Zap, Settings } from 'lucide-react';
import { useT } from '../lib/i18n';

interface Props {
  state: GameState;
  onPause: () => void;
  onActivatePower: (type: 'shield' | 'slowmo' | 'magnet') => void;
  onAdrenaline: () => void;
  onSettings: () => void;
}

export default function HUD({ state, onPause, onActivatePower, onAdrenaline, onSettings }: Props) {
  const { t } = useT();
  if (state.screen !== 'playing') return null;

  const hasActive = (type: string) => state.activePowers.some(p => p.type === type);
  const adrenalineFull = state.adrenaline >= 100;

  return (
    <>
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-20 pointer-events-auto">
        <div className="flex items-center justify-between px-3 pt-2">
          <div className="flex items-center gap-1.5">
            <button onClick={onPause} className="w-8 h-8 rounded-full bg-foreground/5 border border-foreground/20 text-foreground/70 hover:text-foreground hover:border-primary/50 active:scale-95 transition-all flex items-center justify-center">
              <Pause size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onSettings(); }}
              aria-label="Settings"
              className="w-8 h-8 rounded-full bg-foreground/5 border border-foreground/20 text-foreground/60 hover:text-foreground hover:border-primary/50 active:scale-95 transition-all flex items-center justify-center"
            >
              <Settings size={13} />
            </button>
          </div>
          <div className="text-center">
            <p className="text-primary font-mono text-2xl font-bold drop-shadow-[0_0_10px_rgba(0,255,204,0.5)] leading-none">
              {state.score}
            </p>
            {state.settings.showStreak && state.streak > 0 && (
              <p className="text-primary/60 font-mono text-[10px] mt-0.5">🔥 {state.streak}</p>
            )}
            {state.settings.showAdrenaline && (
              <div className="mt-1 flex items-center justify-center gap-1.5">
                <span className="text-[8px] font-mono text-yellow-400/70">{t('hud.adrenaline')}</span>
                <div className="relative w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-200 ${adrenalineFull ? 'bg-yellow-400 animate-pulse' : 'bg-yellow-500/70'}`} style={{ width: `${state.adrenaline}%` }} />
                </div>
                <button onClick={(e) => { e.stopPropagation(); onAdrenaline(); }} disabled={!adrenalineFull || state.adrenalineActive}
                  className={`p-0.5 rounded transition-all ${adrenalineFull && !state.adrenalineActive ? 'text-yellow-400 hover:text-yellow-300 animate-pulse' : 'text-white/20 cursor-not-allowed'}`}>
                  <Zap size={12} />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-neon-yellow font-mono text-sm drop-shadow-[0_0_8px_rgba(255,215,0,0.4)]">
            <span>💰</span><span>{state.coins}</span>
          </div>
        </div>
        {state.chaosMode && (
          <div className="text-center mt-0.5">
            <span className="text-destructive font-mono text-[10px] animate-pulse">{t('hud.chaosLabel')}</span>
          </div>
        )}
      </div>

      {/* Power-up buttons stacked on the LEFT side, vertically centered, above banner */}
      <div className="fixed left-2 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5 pointer-events-auto">
        {!state.hasShield && !hasActive('shield') && (
          <button onClick={() => onActivatePower('shield')} aria-label={t('hud.shield')}
            className="w-9 h-9 bg-primary/15 border border-primary/50 text-primary font-mono text-[10px] rounded-lg hover:bg-primary/25 active:scale-95 transition-all shadow-[0_0_10px_rgba(0,255,204,0.25)]">
            🛡️
          </button>
        )}
        {!hasActive('slowmo') && (
          <button onClick={() => onActivatePower('slowmo')} aria-label={t('hud.slowmo')}
            className="w-9 h-9 bg-primary/15 border border-primary/50 text-primary font-mono text-[10px] rounded-lg hover:bg-primary/25 active:scale-95 transition-all shadow-[0_0_10px_rgba(0,255,204,0.25)]">
            ⏱️
          </button>
        )}
        {!hasActive('magnet') && (
          <button onClick={() => onActivatePower('magnet')} aria-label={t('hud.magnet')}
            className="w-9 h-9 bg-primary/15 border border-primary/50 text-primary font-mono text-[10px] rounded-lg hover:bg-primary/25 active:scale-95 transition-all shadow-[0_0_10px_rgba(0,255,204,0.25)]">
            🧲
          </button>
        )}
      </div>
    </>
  );
}
