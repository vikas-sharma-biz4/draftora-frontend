/**
 * Tests for src/store/features/notifications/notificationsSlice.ts
 */

import {
  useNotificationsStore,
  INITIAL_NOTIFICATIONS_STATE,
} from "@/store/features/notifications/notificationsSlice";
import type { AppNotification } from "@/store/features/notifications/notificationsSlice";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addNotif(overrides: Partial<Omit<AppNotification, "id" | "read" | "createdAt">> = {}) {
  useNotificationsStore.getState().addNotification({
    type: "info",
    title: "Test",
    message: "Test message",
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  useNotificationsStore.setState(INITIAL_NOTIFICATIONS_STATE);
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("notificationsSlice — initial state", () => {
  it("starts with an empty notifications array", () => {
    expect(useNotificationsStore.getState().notifications).toHaveLength(0);
  });

  it("starts with unreadCount = 0", () => {
    expect(useNotificationsStore.getState().unreadCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// addNotification
// ---------------------------------------------------------------------------

describe("notificationsSlice — addNotification", () => {
  it("adds a notification to the list", () => {
    addNotif();
    expect(useNotificationsStore.getState().notifications).toHaveLength(1);
  });

  it("increments unreadCount", () => {
    addNotif();
    addNotif();
    expect(useNotificationsStore.getState().unreadCount).toBe(2);
  });

  it("assigns id, read=false, createdAt", () => {
    addNotif({ title: "New" });
    const notif = useNotificationsStore.getState().notifications[0];
    expect(notif.id).toMatch(/^notif_/);
    expect(notif.read).toBe(false);
    expect(typeof notif.createdAt).toBe("number");
  });

  it("prepends new notifications to the front", () => {
    addNotif({ title: "First" });
    addNotif({ title: "Second" });
    const { notifications } = useNotificationsStore.getState();
    expect(notifications[0].title).toBe("Second");
    expect(notifications[1].title).toBe("First");
  });

  it("supports all notification types", () => {
    const types = ["info", "success", "warning", "error"] as const;
    types.forEach((type) => addNotif({ type }));
    const { notifications } = useNotificationsStore.getState();
    expect(notifications).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// removeNotification
// ---------------------------------------------------------------------------

describe("notificationsSlice — removeNotification", () => {
  it("removes the notification with the given id", () => {
    addNotif();
    const id = useNotificationsStore.getState().notifications[0].id;
    useNotificationsStore.getState().removeNotification(id);
    expect(useNotificationsStore.getState().notifications).toHaveLength(0);
  });

  it("decrements unreadCount when removing an unread notification", () => {
    addNotif();
    const id = useNotificationsStore.getState().notifications[0].id;
    useNotificationsStore.getState().removeNotification(id);
    expect(useNotificationsStore.getState().unreadCount).toBe(0);
  });

  it("does not decrement unreadCount when removing an already-read notification", () => {
    addNotif();
    const id = useNotificationsStore.getState().notifications[0].id;
    useNotificationsStore.getState().markAsRead(id);
    useNotificationsStore.getState().removeNotification(id);
    expect(useNotificationsStore.getState().unreadCount).toBe(0);
  });

  it("is a no-op for non-existent id", () => {
    addNotif();
    useNotificationsStore.getState().removeNotification("non-existent");
    expect(useNotificationsStore.getState().notifications).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// markAsRead
// ---------------------------------------------------------------------------

describe("notificationsSlice — markAsRead", () => {
  it("marks the notification as read", () => {
    addNotif();
    const id = useNotificationsStore.getState().notifications[0].id;
    useNotificationsStore.getState().markAsRead(id);
    expect(useNotificationsStore.getState().notifications[0].read).toBe(true);
  });

  it("decrements unreadCount when marking unread as read", () => {
    addNotif();
    addNotif();
    const id = useNotificationsStore.getState().notifications[0].id;
    useNotificationsStore.getState().markAsRead(id);
    expect(useNotificationsStore.getState().unreadCount).toBe(1);
  });

  it("does not decrement unreadCount if already read", () => {
    addNotif();
    const id = useNotificationsStore.getState().notifications[0].id;
    useNotificationsStore.getState().markAsRead(id);
    useNotificationsStore.getState().markAsRead(id); // second time
    expect(useNotificationsStore.getState().unreadCount).toBe(0);
  });

  it("does not affect other notifications", () => {
    addNotif({ title: "A" });
    addNotif({ title: "B" });
    const idA = useNotificationsStore.getState().notifications[1].id; // "A" is at index 1 (prepended)
    useNotificationsStore.getState().markAsRead(idA);
    expect(useNotificationsStore.getState().notifications[0].read).toBe(false); // "B" still unread
  });
});

// ---------------------------------------------------------------------------
// markAllAsRead
// ---------------------------------------------------------------------------

describe("notificationsSlice — markAllAsRead", () => {
  it("marks all notifications as read", () => {
    addNotif();
    addNotif();
    addNotif();
    useNotificationsStore.getState().markAllAsRead();
    const { notifications } = useNotificationsStore.getState();
    expect(notifications.every((n) => n.read)).toBe(true);
  });

  it("sets unreadCount to 0", () => {
    addNotif();
    addNotif();
    useNotificationsStore.getState().markAllAsRead();
    expect(useNotificationsStore.getState().unreadCount).toBe(0);
  });

  it("is a no-op when already all read", () => {
    addNotif();
    useNotificationsStore.getState().markAllAsRead();
    useNotificationsStore.getState().markAllAsRead();
    expect(useNotificationsStore.getState().unreadCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// clearAll
// ---------------------------------------------------------------------------

describe("notificationsSlice — clearAll", () => {
  it("removes all notifications", () => {
    addNotif();
    addNotif();
    useNotificationsStore.getState().clearAll();
    expect(useNotificationsStore.getState().notifications).toHaveLength(0);
  });

  it("resets unreadCount to 0", () => {
    addNotif();
    useNotificationsStore.getState().clearAll();
    expect(useNotificationsStore.getState().unreadCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

describe("notificationsSlice — reset", () => {
  it("resets state to initial values", () => {
    addNotif();
    useNotificationsStore.getState().reset();
    expect(useNotificationsStore.getState().notifications).toHaveLength(0);
    expect(useNotificationsStore.getState().unreadCount).toBe(0);
  });
});
