import { GameState, PlayerProfile } from '../game/types';
import { Ghost, Settings, Lock } from 'lucide-react';

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
  if (state.screen !== 'menu') return null;

  const hasBestRun = state.bestGhostFrames.length > 0;

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-6 pointer-events-auto">
      {/* Profile display */}
      {profile?.created && (
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg border border-primary/40 flex items-center justify-center" style={{ backgroundColor: profile.color + '30', borderColor: profile.color }}>
            <span className="text-xs" style={{ color: profile.color }}>
              {profile.shape === 'shape_circle' ? '●' : profile.shape === 'shape_triangle' ? '▲' : profile.shape === 'shape_star' ? '★' : '■'}
            </span>
          </div>
          <span className="font-mono text-xs text-foreground/70">{profile.name}</span>
        </div>
      )}

      {/* Settings button */}
      <button onClick={onSettings} className="absolute top-4 right-4 text-foreground/40 hover:text-foreground transition-colors">
        <Settings size={24} />
      </button>

      <h1 className="text-5xl font-bold tracking-wider text-primary drop-shadow-[0_0_30px_rgba(0,255,204,0.5)] font-mono animate-pulse">
        NeonMultiverse
      </h1>
      <p className="text-muted-foreground text-sm font-mono">
        Best: <span className="text-primary">{state.bestScore}</span>
      </p>
      <div className="flex flex-col gap-3 w-48">
        <button onClick={onPlay} className="px-8 py-3 bg-primary/20 border border-primary text-primary font-mono text-lg rounded-lg hover:bg-primary/30 transition-all hover:shadow-[0_0_20px_rgba(0,255,204,0.3)]">
          PLAY
        </button>
        <button onClick={onGhostMode}
          className={`px-8 py-3 border font-mono text-sm rounded-lg transition-all flex items-center justify-center gap-2 ${hasBestRun ? 'bg-white/10 border-white/40 text-white hover:bg-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-muted/10 border-muted/30 text-muted-foreground cursor-not-allowed'}`}
          disabled={!hasBestRun} title={!hasBestRun ? 'Play a run first to unlock Ghost Mode' : undefined}>
          <Ghost size={16} />
          {hasBestRun ? '👻 VS GHOST' : '🔒 VS GHOST'}
        </button>
        <button onClick={onChaosMode}
          className={`px-8 py-3 border font-mono text-sm rounded-lg transition-all flex items-center justify-center gap-2 ${state.chaosUnlocked ? 'bg-destructive/20 border-destructive/60 text-destructive hover:bg-destructive/30 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-muted/10 border-muted/30 text-muted-foreground hover:border-neon-yellow/40 hover:text-neon-yellow'}`}>
          {state.chaosUnlocked ? '🔥 CHAOS MODE' : (<><Lock size={14} />500 🪙 to unlock</>)}
        </button>
        <button onClick={onShop} className="px-8 py-3 bg-secondary/20 border border-secondary text-secondary font-mono text-lg rounded-lg hover:bg-secondary/30 transition-all">
          SHOP
        </button>
        <button onClick={onAchievements} className="px-8 py-3 bg-yellow-400/10 border border-yellow-400/60 text-yellow-400 font-mono text-sm rounded-lg hover:bg-yellow-400/20 transition-all">
          🏆 ACHIEVEMENTS
        </button>
      </div>
      {!hasBestRun && <p className="text-muted-foreground/50 text-[10px] font-mono">Play a run first to unlock Ghost Mode</p>}
      <p className="text-muted-foreground/50 text-xs font-mono mt-2">Tap to jump • Tap again to slam down</p>
    </div>
  );
}
