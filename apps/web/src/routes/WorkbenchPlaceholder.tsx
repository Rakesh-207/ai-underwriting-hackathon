import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card.tsx';
import { Badge } from '../components/ui/badge.tsx';

// Workbench placeholder — each protected route shows its name and a
// "coming in P1B" message. Visually polished, not a bare stub.
export function WorkbenchPlaceholder({ routeName }: { routeName: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          {routeName}
        </h2>
        <p className="mt-1 text-md text-muted">
          This section of the simulation workbench is part of the vertical slice.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{routeName} panel</CardTitle>
            <Badge tone="primary">Coming in P1B</Badge>
          </div>
          <CardDescription>
            The interactive {routeName.toLowerCase()} experience lands in the
            next implementation phase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[160px] items-center justify-center rounded-md border border-dashed border-border bg-bg/50 px-6 py-10 text-center">
            <div>
              <p className="text-sm font-medium text-ink">
                {routeName} is a foundation route
              </p>
              <p className="mt-1 text-sm text-muted">
                Authentication, routing, and the application shell are wired.
                Domain logic arrives in P1B.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
