/**
 * Always-visible banner placeholder.
 * The real Unity banner is rendered natively above this div by the Capacitor
 * bridge (see src/lib/unityAds.ts). On web this stays as a quiet placeholder
 * that occupies the same screen real estate so layouts match production.
 */
export default function BannerAd() {
  return (
    <div
      id="banner-ad"
      className="fixed bottom-0 left-0 right-0 h-[60px] z-10 bg-black/40 border-t border-border/40 flex items-center justify-center pointer-events-none"
      aria-hidden="true"
    >
      <span className="font-mono text-[10px] text-muted-foreground/40 tracking-wider">
        AD
      </span>
    </div>
  );
}
