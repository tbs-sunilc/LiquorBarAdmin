'use client';

import { useEffect, useState } from 'react';
import {
  ApiError,
  createAdminBarInventoryCategory,
  deleteAdminBarInventoryCategory,
  listAdminBarInventoryCategories,
  setAdminBarInventoryCategoryActive,
  updateAdminBarInventoryCategory,
  type AdminBarInventoryCategoryDto,
  type CreateAdminBarInventoryCategoryRequest,
} from '@/lib/admin-api';
import { Card, ErrorBanner, PageHeader } from '@/components/ui';

const EMPTY_FORM: CreateAdminBarInventoryCategoryRequest = {
  name: '',
  displayOrder: 100,
};

export default function MasterCategoriesPage() {
  const [rows, setRows] = useState<AdminBarInventoryCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AdminBarInventoryCategoryDto | null>(null);
  const [form, setForm] = useState<CreateAdminBarInventoryCategoryRequest>(EMPTY_FORM);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const data = await listAdminBarInventoryCategories();
      setRows(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load master categories.');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(row: AdminBarInventoryCategoryDto) {
    setEditing(row);
    setForm({ name: row.name, displayOrder: row.displayOrder });
    setShowModal(true);
  }

  async function onSave() {
    if (busy || !form.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await updateAdminBarInventoryCategory(editing.id, {
          name: form.name.trim(),
          displayOrder: form.displayOrder,
        });
      } else {
        await createAdminBarInventoryCategory({
          name: form.name.trim(),
          displayOrder: form.displayOrder,
        });
      }
      setShowModal(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save master category.');
    } finally {
      setBusy(false);
    }
  }

  async function onToggleActive(row: AdminBarInventoryCategoryDto) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await setAdminBarInventoryCategoryActive(row.id, !row.isActive);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update category status.');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(row: AdminBarInventoryCategoryDto) {
    if (busy) return;
    if (row.bottleCount > 0) {
      setError(`Cannot delete "${row.name}" because ${row.bottleCount} inventory item(s) use it.`);
      return;
    }
    if (!window.confirm(`Delete category "${row.name}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAdminBarInventoryCategory(row.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete master category.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Global Categories"
        subtitle="Global master categories shared across the platform"
      />

      {error && <ErrorBanner message={error} />}

      <Card
        title="Global Categories"
        action={
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate} disabled={busy}>
            + Add Category
          </button>
        }
      >
        {loading ? (
          <p className="text-sm text-slate-400 py-6 text-center">Loading global categories...</p>
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
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400 text-sm">
                      No global categories yet. Click + Add Category to create one.
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="py-3 pr-3 font-medium text-slate-800">{row.name}</td>
                    <td className="py-3 pr-3 text-slate-500 tabular-nums">{row.displayOrder}</td>
                    <td className="py-3 pr-3">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600">
                        {row.bottleCount}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(row)} disabled={busy}>
                          Edit
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onToggleActive(row)} disabled={busy}>
                          {row.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => onDelete(row)}
                          disabled={busy || row.bottleCount > 0}
                          title={row.bottleCount > 0 ? 'Cannot delete - bottles assigned' : 'Delete category'}
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-800">
                {editing ? 'Edit Category' : 'Add Category'}
              </h2>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
                onClick={() => setShowModal(false)}
              >
                x
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
                  placeholder="e.g. Beer, Whiskey, Vodka"
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
                />
              </div>

              {error && <ErrorBanner message={error} />}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={onSave} disabled={busy || !form.name.trim()}>
                {busy ? 'Saving...' : editing ? 'Save Changes' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
