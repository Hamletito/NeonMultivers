import { useState, useEffect, useCallback } from 'react';
import { GameState } from '../game/types';
import { showRewarded } from '../lib/unityAds';
import { useT } from '../lib/i18n';
import RewardCountdown from './RewardCountdown';

interface Props {
  state: GameState;
  onRevive: () => void;
  onMenu: () => void;
  onPlayAgain: () => void;
  onDoubleCoins: (extra: number) => void;
}

type Mode = 'idle' | 'revive-loading' | 'revive-fallback' | 'double-loading' | 'double-fallback';

export default function GameOverScreen({ state, onRevive, onMenu, onPlayAgain, onDoubleCoins }: Props) {
  const { t } = useT();
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
    } catch { setMode('revive-fallback'); }
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
      } else { setMode('double-fallback'); }
    } catch { setMode('double-fallback'); }
  }, [doubled, state.doubledCoinsUsed, earned, onDoubleCoins]);

  if (state.screen !== 'gameover') return null;

  const isNewBest = state.score >= state.bestScore && state.score > 0;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-background/85 backdrop-blur-md pointer-events-auto animate-fade-in">
      <div className="relative flex flex-col items-center gap-3 px-5 py-4 bg-gradient-to-b from-card/95 to-background/95 border border-destructive/40 rounded-2xl w-[300px] shadow-[0_0_50px_rgba(239,68,68,0.25)] animate-scale-in">
        {/* Dramatic title */}
        <h2 className="text-3xl font-extrabold text-destructive font-mono tracking-widest drop-shadow-[0_0_20px_rgba(239,68,68,0.7)] animate-pulse">
          {t('go.title')}
        </h2>

        <div className="w-full grid grid-cols-2 gap-2">
          <div className="bg-background/60 border border-primary/30 rounded-lg py-2 text-center">
            <p className="text-[9px] font-mono text-muted-foreground uppercase">{t('go.score')}</p>
            <p className="text-primary font-mono text-xl font-bold">{state.score}</p>
          </div>
          <div className="bg-background/60 border border-yellow-400/30 rounded-lg py-2 text-center">
            <p className="text-[9px] font-mono text-muted-foreground uppercase">{t('go.best')}</p>
            <p className="text-yellow-400 font-mono text-xl font-bold">{state.bestScore}</p>
          </div>
        </div>

        {isNewBest && (
          <div className="px-3 py-1 bg-yellow-400/20 border border-yellow-400 rounded-full">
            <p className="text-yellow-400 text-[10px] font-mono font-bold animate-pulse">{t('go.newBest')}</p>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-yellow-400 font-mono text-xs">
          <span>+{earned}</span><span>🪙</span>
          {doubled && <span className="text-yellow-300 font-bold">×2!</span>}
        </div>

        {mode === 'revive-loading' && (
          <div className="flex flex-col items-center gap-1.5 py-1">
            <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground text-[10px] font-mono">{t('go.loadingAd')}</p>
          </div>
        )}
        {mode === 'revive-fallback' && (
          <RewardCountdown seconds={5} onComplete={onRevive} label={t('go.reviving')} />
        )}
        {mode === 'double-loading' && (
          <div className="flex flex-col items-center gap-1.5 py-1">
            <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground text-[10px] font-mono">{t('go.loadingAd')}</p>
          </div>
        )}
        {mode === 'double-fallback' && (
          <RewardCountdown
            seconds={5}
            onComplete={() => { setDoubled(true); onDoubleCoins(earned); setMode('idle'); }}
            label={t('go.doubling')}
          />
        )}

        {mode === 'idle' && (
          <div className="flex flex-col gap-1.5 w-full mt-1">
            <button
              onClick={tryRevive}
              className="px-4 py-2 bg-gradient-to-r from-green-500/30 to-emerald-500/30 border border-green-400 text-green-300 font-mono rounded-lg text-sm font-bold hover:from-green-500/40 hover:to-emerald-500/40 hover:shadow-[0_0_18px_rgba(74,222,128,0.5)] active:scale-95 transition-all"
            >
              {canFreeRevive ? t('go.freeRevive') : t('go.reviveAd')}
            </button>

            {!doubled && !state.doubledCoinsUsed && earned > 0 && (
              <button
                onClick={tryDouble}
                className="px-4 py-2 bg-gradient-to-r from-yellow-500/30 to-amber-500/30 border border-yellow-400 text-yellow-300 font-mono rounded-lg text-sm font-bold hover:from-yellow-500/40 hover:to-amber-500/40 hover:shadow-[0_0_18px_rgba(250,204,21,0.5)] active:scale-95 transition-all"
              >
                {t('go.doubleCoins')}
              </button>
            )}

            <button
              onClick={onPlayAgain}
              className="px-4 py-2 bg-primary/20 border border-primary text-primary font-mono rounded-lg text-sm font-bold hover:bg-primary/30 hover:shadow-[0_0_18px_rgba(0,255,204,0.5)] active:scale-95 transition-all"
            >
              {t('go.playAgain')}
            </button>

            <button
              onClick={onMenu}
              className="px-3 py-1.5 text-muted-foreground text-[11px] font-mono hover:text-foreground active:scale-95 transition-all"
            >
              {t('go.menu')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
