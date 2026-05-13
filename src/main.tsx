import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAds, startBannerWatchdog, refreshBanner } from "./lib/ads";

// Force landscape on mobile (silently ignored on desktop / unsupported browsers)
function lockLandscape() {
  try {
    const so: any = (screen as any).orientation;
    if (so && typeof so.lock === 'function') {
      so.lock('landscape').catch(() => {});
    }
  } catch {}
}
lockLandscape();
window.addEventListener('orientationchange', lockLandscape);

// Initialize AdMob (no-op on plain web; only acts inside Capacitor Android WebView)
try {
  initAds().then(() => startBannerWatchdog()).catch(() => {});
} catch {}

// Recreate banner on orientation change so it spans 100% width again.
window.addEventListener('orientationchange', () => {
  setTimeout(() => { refreshBanner().catch(() => {}); }, 250);
});

createRoot(document.getElementById("root")!).render(<App />);
