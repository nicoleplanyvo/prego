import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const staffLoginSchema = z.object({
  locationSlug: z.string().min(1),
  pin: z.string().regex(/^\d{4,8}$/, 'PIN muss 4–8 Ziffern haben'),
});

export const locationCreateSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Nur Kleinbuchstaben, Zahlen und Bindestriche'),
  mode: z.enum(['PICKUP', 'SERVICE']),
  staffPin: z.string().regex(/^\d{4,8}$/),
});

export const locationUpdateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  mode: z.enum(['PICKUP', 'SERVICE']).optional(),
  staffPin: z.string().regex(/^\d{4,8}$/).optional(),
  active: z.boolean().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(1).max(60),
  sortOrder: z.number().int().min(0).default(0),
});

export const menuItemSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(200).optional().nullable(),
  priceCents: z.number().int().min(0).max(100_000),
  available: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export const orderCreateSchema = z.object({
  locationSlug: z.string().min(1),
  tableLabel: z.string().max(20).optional(),
  guestName: z.string().max(40).optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().min(1).max(20),
        note: z.string().max(120).optional(),
      })
    )
    .min(1)
    .max(30),
});

export const staffStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED']),
});
