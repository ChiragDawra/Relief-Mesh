import { DEMO_DISCLAIMER, DEMO_TOKEN_LABEL } from '@reliefmesh/shared';

export function DemoBanner() {
  return (
    <div className="bg-navy px-6 py-1.5 text-center text-xs font-medium tracking-wide text-white">
      DEMO / SOLANA DEVNET · {DEMO_TOKEN_LABEL}
    </div>
  );
}

export function DemoFooter() {
  return (
    <footer className="border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-500">
      {DEMO_DISCLAIMER}
    </footer>
  );
}
