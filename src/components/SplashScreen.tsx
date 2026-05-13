import { useEffect, useState } from 'react';

interface Props {
  onDone: () => void;
  durationMs?: number;
}

/**
 * Pure-black splash with a dramatic neon "NeonMultiverse" reveal,
 * "Project Dark" subtitle, sweeping neon line and a final flash/shatter
 * before handing off to the main UI. Shown on every app launch.
 */
export default function SplashScreen({ onDone, durationMs = 2500 }: Props) {
  const [shattering, setShattering] = useState(false);
  const title = 'NeonMultiverse';

  useEffect(() => {
    const t1 = setTimeout(() => setShattering(true), durationMs - 500);
    const t2 = setTimeout(onDone, durationMs);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [durationMs, onDone]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center overflow-hidden"
      style={shattering ? { animation: 'splash-shatter 0.5s ease-out forwards' } : undefined}
    >
      {/* Pulsing particle halo */}
      <div
        aria-hidden
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsl(var(--primary) / 0.35) 0%, transparent 70%)',
          animation: 'splash-pulse-bg 1.6s ease-in-out infinite',
          filter: 'blur(20px)',
        }}
      />

      {/* Animated sweeping neon line */}
      <div
        aria-hidden
        className="absolute left-0 right-0 top-1/2 h-[2px]"
        style={{
          background: 'linear-gradient(90deg, transparent, hsl(var(--primary)), transparent)',
          boxShadow: '0 0 20px hsl(var(--primary)), 0 0 40px hsl(var(--primary))',
          animation: 'splash-sweep 1.8s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        }}
      />

      <h1
        className="relative font-mono font-extrabold text-primary text-[clamp(2rem,7vw,4rem)] tracking-[0.15em] text-center select-none"
        style={{ textShadow: '0 0 24px hsl(var(--primary) / 0.7), 0 0 48px hsl(var(--primary) / 0.4)' }}
      >
        {title.split('').map((ch, i) => (
          <span
            key={i}
            className="splash-letter"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            {ch}
          </span>
        ))}
      </h1>

      <p
        className="relative mt-3 font-mono text-[11px] tracking-[0.5em] text-foreground/40 uppercase"
        style={{ animation: 'splash-letter 0.8s ease-out 1.1s both' }}
      >
        Project Dark
      </p>
    </div>
  );
}
