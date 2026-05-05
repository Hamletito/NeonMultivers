import { useT, Lang } from '../lib/i18n';

interface Props {
  onSelect: (lang: Lang) => void;
}

export default function LanguageSelectScreen({ onSelect }: Props) {
  const { setLang } = useT();
  const choose = (l: Lang) => {
    setLang(l);
    onSelect(l);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a12] flex flex-col items-center justify-center gap-8 pointer-events-auto px-6">
      <h2 className="text-2xl sm:text-3xl font-bold font-mono text-primary drop-shadow-[0_0_20px_rgba(0,255,204,0.5)] text-center">
        Choose your language
        <br />
        <span className="text-base text-muted-foreground font-normal">/ Elige tu idioma</span>
      </h2>

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => choose('en')}
          className="px-8 py-5 bg-primary/15 border-2 border-primary text-primary font-mono text-xl rounded-2xl hover:bg-primary/25 hover:shadow-[0_0_30px_rgba(0,255,204,0.5)] active:scale-95 transition-all min-w-[200px]"
        >
          🇬🇧 English
        </button>
        <button
          onClick={() => choose('es')}
          className="px-8 py-5 bg-secondary/15 border-2 border-secondary text-secondary font-mono text-xl rounded-2xl hover:bg-secondary/25 hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] active:scale-95 transition-all min-w-[200px]"
        >
          🇪🇸 Español
        </button>
      </div>

      <button
        onClick={() => window.open('https://hamletito.github.io/NeonMultivers/privacy-policy.html', '_blank')}
        className="absolute bottom-4 text-[11px] font-mono text-muted-foreground hover:text-primary underline-offset-2 hover:underline transition-colors"
      >
        Privacy Policy
      </button>
    </div>
  );
}
