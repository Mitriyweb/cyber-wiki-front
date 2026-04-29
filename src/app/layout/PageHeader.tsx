/**
 * PageHeader — a tiny context that lets any page write its title/subtitle
 * into the global app Header instead of rendering a redundant in-content h1.
 *
 * Usage in a page component:
 *   <PageTitle title="Comments" subtitle="All comments…" />
 *
 * The Header component reads from `usePageHeader()` and renders the title.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface PageHeaderState {
  title: string | null;
  subtitle: string | null;
}

interface PageHeaderContextValue extends PageHeaderState {
  setPageHeader: (next: PageHeaderState) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PageHeaderState>({ title: null, subtitle: null });
  return (
    <PageHeaderContext.Provider value={{ ...state, setPageHeader: setState }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeader(): PageHeaderContextValue {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) {
    throw new Error('usePageHeader must be used inside <PageHeaderProvider>');
  }
  return ctx;
}

interface PageTitleProps {
  title: string;
  subtitle?: string;
}

/**
 * Mounts a page's title/subtitle into the global Header. Renders nothing
 * itself — drop one near the top of any page component.
 */
export function PageTitle({ title, subtitle }: PageTitleProps) {
  const { setPageHeader } = usePageHeader();
  useEffect(() => {
    setPageHeader({ title, subtitle: subtitle ?? null });
    return () => setPageHeader({ title: null, subtitle: null });
  }, [title, subtitle, setPageHeader]);
  return null;
}
