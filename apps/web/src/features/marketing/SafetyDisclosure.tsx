const boundaries = [
  ['Consent', 'A clear purpose comes before a new signal enters the review.'],
  ['Provenance', 'Every observation keeps its source and place in the evidence trail.'],
  ['Plain language', 'Contributions and changes are described so a person can inspect them.'],
  ['Fairness', 'Evaluation cohorts help surface uneven behavior for responsible review.'],
] as const;

export function SafetyDisclosure() {
  return (
    <section id="safety" className="border-b border-border bg-bg" aria-labelledby="safety-heading">
      <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.7fr_1.3fr] lg:px-10 lg:py-32">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Trust is a feature</p>
          <h2 id="safety-heading" className="mt-4 max-w-[12ch] text-4xl font-semibold leading-[1.05] tracking-[-0.05em] text-ink sm:text-5xl">Built to show its work.</h2>
        </div>
        <div className="grid gap-0 divide-y divide-border border-y border-border">
          {boundaries.map(([title, description]) => (
            <div key={title} className="grid gap-2 py-6 sm:grid-cols-[190px_1fr] sm:gap-6">
              <h3 className="font-semibold text-ink">{title}</h3>
              <p className="text-sm leading-6 text-muted">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
