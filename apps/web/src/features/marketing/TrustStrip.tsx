const proofPoints = [
  ['01', 'Consent is explicit'],
  ['02', 'Sources stay attached'],
  ['03', 'Changes are explained'],
  ['04', 'People stay in the loop'],
] as const;

export function TrustStrip() {
  return (
    <section id="trust-strip" className="border-b border-border bg-surface" aria-labelledby="trust-heading">
      <div className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 lg:px-10">
        <h2 id="trust-heading" className="sr-only">Built for responsible exploration</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {proofPoints.map(([number, label]) => (
            <div key={label} className="flex items-center gap-4 border-l border-border pl-4">
              <span className="font-mono text-[10px] font-semibold text-primary">{number}</span>
              <span className="text-sm font-medium text-ink">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
