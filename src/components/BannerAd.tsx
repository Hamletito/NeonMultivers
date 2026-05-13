/**
 * Always-visible banner placeholder.
 * The real AdMob banner is rendered natively above this div by the Capacitor
 * bridge (see src/lib/ads.ts). On web this stays as a quiet placeholder
 * that occupies the same screen real estate so layouts match production.
 *
 * Always 100% width, anchored to the bottom — height matches CSS var
 * --banner-height so all screens can use padding-bottom: var(--banner-height).
 */
export default function BannerAd() {
  return (
    <div
      id="banner-ad"
      className="fixed bottom-0 left-0 right-0 w-full z-10 bg-black/40 border-t border-border/40 flex items-center justify-center pointer-events-none"
      style={{ height: 'var(--banner-height, 60px)' }}
      aria-hidden="true"
    >
      <span className="font-mono text-[10px] text-muted-foreground/40 tracking-wider">
        AD
      </span>
    </div>
  );
}
