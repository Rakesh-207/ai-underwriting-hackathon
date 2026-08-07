import { Badge } from './ui/badge.tsx';
import type { ApplicationRecord } from '../lib/applicationAdapter.ts';

export function ApplicationStatus({ status }: { status: ApplicationRecord['status'] }) { const tone = status === 'Reviewed' ? 'success' : status === 'Needs attention' ? 'warning' : status === 'Processing' ? 'info' : 'neutral'; return <Badge tone={tone}>{status}</Badge>; }
export function RiskBand({ band }: { band: string }) { const tone = band === 'strong' ? 'success' : band === 'stable' ? 'info' : band === 'guarded' ? 'warning' : 'danger'; return <Badge tone={tone}>{band}</Badge>; }
