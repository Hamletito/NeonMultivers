/**
 * Google AdMob adapter for NeonMultiverse.
 *
 * Uses @capacitor-community/admob inside a Capacitor Android WebView.
 * On plain web (no native bridge) every call resolves to a "not ready" state
 * and the calling code falls back to its built-in countdown / silent-skip behaviour.
 *
 * App + ad unit IDs are hard-coded as requested.
 */

import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  AdmobConsentStatus,
  RewardAdPluginEvents,
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
const MIN_GAP_MS = 3 * 60_000; // 3 minutes between non-banner ads

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
  } catch {}
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

export function startBannerWatchdog(): void {
  showBanner();
  setInterval(() => { if (!bannerShown) showBanner(); }, 30_000);
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
  adShowing = true;
  try {
    const racePromise = (async () => {
      await AdMob.prepareInterstitial({ adId: AD_UNITS.interstitial, isTesting: false });
      await AdMob.showInterstitial();
      return true;
    })();
    const timeoutPromise = new Promise<boolean>(res => setTimeout(() => res(false), timeoutMs));
    const ok = await Promise.race([racePromise, timeoutPromise]);
    if (ok) {
      lastNonBannerAdAt = Date.now();
      localStorage.setItem('lastInterstitialAt', String(lastNonBannerAdAt));
    }
    return !!ok;
  } catch {
    return false;
  } finally {
    adShowing = false;
  }
}

/** Random screen-transition interstitial. ~20% chance, gated by 3-min cooldown. */
export function maybeShowTransitionInterstitial(): void {
  if (!canShowNonBanner()) return;
  if (Math.random() > 0.2) return;
  showInterstitial(3000).catch(() => {});
}

// ---- Rewarded ----
export async function showRewarded(timeoutMs = 3000): Promise<boolean> {
  if (!isNative()) return false;
  if (adShowing) return false;
  adShowing = true;
  try {
    let rewarded = false;
    const handler = () => { rewarded = true; };
    const sub = await AdMob.addListener(RewardAdPluginEvents.Rewarded, handler);
    try {
      const racePromise = (async () => {
        await AdMob.prepareRewardVideoAd({ adId: AD_UNITS.rewarded, isTesting: false });
        await AdMob.showRewardVideoAd();
        return true;
      })();
      const timeoutPromise = new Promise<boolean>(res => setTimeout(() => res(false), timeoutMs));
      const shown = await Promise.race([racePromise, timeoutPromise]);
      return !!shown && rewarded;
    } finally {
      try { await sub.remove(); } catch {}
    }
  } catch {
    return false;
  } finally {
    adShowing = false;
  }
}

// ---- App lifecycle (banner pause/resume handled natively by AdMob) ----

// ---- Free-coin reward (no daily limit) ----
const FREE_COINS_REWARD = 15;
export function consumeFreeCoinSlot(): number { return FREE_COINS_REWARD; }
export const FREE_COINS_PER_AD = FREE_COINS_REWARD;
