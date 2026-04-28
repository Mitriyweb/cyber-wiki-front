/**
 * ViewLoadingFallback — minimal inline loading state for route/Suspense
 * fallbacks where a full-page spinner would feel heavy.
 *
 * Ported from doclab common/ViewLoadingFallback.tsx.
 */

import { Loader2 } from 'lucide-react';

interface ViewLoadingFallbackProps {
  message?: string;
}

export function ViewLoadingFallback({ message = 'Loading…' }: ViewLoadingFallbackProps) {
  return (
    <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 size={16} className="animate-spin" />
      {message}
    </div>
  );
}
