import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAdmin } from '../middleware/auth';
import { ApiError, asyncHandler } from '../middleware/error';
import { brandingSchema, categorySchema, locationCreateSchema, locationUpdateSchema, menuItemSchema } from '../schemas';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

/** Stellt sicher, dass die Location zum eingeloggten Tenant gehört. */
async function ownedLocation(tenantId: string, locationId: string) {
  const location = await prisma.location.findFirst({ where: { id: locationId, tenantId } });
  if (!location) throw new ApiError(404, 'Standort nicht gefunden.');
  return location;
}

adminRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.admin!.tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
        subscriptionStatus: true,
        logoDataUrl: true,
        brandAccent: true,
        brandBg: true,
      },
    });
    if (!tenant) throw new ApiError(404, 'Konto nicht gefunden.');
    res.json(tenant);
  })
);

/** Branding (Logo + Farben) – gilt für alle Gast-Seiten des Gastronomen. */
adminRouter.patch(
  '/branding',
  asyncHandler(async (req, res) => {
    const body = brandingSchema.parse(req.body);
    const tenant = await prisma.tenant.update({
      where: { id: req.admin!.tenantId },
      data: {
        logoDataUrl: body.logoDataUrl,
        brandAccent: body.brandAccent,
        brandBg: body.brandBg,
      },
      select: { logoDataUrl: true, brandAccent: true, brandBg: true },
    });
    res.json(tenant);
  })
);

/** Bezahlte Bestellungen zählen als Umsatz – stornierte und unbezahlte nicht. */
const PAID_STATUSES: OrderStatus[] = ['NEW', 'IN_PROGRESS', 'READY', 'COMPLETED'];

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Umsatz-Auswertung über alle Standorte des Tenants (heute + Verlauf + Top-Artikel). */
adminRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 30);
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: {
        location: { tenantId: req.admin!.tenantId },
        status: { in: PAID_STATUSES },
        createdAt: { gte: since },
      },
      select: {
        createdAt: true,
        subtotalCents: true,
        tipCents: true,
        locationId: true,
        location: { select: { name: true } },
        items: { select: { name: true, quantity: true, priceCents: true } },
      },
    });

    const today = { orders: 0, revenueCents: 0, tipCents: 0 };
    const byDayMap = new Map<string, { orders: number; revenueCents: number }>();
    for (let i = 0; i < days; i += 1) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      byDayMap.set(dayKey(d), { orders: 0, revenueCents: 0 });
    }
    const topMap = new Map<string, { quantity: number; revenueCents: number }>();
    const locationMap = new Map<string, { name: string; orders: number; revenueCents: number }>();

    for (const order of orders) {
      const day = byDayMap.get(dayKey(order.createdAt));
      if (day) {
        day.orders += 1;
        day.revenueCents += order.subtotalCents;
      }
      if (order.createdAt >= startOfToday) {
        today.orders += 1;
        today.revenueCents += order.subtotalCents;
        today.tipCents += order.tipCents;
      }
      for (const item of order.items) {
        const entry = topMap.get(item.name) ?? { quantity: 0, revenueCents: 0 };
        entry.quantity += item.quantity;
        entry.revenueCents += item.priceCents * item.quantity;
        topMap.set(item.name, entry);
      }
      const loc = locationMap.get(order.locationId) ?? { name: order.location.name, orders: 0, revenueCents: 0 };
      loc.orders += 1;
      loc.revenueCents += order.subtotalCents;
      locationMap.set(order.locationId, loc);
    }

    res.json({
      days,
      today: {
        ...today,
        avgOrderCents: today.orders > 0 ? Math.round(today.revenueCents / today.orders) : 0,
      },
      byDay: [...byDayMap.entries()].map(([date, value]) => ({ date, ...value })),
      topItems: [...topMap.entries()]
        .map(([name, value]) => ({ name, ...value }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5),
      byLocation: [...locationMap.entries()]
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => b.revenueCents - a.revenueCents),
    });
  })
);

adminRouter.get(
  '/locations',
  asyncHandler(async (req, res) => {
    const locations = await prisma.location.findMany({
      where: { tenantId: req.admin!.tenantId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, slug: true, mode: true, active: true, acceptingOrders: true, createdAt: true },
    });
    res.json(locations);
  })
);

adminRouter.post(
  '/locations',
  asyncHandler(async (req, res) => {
    const body = locationCreateSchema.parse(req.body);
    const slugTaken = await prisma.location.findUnique({ where: { slug: body.slug } });
    if (slugTaken) throw new ApiError(409, 'Dieser Slug ist bereits vergeben.');
    const location = await prisma.location.create({
      data: {
        tenantId: req.admin!.tenantId,
        name: body.name,
        slug: body.slug,
        mode: body.mode,
        staffPinHash: await bcrypt.hash(body.staffPin, 10),
      },
      select: { id: true, name: true, slug: true, mode: true, active: true, acceptingOrders: true, createdAt: true },
    });
    res.status(201).json(location);
  })
);

adminRouter.patch(
  '/locations/:id',
  asyncHandler(async (req, res) => {
    const location = await ownedLocation(req.admin!.tenantId, req.params.id as string);
    const body = locationUpdateSchema.parse(req.body);
    const updated = await prisma.location.update({
      where: { id: location.id },
      data: {
        name: body.name,
        mode: body.mode,
        active: body.active,
        acceptingOrders: body.acceptingOrders,
        staffPinHash: body.staffPin ? await bcrypt.hash(body.staffPin, 10) : undefined,
      },
      select: { id: true, name: true, slug: true, mode: true, active: true, acceptingOrders: true, createdAt: true },
    });
    res.json(updated);
  })
);

adminRouter.get(
  '/locations/:id/menu',
  asyncHandler(async (req, res) => {
    const location = await ownedLocation(req.admin!.tenantId, req.params.id as string);
    const categories = await prisma.menuCategory.findMany({
      where: { locationId: location.id },
      orderBy: { sortOrder: 'asc' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    res.json(categories);
  })
);

adminRouter.post(
  '/locations/:id/categories',
  asyncHandler(async (req, res) => {
    const location = await ownedLocation(req.admin!.tenantId, req.params.id as string);
    const body = categorySchema.parse(req.body);
    const category = await prisma.menuCategory.create({
      data: { locationId: location.id, name: body.name, sortOrder: body.sortOrder },
    });
    res.status(201).json(category);
  })
);

adminRouter.patch(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const category = await prisma.menuCategory.findFirst({
      where: { id: req.params.id as string, location: { tenantId: req.admin!.tenantId } },
    });
    if (!category) throw new ApiError(404, 'Kategorie nicht gefunden.');
    const body = categorySchema.partial().parse(req.body);
    const updated = await prisma.menuCategory.update({ where: { id: category.id }, data: body });
    res.json(updated);
  })
);

adminRouter.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const category = await prisma.menuCategory.findFirst({
      where: { id: req.params.id as string, location: { tenantId: req.admin!.tenantId } },
    });
    if (!category) throw new ApiError(404, 'Kategorie nicht gefunden.');
    await prisma.menuCategory.delete({ where: { id: category.id } });
    res.status(204).end();
  })
);

adminRouter.post(
  '/categories/:id/items',
  asyncHandler(async (req, res) => {
    const category = await prisma.menuCategory.findFirst({
      where: { id: req.params.id as string, location: { tenantId: req.admin!.tenantId } },
    });
    if (!category) throw new ApiError(404, 'Kategorie nicht gefunden.');
    const body = menuItemSchema.parse(req.body);
    const item = await prisma.menuItem.create({
      data: {
        categoryId: category.id,
        name: body.name,
        description: body.description ?? null,
        priceCents: body.priceCents,
        available: body.available,
        sortOrder: body.sortOrder,
      },
    });
    res.status(201).json(item);
  })
);

adminRouter.patch(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const item = await prisma.menuItem.findFirst({
      where: { id: req.params.id as string, category: { location: { tenantId: req.admin!.tenantId } } },
    });
    if (!item) throw new ApiError(404, 'Artikel nicht gefunden.');
    const body = menuItemSchema.partial().parse(req.body);
    const updated = await prisma.menuItem.update({
      where: { id: item.id },
      data: {
        name: body.name,
        description: body.description === undefined ? undefined : body.description,
        priceCents: body.priceCents,
        available: body.available,
        sortOrder: body.sortOrder,
      },
    });
    res.json(updated);
  })
);

adminRouter.delete(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const item = await prisma.menuItem.findFirst({
      where: { id: req.params.id as string, category: { location: { tenantId: req.admin!.tenantId } } },
    });
    if (!item) throw new ApiError(404, 'Artikel nicht gefunden.');
    await prisma.menuItem.delete({ where: { id: item.id } });
    res.status(204).end();
  })
);
