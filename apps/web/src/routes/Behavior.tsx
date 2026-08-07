import { useState } from 'react';
import { Button } from '../components/ui/button.tsx';
import { Page, Panel, Notice } from '../components/workspace/index.tsx';
import { useSimulation } from '../hooks/useWorkspace.tsx';

export function Behavior() {
  const [value, setValue] = useState(0.9);
  const { dynamicScore, behaviorScore, applyBehavior, loading, error } = useSimulation();
  return <Page eyebrow="Behavior" title="Behavior update" description="Submit a synthetic observation only after behavior-update consent. Results remain API-owned."><Notice>{error ?? 'Behavior observations are synthetic and purpose-bound. This surface is for evaluation, not surveillance.'}</Notice><Panel title="New observation"><div className="flex flex-wrap items-end gap-4"><label className="text-sm text-muted">Observed value<input className="mt-2 h-11 w-40 rounded-md border border-border bg-surface px-3 text-ink" type="number" min="0" max="1" step="0.01" value={value} onChange={(event) => setValue(Number(event.target.value))} /></label><Button disabled={loading} onClick={() => void applyBehavior(value)}>Apply behavior update</Button></div></Panel>{behaviorScore && dynamicScore && <div className="grid gap-4 sm:grid-cols-3"><Panel title="Before"><p className="text-3xl font-semibold">{dynamicScore.dynamicScore}</p></Panel><Panel title="After"><p className="text-3xl font-semibold text-primary">{behaviorScore.dynamicScore}</p></Panel><Panel title="Changed evidence"><p className="text-sm text-muted">The API returned the updated deterministic result.</p></Panel></div>}</Page>;
}
