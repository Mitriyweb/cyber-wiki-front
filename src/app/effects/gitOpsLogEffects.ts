/**
 * Git Operations Log Effects
 * Listens to wiki/gitOpsLog/* events, talks to the GitOpsLog API, and
 * emits result/error events back for the UI.
 */

import { apiRegistry, eventBus } from '@cyberfabric/react';
import { GitOpsLogApiService } from '@/app/api/GitOpsLogApiService';
import { t } from '@/app/lib/i18n';

export function registerGitOpsLogEffects(): void {
  eventBus.on('wiki/gitOpsLog/load', async ({ limit }) => {
    try {
      const service = apiRegistry.getService(GitOpsLogApiService);
      const result = await service.list({ limit });
      eventBus.emit('wiki/gitOpsLog/loaded', { entries: result.entries ?? [] });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('errors.failedToLoadGitOpsLog');
      eventBus.emit('wiki/gitOpsLog/error', { error: message });
    }
  });

  eventBus.on('wiki/gitOpsLog/clear', async () => {
    try {
      const service = apiRegistry.getService(GitOpsLogApiService);
      const { cleared } = await service.clear();
      eventBus.emit('wiki/gitOpsLog/cleared', { cleared });
      eventBus.emit('wiki/gitOpsLog/load', { limit: 100 });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('errors.failedToClearGitOpsLog');
      eventBus.emit('wiki/gitOpsLog/error', { error: message });
    }
  });
}
