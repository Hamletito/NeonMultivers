import { X } from 'lucide-react';
import { GameSettings } from '../game/types';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';

interface Props {
  settings: GameSettings;
  onUpdate: (settings: GameSettings) => void;
  onClose: () => void;
}

/**
 * In-game settings panel.
 * - max-height capped to (viewport - banner) so it never overlaps the banner.
 * - internally scrollable when content overflows.
 * - toggles arranged in a horizontal 2-column grid for compact in-run editing.
 */
export default function InGameSettings({ settings, onUpdate, onClose }: Props) {
  const update = (partial: Partial<GameSettings>) => {
    onUpdate({ ...settings, ...partial });
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center pointer-events-auto px-3"
      style={{ paddingBottom: 'var(--banner-height, 60px)' }}
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a2e]/95 backdrop-blur-md border border-primary/30 rounded-2xl p-4 w-[420px] max-w-full shadow-[0_0_40px_rgba(0,255,204,0.15)] animate-scale-in flex flex-col"
        style={{ maxHeight: 'calc(100vh - var(--banner-height, 60px) - 24px)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-primary font-mono text-sm font-bold">⚙️ AJUSTES</h3>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto no-scrollbar pr-1 flex flex-col gap-3">
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

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between bg-background/40 border border-border/40 rounded-lg px-2.5 py-1.5">
              <span className="text-foreground font-mono text-[10px]">🎵 Música</span>
              <Switch checked={settings.musicEnabled} onCheckedChange={v => update({ musicEnabled: v })} />
            </div>
            <div className="flex items-center justify-between bg-background/40 border border-border/40 rounded-lg px-2.5 py-1.5">
              <span className="text-foreground font-mono text-[10px]">🔈 SFX</span>
              <Switch checked={settings.sfxEnabled} onCheckedChange={v => update({ sfxEnabled: v })} />
            </div>
            <div className="flex items-center justify-between bg-background/40 border border-border/40 rounded-lg px-2.5 py-1.5">
              <span className="text-foreground font-mono text-[10px]">✨ Partículas</span>
              <Switch checked={settings.particlesEnabled} onCheckedChange={v => update({ particlesEnabled: v })} />
            </div>
            <div className="flex items-center justify-between bg-background/40 border border-border/40 rounded-lg px-2.5 py-1.5">
              <span className="text-foreground font-mono text-[10px]">📏 Distancia</span>
              <Switch checked={settings.showDistance} onCheckedChange={v => update({ showDistance: v })} />
            </div>
            <div className="flex items-center justify-between bg-background/40 border border-border/40 rounded-lg px-2.5 py-1.5">
              <span className="text-foreground font-mono text-[10px]">🔥 Racha</span>
              <Switch checked={settings.showStreak} onCheckedChange={v => update({ showStreak: v })} />
            </div>
            <div className="flex items-center justify-between bg-background/40 border border-border/40 rounded-lg px-2.5 py-1.5">
              <span className="text-foreground font-mono text-[10px]">⚡ Adrenalina</span>
              <Switch checked={settings.showAdrenaline} onCheckedChange={v => update({ showAdrenaline: v })} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
