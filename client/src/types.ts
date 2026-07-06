export type OrderMode = 'PICKUP' | 'SERVICE';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'NEW'
  | 'IN_PROGRESS'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export interface PublicMenuItem {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
}

export interface PublicCategory {
  id: string;
  name: string;
  items: PublicMenuItem[];
}

export interface PublicLocation {
  id: string;
  name: string;
  slug: string;
  mode: OrderMode;
  currency: string;
  barName: string;
  paymentsReady: boolean;
  pushAvailable: boolean;
  vapidPublicKey: string | null;
  categories: PublicCategory[];
}

export interface OrderItemView {
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
  note: string | null;
}

export interface PublicOrder {
  id: string;
  publicToken: string;
  number: number;
  mode: OrderMode;
  status: OrderStatus;
  tableLabel: string | null;
  guestName: string | null;
  subtotalCents: number;
  currency: string;
  createdAt: string;
  items: OrderItemView[];
  location?: { name: string };
}

export interface BoardOrderItem {
  id: string;
  name: string;
  quantity: number;
  note: string | null;
}

export interface BoardOrder {
  id: string;
  number: number;
  mode: OrderMode;
  status: OrderStatus;
  tableLabel: string | null;
  guestName: string | null;
  subtotalCents: number;
  createdAt: string;
  items: BoardOrderItem[];
}

export interface AdminLocation {
  id: string;
  name: string;
  slug: string;
  mode: OrderMode;
  active: boolean;
  createdAt: string;
}

export interface AdminMenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  available: boolean;
  sortOrder: number;
}

export interface AdminCategory {
  id: string;
  name: string;
  sortOrder: number;
  items: AdminMenuItem[];
}

export interface TenantMe {
  id: string;
  name: string;
  email: string;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  subscriptionStatus: string;
}
