/**
 * Layout Actions
 *
 * Fire-and-forget actions for layout-slice state changes (menu collapse,
 * popup/overlay management). Keeps components free of `eventBus.emit`.
 */

import { eventBus } from '@cyberfabric/react';

export function setMenuCollapsed(collapsed: boolean): void {
  eventBus.emit('layout/menu/collapsed', { collapsed });
}
