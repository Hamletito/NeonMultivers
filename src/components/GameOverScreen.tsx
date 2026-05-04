import { useState, useEffect, useCallback } from 'react';
import { GameState } from '../game/types';

interface Props {
  state: GameState;
  onRevive: () => void;
  onMenu: () => void;
}

export default function GameOverScreen({ state, onRevive, onMenu }: Props) {
  const [showRevive, setShowRevive] = useState(true);
  const [countdown, setCountdown] = useState(5);
  const [adLoading, setAdLoading] = useState(false);
  const [adFailed, setAdFailed] = useState(false);

  const canFreeRevive = !state.freeReviveUsed;

  useEffect(() => {
    if (state.screen !== 'gameover') {
      setShowRevive(true);
      setCountdown(5);
      setAdLoading(false);
      setAdFailed(false);
    }
  }, [state.screen]);

  const handleRevive = useCallback(() => {
    if (canFreeRevive) {
      onRevive();
      return;
    }
    // Simulate ad load attempt (3s timeout)
    setAdLoading(true);
    const timer = setTimeout(() => {
      // Ad failed to load — show countdown
      setAdLoading(false);
      setAdFailed(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [canFreeRevive, onRevive]);

  // Countdown when ad fails
  useEffect(() => {
    if (!adFailed) return;
    if (countdown <= 0) {
      onRevive();
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [adFailed, countdown, onRevive]);

  if (state.screen !== 'gameover') return null;

  const isNewBest = state.score >= state.bestScore && state.score > 0;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-auto">
      <div className="flex flex-col items-center gap-4 p-8 bg-card/90 border border-border rounded-2xl max-w-xs w-full">
        <h2 className="text-3xl font-bold text-destructive font-mono">GAME OVER</h2>

        <div className="text-center space-y-1">
          <p className="text-foreground font-mono text-xl">{state.score}</p>
          {isNewBest && (
            <p className="text-primary text-xs font-mono animate-pulse">NEW BEST!</p>
          )}
          <p className="text-muted-foreground text-xs font-mono">
            Best: {state.bestScore}
          </p>
        </div>

        {showRevive && (
          <>
            {adLoading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground text-xs font-mono">Loading ad...</p>
              </div>
            ) : adFailed ? (
              <div className="flex flex-col items-center gap-2">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                    <circle
                      cx="32" cy="32" r="28"
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="4"
                      strokeDasharray={175.93}
                      strokeDashoffset={175.93 * (countdown / 5)}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-primary font-mono text-lg font-bold">
                    {countdown}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs font-mono">Reviving...</p>
              </div>
            ) : (
              <button
                onClick={handleRevive}
                className="px-6 py-2 bg-primary/20 border border-primary text-primary font-mono rounded-lg hover:bg-primary/30 transition-all text-sm"
              >
                {canFreeRevive ? '🔄 FREE REVIVE' : '📺 REVIVE (Watch Ad)'}
              </button>
            )}
          </>
        )}

        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: 'NeonMultiverse', text: `I scored ${state.score} in NeonMultiverse!` });
            }
          }}
          className="px-6 py-2 bg-accent/20 border border-accent text-accent font-mono rounded-lg text-sm hover:bg-accent/30 transition-all"
        >
          SHARE
        </button>

        <button
          onClick={onMenu}
          className="text-muted-foreground text-xs font-mono hover:text-foreground transition-colors"
        >
          BACK TO MENU
        </button>
      </div>
    </div>
  );
}
