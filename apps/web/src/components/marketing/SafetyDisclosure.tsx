const boundaries = [
  ['No credentials', 'The simulation never asks for raw bank logins or private credentials.'],
  ['Synthetic by default', 'Synthetic examples keep the first review focused, reproducible, and permission-aware.'],
  ['No protected traits', 'Protected traits and proxies stay outside the score inputs.'],
  ['No automatic outcome', 'A manual review signal is a prompt for a person, never a denial.'],
] as const;

export function SafetyDisclosure() {
  return (
    <section id="safety" className="border-b border-border bg-bg" aria-labelledby="safety-heading">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.7fr_1.3fr] lg:py-28">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Trust boundary</p>
          <h2 id="safety-heading" className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">Useful because it knows what not to do.</h2>
        </div>
        <div className="grid gap-0 divide-y divide-border border-y border-border">
          {boundaries.map(([title, description]) => (
            <div key={title} className="grid gap-2 py-5 sm:grid-cols-[190px_1fr] sm:gap-6">
              <h3 className="font-semibold text-ink">{title}</h3>
              <p className="text-sm leading-6 text-muted">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
