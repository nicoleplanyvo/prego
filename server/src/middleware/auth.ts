import type { NextFunction, Request, Response } from 'express';
import { verifyAdminToken, verifyStaffToken, type AdminPayload, type StaffPayload } from '../lib/jwt';

declare module 'express-serve-static-core' {
  interface Request {
    admin?: AdminPayload;
    staff?: StaffPayload;
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const queryToken = req.query.token;
  if (typeof queryToken === 'string' && queryToken.length > 0) return queryToken;
  return null;
}

/** Schützt Admin-Routen (Tenant-Betreiber). */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  const payload = token ? verifyAdminToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: 'Nicht angemeldet.' });
    return;
  }
  req.admin = payload;
  next();
}

/** Schützt Barkeeper-Routen (PIN-Login pro Standort). Token auch als ?token= für SSE erlaubt. */
export function requireStaff(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  const payload = token ? verifyStaffToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: 'Schicht abgelaufen – bitte PIN erneut eingeben.' });
    return;
  }
  req.staff = payload;
  next();
}
