import { useState } from 'react';
import { PlayerProfile } from '../game/types';

interface Props {
  onComplete: (profile: PlayerProfile) => void;
}

const SHAPES = [
  { id: 'square', label: '■', name: 'Cuadrado' },
  { id: 'shape_circle', label: '●', name: 'Círculo' },
  { id: 'shape_triangle', label: '▲', name: 'Triángulo' },
  { id: 'shape_star', label: '★', name: 'Estrella' },
];

const COLORS = [
  { id: '#00ffcc', name: 'Cyan' },
  { id: '#ff69b4', name: 'Rosa' },
  { id: '#a855f7', name: 'Púrpura' },
  { id: '#facc15', name: 'Dorado' },
  { id: '#ef4444', name: 'Rojo' },
  { id: '#3b82f6', name: 'Azul' },
];

export default function ProfileScreen({ onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [shape, setShape] = useState('');
  const [color, setColor] = useState('');

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
      {/* Progress dots */}
      <div className="flex gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className={`w-3 h-3 rounded-full transition-all ${s <= step ? 'bg-primary shadow-[0_0_10px_rgba(0,255,204,0.5)]' : 'bg-white/10'}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="flex flex-col items-center gap-6 animate-fade-in">
          <h2 className="text-2xl font-bold font-mono text-primary drop-shadow-[0_0_20px_rgba(0,255,204,0.4)]">
            Elige tu nombre
          </h2>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value.replace(/\s/g, '').slice(0, 15))}
            maxLength={15}
            placeholder="TuNombre"
            className="w-64 bg-transparent border-b-2 border-primary/40 focus:border-primary text-center text-xl font-mono text-foreground outline-none py-2 transition-colors"
            autoFocus
          />
          <p className="text-muted-foreground font-mono text-xs">{name.length}/15 caracteres</p>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col items-center gap-6 animate-fade-in">
          <h2 className="text-2xl font-bold font-mono text-primary drop-shadow-[0_0_20px_rgba(0,255,204,0.4)]">
            Elige tu forma
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {SHAPES.map(s => (
              <button
                key={s.id}
                onClick={() => setShape(s.id)}
                className={`w-28 h-28 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                  shape === s.id
                    ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(0,255,204,0.3)]'
                    : 'border-white/10 hover:border-white/30 bg-white/5'
                }`}
              >
                <span className="text-4xl" style={{ color: shape === s.id ? '#00ffcc' : '#888' }}>{s.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col items-center gap-6 animate-fade-in">
          <h2 className="text-2xl font-bold font-mono text-primary drop-shadow-[0_0_20px_rgba(0,255,204,0.4)]">
            Elige tu color
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {COLORS.map(c => (
              <button
                key={c.id}
                onClick={() => setColor(c.id)}
                className={`w-16 h-16 rounded-full border-4 transition-all ${
                  color === c.id
                    ? 'border-white scale-110 shadow-[0_0_25px_var(--glow)]'
                    : 'border-transparent hover:border-white/30'
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
        className={`px-10 py-3 font-mono text-lg rounded-lg border transition-all ${
          canNext
            ? 'bg-primary/20 border-primary text-primary hover:bg-primary/30 hover:shadow-[0_0_25px_rgba(0,255,204,0.3)]'
            : 'bg-muted/10 border-muted/30 text-muted-foreground cursor-not-allowed'
        }`}
      >
        {step === 3 ? 'START' : 'SIGUIENTE →'}
      </button>

      <button
        onClick={() => window.open('https://hamletito.github.io/NeonMultivers/privacy-policy.html', '_blank')}
        className="absolute bottom-4 text-[11px] font-mono text-muted-foreground hover:text-primary underline-offset-2 hover:underline transition-colors"
      >
        Privacy Policy
      </button>
    </div>
  );
}
