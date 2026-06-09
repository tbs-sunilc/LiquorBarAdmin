'use client';

import { useEffect, useState } from 'react';
import {
  ApiError,
  listBottleCatalogue,
  listCatalogueCategories,
  createBottleCatalogueEntry,
  updateBottleCatalogueEntry,
  deleteBottleCatalogueEntry,
  type BottleCatalogueDto,
  type CatalogueCategoryDto,
  type CreateBottleCatalogueRequest,
  type UpdateBottleCatalogueRequest,
} from '@/lib/admin-api';
import { Card, ErrorBanner, PageHeader } from '@/components/ui';

const KNOWN_CATEGORIES = [
  'Whisky', 'Vodka', 'Rum', 'Gin', 'Tequila',
  'Brandy', 'Wine', 'Beer', 'Liqueur', 'Other',
];

const EMPTY_FORM: CreateBottleCatalogueRequest = {
  brandName: '',
  productName: '',
  category: '',
  subCategory: '',
  originCountry: '',
  alcoholContentPct: null,
  defaultVolumeMl: 750,
  imageUrl: '',
  tastingNotes: '',
};

export default function BottleCataloguePage() {
  const [rows, setRows] = useState<BottleCatalogueDto[]>([]);
  const [categories, setCategories] = useState<CatalogueCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editRow, setEditRow] = useState<BottleCatalogueDto | null>(null);
  const [form, setForm] = useState<CreateBottleCatalogueRequest>(EMPTY_FORM);

  async function reload(category?: string, search?: string) {
    try {
      setLoading(true);
      setError(null);
      const [data, cats] = await Promise.all([
        listBottleCatalogue(category || undefined, search || undefined, 0, 100),
        listCatalogueCategories(),
      ]);
      setRows(data);
      setCategories(cats);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load catalogue');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void reload(); }, []);

  function openCreate() {
    setEditRow(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(row: BottleCatalogueDto) {
    setEditRow(row);
    setForm({
      brandName: row.brandName,
      productName: row.productName,
      category: row.category,
      subCategory: row.subCategory ?? '',
      originCountry: row.originCountry ?? '',
      alcoholContentPct: row.alcoholContentPct,
      defaultVolumeMl: row.defaultVolumeMl,
      imageUrl: row.imageUrl ?? '',
      tastingNotes: row.tastingNotes ?? '',
    });
    setShowModal(true);
  }

  async function onSave() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (editRow) {
        const payload: UpdateBottleCatalogueRequest = {
          ...form,
          isActive: editRow.isActive,
        };
        await updateBottleCatalogueEntry(editRow.id, payload);
      } else {
        await createBottleCatalogueEntry(form);
      }
      setShowModal(false);
      await reload(filterCategory, filterSearch);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onToggleActive(row: BottleCatalogueDto) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateBottleCatalogueEntry(row.id, {
        brandName: row.brandName,
        productName: row.productName,
        category: row.category,
        subCategory: row.subCategory,
        originCountry: row.originCountry,
        alcoholContentPct: row.alcoholContentPct,
        defaultVolumeMl: row.defaultVolumeMl,
        imageUrl: row.imageUrl,
        tastingNotes: row.tastingNotes,
        isActive: !row.isActive,
      });
      await reload(filterCategory, filterSearch);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update status');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(row: BottleCatalogueDto) {
    if (busy) return;
    if (!window.confirm(`Delete "${row.brandName} – ${row.productName}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteBottleCatalogueEntry(row.id);
      await reload(filterCategory, filterSearch);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  function onFilter() {
    void reload(filterCategory, filterSearch);
  }

  function setField<K extends keyof CreateBottleCatalogueRequest>(
    key: K,
    value: CreateBottleCatalogueRequest[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <>
      <PageHeader
        title="Bottle Catalogue"
        subtitle="Master list of all bottle products available across the platform"
      />

      {error && <ErrorBanner message={error} />}

      {/* Filters */}
      <Card title="Filters">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm bg-white"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.itemCount})
              </option>
            ))}
          </select>
          <input
            type="text"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onFilter()}
            placeholder="Search brand or product…"
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm"
          />
          <button type="button" className="btn btn-secondary" onClick={onFilter}>
            Search
          </button>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + Add Bottle
          </button>
        </div>
      </Card>

      {/* Table */}
      <Card title={`Catalogue (${rows.length})`}>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="py-2 pr-3">Brand</th>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Sub-Cat</th>
                  <th className="py-2 pr-3">ABV%</th>
                  <th className="py-2 pr-3">Vol (ml)</th>
                  <th className="py-2 pr-3">Origin</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-slate-400 text-sm">
                      No catalogue entries found.
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="py-3 pr-3 font-medium">{row.brandName}</td>
                    <td className="py-3 pr-3 text-slate-700">{row.productName}</td>
                    <td className="py-3 pr-3">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700">
                        {row.category}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-slate-500">{row.subCategory ?? '—'}</td>
                    <td className="py-3 pr-3 text-slate-600">
                      {row.alcoholContentPct != null ? `${row.alcoholContentPct}%` : '—'}
                    </td>
                    <td className="py-3 pr-3 text-slate-600">{row.defaultVolumeMl}</td>
                    <td className="py-3 pr-3 text-slate-500">{row.originCountry ?? '—'}</td>
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          row.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEdit(row)}
                          disabled={busy}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onToggleActive(row)}
                          disabled={busy}
                        >
                          {row.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => onDelete(row)}
                          disabled={busy}
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

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-800">
                {editRow ? 'Edit Bottle' : 'Add Bottle to Catalogue'}
              </h2>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Brand Name *</label>
                <input
                  type="text"
                  value={form.brandName}
                  onChange={(e) => setField('brandName', e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="e.g. Glenfiddich"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Product Name *</label>
                <input
                  type="text"
                  value={form.productName}
                  onChange={(e) => setField('productName', e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="e.g. 12 Year Old"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Category *</label>
                <select
                  value={form.category}
                  onChange={(e) => setField('category', e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="">Select category…</option>
                  {KNOWN_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Sub-Category</label>
                <input
                  type="text"
                  value={form.subCategory ?? ''}
                  onChange={(e) => setField('subCategory', e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="e.g. Single Malt"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Origin Country</label>
                <input
                  type="text"
                  value={form.originCountry ?? ''}
                  onChange={(e) => setField('originCountry', e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="e.g. Scotland"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">ABV %</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.alcoholContentPct ?? ''}
                  onChange={(e) =>
                    setField('alcoholContentPct', e.target.value ? parseFloat(e.target.value) : null)
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="e.g. 40.0"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Default Volume (ml)</label>
                <input
                  type="number"
                  min="1"
                  value={form.defaultVolumeMl}
                  onChange={(e) => setField('defaultVolumeMl', parseInt(e.target.value) || 750)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Image URL</label>
                <input
                  type="url"
                  value={form.imageUrl ?? ''}
                  onChange={(e) => setField('imageUrl', e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="https://…"
                />
              </div>

              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tasting Notes</label>
                <textarea
                  rows={3}
                  value={form.tastingNotes ?? ''}
                  onChange={(e) => setField('tastingNotes', e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm resize-none"
                  placeholder="Optional tasting notes…"
                />
              </div>
            </div>

            {error && (
              <div className="px-6 pb-2">
                <ErrorBanner message={error} />
              </div>
            )}

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onSave}
                disabled={busy || !form.brandName.trim() || !form.productName.trim() || !form.category}
              >
                {busy ? 'Saving…' : editRow ? 'Save Changes' : 'Add Bottle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
