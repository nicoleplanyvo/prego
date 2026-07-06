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

  if (isLoading) return <p className="mt-6 text-ivory/60">Speisekarte wird geladen …</p>;

  return (
    <div className="mt-4 space-y-5">
      {categories.map((category) => (
        <CategoryBlock
          key={category.id}
          category={category}
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

function CategoryBlock(props: { category: AdminCategory; onChanged: () => void; onDelete: () => void }): JSX.Element {
  const { category } = props;
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrice, setItemPrice] = useState('');

  const addItem = useMutation({
    mutationFn: () =>
      api<AdminMenuItem>(`/api/admin/categories/${category.id}/items`, {
        method: 'POST',
        auth: 'admin',
        body: {
          name: itemName,
          description: itemDescription.trim() || null,
          priceCents: Math.round(parseFloat(itemPrice.replace(',', '.')) * 100),
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

  const priceValid = /^\d+([.,]\d{1,2})?$/.test(itemPrice.trim());

  return (
    <section className="rounded-2xl border border-ivory/10 bg-carta p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-extrabold">{category.name}</h3>
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
        {category.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className={`font-semibold ${item.available ? '' : 'text-ivory/35 line-through'}`}>{item.name}</p>
              {item.description && <p className="truncate text-sm text-ivory/50">{item.description}</p>}
            </div>
            <p className="font-semibold text-ivory/80">{euro(item.priceCents)}</p>
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
        ))}
      </ul>
    </section>
  );
}
