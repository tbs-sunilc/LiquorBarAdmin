'use client';

/**
 * SC-11 Dry-days calendar management.  Filter, inline add form, table with
 * active toggle.  State code 'ALL' is the nationwide sentinel
 * (Republic Day, Independence Day, etc.).
 */

import { useEffect, useState } from 'react';
import {
  addDryDay,
  ApiError,
  listDryDays,
  setDryDayActive,
  type DryDayRowDto,
} from '@/lib/admin-api';
import {
  Card,
  EmptyState,
  ErrorBanner,
  PageHeader,
  SkeletonRow,
  Toolbar,
} from '@/components/ui';

export default function DryDaysPage() {
  const [stateFilter, setStateFilter] = useState('');
  const [rows, setRows] = useState<DryDayRowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form
  const [stateCode, setStateCode] = useState('ALL');
  const [dryDate, setDryDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    try {
      setLoading(true); setError(null);
      setRows(await listDryDays(stateFilter || undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateFilter]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await addDryDay({
        stateCode: stateCode.trim().toUpperCase(),
        dryDate,
        title: title.trim(),
        description: description.trim() || undefined,
        isRecurringYearly: recurring,
      });
      setTitle(''); setDescription(''); setRecurring(false);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(row: DryDayRowDto) {
    try {
      await setDryDayActive(row.id, !row.isActive);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to toggle');
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Compliance"
        title="Dry days"
        subtitle="State-notified prohibition dates that block wallet purchases (BR-013)."
        actions={<span className="text-xs text-muted"><span className="font-numeric font-semibold text-ink">{rows.length}</span> entries</span>}
      />

      <Toolbar>
        <label htmlFor="filter-state" className="text-xs font-semibold uppercase tracking-wider text-muted">Filter</label>
        <input
          id="filter-state"
          placeholder="State code (e.g. MH)"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value.toUpperCase())}
          className="input max-w-[12rem] font-mono uppercase"
          maxLength={3}
        />
      </Toolbar>

      <Card title="Add a dry day" subtitle="Use ALL for nationwide events." className="mb-6">
        <form onSubmit={handleAdd} className="grid md:grid-cols-5 gap-3 items-end">
          <Field label="State" htmlFor="dd-state">
            <input id="dd-state" value={stateCode} onChange={(e) => setStateCode(e.target.value.toUpperCase())}
                   maxLength={3} placeholder="ALL / MH / KA"
                   className="input font-mono uppercase" />
          </Field>
          <Field label="Date" htmlFor="dd-date">
            <input id="dd-date" type="date" value={dryDate} onChange={(e) => setDryDate(e.target.value)} className="input" />
          </Field>
          <Field label="Title" htmlFor="dd-title">
            <input id="dd-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
                   placeholder="e.g., Republic Day" className="input" />
          </Field>
          <Field label="Recurring" htmlFor="dd-rec">
            <label className="inline-flex items-center gap-2 text-sm text-ink h-10">
              <input id="dd-rec" type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)}
                     className="accent-[color:var(--color-accent)] w-4 h-4" />
              Repeats yearly
            </label>
          </Field>
          <button type="submit" disabled={submitting || !title.trim()} className="btn btn-primary h-10">
            {submitting ? 'Adding…' : 'Add dry day'}
          </button>

          <div className="md:col-span-5">
            <Field label="Description (optional)" htmlFor="dd-desc">
              <input id="dd-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} className="input" />
            </Field>
          </div>
        </form>
      </Card>

      {error && <div className="mb-4"><ErrorBanner>{error}</ErrorBanner></div>}

      {!loading && rows.length === 0 && (
        <EmptyState icon="✦" title="No dry days" description="Add a dry day above to start blocking wallet purchases on that date." />
      )}

      {(loading || rows.length > 0) && (
        <div className="card-raised overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>State</th>
                <th>Date</th>
                <th>Title</th>
                <th>Description</th>
                <th>Recurring</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}
              {!loading && rows.map((r) => (
                <tr key={r.id} className={r.isActive ? '' : 'opacity-60'}>
                  <td className="font-mono text-xs text-ink uppercase">{r.stateCode}</td>
                  <td className="font-numeric tabular-nums text-ink">{r.dryDate}</td>
                  <td className="font-medium text-ink">{r.title}</td>
                  <td className="text-muted text-xs">{r.description ?? '—'}</td>
                  <td className="text-muted text-xs">{r.isRecurringYearly ? 'Yearly' : 'One-time'}</td>
                  <td className="text-right">
                    <button
                      onClick={() => toggleActive(r)}
                      className={`btn btn-sm ${r.isActive ? 'btn-ghost' : 'btn-gold'}`}
                    >
                      {r.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="field-label">{label}</label>
      {children}
    </div>
  );
}
