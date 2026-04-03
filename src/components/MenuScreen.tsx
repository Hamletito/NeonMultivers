import { GameState } from '../game/types';

interface Props {
  state: GameState;
  onPlay: () => void;
  onShop: () => void;
}

export default function MenuScreen({ state, onPlay, onShop }: Props) {
  if (state.screen !== 'menu') return null;

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-6 pointer-events-auto">
      <h1 className="text-5xl font-bold tracking-wider text-primary drop-shadow-[0_0_30px_rgba(0,255,204,0.5)] font-mono">
        NEON RUN
      </h1>
      <p className="text-muted-foreground text-sm font-mono">
        Best: <span className="text-primary">{state.bestScore}</span>
      </p>
      <div className="flex flex-col gap-3 w-48">
        <button
          onClick={onPlay}
          className="px-8 py-3 bg-primary/20 border border-primary text-primary font-mono text-lg rounded-lg hover:bg-primary/30 transition-all hover:shadow-[0_0_20px_rgba(0,255,204,0.3)]"
        >
          PLAY
        </button>
        <button
          onClick={onShop}
          className="px-8 py-3 bg-secondary/20 border border-secondary text-secondary font-mono text-lg rounded-lg hover:bg-secondary/30 transition-all"
        >
          SHOP
        </button>
      </div>
      <p className="text-muted-foreground/50 text-xs font-mono mt-4">
        Tap to jump • Tap again to slam down
      </p>
    </div>
  );
}
