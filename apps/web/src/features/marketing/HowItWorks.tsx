const steps = [
  ['01', 'Start with the baseline', 'See the traditional application and bureau-based picture first.'],
  ['02', 'Ask for consent', 'Choose a clear purpose before any alternative signal is used.'],
  ['03', 'Add a consented signal', 'Introduce a synthetic, purpose-bound signal to the scenario.'],
  ['04', 'Read the change', 'Compare the reliability score, evidence, and review signal.'],
  ['05', 'Update the picture', 'Apply a behavior update and see the before-and-after result.'],
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-b border-border bg-bg" aria-labelledby="how-heading">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 lg:py-28">
        <div className="max-w-[620px]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">A deliberate sequence</p>
          <h2 id="how-heading" className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">From baseline to better context.</h2>
          <p className="mt-4 text-lg leading-8 text-muted">A simulation stays understandable when every change has a reason, a permission, and a visible next step.</p>
        </div>
        <ol className="mt-14 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-5">
          {steps.map(([number, title, description]) => (
            <li key={number} className="bg-surface p-5 sm:p-6 md:min-h-[250px]">
              <span className="text-xs font-semibold text-primary">{number}</span>
              <h3 className="mt-12 text-lg font-semibold leading-6 text-ink">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
