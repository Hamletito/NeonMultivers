import { useState, useRef, useEffect } from 'react';
import { SHOP_ITEMS } from '../game/constants';
import { ShopItem } from '../game/types';
import { ArrowLeft } from 'lucide-react';
import { showRewarded, getFreeCoinsRemaining, consumeFreeCoinSlot, FREE_COINS_PER_AD, FREE_COINS_MAX_PER_DAY } from '../lib/unityAds';
import RewardCountdown from './RewardCountdown';

interface Props {
  coins: number;
  removeAds: boolean;
  equippedSkin: string;
  equippedTrail: string;
  equippedDeath: string;
  equippedJump: string;
  equippedBackground: string;
  equippedFloor: string;
  onBuy: (item: ShopItem) => void;
  onEquip: (item: ShopItem) => void;
  onRemoveAds: () => void;
  onBack: () => void;
  onFreeCoins: (amount: number) => void;
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

function getEquippedId(type: string, props: Props): string {
  switch (type) {
    case 'skin': return props.equippedSkin;
    case 'trail': return props.equippedTrail;
    case 'death': return props.equippedDeath;
    case 'jump': return props.equippedJump;
    case 'background': return props.equippedBackground;
    case 'floor': return props.equippedFloor;
    default: return '';
  }
}

// Mini canvas preview component
function ItemPreview({ item }: { item: ShopItem }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    let animFrame: number;
    let frame = 0;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      frame++;

      switch (item.type) {
        case 'skin':
          drawSkinPreview(ctx, item, w, h, frame);
          break;
        case 'trail':
          drawTrailPreview(ctx, item, w, h, frame);
          break;
        case 'death':
          drawDeathPreview(ctx, item, w, h, frame);
          break;
        case 'jump':
          drawJumpPreview(ctx, item, w, h, frame);
          break;
        case 'background':
          drawBgPreview(ctx, item, w, h, frame);
          break;
        case 'floor':
          drawFloorPreview(ctx, item, w, h, frame);
          break;
        case 'powerup':
          drawPowerupPreview(ctx, item, w, h, frame);
          break;
      }

      animFrame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animFrame);
  }, [item]);

  return <canvas ref={canvasRef} width={80} height={60} className="mx-auto" />;
}

function drawSkinPreview(ctx: CanvasRenderingContext2D, item: ShopItem, w: number, h: number, frame: number) {
  const cx = w / 2, cy = h / 2;
  const color = item.color || '#00ffcc';
  const size = 20;
  const half = size / 2;
  const breathe = 0.95 + 0.05 * Math.sin(frame * 0.05);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(breathe, breathe);
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.fillStyle = color;

  if (item.id === 'shape_circle') {
    ctx.beginPath(); ctx.arc(0, 0, half, 0, Math.PI * 2); ctx.fill();
  } else if (item.id === 'shape_triangle') {
    ctx.beginPath(); ctx.moveTo(0, -half); ctx.lineTo(half, half); ctx.lineTo(-half, half); ctx.closePath(); ctx.fill();
  } else if (item.id === 'shape_star') {
    drawStarShape(ctx, 0, 0, 5, half, half / 2);
  } else if (item.id === 'phantom') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 20;
    ctx.strokeRect(-half, -half, size, size);
  } else if (item.id === 'nova') {
    ctx.fillRect(-half, -half, size, size);
    ctx.globalAlpha = 0.3 + 0.2 * Math.sin(frame * 0.08);
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.arc(0, 0, half * 1.8, 0, Math.PI * 2); ctx.fill();
    // Light particles
    for (let i = 0; i < 4; i++) {
      const a = frame * 0.03 + i * Math.PI / 2;
      const px = Math.cos(a) * half * 1.5;
      const py = Math.sin(a) * half * 1.5;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
    }
  } else if (item.id === 'prism') {
    const hue = (frame * 3) % 360;
    ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
    ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
    ctx.fillRect(-half, -half, size, size);
  } else {
    ctx.fillRect(-half, -half, size, size);
  }
  ctx.restore();
}

function drawTrailPreview(ctx: CanvasRenderingContext2D, item: ShopItem, w: number, h: number, frame: number) {
  const cy = h / 2;
  const sqSize = 12;
  const sqX = w - 20;

  // Draw small player square
  ctx.fillStyle = '#00ffcc';
  ctx.shadowColor = '#00ffcc';
  ctx.shadowBlur = 8;
  ctx.fillRect(sqX - sqSize / 2, cy - sqSize / 2, sqSize, sqSize);
  ctx.shadowBlur = 0;

  // Draw trail particles
  const colors: Record<string, string[]> = {
    trail_fire: ['#ff4400', '#ff8800', '#ffcc00'],
    trail_ice: ['#88ddff', '#aaeeff', '#ffffff'],
    trail_electric: ['#00ffff', '#88ffff', '#ffff00'],
    trail_bubble: ['#88ccff', '#aaddff', '#cceeff'],
    trail_star: ['#ffdd00', '#ffaa00', '#ffffff'],
    trail_smoke: ['#666666', '#888888', '#aaaaaa'],
  };
  const trailColors = colors[item.id] || ['#ffffff'];

  for (let i = 0; i < 8; i++) {
    const px = sqX - 8 - i * 6 - Math.sin(frame * 0.1 + i) * 3;
    const py = cy + Math.sin(frame * 0.08 + i * 0.5) * 4;
    const alpha = 1 - i / 8;
    ctx.globalAlpha = alpha * 0.8;
    ctx.fillStyle = trailColors[i % trailColors.length];
    const sz = item.id === 'trail_bubble' ? 4 + Math.sin(frame * 0.05 + i) * 2 : 2 + (1 - i / 8) * 3;
    if (item.id === 'trail_bubble') {
      ctx.beginPath(); ctx.arc(px, py, sz, 0, Math.PI * 2); ctx.fill();
    } else if (item.id === 'trail_electric') {
      ctx.fillRect(px, py + (Math.random() - 0.5) * 6, sz, 1.5);
    } else {
      ctx.beginPath(); ctx.arc(px, py, sz, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawDeathPreview(ctx: CanvasRenderingContext2D, item: ShopItem, w: number, h: number, frame: number) {
  const cx = w / 2, cy = h / 2;
  ctx.save();
  switch (item.id) {
    case 'death_confetti': {
      const confettiColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + frame * 0.02;
        const r = 10 + Math.sin(frame * 0.05 + i) * 8;
        ctx.fillStyle = confettiColors[i % confettiColors.length];
        ctx.globalAlpha = 0.8;
        ctx.fillRect(cx + Math.cos(a) * r - 2, cy + Math.sin(a) * r - 2, 4, 4);
      }
      break;
    }
    case 'death_nuclear': {
      const r = 8 + Math.sin(frame * 0.06) * 4;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ff8800';
      ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(cx, cy, r / 2, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'death_diamond': {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + frame * 0.03;
        const r = 12 + Math.sin(frame * 0.04 + i) * 5;
        ctx.fillStyle = ['#88ddff', '#aaeeff', '#ffffff', '#ccddff'][i % 4];
        ctx.globalAlpha = 0.7;
        ctx.save();
        ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.rotate(frame * 0.05 + i);
        ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(3, 0); ctx.lineTo(0, 3); ctx.lineTo(-3, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'death_firerain': {
      for (let i = 0; i < 6; i++) {
        const fx = cx - 15 + i * 6;
        const fy = cy - 10 + ((frame * 2 + i * 7) % 25);
        ctx.fillStyle = ['#ff4400', '#ff8800', '#ffcc00'][i % 3];
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + 2, fy - 6);
        ctx.lineTo(fx + 4, fy);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
}

function drawJumpPreview(ctx: CanvasRenderingContext2D, item: ShopItem, w: number, h: number, frame: number) {
  const cx = w / 2, cy = h / 2 - 5;
  const sqSize = 10;

  // Small square
  ctx.fillStyle = '#00ffcc';
  ctx.fillRect(cx - sqSize / 2, cy - sqSize / 2, sqSize, sqSize);

  ctx.save();
  switch (item.id) {
    case 'jump_rings': {
      const r = 12 + Math.sin(frame * 0.08) * 3;
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.arc(cx, cy + sqSize, r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.3;
      ctx.beginPath(); ctx.arc(cx, cy + sqSize, r + 5, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case 'jump_cloud': {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#cccccc';
      for (let i = 0; i < 4; i++) {
        const px = cx - 8 + i * 5 + Math.sin(frame * 0.06 + i) * 2;
        const py = cy + sqSize + 2;
        ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'jump_spark': {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + frame * 0.05;
        const r = 8 + Math.sin(frame * 0.1 + i) * 3;
        ctx.fillStyle = ['#ffdd00', '#ff8800', '#ffffff'][i % 3];
        ctx.globalAlpha = 0.7;
        ctx.fillRect(cx + Math.cos(a) * r, cy + sqSize + Math.sin(a) * r * 0.5, 2, 2);
      }
      break;
    }
    case 'jump_shockwave': {
      const r = 10 + Math.sin(frame * 0.08) * 4;
      ctx.strokeStyle = '#88ccff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(cx, cy + sqSize, r, 0, Math.PI); ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

function drawBgPreview(ctx: CanvasRenderingContext2D, item: ShopItem, w: number, h: number, frame: number) {
  ctx.save();
  switch (item.id) {
    case 'bg_stars':
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 15; i++) {
        const sx = (i * 11) % w;
        const sy = (i * 7) % h;
        ctx.globalAlpha = 0.3 + 0.7 * Math.sin(frame * 0.03 + i);
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }
      break;
    case 'bg_matrix':
      ctx.fillStyle = '#000a00';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#00ff00';
      ctx.globalAlpha = 0.3;
      ctx.font = '8px monospace';
      for (let i = 0; i < 6; i++) {
        const chars = '01アイウ';
        const y = ((frame + i * 13) % (h + 10)) - 5;
        ctx.fillText(chars[i % chars.length], i * 14 + 2, y);
      }
      break;
    case 'bg_galaxy':
      ctx.fillStyle = '#0a0020';
      ctx.fillRect(0, 0, w, h);
      const grd = ctx.createRadialGradient(w / 2, h / 2, 5, w / 2, h / 2, w / 2);
      grd.addColorStop(0, 'rgba(102,0,204,0.3)');
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
      break;
    case 'bg_cyberpunk':
      ctx.fillStyle = '#0a0a15';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ff00ff';
      ctx.globalAlpha = 0.15;
      for (let i = 0; i < 5; i++) {
        const bw = 8 + (i * 5) % 12;
        const bh = 15 + (i * 11) % 25;
        ctx.fillRect(i * 16 + 2, h - bh, bw, bh);
      }
      break;
  }
  ctx.restore();
}

function drawFloorPreview(ctx: CanvasRenderingContext2D, item: ShopItem, w: number, h: number, frame: number) {
  const lineY = h / 2 + 10;
  ctx.save();
  switch (item.id) {
    case 'floor_electric':
      ctx.strokeStyle = '#00ffff';
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(5, lineY);
      for (let x = 5; x < w - 5; x += 4) {
        ctx.lineTo(x, lineY + (Math.random() - 0.5) * 5);
      }
      ctx.stroke();
      break;
    case 'floor_fire':
      ctx.strokeStyle = '#ff4400';
      ctx.shadowColor = '#ff4400';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(5, lineY); ctx.lineTo(w - 5, lineY); ctx.stroke();
      ctx.globalAlpha = 0.5;
      for (let x = 10; x < w - 10; x += 8) {
        const fh = 3 + Math.sin(x * 0.2 + frame * 0.08) * 3;
        ctx.fillStyle = Math.random() > 0.5 ? '#ff4400' : '#ffcc00';
        ctx.beginPath(); ctx.moveTo(x, lineY); ctx.lineTo(x + 3, lineY - fh); ctx.lineTo(x + 6, lineY); ctx.fill();
      }
      break;
    case 'floor_ice':
      ctx.strokeStyle = '#88ddff';
      ctx.shadowColor = '#88ddff';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(5, lineY); ctx.lineTo(w - 5, lineY); ctx.stroke();
      ctx.fillStyle = '#aaeeff';
      ctx.globalAlpha = 0.5;
      for (let x = 10; x < w - 10; x += 12) {
        ctx.beginPath(); ctx.moveTo(x, lineY - 2); ctx.lineTo(x + 2, lineY - 5); ctx.lineTo(x + 4, lineY - 2); ctx.closePath(); ctx.fill();
      }
      break;
    case 'floor_rainbow': {
      const colors = ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#0088ff', '#8800ff'];
      const segW = (w - 10) / colors.length;
      ctx.lineWidth = 3;
      colors.forEach((color, i) => {
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(5 + i * segW, lineY);
        ctx.lineTo(5 + (i + 1) * segW, lineY);
        ctx.stroke();
      });
      break;
    }
  }
  ctx.restore();
}

function drawPowerupPreview(ctx: CanvasRenderingContext2D, item: ShopItem, w: number, h: number, frame: number) {
  const cx = w / 2, cy = h / 2;
  ctx.save();
  switch (item.id) {
    case 'powerup_shield': case 'powerup_goldshield':
      ctx.strokeStyle = item.id === 'powerup_goldshield' ? '#ffd700' : '#00ffcc';
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.stroke();
      ctx.font = '16px'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🛡️', cx, cy);
      break;
    case 'powerup_slowmo': case 'powerup_extremeslowmo':
      ctx.fillStyle = item.id === 'powerup_extremeslowmo' ? '#ff00ff' : '#00ffcc';
      ctx.font = '20px'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🐌', cx, cy);
      break;
    case 'powerup_magnet': case 'powerup_megamagnet':
      ctx.fillStyle = item.id === 'powerup_megamagnet' ? '#ffd700' : '#00ffcc';
      ctx.font = '20px'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🧲', cx, cy);
      if (item.id === 'powerup_megamagnet') {
        ctx.strokeStyle = '#ffd700';
        ctx.globalAlpha = 0.3 + 0.2 * Math.sin(frame * 0.05);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.stroke();
      }
      break;
  }
  ctx.restore();
}

function drawStarShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerR: number, innerR: number) {
  let rot = (Math.PI / 2) * 3; const step = Math.PI / spikes;
  ctx.beginPath(); ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) { ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR); rot += step; ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR); rot += step; }
  ctx.closePath(); ctx.fill();
}

export default function ShopScreen({ coins, removeAds, equippedSkin, equippedTrail, equippedDeath, equippedJump, equippedBackground, equippedFloor, onBuy, onEquip, onRemoveAds, onBack, onFreeCoins }: Props) {
  const allProps = { coins, removeAds, equippedSkin, equippedTrail, equippedDeath, equippedJump, equippedBackground, equippedFloor, onBuy, onEquip, onRemoveAds, onBack, onFreeCoins };
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
        <FreeCoinsSection onFreeCoins={onFreeCoins} />
        <div className="grid grid-cols-2 gap-3">
          {items.map(item => {
            const owned = ownedIds.has(item.id);
            const equippedId = getEquippedId(item.type, allProps);
            const equipped = equippedId === item.id;
            const rarity = RARITY_COLORS[item.rarity];
            const isLegendary = item.rarity === 'legendary';

            return (
              <div
                key={item.id}
                className={`bg-card/50 border rounded-xl p-3 flex flex-col items-center gap-2 ${
                  isLegendary ? 'border-yellow-500/40' : equipped ? 'border-primary/60' : 'border-border'
                }`}
              >
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full ${rarity.bg} ${rarity.text} ${rarity.border} border`}>
                  {rarity.label}
                </span>

                <ItemPreview item={item} />

                <p className="text-foreground font-mono text-xs text-center leading-tight">{item.name}</p>

                {equipped ? (
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
                        ? (isLegendary ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/40 hover:bg-yellow-500/20' : 'bg-neon-yellow/10 text-neon-yellow border-neon-yellow/30 hover:bg-neon-yellow/20')
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
      </div>
    </div>
  );
}
