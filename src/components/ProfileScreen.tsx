import { useState } from 'react';
import { PlayerProfile } from '../game/types';
import { useT } from '../lib/i18n';

interface Props {
  onComplete: (profile: PlayerProfile) => void;
}

const COLORS = [
  { id: '#00ffcc', name: 'Cyan' },
  { id: '#ff69b4', name: 'Pink' },
  { id: '#a855f7', name: 'Purple' },
  { id: '#facc15', name: 'Gold' },
  { id: '#ef4444', name: 'Red' },
  { id: '#3b82f6', name: 'Blue' },
];

export default function ProfileScreen({ onComplete }: Props) {
  const { t } = useT();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [shape, setShape] = useState('');
  const [color, setColor] = useState('');

  const SHAPES = [
    { id: 'square', label: '■', name: t('profile.shape.square') },
    { id: 'shape_circle', label: '●', name: t('profile.shape.circle') },
    { id: 'shape_triangle', label: '▲', name: t('profile.shape.triangle') },
    { id: 'shape_star', label: '★', name: t('profile.shape.star') },
  ];

  const canNext = step === 1 ? name.length > 0 : step === 2 ? shape !== '' : color !== '';

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else {
      const profile: PlayerProfile = { name, shape, color, created: true };
      localStorage.setItem('playerProfile', JSON.stringify(profile));
      onComplete(profile);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a12] flex flex-col items-center justify-center gap-8 pointer-events-auto">
      <div className="flex gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className={`w-3 h-3 rounded-full transition-all ${s <= step ? 'bg-primary shadow-[0_0_10px_rgba(0,255,204,0.5)]' : 'bg-white/10'}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="flex flex-col items-center gap-6 animate-fade-in">
          <h2 className="text-2xl font-bold font-mono text-primary drop-shadow-[0_0_20px_rgba(0,255,204,0.4)]">
            {t('profile.name')}
          </h2>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value.replace(/\s/g, '').slice(0, 15))}
            maxLength={15}
            placeholder="Runner"
            className="w-64 bg-transparent border-b-2 border-primary/40 focus:border-primary text-center text-xl font-mono text-foreground outline-none py-2 transition-colors"
            autoFocus
          />
          <p className="text-muted-foreground font-mono text-xs">{name.length}/15 {t('profile.chars')}</p>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col items-center gap-6 animate-fade-in">
          <h2 className="text-2xl font-bold font-mono text-primary drop-shadow-[0_0_20px_rgba(0,255,204,0.4)]">
            {t('profile.shape')}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {SHAPES.map(sh => (
              <button
                key={sh.id}
                onClick={() => setShape(sh.id)}
                className={`w-28 h-28 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${
                  shape === sh.id ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(0,255,204,0.3)]' : 'border-white/10 hover:border-white/30 bg-white/5'
                }`}
              >
                <span className="text-4xl" style={{ color: shape === sh.id ? '#00ffcc' : '#888' }}>{sh.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{sh.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col items-center gap-6 animate-fade-in">
          <h2 className="text-2xl font-bold font-mono text-primary drop-shadow-[0_0_20px_rgba(0,255,204,0.4)]">
            {t('profile.color')}
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {COLORS.map(c => (
              <button
                key={c.id}
                onClick={() => setColor(c.id)}
                className={`w-16 h-16 rounded-full border-4 transition-all active:scale-95 ${
                  color === c.id ? 'border-white scale-110 shadow-[0_0_25px_var(--glow)]' : 'border-transparent hover:border-white/30'
                }`}
                style={{ backgroundColor: c.id, '--glow': c.id + '80' } as React.CSSProperties}
              />
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleNext}
        disabled={!canNext}
        className={`px-10 py-3 font-mono text-lg rounded-lg border transition-all active:scale-95 ${
          canNext ? 'bg-primary/20 border-primary text-primary hover:bg-primary/30 hover:shadow-[0_0_25px_rgba(0,255,204,0.3)]' : 'bg-muted/10 border-muted/30 text-muted-foreground cursor-not-allowed'
        }`}
      >
        {step === 3 ? t('profile.start') : t('profile.next')}
      </button>

      <button
        onClick={() => window.open('https://hamletito.github.io/NeonMultivers/privacy-policy.html', '_blank')}
        className="absolute bottom-4 text-[11px] font-mono text-muted-foreground hover:text-primary underline-offset-2 hover:underline transition-colors"
      >
        {t('profile.privacy')}
      </button>
    </div>
  );
}
