import { DemoBanner, DemoFooter } from '../components/DemoBanner';

export function App() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <DemoBanner />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold text-navy">ReliefMesh</h1>
        <p className="mt-2 text-slate-600">
          Intelligence in every decision. Transparency in every disbursement.
        </p>
      </main>
      <DemoFooter />
    </div>
  );
}
