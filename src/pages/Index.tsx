import { useState, useCallback } from 'react';
import GameCanvas from '../components/GameCanvas';
import MenuScreen from '../components/MenuScreen';
import HUD from '../components/HUD';
import GameOverScreen from '../components/GameOverScreen';
import ShopScreen from '../components/ShopScreen';
import PauseOverlay from '../components/PauseOverlay';
import { GameState, ShopItem } from '../game/types';
import { createInitialState, resetForNewGame } from '../game/engine';
import { toggleMute, isMuted, startMusic, stopMusic } from '../game/audio';

const Index = () => {
  const [state, setState] = useState<GameState>(createInitialState);
  const [muted, setMuted] = useState(isMuted());

  const handlePlay = useCallback(() => {
    setState(s => resetForNewGame(s));
    startMusic(1);
  }, []);

  const handlePause = useCallback(() => {
    setState(s => ({ ...s, screen: 'paused' }));
  }, []);

  const handleResume = useCallback(() => {
    setState(s => ({ ...s, screen: 'playing' }));
  }, []);

  const handleMenu = useCallback(() => {
    setState(s => ({ ...s, screen: 'menu' }));
    stopMusic();
  }, []);

  const handleShop = useCallback(() => {
    setState(s => ({ ...s, screen: 'shop' }));
  }, []);

  const handleRevive = useCallback(() => {
    setState(s => {
      const newState = { ...s, screen: 'playing' as const, freeReviveUsed: true, hasShield: true };
      newState.obstacles = newState.obstacles.filter(o => o.x > s.playerTop.x + 200);
      return newState;
    });
    startMusic(1);
  }, []);

  const handleBuy = useCallback((item: ShopItem) => {
    setState(s => {
      if (s.totalCoins < item.price) return s;
      const newCoins = s.totalCoins - item.price;
      localStorage.setItem('coins', String(newCoins));
      return { ...s, coins: newCoins, totalCoins: newCoins };
    });
  }, []);

  const handleEquip = useCallback((item: ShopItem) => {
    if (item.type === 'skin') {
      localStorage.setItem('equippedSkin', item.id);
      setState(s => ({ ...s, equippedSkin: item.id }));
    }
  }, []);

  const handleRemoveAds = useCallback(() => {
    localStorage.setItem('removeAds', 'true');
    setState(s => ({ ...s, removeAds: true }));
  }, []);

  const handleActivatePower = useCallback((type: 'shield' | 'slowmo' | 'magnet') => {
    setState(s => {
      if (type === 'shield') return { ...s, hasShield: true };
      const duration = type === 'slowmo' ? 3000 : 5000;
      return { ...s, activePowers: [...s.activePowers, { type, remaining: duration }] };
    });
  }, []);

  const handleToggleMute = useCallback(() => {
    toggleMute();
    setMuted(isMuted());
  }, []);

  return (
    <div className="w-full h-screen overflow-hidden bg-background">
      <GameCanvas state={state} onStateChange={setState} />
      <MenuScreen state={state} onPlay={handlePlay} onShop={handleShop} />
      <HUD
        state={state}
        onPause={handlePause}
        onActivatePower={handleActivatePower}
        isMuted={muted}
        onToggleMute={handleToggleMute}
      />
      <GameOverScreen state={state} onRevive={handleRevive} onMenu={handleMenu} />
      <PauseOverlay visible={state.screen === 'paused'} onResume={handleResume} onMenu={handleMenu} />
      {state.screen === 'shop' && (
        <ShopScreen
          coins={state.totalCoins}
          removeAds={state.removeAds}
          equippedSkin={state.equippedSkin}
          onBuy={handleBuy}
          onEquip={handleEquip}
          onRemoveAds={handleRemoveAds}
          onBack={handleMenu}
        />
      )}
      <div id="banner-ad" className="fixed bottom-0 left-0 right-0 h-[60px] z-10" />
    </div>
  );
};

export default Index;
