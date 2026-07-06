import { create } from 'zustand';

export interface CartLine {
  menuItemId: string;
  name: string;
  priceCents: number;
  quantity: number;
  note: string;
}

interface CartState {
  locationSlug: string | null;
  tableLabel: string | null;
  guestName: string;
  tipPercent: number;
  lines: CartLine[];
  setContext: (locationSlug: string, tableLabel: string | null) => void;
  add: (item: { menuItemId: string; name: string; priceCents: number }) => void;
  increment: (menuItemId: string) => void;
  decrement: (menuItemId: string) => void;
  setNote: (menuItemId: string, note: string) => void;
  setGuestName: (guestName: string) => void;
  setTipPercent: (tipPercent: number) => void;
  clear: () => void;
}

export const useCart = create<CartState>((set) => ({
  locationSlug: null,
  tableLabel: null,
  guestName: '',
  tipPercent: 0,
  lines: [],
  setContext: (locationSlug, tableLabel) =>
    set((state) => {
      // Neue Bar gescannt → alter Warenkorb ist irrelevant
      if (state.locationSlug !== locationSlug) {
        return { locationSlug, tableLabel, lines: [], guestName: '', tipPercent: 0 };
      }
      return { locationSlug, tableLabel: tableLabel ?? state.tableLabel };
    }),
  add: (item) =>
    set((state) => {
      const existing = state.lines.find((l) => l.menuItemId === item.menuItemId);
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l.menuItemId === item.menuItemId ? { ...l, quantity: Math.min(l.quantity + 1, 20) } : l
          ),
        };
      }
      return { lines: [...state.lines, { ...item, quantity: 1, note: '' }] };
    }),
  increment: (menuItemId) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.menuItemId === menuItemId ? { ...l, quantity: Math.min(l.quantity + 1, 20) } : l)),
    })),
  decrement: (menuItemId) =>
    set((state) => ({
      lines: state.lines
        .map((l) => (l.menuItemId === menuItemId ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0),
    })),
  setNote: (menuItemId, note) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.menuItemId === menuItemId ? { ...l, note } : l)),
    })),
  setGuestName: (guestName) => set({ guestName }),
  setTipPercent: (tipPercent) => set({ tipPercent }),
  clear: () => set({ lines: [], guestName: '', tipPercent: 0 }),
}));

export function cartTotalCents(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
}

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function cartTipCents(lines: CartLine[], tipPercent: number): number {
  return Math.round((cartTotalCents(lines) * tipPercent) / 100);
}
