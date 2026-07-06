/** Zentraler API-Client mit Fehlerbehandlung und Token-Verwaltung. */

const ADMIN_TOKEN_KEY = 'prego_admin_token';
const STAFF_TOKEN_KEY = 'prego_staff_token';
const STAFF_LOCATION_KEY = 'prego_staff_location';

export interface StaffLocationInfo {
  id: string;
  name: string;
  slug: string;
  mode: 'PICKUP' | 'SERVICE';
}

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string | null): void {
  if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function getStaffToken(): string | null {
  return localStorage.getItem(STAFF_TOKEN_KEY);
}

export function setStaffSession(token: string | null, location: StaffLocationInfo | null): void {
  if (token && location) {
    localStorage.setItem(STAFF_TOKEN_KEY, token);
    localStorage.setItem(STAFF_LOCATION_KEY, JSON.stringify(location));
  } else {
    localStorage.removeItem(STAFF_TOKEN_KEY);
    localStorage.removeItem(STAFF_LOCATION_KEY);
  }
}

export function getStaffLocation(): StaffLocationInfo | null {
  const raw = localStorage.getItem(STAFF_LOCATION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StaffLocationInfo;
  } catch {
    return null;
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: 'admin' | 'staff';
}

export class ApiRequestError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth === 'admin') {
    const token = getAdminToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (options.auth === 'staff') {
    const token = getStaffToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* leerer Body */
  }

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Fehler ${res.status}`;
    throw new ApiRequestError(res.status, message);
  }

  return data as T;
}

/** Formatiert Cent-Beträge als deutschen Euro-String. */
export function euro(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}
