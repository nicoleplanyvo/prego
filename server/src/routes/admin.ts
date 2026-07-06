import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { requireAdmin } from '../middleware/auth';
import { ApiError, asyncHandler } from '../middleware/error';
import { categorySchema, locationCreateSchema, locationUpdateSchema, menuItemSchema } from '../schemas';

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
      },
    });
    if (!tenant) throw new ApiError(404, 'Konto nicht gefunden.');
    res.json(tenant);
  })
);

adminRouter.get(
  '/locations',
  asyncHandler(async (req, res) => {
    const locations = await prisma.location.findMany({
      where: { tenantId: req.admin!.tenantId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, slug: true, mode: true, active: true, createdAt: true },
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
      select: { id: true, name: true, slug: true, mode: true, active: true, createdAt: true },
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
        staffPinHash: body.staffPin ? await bcrypt.hash(body.staffPin, 10) : undefined,
      },
      select: { id: true, name: true, slug: true, mode: true, active: true, createdAt: true },
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
