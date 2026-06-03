'use client';

import { useEffect, useState } from 'react';
import type React from 'react';
import {
  ApiError,
  createFeaturedListing,
  listFeaturedListings,
  listSubscriptions,
  removeFeaturedListing,
  renewFeaturedListing,
  updateFeaturedListing,
  type AdminFeaturedListingRowDto,
  type AdminSubscriptionRowDto,
} from '@/lib/admin-api';
import {
  Badge,
  type BadgeTone,
  Card,
  EmptyState,
  ErrorBanner,
  Modal,
  ModalActions,
  PageHeader,
  SkeletonRow,
} from '@/components/ui';

type FilterStatus = 'All' | 'Active' | 'Scheduled' | 'Expired' | 'Cancelled';
type ModalState =
  | { kind: 'create' }
  | { kind: 'edit'; row: AdminFeaturedListingRowDto }
  | { kind: 'remove'; row: AdminFeaturedListingRowDto }
  | null;

type ToastState = {
  id: number;
  message: string;
};

type ListingFormState = {
  barId: string;
  barCity: string;
  slotType: string;
  durationDays: string;
  startDate: string;
  scopeCity: string;
  scopeCategory: string;
  status: string;
};

const STATUS_OPTIONS: readonly FilterStatus[] = ['All', 'Active', 'Scheduled', 'Expired', 'Cancelled'];
const SLOT_OPTIONS = [
  { value: 'CityTop', label: 'Top of City' },
  { value: 'Carousel', label: 'Carousel' },
  { value: 'SearchBoost', label: 'Search Boost' },
  { value: 'CategoryTop', label: 'Category Banner' },
] as const;
const DURATION_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
] as const;

export default function FeaturedListingsPage() {
  const [status, setStatus] = useState<FilterStatus>('All');
  const [rows, setRows] = useState<AdminFeaturedListingRowDto[]>([]);
  const [bars, setBars] = useState<AdminSubscriptionRowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [form, setForm] = useState<ListingFormState>(emptyForm());

  useEffect(() => {
    void loadData(status);
  }, [status]);

  useEffect(() => {
    if (!modal) return;
    if (modal.kind === 'create') {
      setForm(emptyForm());
      return;
    }

    if (modal.kind === 'edit') {
      setForm(fromRow(modal.row));
      pushToast('Featured listing editor opened');
    }
  }, [modal]);

  async function loadData(nextStatus: FilterStatus) {
    try {
      setLoading(true);
      setError(null);
      const [featured, subscriptions] = await Promise.all([
        listFeaturedListings(nextStatus === 'All' ? undefined : nextStatus, 0, 100),
        listSubscriptions(undefined, 0, 100),
      ]);
      setRows(featured);
      setBars(subscriptions);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load featured listings');
    } finally {
      setLoading(false);
    }
  }

  function pushToast(message: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }

  function openCreate() {
    setActionError(null);
    setModal({ kind: 'create' });
  }

  function openEdit(row: AdminFeaturedListingRowDto) {
    setActionError(null);
    setModal({ kind: 'edit', row });
  }

  function openRemove(row: AdminFeaturedListingRowDto) {
    setActionError(null);
    setModal({ kind: 'remove', row });
  }

  async function submitEditor() {
    const selectedBarId = Number(form.barId);
    if (!selectedBarId || !form.startDate) return;

    setBusy(true);
    setActionError(null);
    try {
      const startsAtUtc = toIsoStart(form.startDate);
      const endsAtUtc = addDaysIso(startsAtUtc, Number(form.durationDays));

      if (modal?.kind === 'edit') {
        const updated = await updateFeaturedListing(modal.row.id, {
          slotType: form.slotType,
          scopeCity: form.scopeCity || null,
          scopeCategory: form.scopeCategory || null,
          priority: priorityForSlot(form.slotType),
          startsAtUtc,
          endsAtUtc,
          status: form.status,
        });
        setRows((current) => current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
        pushToast('Featured listing editor opened');
      } else {
        const created = await createFeaturedListing(selectedBarId, {
          slotType: form.slotType,
          scopeCity: form.scopeCity || null,
          scopeCategory: form.scopeCategory || null,
          priority: priorityForSlot(form.slotType),
          startsAtUtc,
          endsAtUtc,
          status: form.status,
        });
        setRows((current) => [created, ...current]);
      }

      setModal(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to save featured listing');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (modal?.kind !== 'remove') return;
    setBusy(true);
    setActionError(null);
    try {
      const removed = await removeFeaturedListing(modal.row.id, 'Removed from admin featured menu');
      setRows((current) => current.map((row) => (row.id === removed.id ? { ...row, ...removed } : row)));
      pushToast('Featured listing removed. Bar notified.');
      setModal(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to remove featured listing');
    } finally {
      setBusy(false);
    }
  }

  async function handleRenew(row: AdminFeaturedListingRowDto) {
    setBusy(true);
    setActionError(null);
    try {
      const renewed = await renewFeaturedListing(row.id, { days: 7 });
      setRows((current) => current.map((item) => (item.id === renewed.id ? { ...item, ...renewed } : item)));
      pushToast(`${row.barName} listing renewed for 7 days`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to renew featured listing');
    } finally {
      setBusy(false);
    }
  }

  const activeRows = rows.filter((row) => row.status === 'Active');
  const activeCities = new Set(activeRows.map((row) => displayCity(row)).filter(Boolean)).size;
  const totalClicks = rows.reduce((sum, row) => sum + row.clickCount, 0);
  const totalImpressions = rows.reduce((sum, row) => sum + row.impressionCount, 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Featured listings"
        subtitle="Premium bar placement across city-top, category and search surfaces."
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + Add Featured Listing
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <KpiCard tone="gold" label="Active Featured Listings" value={String(activeRows.length)} detail={`Across ${activeCities || 0} cities`} />
        <KpiCard tone="success" label="Total Clicks" value={formatCompact(totalClicks)} detail={`${formatCompact(totalImpressions)} impressions served`} />
        <KpiCard tone="info" label="Average CTR" value={`${avgCtr.toFixed(1)}%`} detail="Clicks vs impressions across all slots" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">Status</label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as FilterStatus)}
          className="select max-w-[14rem]"
          aria-label="Filter featured listings by status"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="mb-4"><ErrorBanner>{error}</ErrorBanner></div>}
      {actionError && !modal && <div className="mb-4"><ErrorBanner>{actionError}</ErrorBanner></div>}

      {!loading && rows.length === 0 ? (
        <EmptyState
          icon="★"
          title="No featured listings"
          description="Create a placement to start highlighting bars in premium discovery slots."
          cta={<button type="button" className="btn btn-primary" onClick={openCreate}>Add Featured Listing</button>}
        />
      ) : (
        <Card title="Active Featured Listings" subtitle="Hover rows for actions and quick review">
          <div className="overflow-x-auto">
            <table className="table min-w-[920px]">
              <thead>
                <tr>
                  <th>Bar</th>
                  <th>City</th>
                  <th>Listing Type</th>
                  <th>Duration</th>
                  <th>Impressions</th>
                  <th>Clicks</th>
                  <th>CTR</th>
                  <th>Expiry</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, index) => <SkeletonRow key={index} cols={9} />)}
                {!loading && rows.map((row) => {
                  const expired = row.status === 'Expired';
                  return (
                    <tr
                      key={row.id}
                      className={[
                        'cursor-pointer transition-all duration-150',
                        expired ? 'opacity-75' : '',
                        row.status === 'Cancelled' ? 'bg-[color:var(--color-danger-tint)]/30' : '',
                      ].join(' ')}
                      onClick={() => openEdit(row)}
                    >
                      <td>
                        <div className="font-semibold text-ink">{row.barName}</div>
                        <div className="text-xs text-muted font-mono">Bar #{row.barId}</div>
                      </td>
                      <td className="text-muted">{displayCity(row)}</td>
                      <td><Badge tone={slotTone(row.slotType)}>{slotLabel(row.slotType)}</Badge></td>
                      <td className="font-numeric text-ink">{formatDuration(row.startsAtUtc, row.endsAtUtc)}</td>
                      <td className="font-numeric text-ink">{row.impressionCount.toLocaleString('en-IN')}</td>
                      <td className="font-numeric text-ink">{row.clickCount.toLocaleString('en-IN')}</td>
                      <td className="font-numeric">
                        <span className={ctrTone(row.clickCount, row.impressionCount)}>
                          {formatCtr(row.clickCount, row.impressionCount)}
                        </span>
                      </td>
                      <td className={expired ? 'text-[color:var(--color-danger)] font-semibold' : 'text-muted'}>
                        {expired ? `Expired ${fmtDate(row.endsAtUtc)}` : fmtDate(row.endsAtUtc)}
                      </td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(row)}>
                            Edit
                          </button>
                          {expired ? (
                            <button type="button" className="btn btn-sm bg-[color:var(--color-success)] text-white hover:opacity-90" onClick={() => handleRenew(row)}>
                              Renew
                            </button>
                          ) : (
                            <button type="button" className="btn btn-sm bg-[color:var(--color-danger)] text-white hover:opacity-90" onClick={() => openRemove(row)}>
                              Remove
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {modal && (modal.kind === 'create' || modal.kind === 'edit') && (
        <Modal
          title={modal.kind === 'create' ? 'Add Featured Listing' : 'Edit Featured Listing'}
          onClose={() => !busy && setModal(null)}
          width="44rem"
        >
          <div className="space-y-5">
            {actionError && <ErrorBanner>{actionError}</ErrorBanner>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bar *">
                <select
                  value={form.barId}
                  onChange={(event) => {
                    const nextBarId = event.target.value;
                    const bar = bars.find((item) => String(item.barId) === nextBarId);
                    setForm((current) => ({
                      ...current,
                      barId: nextBarId,
                      barCity: bar ? subscriptionCity(bar) : current.barCity,
                    }));
                  }}
                  className="select"
                  disabled={modal.kind === 'edit'}
                >
                  <option value="">Search bar name...</option>
                  {bars.map((bar) => (
                    <option key={bar.barId} value={bar.barId}>
                      {bar.barName}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Listing Type *">
                <select
                  value={form.slotType}
                  onChange={(event) => setForm((current) => ({ ...current, slotType: event.target.value }))}
                  className="select"
                >
                  {SLOT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Duration *">
                <select
                  value={form.durationDays}
                  onChange={(event) => setForm((current) => ({ ...current, durationDays: event.target.value }))}
                  className="select"
                >
                  {DURATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Status *">
                <select
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                  className="select"
                >
                  {['Active', 'Scheduled', 'Expired', 'Cancelled'].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Start Date *">
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                  className="input"
                />
              </Field>

              <Field label="Bar City">
                <div className="input flex items-center bg-ivory-2 text-muted">{form.barCity || '-'}</div>
              </Field>

              <Field label="Scope City">
                <input
                  type="text"
                  value={form.scopeCity}
                  onChange={(event) => setForm((current) => ({ ...current, scopeCity: event.target.value }))}
                  className="input"
                  placeholder="Optional targeting city"
                />
              </Field>

              <Field label="Scope Category">
                <input
                  type="text"
                  value={form.scopeCategory}
                  onChange={(event) => setForm((current) => ({ ...current, scopeCategory: event.target.value }))}
                  className="input"
                  placeholder="Whisky"
                />
              </Field>

              <Field label="Payment Status">
                <div className="input flex items-center bg-ivory-2 text-muted">Razorpay collected</div>
              </Field>
            </div>
            <ModalActions
              busy={busy || !form.barId || !form.startDate}
              onCancel={() => setModal(null)}
              onConfirm={submitEditor}
              confirmLabel={modal.kind === 'create' ? 'Add Listing' : 'Save Changes'}
              tone="primary"
            />
          </div>
        </Modal>
      )}

      {modal?.kind === 'remove' && (
        <Modal title="Remove Featured Listing?" onClose={() => !busy && setModal(null)} width="46rem">
          <div className="space-y-5">
            {actionError && <ErrorBanner>{actionError}</ErrorBanner>}
            <p className="text-sm text-muted">
              The bar will be notified. No refund is issued for remaining listing days unless manually overridden.
            </p>
            <ModalActions
              busy={busy}
              onCancel={() => setModal(null)}
              onConfirm={handleRemove}
              confirmLabel="Remove Listing"
              tone="danger"
            />
          </div>
        </Modal>
      )}

      <div className="pointer-events-none fixed right-6 top-20 z-50 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-lg border border-[color:var(--color-border)] bg-surface px-4 py-3 shadow-card-md animate-[toastIn_0.2s_ease-out]"
          >
            <p className="text-sm font-semibold text-ink">{toast.message}</p>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

function KpiCard({
  tone,
  label,
  value,
  detail,
}: {
  tone: 'gold' | 'success' | 'info';
  label: string;
  value: string;
  detail: string;
}) {
  const borderTone =
    tone === 'gold'
      ? 'var(--color-accent)'
      : tone === 'success'
        ? 'var(--color-success)'
        : 'var(--color-info)';

  return (
    <div
      className="card-raised p-5"
      style={{ boxShadow: 'var(--shadow-sm)', borderLeft: `4px solid ${borderTone}` }}
    >
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-muted">{label}</p>
      <p className="mt-2 font-display text-4xl text-ink">{value}</p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}

function emptyForm(): ListingFormState {
  return {
    barId: '',
    barCity: '',
    slotType: 'CityTop',
    durationDays: '7',
    startDate: todayYmd(),
    scopeCity: '',
    scopeCategory: '',
    status: 'Active',
  };
}

function fromRow(row: AdminFeaturedListingRowDto): ListingFormState {
  return {
    barId: String(row.barId),
    barCity: row.city,
    slotType: row.slotType,
    durationDays: String(durationDays(row.startsAtUtc, row.endsAtUtc)),
    startDate: row.startsAtUtc.slice(0, 10),
    scopeCity: row.scopeCity ?? '',
    scopeCategory: row.scopeCategory ?? '',
    status: row.status,
  };
}

function priorityForSlot(slotType: string): number {
  switch (slotType) {
    case 'CityTop':
      return 10;
    case 'CategoryTop':
      return 20;
    case 'SearchBoost':
      return 30;
    default:
      return 40;
  }
}

function durationDays(startsAtUtc: string, endsAtUtc: string): number {
  const diff = new Date(endsAtUtc).getTime() - new Date(startsAtUtc).getTime();
  return Math.max(1, Math.round(diff / 86_400_000));
}

function formatDuration(startsAtUtc: string, endsAtUtc: string): string {
  return `${durationDays(startsAtUtc, endsAtUtc)} days`;
}

function formatCtr(clicks: number, impressions: number): string {
  if (impressions <= 0) return '0.0%';
  return `${((clicks / impressions) * 100).toFixed(1)}%`;
}

function ctrTone(clicks: number, impressions: number): string {
  if (impressions <= 0) return 'text-muted';
  const pct = (clicks / impressions) * 100;
  if (pct >= 3.5) return 'text-[color:var(--color-success)] font-semibold';
  if (pct >= 2) return 'text-[color:var(--color-accent-lo)] font-semibold';
  return 'text-muted';
}

function slotTone(slotType: string): BadgeTone {
  switch (slotType) {
    case 'CityTop':
      return 'warn';
    case 'CategoryTop':
      return 'info';
    case 'SearchBoost':
      return 'neutral';
    default:
      return 'success';
  }
}

function slotLabel(slotType: string): string {
  switch (slotType) {
    case 'CityTop':
      return 'Top of City';
    case 'CategoryTop':
      return 'Category Banner';
    case 'SearchBoost':
      return 'Search Boost';
    case 'Carousel':
      return 'Carousel';
    default:
      return slotType;
  }
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function toIsoStart(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: value >= 100000 ? 1 : 0,
  }).format(value);
}

function subscriptionCity(bar: AdminSubscriptionRowDto): string {
  const parts = bar.barName.split(/[-—]/);
  return parts.length > 1 ? parts[parts.length - 1].trim() : '';
}

function displayCity(row: AdminFeaturedListingRowDto): string {
  const scopeCity = row.scopeCity?.trim();
  if (scopeCity) return scopeCity;

  const city = row.city?.trim();
  if (city) return city;

  return '-';
}
