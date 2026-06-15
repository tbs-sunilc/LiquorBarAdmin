'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  createBottleCatalogueEntry,
  deleteBottleCatalogueEntry,
  listBottleCatalogue,
  listCatalogueCategories,
  updateBottleCatalogueEntry,
  type BottleCatalogueDto,
  type CatalogueCategoryDto,
  type BottleCatalogueUploadRequest,
} from '@/lib/admin-api';
import { getDocumentUrl } from '@/lib/document-url';
import { Card, ErrorBanner, PageHeader } from '@/components/ui';

const EMPTY_FORM: BottleCatalogueUploadRequest = {
  categoryId: 0,
  brandName: '',
  productName: '',
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
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<BottleCatalogueDto | null>(null);
  const [search, setSearch] = useState('');
 const [filterCategory, setFilterCategory] = useState<number | undefined>(undefined);
  const [form, setForm] = useState<BottleCatalogueUploadRequest>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    void load();
  }, [search, filterCategory]);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [data, cats] = await Promise.all([
        listBottleCatalogue(filterCategory || undefined, search || undefined),
        listCatalogueCategories(),
      ]);
      setRows(data);
      setCategories(cats);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load bottle catalogue.');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setShowModal(true);
  }

  function openEdit(row: BottleCatalogueDto) {
    setEditing(row);
    setImageFile(null);
    setForm({
      categoryId: row.categoryId,
      brandName: row.brandName,
      productName: row.productName,
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
    if (busy || !form.brandName.trim() || !form.productName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const categoryId = form.categoryId || editing?.categoryId || 0;
      const payload: BottleCatalogueUploadRequest = {
        ...form,
        brandName: form.brandName.trim(),
        productName: form.productName.trim(),
        subCategory: form.subCategory?.trim() || null,
        originCountry: form.originCountry?.trim() || null,
        imageUrl: form.imageUrl?.trim() || null,
        tastingNotes: form.tastingNotes?.trim() || null,
        categoryId,
        imageFile,
      };

      if (editing) {
        await updateBottleCatalogueEntry(editing.id, {
          ...payload,
          isActive: editing.isActive,
        });
      } else {
        await createBottleCatalogueEntry(payload);
      }
      setShowModal(false);
      setImageFile(null);
      if (editing) {
        setRows((current) =>
          current.map((row) =>
            row.id === editing.id
              ? {
                  ...row,
                  ...payload,
                  id: row.id,
                  category: row.category,
                  isActive: editing.isActive,
                  imageUrl: payload.imageFile ? row.imageUrl : payload.imageUrl ?? row.imageUrl,
                }
              : row,
          ),
        );
      } else {
        await load();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save bottle catalogue item.');
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
        categoryId: row.categoryId,
        subCategory: row.subCategory,
        originCountry: row.originCountry,
        alcoholContentPct: row.alcoholContentPct,
        defaultVolumeMl: row.defaultVolumeMl,
          imageUrl: row.imageUrl,
          tastingNotes: row.tastingNotes,
          isActive: !row.isActive,
          imageFile: null,
        });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update bottle status.');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(row: BottleCatalogueDto) {
    if (busy) return;
    if (!window.confirm(`Delete bottle "${row.brandName} ${row.productName}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteBottleCatalogueEntry(row.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete bottle.');
    } finally {
      setBusy(false);
    }
  }

  const categoryOptions = useMemo(
    () => categories.filter((c) => c.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );

  return (
    <>
      <PageHeader
        title="Bottle Catalogue"
        subtitle="Global bottle master list used by all bars"
      />

      {error && <ErrorBanner message={error} />}

      <Card
        title="Bottle Catalogue"
        action={
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate} disabled={busy}>
            + Add Bottle
          </button>
        }
      >
        <div className="mb-4 flex flex-wrap gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brand or bottle"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <select
            value={filterCategory}
onChange={(e) => setFilterCategory(e.target.value ? Number(e.target.value) : undefined)}            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
          >
              <option value="">All Categories</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 py-6 text-center">Loading bottle catalogue...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="py-2 pr-3">Image</th>
                  <th className="py-2 pr-3">Brand</th>
                  <th className="py-2 pr-3">Bottle</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Size</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400 text-sm">
                      No bottle catalogue entries yet. Click + Add Bottle to create one.
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="py-3 pr-3">
                      <div className="h-12 w-12 overflow-hidden rounded-lg bg-slate-100">
                        {row.imageUrl ? (
                          <img src={getDocumentUrl(row.imageUrl)} alt={row.productName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-black uppercase text-slate-400">No Img</div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-3 font-medium text-slate-800">{row.brandName}</td>
                    <td className="py-3 pr-3 text-slate-600">{row.productName}</td>
                    <td className="py-3 pr-3 text-slate-500">{row.category}</td>
                    <td className="py-3 pr-3 text-slate-500">{row.defaultVolumeMl} ml</td>
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
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(row)} disabled={busy}>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-800">
                {editing ? 'Edit Bottle' : 'Add Bottle'}
              </h2>
              <button type="button" className="text-slate-400 hover:text-slate-600 text-xl leading-none" onClick={() => setShowModal(false)}>
                x
              </button>
            </div>

            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Brand Name" value={form.brandName} onChange={(value) => setForm((f) => ({ ...f, brandName: value }))} />
              <Field label="Bottle Name" value={form.productName} onChange={(value) => setForm((f) => ({ ...f, productName: value }))} />
              <SelectField
                label="Category"
                value={String(form.categoryId || '')}
                onChange={(value) => setForm((f) => ({ ...f, categoryId: Number(value) || 0 }))}
              >
                <option value="">Select a category</option>
                {categories.filter((c) => c.isActive).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </SelectField>
              <Field label="Size (ml)" type="number" value={String(form.defaultVolumeMl)} onChange={(value) => setForm((f) => ({ ...f, defaultVolumeMl: Number(value) || 750 }))} />
              <Field label="Unit / Sub Category" value={form.subCategory ?? ''} onChange={(value) => setForm((f) => ({ ...f, subCategory: value }))} />
              <Field label="Alcohol Type" value={form.originCountry ?? ''} onChange={(value) => setForm((f) => ({ ...f, originCountry: value }))} />
              <Field label="Alcohol %" type="number" value={form.alcoholContentPct === null ? '' : String(form.alcoholContentPct)} onChange={(value) => setForm((f) => ({ ...f, alcoholContentPct: value === '' ? null : Number(value) }))} />
              <Field label="Image URL" value={form.imageUrl ?? ''} onChange={(value) => setForm((f) => ({ ...f, imageUrl: value }))} />
              <div className="md:col-span-2 flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Either upload image or paste URL</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                />
                {(imagePreviewUrl || form.imageUrl) && (
                  <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="h-16 w-16 overflow-hidden rounded-lg bg-white">
                      <img
                        src={imagePreviewUrl ?? getDocumentUrl(form.imageUrl) ?? undefined}
                        alt="Bottle preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      {imagePreviewUrl ? 'New file selected. Save to upload.' : 'Current image URL will be used.'}
                    </p>
                  </div>
                )}
              </div>
              <div className="md:col-span-2 flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tasting Notes</label>
                <textarea
                  value={form.tastingNotes ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, tastingNotes: e.target.value }))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-24"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={onSave} disabled={busy}>
                {busy ? 'Saving...' : editing ? 'Save Changes' : 'Add Bottle'}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  list,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  list?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</label>
      <input
        type={type}
        list={list}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
      >
        {children}
      </select>
    </div>
  );
}
