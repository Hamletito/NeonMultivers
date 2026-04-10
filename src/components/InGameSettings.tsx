import { X } from 'lucide-react';
import { GameSettings } from '../game/types';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';

interface Props {
  settings: GameSettings;
  onUpdate: (settings: GameSettings) => void;
  onClose: () => void;
}

export default function InGameSettings({ settings, onUpdate, onClose }: Props) {
  const update = (partial: Partial<GameSettings>) => {
    onUpdate({ ...settings, ...partial });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-auto" onClick={onClose}>
      <div
        className="bg-[#1a1a2e]/95 backdrop-blur-md border border-primary/30 rounded-2xl p-5 w-72 space-y-4 shadow-[0_0_40px_rgba(0,255,204,0.15)] animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-primary font-mono text-sm font-bold">⚙️ AJUSTES</h3>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="text-foreground font-mono text-[10px] mb-1 block">Volumen maestro</label>
          <Slider
            value={[settings.masterVolume * 100]}
            onValueChange={([v]) => update({ masterVolume: v / 100 })}
            max={100}
            step={1}
            className="w-full"
          />
          <span className="text-muted-foreground font-mono text-[9px]">{Math.round(settings.masterVolume * 100)}%</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-foreground font-mono text-[10px]">🎵 Música</span>
          <Switch checked={settings.musicEnabled} onCheckedChange={v => update({ musicEnabled: v })} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-foreground font-mono text-[10px]">🔈 Efectos de sonido</span>
          <Switch checked={settings.sfxEnabled} onCheckedChange={v => update({ sfxEnabled: v })} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-foreground font-mono text-[10px]">📳 Vibración de pantalla</span>
          <Switch checked={settings.screenShakeEnabled} onCheckedChange={v => update({ screenShakeEnabled: v })} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-foreground font-mono text-[10px]">✨ Partículas</span>
          <Switch checked={settings.particlesEnabled} onCheckedChange={v => update({ particlesEnabled: v })} />
        </div>
      </div>
    </div>
  );
}
