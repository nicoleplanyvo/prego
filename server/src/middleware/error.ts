import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

/** Wirft kontrollierte API-Fehler mit HTTP-Status. */
export class ApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    const first = err.errors[0];
    res.status(400).json({ error: `Ungültige Eingabe: ${first ? `${first.path.join('.')} – ${first.message}` : 'unbekanntes Feld'}` });
    return;
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'Interner Fehler. Bitte erneut versuchen.' });
}

/** Wrapper für async Route-Handler, leitet Rejections an den Error-Handler weiter. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
