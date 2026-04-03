import { useRef, useEffect, useCallback } from 'react';
import { GameState } from '../game/types';
import { update, render, handleInput, resetSpawners } from '../game/engine';

interface Props {
  state: GameState;
  onStateChange: (s: GameState) => void;
}

export default function GameCanvas({ state, onStateChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(0);

  stateRef.current = state;

  const handleTap = useCallback(() => {
    const s = stateRef.current;
    if (s.screen === 'playing') {
      onStateChange(handleInput({ ...s }));
    }
  }, [onStateChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    if (state.screen === 'playing') {
      resetSpawners();
    }

    const loop = (time: number) => {
      const dt = lastTimeRef.current ? Math.min(time - lastTimeRef.current, 33) : 16;
      lastTimeRef.current = time;

      const s = stateRef.current;
      if (s.screen === 'playing') {
        const newState = update({ ...s }, canvas.width, canvas.height, dt);
        if (newState.screen !== s.screen || newState.score !== s.score) {
          onStateChange(newState);
        }
        stateRef.current = newState;
      }

      render(ctx, stateRef.current, canvas.width, canvas.height);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [state.screen]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 touch-none"
      onClick={handleTap}
      onTouchStart={(e) => { e.preventDefault(); handleTap(); }}
    />
  );
}
