import { useEffect, useState } from 'react';

interface Props {
  /** Total seconds for the visual countdown. */
  seconds?: number;
  /** Called when the countdown finishes. */
  onComplete: () => void;
  label?: string;
}

/**
 * Filled-circle countdown that visually drains over `seconds`, then triggers
 * `onComplete`. Used as the universal fallback when an ad is not ready in time.
 */
export default function RewardCountdown({ seconds = 5, onComplete, label = 'Reward...' }: Props) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) { onComplete(); return; }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onComplete]);

  const C = 175.93; // 2*pi*28
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
          <circle
            cx="32" cy="32" r="28"
            fill="hsl(var(--primary) / 0.15)"
            stroke="hsl(var(--primary))"
            strokeWidth="4"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - remaining / seconds)}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-primary font-mono text-lg font-bold">
          {remaining}
        </span>
      </div>
      <p className="text-muted-foreground text-[10px] font-mono">{label}</p>
    </div>
  );
}
