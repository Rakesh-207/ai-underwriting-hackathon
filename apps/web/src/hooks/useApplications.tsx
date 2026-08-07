import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { createApplicationAdapter, type ApplicationDraft, type ApplicationRecord, type DataSourceKey } from '../lib/applicationAdapter.ts';

type ApplicationsContextValue = { applications: ApplicationRecord[]; saveDraft: (draft: ApplicationDraft, id?: string) => ApplicationRecord; runReview: (draft: ApplicationDraft, id?: string) => ApplicationRecord; loadExample: () => ApplicationRecord; find: (id: string) => ApplicationRecord | null; updateSource: (id: string, source: DataSourceKey, consent: boolean) => ApplicationRecord };
const ApplicationsContext = createContext<ApplicationsContextValue | null>(null);

export function ApplicationsProvider({ children }: { children: ReactNode }) {
  const adapter = useMemo(() => createApplicationAdapter(), []); const [applications, setApplications] = useState(() => adapter.list()); const refresh = () => setApplications(adapter.list());
  const value: ApplicationsContextValue = { applications, saveDraft: (draft, id) => { const record = adapter.saveDraft(draft, id); refresh(); return record; }, runReview: (draft, id) => { const record = adapter.review(draft, id); refresh(); return record; }, loadExample: () => { const record = adapter.createSyntheticExample(); refresh(); return record; }, find: (id) => applications.find((item) => item.id === id) ?? null, updateSource: (id, source, consent) => { const record = adapter.updateSource(id, source, consent); refresh(); return record; } };
  return <ApplicationsContext.Provider value={value}>{children}</ApplicationsContext.Provider>;
}

export function useApplications() { const value = useContext(ApplicationsContext); if (!value) throw new Error('useApplications must be used within ApplicationsProvider.'); return value; }
