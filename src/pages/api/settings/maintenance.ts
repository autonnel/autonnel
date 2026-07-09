// The enable toggle is plan-gated; message/password stay editable when locked on.
import type { APIRoute } from 'astro';
import { withAuth, jsonResponse } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/rbac';
import { defineRoute, ApiError } from '@/lib/api/define-route';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { hashMaintenancePassword, MAINTENANCE_PASSWORD_MIN } from '@/lib/auth/password';
import { getPolicyHooks } from '@/lib/plugins/registry';
import { createLogger } from '@/lib/logger';
import { getMaintenanceConfig, setMaintenanceConfig } from '@/lib/config/keys';
import type { MaintenancePatchResult } from '@/contracts/settings';

const logger = createLogger('MaintenanceSettings');

export const GET: APIRoute = withAuth(FEATURES.SETTINGS_MAINTENANCE, async () => {
  const cfg = await getMaintenanceConfig();
  const canEdit = await getPolicyHooks().canEditMaintenance({ id: getCurrentTenantId() });
  return jsonResponse({
    enabled: cfg?.enabled ?? false,
    message: cfg?.message ?? '',
    hasPassword: !!cfg?.passwordHash,
    canEdit,
  });
});

export const PATCH = defineRoute('PATCH /api/settings/maintenance', { feature: 'SETTINGS_MAINTENANCE' }, async ({ input }): Promise<MaintenancePatchResult> => {
  const canEdit = await getPolicyHooks().canEditMaintenance({ id: getCurrentTenantId() });

  const body = input;
  if (!body || typeof body !== 'object') throw new ApiError(400, 'Invalid request body');

  const current = (await getMaintenanceConfig()) ?? { enabled: false };
  const next: { enabled: boolean; passwordHash?: string; message?: string } = { ...current };
  let touched = false;

  if (body.enabled !== undefined) {
    if (typeof body.enabled !== 'boolean') throw new ApiError(400, 'enabled must be a boolean');
    if (!canEdit) throw new ApiError(403, 'Maintenance toggle is read-only on this plan');
    next.enabled = body.enabled;
    touched = true;
  }

  if (body.message !== undefined) {
    if (body.message === null || body.message === '') {
      next.message = undefined;
      touched = true;
    } else if (typeof body.message === 'string') {
      const trimmed = body.message.trim();
      next.message = trimmed.length > 0 ? trimmed.slice(0, 1000) : undefined;
      touched = true;
    } else {
      throw new ApiError(400, 'message must be a string');
    }
  }

  if (body.clearPassword === true) {
    next.passwordHash = undefined;
    touched = true;
  } else if (body.password !== undefined && body.password !== '' && body.password !== null) {
    if (typeof body.password !== 'string') throw new ApiError(400, 'password must be a string');
    if (body.password.length < MAINTENANCE_PASSWORD_MIN) {
      throw new ApiError(400, `Password must be at least ${MAINTENANCE_PASSWORD_MIN} characters`);
    }
    next.passwordHash = await hashMaintenancePassword(body.password);
    touched = true;
  }

  if (!touched) throw new ApiError(400, 'No fields to update');

  await setMaintenanceConfig(next);
  logger.info('Maintenance settings updated', { enabled: next.enabled, hasPassword: !!next.passwordHash });

  return {
    enabled: next.enabled,
    message: next.message ?? '',
    hasPassword: !!next.passwordHash,
    canEdit,
  };
});
