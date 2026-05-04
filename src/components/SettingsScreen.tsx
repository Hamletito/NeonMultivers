import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { GameSettings } from '../game/types';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';

interface Props {
  settings: GameSettings;
  onUpdate: (settings: GameSettings) => void;
  onBack: () => void;
}

export default function SettingsScreen({ settings, onUpdate, onBack }: Props) {
  const [s, setS] = useState<GameSettings>({ ...settings });
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetText, setResetText] = useState('');
  const [tab, setTab] = useState<'audio' | 'graphics' | 'gameplay' | 'account' | 'about'>('audio');

  const update = (partial: Partial<GameSettings>) => {
    const next = { ...s, ...partial };
    setS(next);
    onUpdate(next);
  };

  const handleReset = () => {
    if (resetText === 'RESET') {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleExport = () => {
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) data[key] = localStorage.getItem(key) || '';
    }
    const code = btoa(JSON.stringify(data));
    navigator.clipboard.writeText(code).then(() => {
      alert('Datos copiados al portapapeles');
    }).catch(() => {
      prompt('Copia este código:', code);
    });
  };

  const tabs = [
    { key: 'audio' as const, label: '🔊 Audio' },
    { key: 'graphics' as const, label: '🎨 Gráficos' },
    { key: 'gameplay' as const, label: '🎮 Juego' },
    { key: 'account' as const, label: '👤 Cuenta' },
    { key: 'about' as const, label: 'ℹ️ Info' },
  ];

  return (
    <div className="fixed inset-0 z-30 bg-background flex flex-col pointer-events-auto">
      <div className="flex items-center justify-between p-4">
        <button onClick={onBack} className="text-foreground/60 hover:text-foreground transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-xl font-bold text-primary font-mono">⚙️ CONFIGURACIÓN</h2>
        <div className="w-6" />
      </div>

      <div className="flex gap-1.5 px-3 mb-3 overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-2.5 py-1.5 font-mono text-[10px] rounded-lg transition-all whitespace-nowrap ${
              tab === t.key
                ? 'bg-primary/20 text-primary border border-primary'
                : 'text-muted-foreground hover:text-foreground border border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-20">
        {tab === 'audio' && (
          <div className="space-y-5">
            <div>
              <label className="text-foreground font-mono text-xs mb-2 block">Volumen maestro</label>
              <Slider
                value={[s.masterVolume * 100]}
                onValueChange={([v]) => update({ masterVolume: v / 100 })}
                max={100}
                step={1}
                className="w-full"
              />
              <span className="text-muted-foreground font-mono text-[10px]">{Math.round(s.masterVolume * 100)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground font-mono text-xs">🎵 Música</span>
              <Switch checked={s.musicEnabled} onCheckedChange={(v) => update({ musicEnabled: v })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground font-mono text-xs">🔈 Efectos de sonido</span>
              <Switch checked={s.sfxEnabled} onCheckedChange={(v) => update({ sfxEnabled: v })} />
            </div>
          </div>
        )}

        {tab === 'graphics' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-foreground font-mono text-xs">✨ Efectos de partículas</span>
              <Switch checked={s.particlesEnabled} onCheckedChange={(v) => update({ particlesEnabled: v })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground font-mono text-xs">📳 Vibración de pantalla</span>
              <Switch checked={s.screenShakeEnabled} onCheckedChange={(v) => update({ screenShakeEnabled: v })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground font-mono text-xs">🌌 Animaciones de fondo</span>
              <Switch checked={s.bgAnimEnabled} onCheckedChange={(v) => update({ bgAnimEnabled: v })} />
            </div>
          </div>
        )}

        {tab === 'gameplay' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-foreground font-mono text-xs">📏 Mostrar distancia</span>
              <Switch checked={s.showDistance} onCheckedChange={(v) => update({ showDistance: v })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground font-mono text-xs">🔥 Mostrar racha</span>
              <Switch checked={s.showStreak} onCheckedChange={(v) => update({ showStreak: v })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground font-mono text-xs">⚡ Barra de adrenalina</span>
              <Switch checked={s.showAdrenaline} onCheckedChange={(v) => update({ showAdrenaline: v })} />
            </div>
            <div>
              <span className="text-foreground font-mono text-xs block mb-2">🎯 Sensibilidad de control</span>
              <div className="flex gap-2">
                {(['normal', 'high'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => update({ controlSensitivity: v })}
                    className={`px-4 py-2 font-mono text-xs rounded-lg border transition-all ${
                      s.controlSensitivity === v
                        ? 'bg-primary/20 text-primary border-primary'
                        : 'text-muted-foreground border-border hover:text-foreground'
                    }`}
                  >
                    {v === 'normal' ? 'Normal' : 'Alta'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'account' && (
          <div className="space-y-5">
            <div>
              <label className="text-foreground font-mono text-xs mb-1 block">👤 Nombre del jugador</label>
              <input
                type="text"
                value={s.playerName}
                onChange={(e) => update({ playerName: e.target.value })}
                maxLength={20}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
                placeholder="Runner"
              />
            </div>

            <button
              onClick={handleExport}
              className="w-full px-4 py-2 bg-primary/20 border border-primary text-primary font-mono text-xs rounded-lg hover:bg-primary/30 transition-all"
            >
              📋 Exportar datos guardados
            </button>

            {!resetConfirm ? (
              <button
                onClick={() => setResetConfirm(true)}
                className="w-full px-4 py-2 bg-destructive/20 border border-destructive text-destructive font-mono text-xs rounded-lg hover:bg-destructive/30 transition-all"
              >
                🗑️ Reiniciar progreso
              </button>
            ) : (
              <div className="p-4 bg-card/50 border border-destructive rounded-xl space-y-3">
                <p className="text-destructive font-mono text-xs text-center">
                  ¿Estás seguro? Esto eliminará todas tus monedas, skins y logros. Esto no se puede deshacer.
                </p>
                <p className="text-muted-foreground font-mono text-[10px] text-center">Escribe "RESET" para confirmar</p>
                <input
                  type="text"
                  value={resetText}
                  onChange={(e) => setResetText(e.target.value.toUpperCase())}
                  className="w-full bg-card border border-destructive/50 rounded-lg px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-destructive text-center"
                  placeholder="RESET"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setResetConfirm(false); setResetText(''); }}
                    className="flex-1 px-3 py-2 border border-border text-muted-foreground font-mono text-xs rounded-lg hover:text-foreground transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={resetText !== 'RESET'}
                    className={`flex-1 px-3 py-2 font-mono text-xs rounded-lg transition-all ${
                      resetText === 'RESET'
                        ? 'bg-destructive text-destructive-foreground hover:bg-destructive/80'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'about' && (
          <div className="space-y-3 text-center">
            <p className="text-foreground font-mono text-lg">NeonMultiverse</p>
            <p className="text-muted-foreground font-mono text-xs">v1.0.0</p>
            <div className="text-muted-foreground font-mono text-[11px] space-y-1 pt-2">
              <p>Desarrollado por <span className="text-foreground">Jonathan Daniel Castor Merchán</span></p>
              <p>Estudio: <span className="text-foreground">Project Dark</span></p>
              <p>Contacto: <span className="text-foreground">joncastrome20@gmail.com</span></p>
            </div>
            <p className="text-muted-foreground font-mono text-xs pt-2">Hecho con ❤️</p>
            <div className="flex flex-col items-center gap-2 pt-2">
              <a
                href="mailto:joncastrome20@gmail.com?subject=NeonMultiverse Bug Report"
                className="inline-block px-4 py-2 bg-primary/20 border border-primary text-primary font-mono text-xs rounded-lg hover:bg-primary/30 transition-all"
              >
                🐛 Reportar un error
              </a>
              <button
                onClick={() => window.open('https://hamletito.github.io/NeonMultivers/privacy-policy.html', '_blank')}
                className="inline-block px-4 py-2 bg-card border border-border text-foreground/80 font-mono text-xs rounded-lg hover:bg-card/70 transition-all"
              >
                📄 Privacy Policy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
