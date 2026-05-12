import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { GameSettings } from '../game/types';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { useT, Lang } from '../lib/i18n';

interface Props {
  settings: GameSettings;
  onUpdate: (settings: GameSettings) => void;
  onBack: () => void;
  coins: number;
  onCoinsChange: (newCoins: number) => void;
}

const NAME_CHANGE_COST = 50;

export default function SettingsScreen({ settings, onUpdate, onBack, coins, onCoinsChange }: Props) {
  const { t, lang, setLang } = useT();
  const [s, setS] = useState<GameSettings>({ ...settings });
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetText, setResetText] = useState('');
  const [tab, setTab] = useState<'audio' | 'graphics' | 'gameplay' | 'about'>('audio');
  const [editingName, setEditingName] = useState(false);
  const [pendingName, setPendingName] = useState(s.playerName);
  const [showNameConfirm, setShowNameConfirm] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const update = (partial: Partial<GameSettings>) => {
    const next = { ...s, ...partial };
    setS(next);
    onUpdate(next);
  };

  const handleReset = () => {
    if (resetText === 'RESET') { localStorage.clear(); window.location.reload(); }
  };

  const startEditName = () => { setPendingName(s.playerName); setEditingName(true); setNameError(null); };
  const requestNameChange = () => {
    if (!pendingName || pendingName === s.playerName) { setEditingName(false); return; }
    setShowNameConfirm(true);
  };
  const confirmNameChange = () => {
    if (coins < NAME_CHANGE_COST) { setNameError(t('set.nameChange.notEnough')); setShowNameConfirm(false); return; }
    const newCoins = coins - NAME_CHANGE_COST;
    localStorage.setItem('coins', String(newCoins));
    onCoinsChange(newCoins);
    update({ playerName: pendingName });
    try {
      const raw = localStorage.getItem('playerProfile');
      if (raw) { const p = JSON.parse(raw); p.name = pendingName; localStorage.setItem('playerProfile', JSON.stringify(p)); }
    } catch {}
    setShowNameConfirm(false);
    setEditingName(false);
  };

  const tabs = [
    { key: 'audio' as const, tk: 'set.tab.audio' },
    { key: 'graphics' as const, tk: 'set.tab.graphics' },
    { key: 'gameplay' as const, tk: 'set.tab.gameplay' },
    { key: 'about' as const, tk: 'set.tab.about' },
  ];

  return (
    <div className="fixed inset-0 z-30 bg-background flex flex-col pointer-events-auto">
      <div className="flex items-center justify-between p-4">
        <button onClick={onBack} className="text-foreground/60 hover:text-foreground active:scale-95 transition-all"><ArrowLeft size={24} /></button>
        <h2 className="text-xl font-bold text-primary font-mono">{t('set.title')}</h2>
        <div className="w-6" />
      </div>

      <div className="flex gap-1.5 px-3 mb-3 overflow-x-auto no-scrollbar">
        {tabs.map(tt => (
          <button key={tt.key} onClick={() => setTab(tt.key)}
            className={`px-2.5 py-1.5 font-mono text-[10px] rounded-lg transition-all whitespace-nowrap active:scale-95 ${
              tab === tt.key ? 'bg-primary/20 text-primary border border-primary' : 'text-muted-foreground hover:text-foreground border border-transparent'
            }`}>{t(tt.tk)}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-20">
        {tab === 'audio' && (
          <div className="space-y-5">
            <div>
              <label className="text-foreground font-mono text-xs mb-2 block">{t('set.master')}</label>
              <Slider value={[s.masterVolume * 100]} onValueChange={([v]) => update({ masterVolume: v / 100 })} max={100} step={1} className="w-full" />
              <span className="text-muted-foreground font-mono text-[10px]">{Math.round(s.masterVolume * 100)}%</span>
            </div>
            <div className="flex items-center justify-between"><span className="text-foreground font-mono text-xs">{t('set.music')}</span><Switch checked={s.musicEnabled} onCheckedChange={(v) => update({ musicEnabled: v })} /></div>
            <div className="flex items-center justify-between"><span className="text-foreground font-mono text-xs">{t('set.sfx')}</span><Switch checked={s.sfxEnabled} onCheckedChange={(v) => update({ sfxEnabled: v })} /></div>
          </div>
        )}

        {tab === 'graphics' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between"><span className="text-foreground font-mono text-xs">{t('set.particles')}</span><Switch checked={s.particlesEnabled} onCheckedChange={(v) => update({ particlesEnabled: v })} /></div>
            <div className="flex items-center justify-between"><span className="text-foreground font-mono text-xs">{t('set.bgAnim')}</span><Switch checked={s.bgAnimEnabled} onCheckedChange={(v) => update({ bgAnimEnabled: v })} /></div>
          </div>
        )}

        {tab === 'gameplay' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between"><span className="text-foreground font-mono text-xs">{t('set.showDistance')}</span><Switch checked={s.showDistance} onCheckedChange={(v) => update({ showDistance: v })} /></div>
            <div className="flex items-center justify-between"><span className="text-foreground font-mono text-xs">{t('set.showStreak')}</span><Switch checked={s.showStreak} onCheckedChange={(v) => update({ showStreak: v })} /></div>
            <div className="flex items-center justify-between"><span className="text-foreground font-mono text-xs">{t('set.showAdrenaline')}</span><Switch checked={s.showAdrenaline} onCheckedChange={(v) => update({ showAdrenaline: v })} /></div>
            <div>
              <span className="text-foreground font-mono text-xs block mb-2">{t('set.controlSens')}</span>
              <div className="flex gap-2">
                {(['normal', 'high'] as const).map(v => (
                  <button key={v} onClick={() => update({ controlSensitivity: v })}
                    className={`px-4 py-2 font-mono text-xs rounded-lg border transition-all active:scale-95 ${s.controlSensitivity === v ? 'bg-primary/20 text-primary border-primary' : 'text-muted-foreground border-border hover:text-foreground'}`}>
                    {v === 'normal' ? t('set.normal') : t('set.high')}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-foreground font-mono text-xs block mb-2">{t('set.language')}</span>
              <div className="flex gap-2">
                {(['en', 'es'] as Lang[]).map(l => (
                  <button key={l} onClick={() => setLang(l)}
                    className={`px-4 py-2 font-mono text-xs rounded-lg border transition-all active:scale-95 ${lang === l ? 'bg-primary/20 text-primary border-primary' : 'text-muted-foreground border-border hover:text-foreground'}`}>
                    {l === 'en' ? '🇬🇧 English' : '🇪🇸 Español'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}



        {tab === 'about' && (
          <div className="space-y-3 text-center">
            <p className="text-foreground font-mono text-lg">NeonMultiverse</p>
            <p className="text-muted-foreground font-mono text-xs">v1.0.0</p>
            <div className="text-muted-foreground font-mono text-[11px] space-y-1 pt-2">
              <p>{t('set.about.dev')} <span className="text-foreground">Jonathan Daniel Castor Merchán</span></p>
              <p>{t('set.about.studio')}: <span className="text-foreground">Project Dark</span></p>
              <p>{t('set.about.contact')}: <span className="text-foreground">joncastrome20@gmail.com</span></p>
            </div>
            <p className="text-muted-foreground font-mono text-xs pt-2">{t('set.about.madeWith')}</p>
            <div className="flex flex-col items-center gap-2 pt-2">
              <a href="mailto:joncastrome20@gmail.com?subject=NeonMultiverse Bug Report" className="inline-block px-4 py-2 bg-primary/20 border border-primary text-primary font-mono text-xs rounded-lg hover:bg-primary/30 active:scale-95 transition-all">{t('set.about.report')}</a>
              <button onClick={() => window.open('https://hamletito.github.io/NeonMultivers/privacy-policy.html', '_blank')} className="inline-block px-4 py-2 bg-card border border-border text-foreground/80 font-mono text-xs rounded-lg hover:bg-card/70 active:scale-95 transition-all">{t('set.about.privacy')}</button>
            </div>
          </div>
        )}
      </div>

      {showNameConfirm && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowNameConfirm(false)}>
          <div className="bg-card border border-yellow-500/50 rounded-2xl p-5 w-full max-w-xs space-y-3 shadow-[0_0_30px_rgba(250,204,21,0.25)] animate-scale-in" onClick={e => e.stopPropagation()}>
            <h3 className="font-mono text-sm text-yellow-400 text-center font-bold">{t('set.nameChange.title')}</h3>
            <p className="font-mono text-xs text-foreground text-center">{t('set.nameChange.cost')} <span className="text-yellow-400 font-bold">50 🪙</span></p>
            <p className="font-mono text-[10px] text-muted-foreground text-center">{t('set.nameChange.balance')}: <span className="text-yellow-400">{coins} 🪙</span></p>
            {coins < NAME_CHANGE_COST ? (
              <>
                <p className="font-mono text-[11px] text-destructive text-center">{t('set.nameChange.notEnough')}</p>
                <button onClick={() => setShowNameConfirm(false)} className="w-full px-3 py-2 border border-border text-muted-foreground font-mono text-xs rounded-lg hover:text-foreground active:scale-95 transition-all">{t('set.nameChange.close')}</button>
              </>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setShowNameConfirm(false)} className="flex-1 px-3 py-2 border border-border text-muted-foreground font-mono text-xs rounded-lg hover:text-foreground active:scale-95 transition-all">{t('set.cancel')}</button>
                <button onClick={confirmNameChange} className="flex-1 px-3 py-2 bg-yellow-500/20 border border-yellow-500 text-yellow-400 font-mono text-xs rounded-lg hover:bg-yellow-500/30 active:scale-95 transition-all">{t('set.nameChange.continue')}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
