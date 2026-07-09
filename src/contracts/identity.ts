export interface RoleDto {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  features: string[];
}

export interface MemberDto {
  id: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  roles: Array<{ id: string; name: string }>;
}

export interface InvitationDto {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface ApiKeyDto {
  id: string;
  name: string;
  key: string;
  writeAccess: boolean;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface FeatureCatalogEntry {
  id: string;
  label: string;
  group: string;
}

export interface IdentityContracts {
  'POST /api/auth/login': {
    input: { username: string; password: string };
    output: { ok: true };
  };
  'POST /api/auth/logout': { input: null; output: { ok: true } };
  'POST /api/auth/register': {
    input: { username: string; password: string; email?: string; invitationToken?: string };
    output: { ok: true };
  };
  'POST /api/auth/change-password': {
    input: { currentPassword: string; newPassword: string };
    output: { ok: true; sessionsRevoked: number };
  };
  'POST /api/auth/invite': {
    input: { email: string; role: string };
    output: { id: string };
  };
  'GET /api/auth/invitations': { input: null; output: { invitations: InvitationDto[] } };
  // id supplied via path param
  'DELETE /api/auth/invitations/:id': { input: null; output: { ok: true } };
  // token supplied via path param; accepting user's email in the body
  'POST /api/auth/invitations/:token': {
    input: { email: string };
    output: { ok: true };
  };

  'GET /api/permissions': {
    input: null;
    output: { features: FeatureCatalogEntry[]; users: MemberDto[] };
  };
  'GET /api/permissions/roles': { input: null; output: { roles: RoleDto[] } };
  'POST /api/permissions/roles': {
    input: { name: string; description?: string | null };
    output: { role: RoleDto };
  };
  'PUT /api/permissions/roles/:id': {
    input: { name?: string; description?: string | null };
    output: { role: RoleDto };
  };
  'DELETE /api/permissions/roles/:id': { input: null; output: { success: true } };
  'PUT /api/permissions/roles/:id/features': {
    input: { featureIds: string[] };
    output: { success: true; roleId: string; features: string[] };
  };
  'PUT /api/permissions/users/:userId/roles': {
    input: { roleIds: string[] };
    output: { success: true; userId: string; roleIds: string[] };
  };

  'GET /api/api-keys': { input: null; output: { apiKeys: ApiKeyDto[] } };
  'POST /api/api-keys': {
    input: { name?: string; grants?: string[]; writeAccess?: boolean; expiresAt?: string | null };
    output: { key: string };
  };
  'PATCH /api/api-keys': {
    input: { id: string; writeAccess: boolean };
    output: { ok: true };
  };
  // id supplied via ?id= query param
  'DELETE /api/api-keys': { input: null; output: { ok: true } };
}
