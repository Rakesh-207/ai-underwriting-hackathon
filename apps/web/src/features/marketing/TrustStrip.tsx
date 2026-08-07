const proofPoints = [
  ['01', 'Purpose-bound consent'],
  ['02', 'Deterministic evidence'],
  ['03', 'Human review signal'],
  ['04', 'Auditable by design'],
] as const;

export function TrustStrip() {
  return (
    <section id="trust-strip" className="border-b border-border bg-surface" aria-labelledby="trust-heading">
      <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8">
        <h2 id="trust-heading" className="sr-only">Built for responsible exploration</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {proofPoints.map(([number, label]) => (
            <div key={label} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-bg text-xs font-semibold text-primary">{number}</span>
              <span className="text-sm font-medium text-ink">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
