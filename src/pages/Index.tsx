import { useState, useCallback, useEffect } from 'react';
import GameCanvas from '../components/GameCanvas';
import MenuScreen from '../components/MenuScreen';
import HUD from '../components/HUD';
import GameOverScreen from '../components/GameOverScreen';
import ShopScreen from '../components/ShopScreen';
import PauseOverlay from '../components/PauseOverlay';
import SettingsScreen from '../components/SettingsScreen';
import ProfileScreen from '../components/ProfileScreen';
import TutorialOverlay from '../components/TutorialOverlay';
import InGameSettings from '../components/InGameSettings';
import { GameState, ShopItem, GameSettings, PlayerProfile } from '../game/types';
import { createInitialState, resetForNewGame, activateAdrenaline } from '../game/engine';
import { toggleMute, isMuted, startMusic, stopMusic, setMasterVolume, setSfxEnabled, setMusicEnabled } from '../game/audio';

function loadProfile(): PlayerProfile | null {
  try {
    const raw = localStorage.getItem('playerProfile');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

const Index = () => {
  const [state, setState] = useState<GameState>(createInitialState);
  const [muted, setMuted] = useState(isMuted());
  const [profile, setProfile] = useState<PlayerProfile | null>(loadProfile);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showInGameSettings, setShowInGameSettings] = useState(false);

  const needsProfile = !profile?.created;
  const needsTutorial = profile?.created && localStorage.getItem('tutorialDone') !== 'true';

  const handlePlay = useCallback(() => {
    if (needsTutorial) {
      setShowTutorial(true);
      return;
    }
    setState(s => resetForNewGame({ ...s, ghostMode: false, chaosMode: false }));
    startMusic(1);
  }, [needsTutorial]);

  const handleTutorialComplete = useCallback(() => {
    setShowTutorial(false);
    setState(s => resetForNewGame({ ...s, ghostMode: false, chaosMode: false }));
    startMusic(1);
  }, []);

  const handleProfileComplete = useCallback((p: PlayerProfile) => {
    setProfile(p);
    // Apply profile choices
    if (p.shape && p.shape !== 'square') {
      localStorage.setItem('equippedSkin', p.shape);
      setState(s => ({ ...s, equippedSkin: p.shape }));
    }
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

  const handlePause = useCallback(() => setState(s => ({ ...s, screen: 'paused' })), []);
  const handleResume = useCallback(() => setState(s => ({ ...s, screen: 'playing' })), []);
  const handleMenu = useCallback(() => { setState(s => ({ ...s, screen: 'menu' })); stopMusic(); setShowInGameSettings(false); }, []);
  const handleShop = useCallback(() => setState(s => ({ ...s, screen: 'shop' })), []);
  const handleSettings = useCallback(() => {
    setState(s => {
      if (s.screen === 'playing') {
        setShowInGameSettings(true);
        return { ...s, screen: 'paused' };
      }
      return { ...s, screen: 'settings' };
    });
  }, []);

  const handleCloseInGameSettings = useCallback(() => {
    setShowInGameSettings(false);
    setState(s => ({ ...s, screen: 'playing' }));
  }, []);

  const handleRevive = useCallback(() => {
    setState(s => {
      const newState = { ...s, screen: 'playing' as const, freeReviveUsed: true, hasShield: false, dyingTimer: 0, invincibleTimer: 3000, deathAnim: null };
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
    const key = item.type === 'skin' ? 'equippedSkin' : item.type === 'trail' ? 'equippedTrail' : item.type === 'death' ? 'equippedDeath' : item.type === 'jump' ? 'equippedJump' : item.type === 'background' ? 'equippedBackground' : item.type === 'floor' ? 'equippedFloor' : '';
    if (key) {
      localStorage.setItem(key, item.id);
      setState(s => ({ ...s, [key]: item.id }));
    }
  }, []);

  const handleRemoveAds = useCallback(() => { localStorage.setItem('removeAds', 'true'); setState(s => ({ ...s, removeAds: true })); }, []);
  const handleActivatePower = useCallback((type: 'shield' | 'slowmo' | 'magnet') => {
    setState(s => {
      if (type === 'shield') return { ...s, hasShield: true };
      const duration = type === 'slowmo' ? 3000 : 5000;
      return { ...s, activePowers: [...s.activePowers, { type, remaining: duration }] };
    });
  }, []);
  const handleAdrenaline = useCallback(() => setState(s => activateAdrenaline({ ...s })), []);
  const handleToggleMute = useCallback(() => { toggleMute(); setMuted(isMuted()); }, []);
  const handleUpdateSettings = useCallback((settings: GameSettings) => {
    localStorage.setItem('gameSettings', JSON.stringify(settings));
    setMasterVolume(settings.masterVolume);
    setSfxEnabled(settings.sfxEnabled);
    setMusicEnabled(settings.musicEnabled);
    setState(s => ({ ...s, settings }));
  }, []);

  if (needsProfile) {
    return (
      <div className="w-full h-screen overflow-hidden bg-background">
        <ProfileScreen onComplete={handleProfileComplete} />
      </div>
    );
  }

  return (
    <div className="w-full h-screen overflow-hidden bg-background">
      <GameCanvas state={state} onStateChange={setState} />
      {showTutorial && <TutorialOverlay onComplete={handleTutorialComplete} />}
      <MenuScreen state={state} onPlay={handlePlay} onShop={handleShop} onGhostMode={handleGhostMode} onChaosMode={handleChaosMode} onSettings={handleSettings} profile={profile} />
      <HUD state={state} onPause={handlePause} onActivatePower={handleActivatePower} onAdrenaline={handleAdrenaline} onSettings={handleSettings} />
      <GameOverScreen state={state} onRevive={handleRevive} onMenu={handleMenu} />
      <PauseOverlay visible={state.screen === 'paused' && !showInGameSettings} onResume={handleResume} onMenu={handleMenu} />
      {showInGameSettings && (
        <InGameSettings settings={state.settings} onUpdate={handleUpdateSettings} onClose={handleCloseInGameSettings} />
      )}
      {state.screen === 'shop' && (
        <ShopScreen coins={state.totalCoins} removeAds={state.removeAds} equippedSkin={state.equippedSkin} equippedTrail={state.equippedTrail} equippedDeath={state.equippedDeath} equippedJump={state.equippedJump} equippedBackground={state.equippedBackground} equippedFloor={state.equippedFloor} onBuy={handleBuy} onEquip={handleEquip} onRemoveAds={handleRemoveAds} onBack={handleMenu} />
      )}
      {state.screen === 'settings' && (
        <SettingsScreen settings={state.settings} onUpdate={handleUpdateSettings} onBack={handleMenu} />
      )}
      <div id="banner-ad" className="fixed bottom-0 left-0 right-0 h-[60px] z-10" />
    </div>
  );
};

export default Index;
