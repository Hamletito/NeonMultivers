/**
 * Google AdMob adapter for NeonMultiverse.
 *
 * Uses @capacitor-community/admob inside a Capacitor Android WebView.
 * On plain web (no native bridge) every call resolves to a "not ready" state
 * and the calling code falls back to its built-in countdown / silent-skip behaviour.
 *
 * Strategy:
 *   - Aggressive preloading of interstitial + rewarded at startup, and
 *     immediately after each ad is consumed. Watchdog retries every 30 s.
 *   - Banner is 100% width (ADAPTIVE_BANNER), anchored bottom, recreated on
 *     orientation/resize so the underlying native view always recalculates width.
 *   - Interstitial cooldown bumped from 3 min → 10 min between non-banner ads.
 */

import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  AdmobConsentStatus,
  RewardAdPluginEvents,
  InterstitialAdPluginEvents,
} from '@capacitor-community/admob';

export const AD_UNITS = {
  banner: 'ca-app-pub-1288760910461542/1474170281',
  interstitial: 'ca-app-pub-1288760910461542/3908761938',
  rewarded: 'ca-app-pub-1288760910461542/2896886996',
} as const;

const isNative = () => {
  try { return !!(window as any).Capacitor?.isNativePlatform?.(); } catch { return false; }
};

let initialized = false;
let bannerShown = false;
let lastNonBannerAdAt = 0;
let adShowing = false;
let interstitialReady = false;
let rewardedReady = false;
const MIN_GAP_MS = 10 * 60_000; // 10 minutes between non-banner ads

// ---- Init + preload pipeline ----
export async function initAds(): Promise<void> {
  if (initialized) return;
  initialized = true;
  if (!isNative()) return;
  try {
    await AdMob.initialize({ initializeForTesting: false });
    try {
      const { status } = await AdMob.requestConsentInfo();
      if (status === AdmobConsentStatus.REQUIRED) {
        await AdMob.showConsentForm();
      }
    } catch {}
    // Auto-rearm interstitial after dismiss
    try {
      AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
        interstitialReady = false;
        prepareInterstitial().catch(() => {});
      });
    } catch {}
    try {
      AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        rewardedReady = false;
        prepareRewarded().catch(() => {});
      });
    } catch {}
    // Kick off preloads in parallel
    prepareInterstitial().catch(() => {});
    prepareRewarded().catch(() => {});
    showBanner().catch(() => {});
    // Keep ads warm — retry every 30 s if anything failed
    setInterval(() => {
      if (!interstitialReady) prepareInterstitial().catch(() => {});
      if (!rewardedReady) prepareRewarded().catch(() => {});
      if (!bannerShown) showBanner().catch(() => {});
    }, 30_000);
  } catch {}
}

async function prepareInterstitial(): Promise<void> {
  if (!isNative() || interstitialReady) return;
  try {
    await AdMob.prepareInterstitial({ adId: AD_UNITS.interstitial, isTesting: false });
    interstitialReady = true;
  } catch { interstitialReady = false; }
}

async function prepareRewarded(): Promise<void> {
  if (!isNative() || rewardedReady) return;
  try {
    await AdMob.prepareRewardVideoAd({ adId: AD_UNITS.rewarded, isTesting: false });
    rewardedReady = true;
  } catch { rewardedReady = false; }
}

// ---- Banner ----
export async function showBanner(): Promise<void> {
  if (!isNative()) return;
  try {
    await AdMob.showBanner({
      adId: AD_UNITS.banner,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: false,
    });
    bannerShown = true;
  } catch {
    bannerShown = false;
  }
}

export async function hideBanner(): Promise<void> {
  if (!isNative()) return;
  try { await AdMob.hideBanner(); } catch {}
  try { await AdMob.removeBanner(); } catch {}
  bannerShown = false;
}

/** Destroy + recreate the banner so its native width recalculates after rotation. */
export async function refreshBanner(): Promise<void> {
  await hideBanner();
  await showBanner();
}

export function startBannerWatchdog(): void {
  showBanner();
  // Reactively recreate banner when the WebView is resized (orientation change, etc.)
  let resizeT: number | undefined;
  const onResize = () => {
    if (resizeT) clearTimeout(resizeT);
    resizeT = window.setTimeout(() => { refreshBanner().catch(() => {}); }, 200);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  try {
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(onResize);
      ro.observe(document.documentElement);
    }
  } catch {}
  setInterval(() => { if (!bannerShown) showBanner().catch(() => {}); }, 30_000);
}

// ---- Interstitial ----
function canShowNonBanner(): boolean {
  if (adShowing) return false;
  const last = parseInt(localStorage.getItem('lastInterstitialAt') || '0', 10) || lastNonBannerAdAt;
  if (Date.now() - last < MIN_GAP_MS) return false;
  return true;
}

export async function showInterstitial(timeoutMs = 3000): Promise<boolean> {
  if (!canShowNonBanner()) return false;
  if (!isNative()) return false;
  if (!interstitialReady) {
    // Last-ditch attempt to load on demand, but only briefly
    await Promise.race([prepareInterstitial(), new Promise(r => setTimeout(r, 1500))]);
  }
  if (!interstitialReady) return false;
  adShowing = true;
  try {
    const racePromise = (async () => { await AdMob.showInterstitial(); return true; })();
    const timeoutPromise = new Promise<boolean>(res => setTimeout(() => res(false), timeoutMs));
    const ok = await Promise.race([racePromise, timeoutPromise]);
    if (ok) {
      lastNonBannerAdAt = Date.now();
      localStorage.setItem('lastInterstitialAt', String(lastNonBannerAdAt));
    }
    interstitialReady = false;
    prepareInterstitial().catch(() => {});
    return !!ok;
  } catch {
    interstitialReady = false;
    prepareInterstitial().catch(() => {});
    return false;
  } finally {
    adShowing = false;
  }
}

/** Random screen-transition interstitial. ~20% chance, gated by 10-min cooldown. */
export function maybeShowTransitionInterstitial(): void {
  if (!canShowNonBanner()) return;
  if (Math.random() > 0.2) return;
  showInterstitial(3000).catch(() => {});
}

// ---- Rewarded ----
export async function showRewarded(timeoutMs = 3000): Promise<boolean> {
  if (!isNative()) return false;
  if (adShowing) return false;
  if (!rewardedReady) {
    await Promise.race([prepareRewarded(), new Promise(r => setTimeout(r, 1500))]);
  }
  if (!rewardedReady) return false;
  adShowing = true;
  try {
    let rewarded = false;
    const handler = () => { rewarded = true; };
    const sub = await AdMob.addListener(RewardAdPluginEvents.Rewarded, handler);
    try {
      const racePromise = (async () => { await AdMob.showRewardVideoAd(); return true; })();
      const timeoutPromise = new Promise<boolean>(res => setTimeout(() => res(false), timeoutMs));
      const shown = await Promise.race([racePromise, timeoutPromise]);
      rewardedReady = false;
      prepareRewarded().catch(() => {});
      return !!shown && rewarded;
    } finally {
      try { await sub.remove(); } catch {}
    }
  } catch {
    rewardedReady = false;
    prepareRewarded().catch(() => {});
    return false;
  } finally {
    adShowing = false;
  }
}

// ---- Free-coin reward (no daily limit) ----
const FREE_COINS_REWARD = 15;
export function consumeFreeCoinSlot(): number { return FREE_COINS_REWARD; }
export const FREE_COINS_PER_AD = FREE_COINS_REWARD;
