import { useState, useEffect, useCallback } from 'react';
import { GameState } from '../game/types';
import { showRewarded } from '../lib/unityAds';
import RewardCountdown from './RewardCountdown';

interface Props {
  state: GameState;
  onRevive: () => void;
  onMenu: () => void;
  onDoubleCoins: (extra: number) => void;
}

type Mode = 'idle' | 'revive-loading' | 'revive-fallback' | 'double-loading' | 'double-fallback';

export default function GameOverScreen({ state, onRevive, onMenu, onDoubleCoins }: Props) {
  const [mode, setMode] = useState<Mode>('idle');
  const [doubled, setDoubled] = useState(false);

  const canFreeRevive = !state.freeReviveUsed;
  const earned = state.coinsEarnedThisRun || 0;

  useEffect(() => {
    if (state.screen !== 'gameover') {
      setMode('idle');
      setDoubled(false);
    }
  }, [state.screen]);

  const tryRevive = useCallback(async () => {
    if (canFreeRevive) { onRevive(); return; }
    setMode('revive-loading');
    try {
      const ok = await showRewarded(3000);
      if (ok) onRevive();
      else setMode('revive-fallback');
    } catch {
      setMode('revive-fallback');
    }
  }, [canFreeRevive, onRevive]);

  const tryDouble = useCallback(async () => {
    if (doubled || state.doubledCoinsUsed) return;
    setMode('double-loading');
    try {
      const ok = await showRewarded(3000);
      if (ok) {
        setDoubled(true);
        onDoubleCoins(earned);
        setMode('idle');
      } else {
        setMode('double-fallback');
      }
    } catch {
      setMode('double-fallback');
    }
  }, [doubled, state.doubledCoinsUsed, earned, onDoubleCoins]);

  if (state.screen !== 'gameover') return null;

  const isNewBest = state.score >= state.bestScore && state.score > 0;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-auto">
      <div className="flex flex-col items-center gap-3 p-6 bg-card/90 border border-border rounded-2xl max-w-xs w-full">
        <h2 className="text-2xl font-bold text-destructive font-mono">GAME OVER</h2>

        <div className="text-center space-y-1">
          <p className="text-foreground font-mono text-xl">{state.score}</p>
          {isNewBest && <p className="text-primary text-xs font-mono animate-pulse">NEW BEST!</p>}
          <p className="text-muted-foreground text-xs font-mono">Best: {state.bestScore}</p>
          <p className="text-yellow-400 text-xs font-mono">+{earned} 🪙 this run{doubled ? ' (x2!)' : ''}</p>
        </div>

        {mode === 'revive-loading' && (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground text-xs font-mono">Loading ad...</p>
          </div>
        )}
        {mode === 'revive-fallback' && (
          <RewardCountdown seconds={5} onComplete={onRevive} label="Reviving..." />
        )}
        {mode === 'double-loading' && (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground text-xs font-mono">Loading ad...</p>
          </div>
        )}
        {mode === 'double-fallback' && (
          <RewardCountdown
            seconds={5}
            onComplete={() => { setDoubled(true); onDoubleCoins(earned); setMode('idle'); }}
            label="Doubling coins..."
          />
        )}

        {mode === 'idle' && (
          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={tryRevive}
              className="px-4 py-2 bg-green-500/20 border border-green-500 text-green-400 font-mono rounded-lg hover:bg-green-500/30 transition-all text-sm"
            >
              {canFreeRevive ? '💚 FREE REVIVE' : '💚 REVIVE (Watch Ad)'}
            </button>

            {!doubled && !state.doubledCoinsUsed && earned > 0 && (
              <button
                onClick={tryDouble}
                className="px-4 py-2 bg-yellow-500/20 border border-yellow-500 text-yellow-400 font-mono rounded-lg hover:bg-yellow-500/30 transition-all text-xs"
              >
                💰 2X COINS — Watch ad to double your {earned} coins!
              </button>
            )}

            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: 'NeonMultiverse', text: `I scored ${state.score} in NeonMultiverse!` });
                }
              }}
              className="px-4 py-2 bg-accent/20 border border-accent text-accent font-mono rounded-lg text-xs hover:bg-accent/30 transition-all"
            >
              SHARE
            </button>

            <button
              onClick={onMenu}
              className="text-muted-foreground text-xs font-mono hover:text-foreground transition-colors mt-1"
            >
              BACK TO MENU
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
