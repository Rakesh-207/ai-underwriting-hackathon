import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx';
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import type { RiskBand } from '@underwriting/shared';

export function Page({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{description}</p></div>{children}</div>;
}
export function Panel({ title, description, children, className = '' }: { title: string; description?: string; children: ReactNode; className?: string }) { return <Card className={className}><CardHeader><CardTitle>{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</CardHeader><CardContent>{children}</CardContent></Card>; }
export function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) { return <Panel title={label}><p className="text-2xl font-semibold text-ink">{value}</p>{detail && <p className="mt-1 text-sm text-muted">{detail}</p>}</Panel>; }
export function Status({ band, children }: { band: RiskBand | 'granted' | 'revoked' | 'review' | 'clear' | 'high_review'; children: ReactNode }) { const tone = band === 'strong' || band === 'granted' || band === 'clear' ? 'success' : band === 'stable' ? 'info' : band === 'watch' || band === 'high_review' ? 'danger' : 'warning'; return <Badge tone={tone}>{children}</Badge>; }
export function Gate({ purpose }: { purpose: string }) { return <Panel title="Consent gate" description={`Grant ${purpose} consent to unlock this synthetic data surface.`}><p className="text-sm text-muted">This screen remains read-only until a purpose-bound receipt is present. No score is computed in the browser.</p><Button className="mt-4" variant="secondary">Review consent</Button></Panel>; }
export function Provenance({ refs }: { refs: Array<{ fixtureId: string; category: string; source: string }> }) { return <Panel title="Provenance"><ul className="space-y-2 text-sm text-muted">{refs.map((ref) => <li key={ref.fixtureId} className="flex flex-wrap justify-between gap-2 border-b border-border pb-2 last:border-0"><span>{ref.category}</span><span className="font-mono text-xs">{ref.source} · {ref.fixtureId}</span></li>)}</ul></Panel>; }
export function Notice({ children }: { children: ReactNode }) { return <div className="rounded-md border border-info/20 bg-info/10 px-4 py-3 text-sm text-ink">{children}</div>; }
