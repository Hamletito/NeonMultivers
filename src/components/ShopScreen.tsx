import { useState } from 'react';
import { SHOP_ITEMS } from '../game/constants';
import { ShopItem } from '../game/types';
import { ArrowLeft, Lock } from 'lucide-react';

interface Props {
  coins: number;
  removeAds: boolean;
  equippedSkin: string;
  onBuy: (item: ShopItem) => void;
  onEquip: (item: ShopItem) => void;
  onRemoveAds: () => void;
  onBack: () => void;
}

type Tab = 'skins' | 'trails' | 'death' | 'jump' | 'backgrounds' | 'floor' | 'powerups';

const TABS: { key: Tab; label: string }[] = [
  { key: 'skins', label: 'Skins' },
  { key: 'trails', label: 'Trails' },
  { key: 'death', label: 'Death' },
  { key: 'jump', label: 'Jump' },
  { key: 'backgrounds', label: 'BG' },
  { key: 'floor', label: 'Floor' },
  { key: 'powerups', label: 'Power' },
];

const RARITY_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  common: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/40', label: 'Common' },
  rare: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40', label: 'Rare' },
  epic: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/40', label: 'Epic' },
  legendary: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40', label: 'Legendary' },
};

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

const TYPE_ICONS: Record<string, string> = {
  trail: '✨', death: '💥', jump: '💨', background: '🌌', floor: '⚡', powerup: '⚡',
};

export default function ShopScreen({ coins, removeAds, equippedSkin, onBuy, onEquip, onRemoveAds, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('skins');
  const [ownedIds, setOwnedIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('ownedItems');
    return saved ? new Set(JSON.parse(saved)) : new Set(SHOP_ITEMS.filter(i => i.owned).map(i => i.id));
  });

  const items = SHOP_ITEMS
    .filter(i => {
      if (tab === 'skins') return i.type === 'skin';
      if (tab === 'trails') return i.type === 'trail';
      if (tab === 'death') return i.type === 'death';
      if (tab === 'jump') return i.type === 'jump';
      if (tab === 'backgrounds') return i.type === 'background';
      if (tab === 'floor') return i.type === 'floor';
      if (tab === 'powerups') return i.type === 'powerup';
      return false;
    })
    .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));

  const tabClass = (t: Tab) =>
    `px-2.5 py-1.5 font-mono text-[10px] rounded-lg transition-all whitespace-nowrap ${tab === t
      ? 'bg-primary/20 text-primary border border-primary'
      : 'text-muted-foreground hover:text-foreground border border-transparent'}`;

  return (
    <div className="fixed inset-0 z-30 bg-background flex flex-col pointer-events-auto">
      <div className="flex items-center justify-between p-4">
        <button onClick={onBack} className="text-foreground/60 hover:text-foreground transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-xl font-bold text-primary font-mono">SHOP</h2>
        <div className="text-neon-yellow font-mono text-sm flex items-center gap-1">
          <span>💰</span>{coins}
        </div>
      </div>

      <div className="flex gap-1.5 px-3 mb-3 overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button key={t.key} className={tabClass(t.key)} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-20">
        <div className="grid grid-cols-2 gap-3">
          {items.map(item => {
            const owned = ownedIds.has(item.id);
            const equipped = item.type === 'skin' && equippedSkin === item.id;
            const rarity = RARITY_COLORS[item.rarity];
            const isLegendary = item.rarity === 'legendary';

            return (
              <div
                key={item.id}
                className={`bg-card/50 border rounded-xl p-3 flex flex-col items-center gap-2 ${
                  isLegendary ? 'border-yellow-500/40' : 'border-border'
                }`}
              >
                {/* Rarity badge */}
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full ${rarity.bg} ${rarity.text} ${rarity.border} border`}>
                  {rarity.label}
                </span>

                {/* Icon */}
                {item.color ? (
                  <div
                    className="w-10 h-10 rounded-lg"
                    style={{ backgroundColor: item.color, boxShadow: `0 0 15px ${item.color}40` }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg">
                    {TYPE_ICONS[item.type] || '⚡'}
                  </div>
                )}

                <p className="text-foreground font-mono text-xs text-center leading-tight">{item.name}</p>

                {isLegendary ? (
                  <span className="text-yellow-500/70 text-[10px] font-mono flex items-center gap-1">
                    <Lock size={10} /> Earn in Ranked
                  </span>
                ) : equipped ? (
                  <span className="text-primary text-xs font-mono">EQUIPPED</span>
                ) : owned ? (
                  <button
                    onClick={() => onEquip(item)}
                    className="text-xs font-mono px-3 py-1 rounded bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all"
                  >
                    EQUIP
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (coins >= item.price) {
                        onBuy(item);
                        setOwnedIds(prev => {
                          const next = new Set(prev);
                          next.add(item.id);
                          localStorage.setItem('ownedItems', JSON.stringify([...next]));
                          return next;
                        });
                      }
                    }}
                    className={`text-xs font-mono px-3 py-1 rounded border transition-all ${
                      coins >= item.price
                        ? 'bg-neon-yellow/10 text-neon-yellow border-neon-yellow/30 hover:bg-neon-yellow/20'
                        : 'bg-muted/10 text-muted-foreground border-muted/30 cursor-not-allowed'
                    }`}
                  >
                    💰 {item.price}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {!removeAds && (
          <div className="mt-6 p-4 bg-card/50 border border-accent rounded-xl flex flex-col items-center gap-2">
            <p className="text-accent font-mono text-sm font-bold">Remove Ads</p>
            <p className="text-muted-foreground text-xs font-mono text-center">Enjoy ad-free gameplay</p>
            <button
              onClick={onRemoveAds}
              className="px-4 py-2 bg-accent/20 border border-accent text-accent font-mono text-xs rounded-lg hover:bg-accent/30 transition-all"
            >
              PURCHASE — $2.99
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
