import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config';

const adminPayloadSchema = z.object({
  role: z.literal('admin'),
  tenantId: z.string(),
});

const staffPayloadSchema = z.object({
  role: z.literal('staff'),
  tenantId: z.string(),
  locationId: z.string(),
});

export type AdminPayload = z.infer<typeof adminPayloadSchema>;
export type StaffPayload = z.infer<typeof staffPayloadSchema>;

export function signAdminToken(tenantId: string): string {
  const payload: AdminPayload = { role: 'admin', tenantId };
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: '7d' });
}

export function signStaffToken(tenantId: string, locationId: string): string {
  const payload: StaffPayload = { role: 'staff', tenantId, locationId };
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: '16h' });
}

export function verifyAdminToken(token: string): AdminPayload | null {
  try {
    return adminPayloadSchema.parse(jwt.verify(token, config.JWT_SECRET));
  } catch {
    return null;
  }
}

export function verifyStaffToken(token: string): StaffPayload | null {
  try {
    return staffPayloadSchema.parse(jwt.verify(token, config.JWT_SECRET));
  } catch {
    return null;
  }
}
