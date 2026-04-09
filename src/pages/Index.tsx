import { useState, useCallback } from 'react';
import GameCanvas from '../components/GameCanvas';
import MenuScreen from '../components/MenuScreen';
import HUD from '../components/HUD';
import GameOverScreen from '../components/GameOverScreen';
import ShopScreen from '../components/ShopScreen';
import PauseOverlay from '../components/PauseOverlay';
import SettingsScreen from '../components/SettingsScreen';
import { GameState, ShopItem, GameSettings } from '../game/types';
import { createInitialState, resetForNewGame, activateAdrenaline } from '../game/engine';
import { toggleMute, isMuted, startMusic, stopMusic, setMasterVolume, setSfxEnabled, setMusicEnabled } from '../game/audio';

const Index = () => {
  const [state, setState] = useState<GameState>(createInitialState);
  const [muted, setMuted] = useState(isMuted());

  const handlePlay = useCallback(() => {
    setState(s => resetForNewGame({ ...s, ghostMode: false, chaosMode: false }));
    startMusic(1);
  }, []);

  const handleChaosMode = useCallback(() => {
    setState(s => {
      if (!s.chaosUnlocked) {
        if (s.totalCoins >= 500) {
          const newCoins = s.totalCoins - 500;
          localStorage.setItem('coins', String(newCoins));
          localStorage.setItem('chaosUnlocked', 'true');
          return { ...s, totalCoins: newCoins, coins: newCoins, chaosUnlocked: true };
        }
        return s;
      }
      return resetForNewGame({ ...s, ghostMode: false, chaosMode: true });
    });
    if (state.chaosUnlocked) startMusic(1);
  }, [state.chaosUnlocked]);

  const handleGhostMode = useCallback(() => {
    setState(s => {
      if (s.bestGhostFrames.length === 0) return s;
      return resetForNewGame({ ...s, ghostMode: true, chaosMode: false });
    });
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

  const handleSettings = useCallback(() => {
    setState(s => ({ ...s, screen: 'settings' }));
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
    } else if (item.type === 'trail') {
      localStorage.setItem('equippedTrail', item.id);
      setState(s => ({ ...s, equippedTrail: item.id }));
    } else if (item.type === 'death') {
      localStorage.setItem('equippedDeath', item.id);
      setState(s => ({ ...s, equippedDeath: item.id }));
    } else if (item.type === 'jump') {
      localStorage.setItem('equippedJump', item.id);
      setState(s => ({ ...s, equippedJump: item.id }));
    } else if (item.type === 'background') {
      localStorage.setItem('equippedBackground', item.id);
      setState(s => ({ ...s, equippedBackground: item.id }));
    } else if (item.type === 'floor') {
      localStorage.setItem('equippedFloor', item.id);
      setState(s => ({ ...s, equippedFloor: item.id }));
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

  const handleAdrenaline = useCallback(() => {
    setState(s => activateAdrenaline({ ...s }));
  }, []);

  const handleToggleMute = useCallback(() => {
    toggleMute();
    setMuted(isMuted());
  }, []);

  const handleUpdateSettings = useCallback((settings: GameSettings) => {
    localStorage.setItem('gameSettings', JSON.stringify(settings));
    setMasterVolume(settings.masterVolume);
    setSfxEnabled(settings.sfxEnabled);
    setMusicEnabled(settings.musicEnabled);
    setState(s => ({ ...s, settings }));
  }, []);

  return (
    <div className="w-full h-screen overflow-hidden bg-background">
      <GameCanvas state={state} onStateChange={setState} />
      <MenuScreen
        state={state}
        onPlay={handlePlay}
        onShop={handleShop}
        onGhostMode={handleGhostMode}
        onChaosMode={handleChaosMode}
        onSettings={handleSettings}
      />
      <HUD
        state={state}
        onPause={handlePause}
        onActivatePower={handleActivatePower}
        onAdrenaline={handleAdrenaline}
        isMuted={muted}
        onToggleMute={handleToggleMute}
        onSettings={handleSettings}
      />
      <GameOverScreen state={state} onRevive={handleRevive} onMenu={handleMenu} />
      <PauseOverlay visible={state.screen === 'paused'} onResume={handleResume} onMenu={handleMenu} />
      {state.screen === 'shop' && (
        <ShopScreen
          coins={state.totalCoins}
          removeAds={state.removeAds}
          equippedSkin={state.equippedSkin}
          equippedTrail={state.equippedTrail}
          equippedDeath={state.equippedDeath}
          equippedJump={state.equippedJump}
          equippedBackground={state.equippedBackground}
          equippedFloor={state.equippedFloor}
          onBuy={handleBuy}
          onEquip={handleEquip}
          onRemoveAds={handleRemoveAds}
          onBack={handleMenu}
        />
      )}
      {state.screen === 'settings' && (
        <SettingsScreen
          settings={state.settings}
          onUpdate={handleUpdateSettings}
          onBack={handleMenu}
        />
      )}
      <div id="banner-ad" className="fixed bottom-0 left-0 right-0 h-[60px] z-10" />
    </div>
  );
};

export default Index;
