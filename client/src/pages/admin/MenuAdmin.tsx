import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, euro } from '../../api';
import type { AdminCategory, AdminLocation, AdminMenuItem } from '../../types';

export default function MenuAdmin(): JSX.Element {
  const [locationId, setLocationId] = useState<string>('');

  const { data: locations = [] } = useQuery({
    queryKey: ['admin-locations'],
    queryFn: () => api<AdminLocation[]>('/api/admin/locations', { auth: 'admin' }),
  });

  const selected = locationId || locations[0]?.id || '';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">Speisekarte</h2>
        {locations.length > 0 && (
          <select
            value={selected}
            onChange={(e) => setLocationId(e.target.value)}
            aria-label="Standort wählen"
            className="rounded-xl border-2 border-ivory/15 bg-carta px-3 py-2 font-semibold focus:border-champagne focus:outline-none"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {locations.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-ivory/15 p-8 text-center text-ivory/50">
          Lege zuerst einen Standort an – danach kannst du hier die Speisekarte pflegen.
        </p>
      ) : (
        selected && <MenuEditor key={selected} locationId={selected} />
      )}
    </div>
  );
}

/** Euro-Eingabe („8,50") → Cent; NaN bei ungültiger Eingabe. */
function parsePriceCents(input: string): number {
  return Math.round(parseFloat(input.trim().replace(',', '.')) * 100);
}

function isPriceValid(input: string): boolean {
  return /^\d+([.,]\d{1,2})?$/.test(input.trim());
}

/** Cent → Eingabe-String („8,50") fürs Bearbeiten-Formular. */
function formatPriceInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

function MenuEditor(props: { locationId: string }): JSX.Element {
  const queryClient = useQueryClient();
  const [newCategory, setNewCategory] = useState('');

  const queryKey = ['admin-menu', props.locationId];
  const { data: categories = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => api<AdminCategory[]>(`/api/admin/locations/${props.locationId}/menu`, { auth: 'admin' }),
  });

  const invalidate = (): void => void queryClient.invalidateQueries({ queryKey });

  const addCategory = useMutation({
    mutationFn: () =>
      api<AdminCategory>(`/api/admin/locations/${props.locationId}/categories`, {
        method: 'POST',
        auth: 'admin',
        body: { name: newCategory, sortOrder: categories.length },
      }),
    onSuccess: () => {
      setNewCategory('');
      invalidate();
    },
  });

  const deleteCategory = useMutation({
    mutationFn: (categoryId: string) => api<void>(`/api/admin/categories/${categoryId}`, { method: 'DELETE', auth: 'admin' }),
    onSettled: invalidate,
  });

  // Nachbarn tauschen – die Array-Indizes normalisieren die sortOrder nebenbei.
  const moveCategory = useMutation({
    mutationFn: async (input: { index: number; direction: -1 | 1 }) => {
      const current = categories[input.index];
      const neighbor = categories[input.index + input.direction];
      if (!current || !neighbor) return;
      await Promise.all([
        api(`/api/admin/categories/${current.id}`, {
          method: 'PATCH',
          auth: 'admin',
          body: { sortOrder: input.index + input.direction },
        }),
        api(`/api/admin/categories/${neighbor.id}`, {
          method: 'PATCH',
          auth: 'admin',
          body: { sortOrder: input.index },
        }),
      ]);
    },
    onSettled: invalidate,
  });

  if (isLoading) return <p className="mt-6 text-ivory/60">Speisekarte wird geladen …</p>;

  return (
    <div className="mt-4 space-y-5">
      {categories.map((category, index) => (
        <CategoryBlock
          key={category.id}
          category={category}
          canMoveUp={index > 0}
          canMoveDown={index < categories.length - 1}
          onMove={(direction) => moveCategory.mutate({ index, direction })}
          onChanged={invalidate}
          onDelete={() => {
            if (window.confirm(`Kategorie „${category.name}" inkl. aller Artikel löschen?`)) {
              deleteCategory.mutate(category.id);
            }
          }}
        />
      ))}

      <div className="flex gap-2">
        <input
          type="text"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="Neue Kategorie (z. B. Aperitivo)"
          className="flex-1 rounded-xl border-2 border-ivory/15 px-4 py-3 focus:border-champagne focus:outline-none"
        />
        <button
          type="button"
          onClick={() => addCategory.mutate()}
          disabled={addCategory.isPending || newCategory.trim().length === 0}
          className="rounded-xl bg-champagne px-5 py-3 font-bold text-noir transition hover:bg-champagne-dark disabled:opacity-50"
        >
          Kategorie anlegen
        </button>
      </div>
    </div>
  );
}

function CategoryBlock(props: {
  category: AdminCategory;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
  onChanged: () => void;
  onDelete: () => void;
}): JSX.Element {
  const { category } = props;
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(category.name);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const addItem = useMutation({
    mutationFn: () =>
      api<AdminMenuItem>(`/api/admin/categories/${category.id}/items`, {
        method: 'POST',
        auth: 'admin',
        body: {
          name: itemName,
          description: itemDescription.trim() || null,
          priceCents: parsePriceCents(itemPrice),
          available: true,
          sortOrder: category.items.length,
        },
      }),
    onSuccess: () => {
      setItemName('');
      setItemDescription('');
      setItemPrice('');
      setShowItemForm(false);
      props.onChanged();
    },
  });

  const renameCategory = useMutation({
    mutationFn: () =>
      api<AdminCategory>(`/api/admin/categories/${category.id}`, {
        method: 'PATCH',
        auth: 'admin',
        body: { name: nameDraft.trim() },
      }),
    onSuccess: () => {
      setRenaming(false);
      props.onChanged();
    },
  });

  const toggleItem = useMutation({
    mutationFn: (item: AdminMenuItem) =>
      api<AdminMenuItem>(`/api/admin/items/${item.id}`, {
        method: 'PATCH',
        auth: 'admin',
        body: { available: !item.available },
      }),
    onSettled: props.onChanged,
  });

  const deleteItem = useMutation({
    mutationFn: (itemId: string) => api<void>(`/api/admin/items/${itemId}`, { method: 'DELETE', auth: 'admin' }),
    onSettled: props.onChanged,
  });

  const moveItem = useMutation({
    mutationFn: async (input: { index: number; direction: -1 | 1 }) => {
      const current = category.items[input.index];
      const neighbor = category.items[input.index + input.direction];
      if (!current || !neighbor) return;
      await Promise.all([
        api(`/api/admin/items/${current.id}`, {
          method: 'PATCH',
          auth: 'admin',
          body: { sortOrder: input.index + input.direction },
        }),
        api(`/api/admin/items/${neighbor.id}`, {
          method: 'PATCH',
          auth: 'admin',
          body: { sortOrder: input.index },
        }),
      ]);
    },
    onSettled: props.onChanged,
  });

  const priceValid = isPriceValid(itemPrice);

  return (
    <section className="rounded-2xl border border-ivory/10 bg-carta p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {renaming ? (
          <div className="flex flex-1 gap-2">
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={60}
              aria-label="Kategorie umbenennen"
              className="flex-1 rounded-lg border-2 border-ivory/15 px-3 py-1.5 text-sm font-bold focus:border-champagne focus:outline-none"
            />
            <button
              type="button"
              onClick={() => renameCategory.mutate()}
              disabled={renameCategory.isPending || nameDraft.trim().length === 0}
              className="rounded-lg bg-champagne px-3 py-1.5 text-sm font-bold text-noir transition hover:bg-champagne-dark disabled:opacity-50"
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={() => {
                setRenaming(false);
                setNameDraft(category.name);
              }}
              className="rounded-lg border-2 border-ivory/15 px-3 py-1.5 text-sm font-bold transition hover:border-ivory/30"
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold">{category.name}</h3>
            <button
              type="button"
              onClick={() => setRenaming(true)}
              aria-label={`Kategorie ${category.name} umbenennen`}
              className="rounded-lg px-1.5 py-1 text-sm text-ivory/40 transition hover:text-champagne"
            >
              ✎
            </button>
            <MoveButtons
              label={`Kategorie ${category.name}`}
              canUp={props.canMoveUp}
              canDown={props.canMoveDown}
              onMove={props.onMove}
            />
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowItemForm((v) => !v)}
            className="rounded-lg border-2 border-ivory/15 px-3 py-1.5 text-sm font-bold transition hover:border-ivory/30"
          >
            {showItemForm ? 'Abbrechen' : '+ Artikel'}
          </button>
          <button
            type="button"
            onClick={props.onDelete}
            aria-label={`Kategorie ${category.name} löschen`}
            className="rounded-lg border-2 border-ivory/15 px-3 py-1.5 text-sm font-bold text-red-300 transition hover:border-red-400/60"
          >
            Löschen
          </button>
        </div>
      </div>

      {showItemForm && (
        <div className="mt-3 grid gap-3 rounded-xl bg-ivory/5 p-4 sm:grid-cols-3">
          <input
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="Name (z. B. Aperol Spritz)"
            className="rounded-lg border-2 border-ivory/15 px-3 py-2 text-sm focus:border-champagne focus:outline-none"
          />
          <input
            type="text"
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            placeholder="Beschreibung (optional)"
            className="rounded-lg border-2 border-ivory/15 px-3 py-2 text-sm focus:border-champagne focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
              placeholder="Preis € (z. B. 8,50)"
              className="w-full rounded-lg border-2 border-ivory/15 px-3 py-2 text-sm focus:border-champagne focus:outline-none"
            />
            <button
              type="button"
              onClick={() => addItem.mutate()}
              disabled={addItem.isPending || itemName.trim().length === 0 || !priceValid}
              className="shrink-0 rounded-lg bg-champagne px-4 py-2 text-sm font-bold text-noir transition hover:bg-champagne-dark disabled:opacity-50"
            >
              OK
            </button>
          </div>
        </div>
      )}

      <ul className="mt-3 divide-y divide-ivory/10">
        {category.items.length === 0 && <li className="py-3 text-sm text-ivory/45">Noch keine Artikel.</li>}
        {category.items.map((item, index) =>
          editingItemId === item.id ? (
            <ItemEditRow
              key={item.id}
              item={item}
              onDone={() => {
                setEditingItemId(null);
                props.onChanged();
              }}
              onCancel={() => setEditingItemId(null)}
            />
          ) : (
            <li key={item.id} className="flex items-center gap-2 py-3 sm:gap-3">
              <MoveButtons
                label={item.name}
                canUp={index > 0}
                canDown={index < category.items.length - 1}
                onMove={(direction) => moveItem.mutate({ index, direction })}
              />
              <div className="min-w-0 flex-1">
                <p className={`font-semibold ${item.available ? '' : 'text-ivory/35 line-through'}`}>{item.name}</p>
                {item.description && <p className="truncate text-sm text-ivory/50">{item.description}</p>}
              </div>
              <p className="font-semibold text-ivory/80">{euro(item.priceCents)}</p>
              <button
                type="button"
                onClick={() => setEditingItemId(item.id)}
                aria-label={`${item.name} bearbeiten`}
                className="rounded-lg border-2 border-ivory/10 px-2.5 py-1.5 text-xs font-bold text-ivory/60 transition hover:border-champagne hover:text-champagne"
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() => toggleItem.mutate(item)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  item.available ? 'bg-oliva/10 text-oliva hover:bg-oliva/20' : 'bg-ivory/10 text-ivory/50 hover:bg-ivory/15'
                }`}
              >
                {item.available ? 'Verfügbar' : 'Ausverkauft'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`„${item.name}" löschen?`)) deleteItem.mutate(item.id);
                }}
                aria-label={`${item.name} löschen`}
                className="rounded-lg border-2 border-ivory/10 px-2.5 py-1.5 text-xs font-bold text-red-300 transition hover:border-red-400/60"
              >
                ✕
              </button>
            </li>
          )
        )}
      </ul>
    </section>
  );
}

/** Inline-Bearbeitung eines Artikels: Name, Beschreibung, Preis. */
function ItemEditRow(props: { item: AdminMenuItem; onDone: () => void; onCancel: () => void }): JSX.Element {
  const { item } = props;
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? '');
  const [price, setPrice] = useState(formatPriceInput(item.priceCents));

  const updateItem = useMutation({
    mutationFn: () =>
      api<AdminMenuItem>(`/api/admin/items/${item.id}`, {
        method: 'PATCH',
        auth: 'admin',
        body: {
          name: name.trim(),
          description: description.trim() || null,
          priceCents: parsePriceCents(price),
        },
      }),
    onSuccess: props.onDone,
  });

  const valid = name.trim().length > 0 && isPriceValid(price);

  return (
    <li className="py-3">
      <div className="grid gap-2 rounded-xl bg-ivory/5 p-3 sm:grid-cols-[1fr_1fr_auto]">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          aria-label="Artikelname"
          className="rounded-lg border-2 border-ivory/15 px-3 py-2 text-sm focus:border-champagne focus:outline-none"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          placeholder="Beschreibung (optional)"
          aria-label="Beschreibung"
          className="rounded-lg border-2 border-ivory/15 px-3 py-2 text-sm focus:border-champagne focus:outline-none"
        />
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-label="Preis in Euro"
            className="w-24 rounded-lg border-2 border-ivory/15 px-3 py-2 text-sm focus:border-champagne focus:outline-none"
          />
          <button
            type="button"
            onClick={() => updateItem.mutate()}
            disabled={updateItem.isPending || !valid}
            className="rounded-lg bg-champagne px-4 py-2 text-sm font-bold text-noir transition hover:bg-champagne-dark disabled:opacity-50"
          >
            Speichern
          </button>
          <button
            type="button"
            onClick={props.onCancel}
            className="rounded-lg border-2 border-ivory/15 px-3 py-2 text-sm font-bold transition hover:border-ivory/30"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </li>
  );
}

function MoveButtons(props: {
  label: string;
  canUp: boolean;
  canDown: boolean;
  onMove: (direction: -1 | 1) => void;
}): JSX.Element {
  return (
    <span className="flex shrink-0 flex-col">
      <button
        type="button"
        onClick={() => props.onMove(-1)}
        disabled={!props.canUp}
        aria-label={`${props.label} nach oben`}
        className="px-1 text-xs leading-4 text-ivory/40 transition hover:text-champagne disabled:opacity-20"
      >
        ▲
      </button>
      <button
        type="button"
        onClick={() => props.onMove(1)}
        disabled={!props.canDown}
        aria-label={`${props.label} nach unten`}
        className="px-1 text-xs leading-4 text-ivory/40 transition hover:text-champagne disabled:opacity-20"
      >
        ▼
      </button>
    </span>
  );
}
