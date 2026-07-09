export {
  FEATURES,
  FEATURE_LABELS,
  FEATURE_DESCRIPTIONS,
  NAV_FEATURE_MAP,
  VIRTUAL_ADMIN_ROLE_ID,
  VIRTUAL_ADMIN_ROLE_NAME,
  getPermissionAdminIds,
  getPermissionAdminIdsAsync,
  type FeatureId,
} from './config';

export {
  getPermissionRepository,
  setPermissionRepository,
  PrismaPermissionRepository,
  virtualAdminRole,
  type IPermissionRepository,
  type RoleRecord,
  type RoleWithFeatures,
  type UserWithRoles,
} from './repository';

export {
  getUserRoles,
  getUserFeatures,
  userHasFeature,
  canAccessPermissionsPage,
  canAccessPermissionsPageAsync,
  getAccessibleNavIds,
  getNavMenuForUser,
  deriveAccessibleNavIds,
  invalidateUserRolesCache,
  invalidateAllPermissionCaches,
} from './service';
