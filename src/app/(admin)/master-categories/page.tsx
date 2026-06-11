'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ApiError,
  listAdminBars,
  listAdminBarInventoryCategories,
  createAdminBarInventoryCategory,
  updateAdminBarInventoryCategory,
  setAdminBarInventoryCategoryActive,
  deleteAdminBarInventoryCategory,
  type AdminBarSummaryDto,
  type AdminBarInventoryCategoryDto,
  type CreateAdminBarInventoryCategoryRequest,
} from '@/lib/admin-api';
import { Card, ErrorBanner, PageHeader } from '@/components/ui';

const EMPTY_FORM: CreateAdminBarInventoryCategoryRequest = {
  name: '',
  displayOrder: 100,
};

export default function BarInventoryCategoriesPage() {
  // --- Bar picker ---
  const [bars, setBars] = useState<AdminBarSummaryDto[]>([]);
  const [barSearch, setBarSearch] = useState('');
  const [selectedBar, setSelectedBar] = useState<AdminBarSummaryDto | null>(null);
  const [barsLoading, setBarsLoading] = useState(true);
  const [barsError, setBarsError] = useState<string | null>(null);

  // --- Categories ---
  const [categories, setCategories] = useState<AdminBarInventoryCategoryDto[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // --- Modal ---
  const [showModal, setShowModal] = useState(false);
  const [editCat, setEditCat] = useState<AdminBarInventoryCategoryDto | null>(null);
  const [form, setForm] = useState<CreateAdminBarInventoryCategoryRequest>(EMPTY_FORM);

  // Load bars once
  useEffect(() => {
    (async () => {
      try {
        setBarsLoading(true);
        setBarsError(null);
        const data = await listAdminBars(undefined, 0, 200);
        setBars(data);
      } catch (err) {
        setBarsError(err instanceof ApiError ? err.message : 'Failed to load bars');
      } finally {
        setBarsLoading(false);
      }
    })();
  }, []);

  // Load categories when bar is selected
  const loadCategories = useCallback(async (barId: number) => {
    try {
      setCatsLoading(true);
      setError(null);
      const data = await listAdminBarInventoryCategories(barId);
      setCategories(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load categories');
    } finally {
      setCatsLoading(false);
    }
  }, []);

  const onSelectBar = (bar: AdminBarSummaryDto) => {
    setSelectedBar(bar);
    setCategories([]);
    void loadCategories(bar.id);
  };

  // Filtered bar list
  const filteredBars = bars.filter(b =>
    !barSearch ||
    b.businessName.toLowerCase().includes(barSearch.toLowerCase()) ||
    b.city.toLowerCase().includes(barSearch.toLowerCase()),
  );

  function openCreate() {
    setEditCat(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(cat: AdminBarInventoryCategoryDto) {
    setEditCat(cat);
    setForm({ name: cat.name, displayOrder: cat.displayOrder });
    setShowModal(true);
  }

  async function onSave() {
    if (busy || !selectedBar) return;
    setBusy(true);
    setError(null);
    try {
      if (editCat) {
        await updateAdminBarInventoryCategory(selectedBar.id, editCat.id, form);
      } else {
        await createAdminBarInventoryCategory(selectedBar.id, form);
      }
      setShowModal(false);
      await loadCategories(selectedBar.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onToggleActive(cat: AdminBarInventoryCategoryDto) {
    if (busy || !selectedBar) return;
    setBusy(true);
    setError(null);
    try {
      await setAdminBarInventoryCategoryActive(selectedBar.id, cat.id, !cat.isActive);
      await loadCategories(selectedBar.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update status');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(cat: AdminBarInventoryCategoryDto) {
    if (busy || !selectedBar) return;
    if (!window.confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAdminBarInventoryCategory(selectedBar.id, cat.id);
      await loadCategories(selectedBar.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Bar Inventory Categories"
        subtitle="Manage per-bar shelf categories that organise inventory bottles"
      />

      {error && <ErrorBanner message={error} />}

      {/* Two-column layout: Bar picker on left, categories on right */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">

        {/* ── Bar Picker ── */}
        <Card title="Select Bar">
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={barSearch}
              onChange={(e) => setBarSearch(e.target.value)}
              placeholder="Search bars…"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm w-full"
              id="bar-search-input"
            />

            {barsLoading && (
              <p className="text-xs text-slate-400 text-center py-4">Loading bars…</p>
            )}
            {barsError && <ErrorBanner message={barsError} />}

            <div className="flex flex-col gap-1 max-h-[500px] overflow-y-auto">
              {filteredBars.map((bar) => (
                <button
                  key={bar.id}
                  type="button"
                  onClick={() => onSelectBar(bar)}
                  className={`text-left px-3 py-2.5 rounded-xl transition-colors text-sm ${
                    selectedBar?.id === bar.id
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                  id={`bar-item-${bar.id}`}
                >
                  <div className="font-medium leading-tight">{bar.businessName}</div>
                  <div className={`text-xs mt-0.5 ${selectedBar?.id === bar.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {bar.city}, {bar.stateCode} · #{bar.id}
                  </div>
                </button>
              ))}
              {!barsLoading && filteredBars.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No bars found.</p>
              )}
            </div>
          </div>
        </Card>

        {/* ── Categories Panel ── */}
        <div className="flex flex-col gap-4">
          {!selectedBar ? (
            <Card title="Categories">
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <span className="text-4xl">🏪</span>
                <p className="text-sm text-slate-400">Select a bar to manage its inventory categories</p>
              </div>
            </Card>
          ) : (
            <Card
              title={`Categories — ${selectedBar.businessName}`}
              action={
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={openCreate}
                  disabled={busy}
                  id="add-category-btn"
                >
                  + Add Category
                </button>
              }
            >
              {catsLoading ? (
                <p className="text-sm text-slate-400 py-6 text-center">Loading categories…</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                        <th className="py-2 pr-3">Name</th>
                        <th className="py-2 pr-3">Display Order</th>
                        <th className="py-2 pr-3">Bottles</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-slate-400 text-sm">
                            No categories yet. Click <strong>+ Add Category</strong> to create one.
                          </td>
                        </tr>
                      )}
                      {categories.map((cat) => (
                        <tr key={cat.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                          <td className="py-3 pr-3 font-medium text-slate-800">{cat.name}</td>
                          <td className="py-3 pr-3 text-slate-500 tabular-nums">{cat.displayOrder}</td>
                          <td className="py-3 pr-3">
                            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600">
                              {cat.bottleCount}
                            </span>
                          </td>
                          <td className="py-3 pr-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                cat.isActive
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {cat.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => openEdit(cat)}
                                disabled={busy}
                                id={`edit-cat-${cat.id}`}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => onToggleActive(cat)}
                                disabled={busy}
                                id={`toggle-cat-${cat.id}`}
                              >
                                {cat.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => onDelete(cat)}
                                disabled={busy || cat.bottleCount > 0}
                                title={cat.bottleCount > 0 ? 'Cannot delete — bottles assigned' : 'Delete category'}
                                id={`delete-cat-${cat.id}`}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-800">
                {editCat ? 'Edit Category' : 'Add Inventory Category'}
              </h2>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
                onClick={() => setShowModal(false)}
                id="close-modal-btn"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="e.g. Whisky, Premium Spirits…"
                  id="category-name-input"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Display Order
                </label>
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={form.displayOrder ?? 100}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, displayOrder: parseInt(e.target.value) || 100 }))
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  id="category-order-input"
                />
                <p className="text-xs text-slate-400">Lower numbers appear first (default: 100).</p>
              </div>

              {error && (
                <ErrorBanner message={error} />
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
                disabled={busy}
                id="cancel-modal-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onSave}
                disabled={busy || !form.name.trim()}
                id="save-modal-btn"
              >
                {busy ? 'Saving…' : editCat ? 'Save Changes' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Augment AdminBarInventoryCategoryDto with isActive for UI ───────────────
declare module '@/lib/admin-api' {
  interface AdminBarInventoryCategoryDto {
    isActive?: boolean;
  }
}
