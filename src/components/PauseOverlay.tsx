interface Props {
  visible: boolean;
  onResume: () => void;
  onMenu: () => void;
}

export default function PauseOverlay({ visible, onResume, onMenu }: Props) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-auto">
      <div className="flex flex-col items-center gap-4 p-8">
        <h2 className="text-3xl font-bold text-foreground font-mono">PAUSED</h2>
        <button
          onClick={onResume}
          className="px-8 py-3 bg-primary/20 border border-primary text-primary font-mono rounded-lg hover:bg-primary/30 transition-all"
        >
          RESUME
        </button>
        <button
          onClick={onMenu}
          className="text-muted-foreground text-sm font-mono hover:text-foreground transition-colors"
        >
          QUIT TO MENU
        </button>
      </div>
    </div>
  );
}
