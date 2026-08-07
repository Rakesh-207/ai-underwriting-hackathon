const steps = [
  ['01', 'Start with what is known', 'See the application and bureau picture before adding anything else.'],
  ['02', 'Make the purpose clear', 'Choose what a new signal is for before it enters the review.'],
  ['03', 'Bring the evidence together', 'Read traditional data and consented context in one place.'],
  ['04', 'Follow the change', 'See which observation moved the picture and why.'],
] as const;

export function HowItWorks() {
  return (
    <section id="story" className="border-b border-border bg-bg" aria-labelledby="how-heading">
      <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 lg:px-10 lg:py-32">
        <div className="max-w-[620px]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">The review, in context</p>
          <h2 id="how-heading" className="mt-4 max-w-[14ch] text-4xl font-semibold leading-[1.05] tracking-[-0.05em] text-ink sm:text-5xl">Credit history is only one signal.</h2>
          <p className="mt-5 text-lg leading-8 text-muted">Traditional underwriting gives teams an essential starting point. A more complete review makes room for useful context, with consent and provenance attached.</p>
        </div>
        <ol className="mt-16 grid gap-0 border-y border-border md:grid-cols-4">
          {steps.map(([number, title, description]) => (
            <li key={number} className="border-b border-border py-7 md:border-b-0 md:border-r md:px-7 md:first:pl-0 md:last:border-r-0">
              <span className="font-mono text-xs font-semibold text-primary">{number}</span>
              <h3 className="mt-12 text-lg font-semibold leading-6 text-ink">{title}</h3>
              <p className="mt-3 max-w-[24ch] text-sm leading-6 text-muted">{description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
