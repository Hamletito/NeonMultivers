import { GameState, PlayerProfile } from '../game/types';
import { Ghost, Settings, Lock } from 'lucide-react';
import { useT } from '../lib/i18n';

interface Props {
  state: GameState;
  onPlay: () => void;
  onShop: () => void;
  onGhostMode: () => void;
  onChaosMode: () => void;
  onSettings: () => void;
  onAchievements: () => void;
  profile?: PlayerProfile | null;
}

export default function MenuScreen({ state, onPlay, onShop, onGhostMode, onChaosMode, onSettings, onAchievements, profile }: Props) {
  const { t } = useT();
  if (state.screen !== 'menu') return null;
  const hasBestRun = state.bestGhostFrames.length > 0;

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-2 sm:gap-3 pointer-events-auto px-4 py-2 overflow-hidden">
      {profile?.created && (
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md border flex items-center justify-center" style={{ backgroundColor: profile.color + '30', borderColor: profile.color }}>
            <span className="text-[10px]" style={{ color: profile.color }}>
              {profile.shape === 'shape_circle' ? '●' : profile.shape === 'shape_triangle' ? '▲' : profile.shape === 'shape_star' ? '★' : '■'}
            </span>
          </div>
          <span className="font-mono text-[10px] text-foreground/70">{profile.name}</span>
        </div>
      )}

      <button
        onClick={onSettings}
        aria-label="Settings"
        className="absolute top-2 right-2 w-9 h-9 rounded-full border border-primary/50 bg-primary/10 text-primary flex items-center justify-center shadow-[0_0_15px_rgba(0,255,204,0.35)] hover:bg-primary/20 hover:shadow-[0_0_25px_rgba(0,255,204,0.6)] active:scale-95 transition-all"
      >
        <Settings size={16} />
      </button>

      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-wider text-primary drop-shadow-[0_0_25px_rgba(0,255,204,0.5)] font-mono">
        NeonMultiverse
      </h1>
      <p className="text-muted-foreground text-[10px] font-mono -mt-1">
        {t('menu.best')}: <span className="text-primary">{state.bestScore}</span>
      </p>

      <div className="flex flex-col gap-1.5 w-40 sm:w-44">
        <button onClick={onPlay} className="px-4 py-2 bg-primary/20 border border-primary text-primary font-mono text-sm rounded-md hover:bg-primary/30 active:scale-95 transition-all hover:shadow-[0_0_18px_rgba(0,255,204,0.4)]">
          {t('menu.play')}
        </button>

        <button
          onClick={onGhostMode}
          disabled={!hasBestRun}
          title={!hasBestRun ? t('menu.unlockGhost') : undefined}
          className={`px-4 py-1.5 border font-mono text-[11px] rounded-md transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
            hasBestRun ? 'bg-white/10 border-white/40 text-white hover:bg-white/20' : 'bg-muted/10 border-muted/30 text-muted-foreground cursor-not-allowed'
          }`}
        >
          <Ghost size={12} />
          {hasBestRun ? t('menu.vsGhost') : t('menu.vsGhostLocked')}
        </button>

        <button
          onClick={onChaosMode}
          className={`px-4 py-1.5 border font-mono text-[11px] rounded-md transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
            state.chaosUnlocked ? 'bg-destructive/20 border-destructive/60 text-destructive hover:bg-destructive/30' : 'bg-muted/10 border-muted/30 text-muted-foreground hover:border-yellow-400/40 hover:text-yellow-400'
          }`}
        >
          {state.chaosUnlocked ? t('menu.chaos') : (<><Lock size={11} />500 🪙</>)}
        </button>

        <button onClick={onShop} className="px-4 py-1.5 bg-secondary/20 border border-secondary text-secondary font-mono text-[11px] rounded-md hover:bg-secondary/30 active:scale-95 transition-all">
          {t('menu.shop')}
        </button>

        <button onClick={onAchievements} className="px-4 py-1.5 bg-yellow-400/10 border border-yellow-400/60 text-yellow-400 font-mono text-[11px] rounded-md hover:bg-yellow-400/20 active:scale-95 transition-all">
          {t('menu.achievements')}
        </button>
      </div>

      <p className="text-muted-foreground/50 text-[9px] font-mono mt-1">{t('menu.tip')}</p>
    </div>
  );
}
