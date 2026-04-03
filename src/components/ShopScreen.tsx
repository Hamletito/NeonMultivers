import { useState } from 'react';
import { SHOP_ITEMS } from '../game/constants';
import { ShopItem } from '../game/types';
import { ArrowLeft } from 'lucide-react';

interface Props {
  coins: number;
  removeAds: boolean;
  equippedSkin: string;
  onBuy: (item: ShopItem) => void;
  onEquip: (item: ShopItem) => void;
  onRemoveAds: () => void;
  onBack: () => void;
}

type Tab = 'skins' | 'powerups' | 'effects';

export default function ShopScreen({ coins, removeAds, equippedSkin, onBuy, onEquip, onRemoveAds, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('skins');
  const [ownedIds, setOwnedIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('ownedItems');
    return saved ? new Set(JSON.parse(saved)) : new Set(SHOP_ITEMS.filter(i => i.owned).map(i => i.id));
  });

  const items = SHOP_ITEMS.filter(i => {
    if (tab === 'skins') return i.type === 'skin';
    if (tab === 'powerups') return i.type === 'powerup';
    return i.type === 'trail' || i.type === 'death';
  });

  const tabClass = (t: Tab) =>
    `px-4 py-2 font-mono text-xs rounded-lg transition-all ${tab === t
      ? 'bg-primary/20 text-primary border border-primary'
      : 'text-muted-foreground hover:text-foreground'}`;

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

      <div className="flex gap-2 px-4 mb-4">
        <button className={tabClass('skins')} onClick={() => setTab('skins')}>Skins</button>
        <button className={tabClass('powerups')} onClick={() => setTab('powerups')}>Power-ups</button>
        <button className={tabClass('effects')} onClick={() => setTab('effects')}>Effects</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-20">
        <div className="grid grid-cols-2 gap-3">
          {items.map(item => {
            const owned = ownedIds.has(item.id);
            const equipped = item.type === 'skin' && equippedSkin === item.id;
            return (
              <div key={item.id} className="bg-card/50 border border-border rounded-xl p-4 flex flex-col items-center gap-2">
                {item.color && (
                  <div className="w-10 h-10 rounded-lg" style={{ backgroundColor: item.color, boxShadow: `0 0 15px ${item.color}40` }} />
                )}
                {!item.color && (
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg">
                    {item.type === 'powerup' ? '⚡' : item.type === 'trail' ? '✨' : '💥'}
                  </div>
                )}
                <p className="text-foreground font-mono text-xs text-center">{item.name}</p>
                {equipped ? (
                  <span className="text-primary text-xs font-mono">EQUIPPED</span>
                ) : owned ? (
                  <button
                    onClick={() => onEquip(item as ShopItem)}
                    className="text-xs font-mono px-3 py-1 rounded bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all"
                  >
                    EQUIP
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (coins >= item.price) {
                        onBuy(item as ShopItem);
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
