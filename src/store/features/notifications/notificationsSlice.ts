/**
 * Zustand store for in-app notification state management
 *
 * Manages:
 * - Notification list with read/unread tracking
 * - Unread count
 * - Add / remove / clear / mark-as-read operations
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
}

export const INITIAL_NOTIFICATIONS_STATE = {
  notifications: [] as AppNotification[],
  unreadCount: 0,
};

interface NotificationsState {
  // State
  notifications: AppNotification[];
  unreadCount: number;

  // Actions
  addNotification: (payload: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  reset: () => void;
}

function generateId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  // Initial state
  notifications: [],
  unreadCount: 0,

  addNotification: (payload) => {
    const notification: AppNotification = {
      ...payload,
      id: generateId(),
      read: false,
      createdAt: Date.now(),
    };
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },

  removeNotification: (id: string) => {
    const target = get().notifications.find((n) => n.id === id);
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      unreadCount: target && !target.read
        ? Math.max(0, state.unreadCount - 1)
        : state.unreadCount,
    }));
  },

  markAsRead: (id: string) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(
        0,
        state.unreadCount - (state.notifications.find((n) => n.id === id && !n.read) ? 1 : 0)
      ),
    }));
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
  reset: () => set(INITIAL_NOTIFICATIONS_STATE),
}));

// ─── Granular Selector Hooks ─────────────────────────────────────────────────────

/**
 * Selector hooks for fine-grained Zustand subscriptions.
 *
 * Components should use these hooks to subscribe only to the specific state
 * they need, avoiding unnecessary re-renders when unrelated state changes.
 */

/**
 * Selects all notifications
 */
export const useNotifications = () => useNotificationsStore((state) => state.notifications);

/**
 * Selects unread count
 */
export const useUnreadCount = () => useNotificationsStore((state) => state.unreadCount);

/**
 * Selects unread notifications only
 */
export const useUnreadNotifications = () =>
  useNotificationsStore((state) => state.notifications.filter(n => !n.read));

/**
 * Selects notifications by type
 */
export const useNotificationsByType = (type: NotificationType) =>
  useNotificationsStore((state) => state.notifications.filter(n => n.type === type));

/**
 * Selects all notification actions (stable reference)
 */
export const useNotificationActions = () =>
  useNotificationsStore(
    useShallow((state) => ({
      addNotification: state.addNotification,
      removeNotification: state.removeNotification,
      markAsRead: state.markAsRead,
      markAllAsRead: state.markAllAsRead,
      clearAll: state.clearAll,
      reset: state.reset,
    }))
  );
