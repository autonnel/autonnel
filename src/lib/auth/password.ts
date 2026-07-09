import bcrypt from 'bcryptjs';

const COST_FACTOR = 10;
const MAINTENANCE_PASSWORD_MIN = 4;

export async function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  return bcrypt.hash(plain, COST_FACTOR);
}

export async function hashMaintenancePassword(plain: string): Promise<string> {
  if (!plain || plain.length < MAINTENANCE_PASSWORD_MIN) {
    throw new Error(`Maintenance password must be at least ${MAINTENANCE_PASSWORD_MIN} characters`);
  }
  return bcrypt.hash(plain, COST_FACTOR);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}

export { MAINTENANCE_PASSWORD_MIN };
