const proofCards = [
  ['Contribution ledger', 'Baseline and alternative contribution stay visible instead of disappearing into one opaque output.'],
  ['Provenance at hand', 'Each evidence item keeps its source, purpose, and place in the review story.'],
  ['Fairness evaluation', 'Evaluation cohorts help surface uneven behavior without becoming model inputs.'],
] as const;

export function MethodologyProof() {
  return (
    <section id="methodology" className="border-b border-border bg-surface" aria-labelledby="methodology-heading">
      <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 lg:px-10 lg:py-32">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Explainability, built in</p>
            <h2 id="methodology-heading" className="mt-4 max-w-[13ch] text-4xl font-semibold leading-[1.05] tracking-[-0.05em] text-ink sm:text-5xl">Every change should have a reason.</h2>
          </div>
          <p className="max-w-[55ch] text-lg leading-8 text-muted">The useful part is not a mysterious number. It is a review that can show the source, purpose, and contribution of every signal, then make room for a person to question it.</p>
        </div>
        <div className="mt-16 grid gap-0 border-y border-border md:grid-cols-3">
          {proofCards.map(([title, description], index) => (
            <article key={title} className="border-b border-border py-7 md:border-b-0 md:border-r md:px-7 md:first:pl-0 md:last:border-r-0">
              <span className="font-mono text-xs text-primary">0{index + 1}</span>
              <h3 className="mt-8 text-lg font-semibold text-ink">{title}</h3>
              <p className="mt-3 max-w-[30ch] text-sm leading-6 text-muted">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
