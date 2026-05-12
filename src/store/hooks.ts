/**
 * Central hook re-exports for all Zustand stores
 *
 * Note: This project uses Zustand instead of Redux Toolkit.
 * There is no dispatch/selector boilerplate — each store hook
 * is used directly. This file provides a single import point
 * for all store hooks.
 *
 * Usage:
 *   import { useClientStore, useUIStore } from '@/store/hooks';
 */

export { useClientStore } from './features/clients/clientSlice';
export { useDraftStore } from './features/drafts/draftSlice';
export { useDraftSessionStore } from './features/drafts/draftSessionSlice';
export { useProposalStore } from './features/proposals/proposalSlice';
export { useUIStore } from './features/ui/uiSlice';
export { useNotificationsStore } from './features/notifications/notificationsSlice';

export type { Theme } from './features/ui/uiSlice';
export type { AppNotification, NotificationType } from './features/notifications/notificationsSlice';
