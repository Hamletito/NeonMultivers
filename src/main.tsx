import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initUnityAds, startBannerWatchdog } from "./lib/unityAds";

// Best-effort attempt to lock landscape on mobile (silently ignored on desktop / unsupported browsers)
try {
  const so: any = (screen as any).orientation;
  if (so && typeof so.lock === 'function') {
    so.lock('landscape').catch(() => {});
  }
} catch {}

// Initialize Unity Ads (no-op on plain web; only acts inside Capacitor Android WebView)
try {
  initUnityAds().then(() => startBannerWatchdog()).catch(() => {});
} catch {}

createRoot(document.getElementById("root")!).render(<App />);
