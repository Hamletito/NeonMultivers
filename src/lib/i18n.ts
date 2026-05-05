// Lightweight i18n. No external deps.
// Usage: const { t, lang, setLang } = useT();  ->  t('menu.play')
import { useEffect, useState, useSyncExternalStore } from 'react';

export type Lang = 'en' | 'es';

const STORAGE_KEY = 'lang';

function detectInitial(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'en' || v === 'es') return v;
  } catch {}
  return null;
}

let currentLang: Lang = detectInitial() ?? 'en';
const listeners = new Set<() => void>();

export function getLang(): Lang { return currentLang; }
export function isLangChosen(): boolean { return detectInitial() !== null; }
export function setLang(l: Lang) {
  currentLang = l;
  try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  listeners.forEach(fn => fn());
}

const subscribe = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };
const getSnapshot = () => currentLang;

const DICT: Record<Lang, Record<string, string>> = {
  en: {
    // Menu
    'menu.best': 'Best',
    'menu.play': 'PLAY',
    'menu.vsGhost': 'VS GHOST',
    'menu.vsGhostLocked': '🔒 VS GHOST',
    'menu.chaos': '🔥 CHAOS',
    'menu.shop': 'SHOP',
    'menu.achievements': '🏆 ACHIEVEMENTS',
    'menu.tip': 'Tap to jump • Tap again to slam',
    'menu.unlockGhost': 'Play a run first to unlock Ghost Mode',

    // HUD
    'hud.adrenaline': 'ADRENALINE',
    'hud.shield': '🛡️ Shield',
    'hud.slowmo': '🐌 Slow-Mo',
    'hud.magnet': '🧲 Magnet',
    'hud.chaosLabel': '🔥 CHAOS MODE 🔥',

    // Pause
    'pause.title': 'PAUSED',
    'pause.resume': 'RESUME',
    'pause.menu': 'QUIT TO MENU',

    // Game over
    'go.title': 'GAME OVER',
    'go.score': 'Score',
    'go.best': 'Best',
    'go.newBest': '⭐ NEW BEST! ⭐',
    'go.thisRun': 'this run',
    'go.freeRevive': '💚 FREE REVIVE',
    'go.reviveAd': '💚 REVIVE (Watch Ad)',
    'go.doubleCoins': '💰 2X COINS',
    'go.playAgain': '▶ PLAY AGAIN',
    'go.menu': 'MENU',
    'go.loadingAd': 'Loading ad...',
    'go.reviving': 'Reviving...',
    'go.doubling': 'Doubling coins...',

    // Shop
    'shop.title': '⚡ SHOP',
    'shop.tab.skins': 'Skins',
    'shop.tab.trails': 'Trails',
    'shop.tab.death': 'Death',
    'shop.tab.jump': 'Jump',
    'shop.tab.backgrounds': 'BG',
    'shop.tab.floor': 'Floor',
    'shop.tab.powerups': 'Power',
    'shop.equipped': 'EQUIPPED',
    'shop.equip': 'EQUIP',
    'shop.equippedToast': 'Equipped!',
    'shop.freeCoins': '🎁 FREE COINS',
    'shop.freeCoinsHint': 'per ad • unlimited',
    'shop.watchAdFor': 'Watch ad for',
    'shop.coins': 'coins',
    'shop.rarity.common': 'Common',
    'shop.rarity.rare': 'Rare',
    'shop.rarity.epic': 'Epic',
    'shop.rarity.legendary': 'Legendary',

    // Settings
    'set.title': '⚙️ SETTINGS',
    'set.tab.audio': '🔊 Audio',
    'set.tab.graphics': '🎨 Graphics',
    'set.tab.gameplay': '🎮 Gameplay',
    'set.tab.account': '👤 Account',
    'set.tab.about': 'ℹ️ About',
    'set.master': 'Master volume',
    'set.music': '🎵 Music',
    'set.sfx': '🔈 Sound effects',
    'set.particles': '✨ Particle effects',
    'set.bgAnim': '🌌 Background animations',
    'set.showDistance': '📏 Show distance',
    'set.showStreak': '🔥 Show streak',
    'set.showAdrenaline': '⚡ Adrenaline bar',
    'set.controlSens': '🎯 Control sensitivity',
    'set.normal': 'Normal',
    'set.high': 'High',
    'set.playerName': '👤 Player name',
    'set.edit': 'Edit',
    'set.cancel': 'Cancel',
    'set.save': 'Save (50 🪙)',
    'set.reset': '🗑️ Reset progress',
    'set.resetConfirm': 'Are you sure? This will erase all your coins, skins and achievements. This cannot be undone.',
    'set.resetType': 'Type "RESET" to confirm',
    'set.confirm': 'Confirm',
    'set.language': '🌐 Language',
    'set.nameChange.title': 'Change name',
    'set.nameChange.cost': 'Changing your name costs',
    'set.nameChange.balance': 'Current balance',
    'set.nameChange.notEnough': 'Not enough coins',
    'set.nameChange.continue': 'Continue',
    'set.nameChange.close': 'Close',
    'set.about.dev': 'Developed by',
    'set.about.studio': 'Studio',
    'set.about.contact': 'Contact',
    'set.about.madeWith': 'Made with ❤️',
    'set.about.report': '🐛 Report a bug',
    'set.about.privacy': '📄 Privacy Policy',

    // Tutorial
    'tut.1': 'TAP to jump',
    'tut.1sub': 'Tap the screen now',
    'tut.2': 'Nice! Jump over obstacles',
    'tut.2sub': 'Tap to continue',
    'tut.3': 'TAP again in mid-air\nto slam down faster',
    'tut.3sub': 'Tap to continue',
    'tut.4': 'Collect coins to buy\nitems in the shop',
    'tut.4sub': 'Tap to continue',
    'tut.4got': '🪙 Coin collected! Tap to continue',
    'tut.5': "You're ready. Good luck.",
    'tut.5sub': 'Tap to start',

    // Profile
    'profile.name': 'Choose your name',
    'profile.shape': 'Choose your shape',
    'profile.color': 'Choose your color',
    'profile.next': 'NEXT →',
    'profile.start': 'START',
    'profile.chars': 'characters',
    'profile.privacy': 'Privacy Policy',
    'profile.shape.square': 'Square',
    'profile.shape.circle': 'Circle',
    'profile.shape.triangle': 'Triangle',
    'profile.shape.star': 'Star',

    // Lang select
    'lang.title': 'Choose your language',
    'lang.en': '🇬🇧 English',
    'lang.es': '🇪🇸 Español',

    // Rotate
    'rotate.title': 'Rotate your device',
    'rotate.sub': 'NeonMultiverse is best played in landscape',
  },
  es: {
    'menu.best': 'Récord',
    'menu.play': 'JUGAR',
    'menu.vsGhost': 'VS FANTASMA',
    'menu.vsGhostLocked': '🔒 VS FANTASMA',
    'menu.chaos': '🔥 CAOS',
    'menu.shop': 'TIENDA',
    'menu.achievements': '🏆 LOGROS',
    'menu.tip': 'Toca para saltar • Toca de nuevo para caer',
    'menu.unlockGhost': 'Juega una partida para desbloquear el Modo Fantasma',

    'hud.adrenaline': 'ADRENALINA',
    'hud.shield': '🛡️ Escudo',
    'hud.slowmo': '🐌 Cámara lenta',
    'hud.magnet': '🧲 Imán',
    'hud.chaosLabel': '🔥 MODO CAOS 🔥',

    'pause.title': 'PAUSA',
    'pause.resume': 'CONTINUAR',
    'pause.menu': 'SALIR AL MENÚ',

    'go.title': 'FIN DEL JUEGO',
    'go.score': 'Puntaje',
    'go.best': 'Récord',
    'go.newBest': '⭐ ¡NUEVO RÉCORD! ⭐',
    'go.thisRun': 'esta partida',
    'go.freeRevive': '💚 REVIVIR GRATIS',
    'go.reviveAd': '💚 REVIVIR (Ver anuncio)',
    'go.doubleCoins': '💰 2X MONEDAS',
    'go.playAgain': '▶ JUGAR DE NUEVO',
    'go.menu': 'MENÚ',
    'go.loadingAd': 'Cargando anuncio...',
    'go.reviving': 'Reviviendo...',
    'go.doubling': 'Duplicando monedas...',

    'shop.title': '⚡ TIENDA',
    'shop.tab.skins': 'Skins',
    'shop.tab.trails': 'Estelas',
    'shop.tab.death': 'Muerte',
    'shop.tab.jump': 'Salto',
    'shop.tab.backgrounds': 'Fondo',
    'shop.tab.floor': 'Suelo',
    'shop.tab.powerups': 'Power',
    'shop.equipped': 'EQUIPADO',
    'shop.equip': 'EQUIPAR',
    'shop.equippedToast': '¡Equipado!',
    'shop.freeCoins': '🎁 MONEDAS GRATIS',
    'shop.freeCoinsHint': 'por anuncio • ilimitado',
    'shop.watchAdFor': 'Ver anuncio por',
    'shop.coins': 'monedas',
    'shop.rarity.common': 'Común',
    'shop.rarity.rare': 'Raro',
    'shop.rarity.epic': 'Épico',
    'shop.rarity.legendary': 'Legendario',

    'set.title': '⚙️ CONFIGURACIÓN',
    'set.tab.audio': '🔊 Audio',
    'set.tab.graphics': '🎨 Gráficos',
    'set.tab.gameplay': '🎮 Juego',
    'set.tab.account': '👤 Cuenta',
    'set.tab.about': 'ℹ️ Info',
    'set.master': 'Volumen maestro',
    'set.music': '🎵 Música',
    'set.sfx': '🔈 Efectos de sonido',
    'set.particles': '✨ Efectos de partículas',
    'set.bgAnim': '🌌 Animaciones de fondo',
    'set.showDistance': '📏 Mostrar distancia',
    'set.showStreak': '🔥 Mostrar racha',
    'set.showAdrenaline': '⚡ Barra de adrenalina',
    'set.controlSens': '🎯 Sensibilidad de control',
    'set.normal': 'Normal',
    'set.high': 'Alta',
    'set.playerName': '👤 Nombre del jugador',
    'set.edit': 'Editar',
    'set.cancel': 'Cancelar',
    'set.save': 'Guardar (50 🪙)',
    'set.reset': '🗑️ Reiniciar progreso',
    'set.resetConfirm': '¿Estás seguro? Esto eliminará todas tus monedas, skins y logros. Esto no se puede deshacer.',
    'set.resetType': 'Escribe "RESET" para confirmar',
    'set.confirm': 'Confirmar',
    'set.language': '🌐 Idioma',
    'set.nameChange.title': 'Cambiar nombre',
    'set.nameChange.cost': 'Cambiar tu nombre cuesta',
    'set.nameChange.balance': 'Saldo actual',
    'set.nameChange.notEnough': 'No tienes suficientes monedas',
    'set.nameChange.continue': 'Continuar',
    'set.nameChange.close': 'Cerrar',
    'set.about.dev': 'Desarrollado por',
    'set.about.studio': 'Estudio',
    'set.about.contact': 'Contacto',
    'set.about.madeWith': 'Hecho con ❤️',
    'set.about.report': '🐛 Reportar un error',
    'set.about.privacy': '📄 Política de privacidad',

    'tut.1': 'TOCA para saltar',
    'tut.1sub': 'Toca la pantalla ahora',
    'tut.2': '¡Bien! Salta los obstáculos',
    'tut.2sub': 'Toca para continuar',
    'tut.3': 'TOCA de nuevo en el aire\npara caer más rápido',
    'tut.3sub': 'Toca para continuar',
    'tut.4': 'Recoge monedas para comprar\nobjetos en la tienda',
    'tut.4sub': 'Toca para continuar',
    'tut.4got': '🪙 ¡Moneda recogida! Toca para continuar',
    'tut.5': 'Estás listo. Suerte.',
    'tut.5sub': 'Toca para empezar',

    'profile.name': 'Elige tu nombre',
    'profile.shape': 'Elige tu forma',
    'profile.color': 'Elige tu color',
    'profile.next': 'SIGUIENTE →',
    'profile.start': 'EMPEZAR',
    'profile.chars': 'caracteres',
    'profile.privacy': 'Política de privacidad',
    'profile.shape.square': 'Cuadrado',
    'profile.shape.circle': 'Círculo',
    'profile.shape.triangle': 'Triángulo',
    'profile.shape.star': 'Estrella',

    'lang.title': 'Elige tu idioma',
    'lang.en': '🇬🇧 English',
    'lang.es': '🇪🇸 Español',

    'rotate.title': 'Gira tu dispositivo',
    'rotate.sub': 'NeonMultiverse se juega mejor en horizontal',
  },
};

export function t(key: string): string {
  return DICT[currentLang][key] ?? DICT.en[key] ?? key;
}

export function useT() {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    lang,
    t: (k: string): string => DICT[lang][k] ?? DICT.en[k] ?? k,
    setLang,
  };
}

// Force re-render hack for non-hook callers (rarely needed).
export function useLangVersion() {
  const [, setN] = useState(0);
  useEffect(() => {
    const unsub = subscribe(() => setN(n => n + 1));
    return () => { unsub; };
  }, []);
}
