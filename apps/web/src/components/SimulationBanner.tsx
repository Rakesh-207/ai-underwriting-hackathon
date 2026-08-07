import { Badge } from './ui/badge.tsx';

// Global simulation-only banner. Required on every /app screen.
// Companion spec 3.1: "simulation-only banner" remains visible in all states.
// Copy source: vertical-slice-design.md section 4.1.
export function SimulationBanner() {
  return (
    <div
      role="status"
      className="w-full border-b border-warning/20 bg-warning/5 px-4 py-2.5"
    >
      <div className="mx-auto flex max-w-[1200px] items-center gap-3">
        <Badge tone="warning" className="shrink-0">
          Simulation only
        </Badge>
        <p className="text-sm text-ink/80">
          This workbench demonstrates how consented signals can complement a
          traditional application baseline. It does not produce a real lending
          outcome.
        </p>
      </div>
    </div>
  );
}
