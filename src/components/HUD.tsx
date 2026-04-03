import { GameState } from '../game/types';
import { Pause } from 'lucide-react';

interface Props {
  state: GameState;
  onPause: () => void;
}

export default function HUD({ state, onPause }: Props) {
  if (state.screen !== 'playing') return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 pointer-events-auto">
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
  );
}
