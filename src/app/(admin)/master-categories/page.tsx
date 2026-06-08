'use client';

import { useEffect, useState } from 'react';
import {
  ApiError,
  createMasterCategory,
  deleteMasterCategory,
  listMasterCategories,
  updateMasterCategory,
  type MasterCategoryDto,
} from '@/lib/admin-api';
import { Card, ErrorBanner, PageHeader } from '@/components/ui';

export default function MasterCategoriesPage() {
  const [rows, setRows] = useState<MasterCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      setLoading(true);
      setError(null);
      setRows(await listMasterCategories());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load master categories');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function onCreate() {
    if (!newName.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createMasterCategory(newName.trim());
      setNewName('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create category');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit(id: number) {
    if (!editName.trim() || busy) return;
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setBusy(true);
    setError(null);
    try {
      await updateMasterCategory(id, { name: editName.trim(), isActive: row.isActive });
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update category');
    } finally {
      setBusy(false);
    }
  }

  async function onToggleActive(row: MasterCategoryDto) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateMasterCategory(row.id, { name: row.name, isActive: !row.isActive });
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update status');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(row: MasterCategoryDto) {
    if (busy) return;
    if (!window.confirm(`Delete "${row.name}"? This cannot be undone if unused.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteMasterCategory(row.id);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete category');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Master Categories"
        subtitle="Platform-wide product types used in catalogue search and customer browse"
      />

      {error && <ErrorBanner message={error} />}

      <Card title="Add Category">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Whisky, Craft Beer"
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm"
            disabled={busy}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={onCreate}
            disabled={busy || !newName.trim()}
          >
            Add
          </button>
        </div>
      </Card>

      <Card title={`Categories (${rows.length})`}>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Catalogue Items</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50">
                    <td className="py-3 pr-3 font-medium">
                      {editingId === row.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
                        />
                      ) : (
                        row.name
                      )}
                    </td>
                    <td className="py-3 pr-3 text-slate-600">{row.catalogueItemCount}</td>
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
                        {editingId === row.id ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => onSaveEdit(row.id)}
                              disabled={busy}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setEditingId(null)}
                              disabled={busy}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setEditingId(row.id);
                                setEditName(row.name);
                              }}
                              disabled={busy}
                            >
                              Rename
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
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
