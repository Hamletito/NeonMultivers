/**
 * Unity Ads adapter for NeonMultiverse.
 *
 * Works only inside a Capacitor Android WebView where a native bridge exposes
 * `window.UnityAdsBridge` (recommended: a thin custom plugin around the Unity
 * Ads Android SDK). On plain web or if the bridge is missing every call
 * resolves to a "not ready" / "failed" state, and the calling code falls back
 * to its built-in countdown / silent-skip behaviour.
 *
 * Game ID + ad units are hard-coded as requested.
 */

const GAME_ID = '6105670';
const TEST_MODE = false;

export const AD_UNITS = {
  banner: 'Banner_Android',
  interstitial: 'Intersticial_Android',
  rewarded: 'Recompensado_Android',
} as const;

type Bridge = {
  initialize?: (gameId: string, testMode: boolean) => void | Promise<void>;
  loadBanner?: (placementId: string, anchor: 'bottom' | 'top') => void | Promise<void>;
  showInterstitial?: (placementId: string) => Promise<{ shown: boolean }>;
  showRewarded?: (placementId: string) => Promise<{ rewarded: boolean }>;
  isReady?: (placementId: string) => boolean | Promise<boolean>;
  pause?: () => void;
  resume?: () => void;
};

declare global {
  interface Window {
    UnityAdsBridge?: Bridge;
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

const isNative = () => {
  try { return !!window.Capacitor?.isNativePlatform?.(); } catch { return false; }
};

const bridge = (): Bridge | null => {
  try { return (isNative() && window.UnityAdsBridge) ? window.UnityAdsBridge : null; }
  catch { return null; }
};

let initialized = false;
let lastNonBannerAdAt = 0;
const MIN_GAP_MS = 30_000;
let adShowing = false;

export async function initUnityAds(): Promise<void> {
  if (initialized) return;
  initialized = true;
  const b = bridge();
  if (!b?.initialize) return;
  try { await b.initialize(GAME_ID, TEST_MODE); } catch {}
}

export function showBanner(): void {
  const b = bridge();
  if (!b?.loadBanner) return;
  try { b.loadBanner(AD_UNITS.banner, 'bottom'); } catch {}
}

/** Attempts to start a periodic banner reload. The placeholder div is always
 *  visible regardless. */
export function startBannerWatchdog(): void {
  showBanner();
  setInterval(() => { try { showBanner(); } catch {} }, 30_000);
}

function canShowNonBanner(): boolean {
  if (adShowing) return false;
  if (Date.now() - lastNonBannerAdAt < MIN_GAP_MS) return false;
  return true;
}

/** Resolves true if interstitial was shown, false otherwise (skip silently). */
export function showInterstitial(timeoutMs = 3000): Promise<boolean> {
  if (!canShowNonBanner()) return Promise.resolve(false);
  const b = bridge();
  if (!b?.showInterstitial) return Promise.resolve(false);

  adShowing = true;
  return new Promise<boolean>((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return; done = true; adShowing = false;
      if (ok) lastNonBannerAdAt = Date.now();
      resolve(ok);
    };
    const t = setTimeout(() => finish(false), timeoutMs);
    try {
      b.showInterstitial!(AD_UNITS.interstitial)
        .then(r => { clearTimeout(t); finish(!!r?.shown); })
        .catch(() => { clearTimeout(t); finish(false); });
    } catch { clearTimeout(t); finish(false); }
  });
}

/** Resolves true if reward should be granted (ad finished OR fallback). */
export function showRewarded(timeoutMs = 3000): Promise<boolean> {
  if (!canShowNonBanner()) return Promise.resolve(false);
  const b = bridge();
  if (!b?.showRewarded) return Promise.resolve(false);

  adShowing = true;
  return new Promise<boolean>((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return; done = true; adShowing = false;
      if (ok) lastNonBannerAdAt = Date.now();
      resolve(ok);
    };
    const t = setTimeout(() => finish(false), timeoutMs);
    try {
      b.showRewarded!(AD_UNITS.rewarded)
        .then(r => { clearTimeout(t); finish(!!r?.rewarded); })
        .catch(() => { clearTimeout(t); finish(false); });
    } catch { clearTimeout(t); finish(false); }
  });
}

export function pauseAds() { try { bridge()?.pause?.(); } catch {} }
export function resumeAds() { try { bridge()?.resume?.(); } catch {} }

// ---- App lifecycle ----
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseAds(); else resumeAds();
  });
}

// ---- Daily free-coin counter ----
const FREE_COINS_LIMIT = 5;
const FREE_COINS_REWARD = 25;

function todayKey(): string {
  const d = new Date();
  return `freeCoinsCount_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
export function getFreeCoinsRemaining(): number {
  const used = parseInt(localStorage.getItem(todayKey()) || '0', 10);
  return Math.max(0, FREE_COINS_LIMIT - used);
}
export function consumeFreeCoinSlot(): number {
  const k = todayKey();
  const used = parseInt(localStorage.getItem(k) || '0', 10) + 1;
  localStorage.setItem(k, String(used));
  return FREE_COINS_REWARD;
}
export const FREE_COINS_PER_AD = FREE_COINS_REWARD;
export const FREE_COINS_MAX_PER_DAY = FREE_COINS_LIMIT;

// ---- Game-over interstitial cadence ----
export function shouldShowGameOverInterstitial(): boolean {
  const n = parseInt(localStorage.getItem('gameOverCount') || '0', 10) + 1;
  localStorage.setItem('gameOverCount', String(n));
  // Every 2nd game over: 2, 4, 6, ...
  return n % 2 === 0;
}
