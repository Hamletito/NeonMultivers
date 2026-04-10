import { useState, useEffect } from 'react';

interface Props {
  onComplete: () => void;
}

export default function TutorialOverlay({ onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [showCoin, setShowCoin] = useState(false);

  useEffect(() => {
    if (step === 4) {
      const timer = setTimeout(() => setShowCoin(true), 500);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleTap = () => {
    if (step < 5) setStep(step + 1);
    else {
      localStorage.setItem('tutorialDone', 'true');
      onComplete();
    }
  };

  const messages: Record<number, { title: string; sub?: string }> = {
    1: { title: 'TOCA para saltar', sub: 'Toca la pantalla ahora' },
    2: { title: '¡Bien! Salta los obstáculos', sub: 'Toca para continuar' },
    3: { title: 'TOCA de nuevo en el aire\npara caer más rápido', sub: 'Toca para continuar' },
    4: { title: 'Recoge monedas para comprar\nobjetos en la tienda', sub: showCoin ? '🪙 ¡Moneda recogida! Toca para continuar' : '' },
    5: { title: 'Estás listo. Suerte.', sub: 'Toca para empezar' },
  };

  const msg = messages[step];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center gap-6 pointer-events-auto cursor-pointer"
      onClick={handleTap}
      onTouchStart={(e) => { e.preventDefault(); handleTap(); }}
    >
      <div className="text-center animate-fade-in" key={step}>
        <h2 className="text-2xl font-bold font-mono text-primary drop-shadow-[0_0_20px_rgba(0,255,204,0.5)] whitespace-pre-line leading-relaxed">
          {msg.title}
        </h2>
        {msg.sub && (
          <p className="mt-4 text-muted-foreground font-mono text-sm animate-pulse">
            {msg.sub}
          </p>
        )}
      </div>

      {step === 4 && showCoin && (
        <div className="w-12 h-12 rounded-full bg-[#facc15] flex items-center justify-center shadow-[0_0_30px_rgba(250,204,21,0.5)] animate-scale-in">
          <span className="text-xl font-bold text-black">$</span>
        </div>
      )}

      {/* Step indicator */}
      <div className="absolute bottom-8 flex gap-2">
        {[1, 2, 3, 4, 5].map(s => (
          <div key={s} className={`w-2 h-2 rounded-full ${s <= step ? 'bg-primary' : 'bg-white/20'}`} />
        ))}
      </div>
    </div>
  );
}
