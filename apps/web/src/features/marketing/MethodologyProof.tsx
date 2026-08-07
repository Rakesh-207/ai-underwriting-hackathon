import { Badge } from '../../components/ui/badge.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.tsx';

const proofCards = [
  ['Contribution ledger', 'Baseline and alternative contribution stay visible instead of disappearing into one opaque output.', 'primary'],
  ['Provenance at hand', 'Each evidence item carries its source, purpose, and place in the simulation story.', 'info'],
  ['Synthetic parity diagnostic', 'Evaluation cohorts test for uneven behavior without becoming model inputs.', 'success'],
] as const;

export function MethodologyProof() {
  return (
    <section id="methodology" className="border-b border-border bg-surface" aria-labelledby="methodology-heading">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Methodology</p>
            <h2 id="methodology-heading" className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">A scorecard people can interrogate.</h2>
          </div>
          <p className="max-w-[55ch] text-lg leading-8 text-muted">The deterministic engine is the source of truth. Every simulation result is accompanied by the evidence and limitations needed to review it responsibly.</p>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {proofCards.map(([title, description, tone]) => (
            <Card key={title} className="shadow-none">
              <CardHeader><Badge tone={tone}>{title}</Badge><CardTitle className="mt-5">{title}</CardTitle></CardHeader>
              <CardContent><p className="text-sm leading-6 text-muted">{description}</p></CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
