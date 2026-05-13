/**
 * Role-based access control constants
 */

export const ROLES = {
  ADMIN:  "admin",
  USER:   "user",
  VIEWER: "viewer",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS = {
  PROPOSALS_VIEW:    "proposals:view",
  PROPOSALS_CREATE:  "proposals:create",
  PROPOSALS_EDIT:    "proposals:edit",
  PROPOSALS_DELETE:  "proposals:delete",
  PROPOSALS_APPROVE: "proposals:approve",

  CLIENTS_VIEW:   "clients:view",
  CLIENTS_CREATE: "clients:create",
  CLIENTS_EDIT:   "clients:edit",
  CLIENTS_DELETE: "clients:delete",

  DRAFTS_VIEW:   "drafts:view",
  DRAFTS_SAVE:   "drafts:save",
  DRAFTS_DELETE: "drafts:delete",

  SETTINGS_VIEW: "settings:view",
  SETTINGS_EDIT: "settings:edit",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.USER]: [
    PERMISSIONS.PROPOSALS_VIEW,
    PERMISSIONS.PROPOSALS_CREATE,
    PERMISSIONS.PROPOSALS_EDIT,
    PERMISSIONS.CLIENTS_VIEW,
    PERMISSIONS.CLIENTS_CREATE,
    PERMISSIONS.CLIENTS_EDIT,
    PERMISSIONS.DRAFTS_VIEW,
    PERMISSIONS.DRAFTS_SAVE,
    PERMISSIONS.DRAFTS_DELETE,
    PERMISSIONS.SETTINGS_VIEW,
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.PROPOSALS_VIEW,
    PERMISSIONS.CLIENTS_VIEW,
    PERMISSIONS.DRAFTS_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
  ],
};
