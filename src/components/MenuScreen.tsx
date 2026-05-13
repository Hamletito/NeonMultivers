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

function readNum(k: string): number {
  try { return parseInt(localStorage.getItem(k) || '0', 10) || 0; } catch { return 0; }
}

export default function MenuScreen({ state, onPlay, onShop, onGhostMode, onChaosMode, onSettings, onAchievements, profile }: Props) {
  const { t } = useT();
  if (state.screen !== 'menu') return null;
  const hasBestRun = state.bestGhostFrames.length > 0;

  // Profile mini-stats
  const dayStreak = readNum('dayStreak');
  const totalRuns = readNum('neonRunCount');

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col items-center pointer-events-auto px-4 pt-2 overflow-hidden"
      style={{ paddingBottom: 'var(--banner-height, 60px)' }}
    >
      {/* Top-left: avatar + name + compact stats */}
      {profile?.created && (
        <div className="absolute top-2 left-2 flex items-start gap-1.5">
          <div className="w-7 h-7 rounded-md border flex items-center justify-center" style={{ backgroundColor: profile.color + '30', borderColor: profile.color }}>
            <span className="text-xs" style={{ color: profile.color }}>
              {profile.shape === 'shape_circle' ? '●' : profile.shape === 'shape_triangle' ? '▲' : profile.shape === 'shape_star' ? '★' : '■'}
            </span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-mono text-[11px] text-foreground/80">{profile.name}</span>
            <span className="font-mono text-[8px] text-muted-foreground">🔥 {dayStreak}d · 🎮 {totalRuns} · 📏 {state.bestScore}m</span>
          </div>
        </div>
      )}

      {/* Top-right: settings */}
      <button
        onClick={onSettings}
        aria-label="Settings"
        className="absolute top-2 right-2 w-9 h-9 rounded-full border border-primary/50 bg-primary/10 text-primary flex items-center justify-center shadow-[0_0_15px_rgba(0,255,204,0.35)] hover:bg-primary/20 hover:shadow-[0_0_25px_rgba(0,255,204,0.6)] active:scale-95 transition-all"
      >
        <Settings size={16} />
      </button>

      {/* Title */}
      <h1 className="text-[clamp(1.5rem,5vw,2.5rem)] font-bold tracking-wider text-primary drop-shadow-[0_0_25px_rgba(0,255,204,0.55)] font-mono mt-6 text-center">
        NeonMultiverse
      </h1>
      <p className="text-muted-foreground text-[10px] font-mono mb-2">
        {t('menu.best')}: <span className="text-primary">{state.bestScore}</span>
      </p>

      {/* PLAY — full-width primary */}
      <div className="w-full max-w-[320px] flex flex-col gap-1.5">
        <button
          onClick={onPlay}
          className="w-full px-6 py-3 bg-gradient-to-r from-primary/35 to-primary/20 border-2 border-primary text-primary font-mono text-base font-bold tracking-wider rounded-xl hover:from-primary/45 hover:to-primary/30 active:scale-95 transition-all shadow-[0_0_25px_rgba(0,255,204,0.45)] hover:shadow-[0_0_35px_rgba(0,255,204,0.7)]"
        >
          ▶ {t('menu.play')}
        </button>

        {/* Row 1: VS GHOST | CHAOS — equal width */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={onGhostMode}
            disabled={!hasBestRun}
            title={!hasBestRun ? t('menu.unlockGhost') : undefined}
            className={`px-2 py-1.5 border font-mono text-[11px] rounded-lg transition-all flex items-center justify-center gap-1 active:scale-95 ${
              hasBestRun ? 'bg-white/10 border-white/40 text-white hover:bg-white/20' : 'bg-muted/10 border-muted/30 text-muted-foreground cursor-not-allowed'
            }`}
          >
            <Ghost size={11} />
            {hasBestRun ? t('menu.vsGhost') : t('menu.vsGhostLocked')}
          </button>
          <button
            onClick={onChaosMode}
            className={`px-2 py-1.5 border font-mono text-[11px] rounded-lg transition-all flex items-center justify-center gap-1 active:scale-95 ${
              state.chaosUnlocked ? 'bg-destructive/20 border-destructive/60 text-destructive hover:bg-destructive/30' : 'bg-muted/10 border-muted/30 text-muted-foreground hover:border-yellow-400/40 hover:text-yellow-400'
            }`}
          >
            {state.chaosUnlocked ? t('menu.chaos') : (<><Lock size={10} />500 🪙</>)}
          </button>
        </div>

        {/* Row 2: SHOP | ACHIEVEMENTS — equal width */}
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={onShop} className="px-2 py-1.5 bg-secondary/20 border border-secondary text-secondary font-mono text-[11px] rounded-lg hover:bg-secondary/30 active:scale-95 transition-all">
            {t('menu.shop')}
          </button>
          <button onClick={onAchievements} className="px-2 py-1.5 bg-yellow-400/10 border border-yellow-400/60 text-yellow-400 font-mono text-[11px] rounded-lg hover:bg-yellow-400/20 active:scale-95 transition-all">
            {t('menu.achievements')}
          </button>
        </div>
      </div>

      <p className="text-muted-foreground/50 text-[9px] font-mono mt-2">{t('menu.tip')}</p>
    </div>
  );
}
