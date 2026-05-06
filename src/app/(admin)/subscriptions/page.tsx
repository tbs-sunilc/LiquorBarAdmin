'use client';

/**
 * SC-05 Subscription list.  Failed-payment rows render with a danger tint
 * so support can scan for churn risks at a glance.
 *
 * Clicking any row opens a detail slide-over that fetches the single record
 * via getSubscription(id) — same data shape, rendered with full field set.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ApiError,
  listSubscriptions,
  getSubscription,
  type AdminSubscriptionRowDto,
} from '@/lib/admin-api';
import {
  Badge,
  type BadgeTone,
  EmptyState,
  ErrorBanner,
  PageHeader,
  SkeletonRow,
  Toolbar,
} from '@/components/ui';

const STATUS_OPTIONS = [
  'All', 'Trial', 'Active', 'PastDue', 'GracePeriod', 'Cancelled', 'Expired', 'Paused',
] as const;

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminSubscriptionsPage() {
  const [status, setStatus]       = useState<string>('All');
  const [rows, setRows]           = useState<AdminSubscriptionRowDto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // Detail panel state
  const [selected, setSelected]   = useState<AdminSubscriptionRowDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError]     = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── List fetch ──────────────────────────────────────────────────────────────
  useEffect(() => {
    console.log('Loading subscriptions with status', status);
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const filter = status === 'All' ? undefined : status;
        setRows(await listSubscriptions(filter, 0, 50));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load subscriptions');
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  // ── Row click → fetch detail ────────────────────────────────────────────────
  const openDetail = async (row: AdminSubscriptionRowDto) => {
    // Optimistically show what we already have from the list
    setSelected(row);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const detail = await getSubscription(row.id);
      setSelected(detail);
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : 'Failed to load detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setDetailError(null);
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDetail(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Derived counts ──────────────────────────────────────────────────────────
  const atRisk = rows.filter(
    (r) => r.status === 'PastDue' || r.status === 'GracePeriod',
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Revenue"
        title="Bar subscriptions"
        subtitle="Platform-wide subscription view for support triage."
        actions={
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted">
            <span className="font-numeric font-semibold text-ink">{rows.length}</span> total
            </span>
            {atRisk > 0 && <Badge tone="danger" dot>{atRisk} at risk</Badge>}
          </div>
        }
      />

      <Toolbar>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="select max-w-[14rem]"
          aria-label="Filter by subscription status"
        >
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Toolbar>

      {error && <div className="mb-4"><ErrorBanner>{error}</ErrorBanner></div>}

      {!loading && rows.length === 0 && (
        <EmptyState icon="✓" title="Nothing here" description={`No subscriptions in ${status}.`} />
      )}

      {(loading || rows.length > 0) && (
        <div className="card-raised overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Bar</th>
                <th>Status</th>
                <th>Cycle</th>
                <th className="text-right">Price</th>
                <th>Period</th>
                <th className="text-right">Failures</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}

              {!loading && rows.map((r) => (
                <tr
                  key={r.id}
                  className={[
                    rowTone(r),
                    'cursor-pointer transition-opacity hover:opacity-80',
                    selected?.id === r.id ? 'ring-1 ring-inset ring-[color:var(--color-accent)]' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => openDetail(r)}
                  aria-label={`View details for ${r.barName}`}
                >
                  <td>
                    <div className="font-medium text-ink">{r.barName}</div>
                    <div className="text-xs text-muted font-mono">Bar #{r.barId}</div>
                  </td>
                  <td><Badge tone={subTone(r.status)}>{r.status}</Badge></td>
                  <td className="text-muted">{r.billingCycle}</td>
                  <td className="text-right font-numeric tabular-nums text-ink">
                    {formatInr(r.priceInPaiseAtSignup)}
                  </td>
                  <td className="text-xs text-muted font-numeric tabular-nums">
                    {fmtDate(r.currentPeriodStart)} → {fmtDate(r.currentPeriodEnd)}
                  </td>
                  <td className="text-right">
                    {r.failedPaymentCount > 0 ? (
                      <span className="font-numeric tabular-nums font-semibold text-[color:var(--color-danger)]">
                        {r.failedPaymentCount}
                      </span>
                    ) : (
                      <span className="font-numeric tabular-nums text-soft">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Detail slide-over ─────────────────────────────────────────────── */}
      {selected && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            aria-hidden
            onClick={closeDetail}
          />

          {/* Panel */}
          <aside
            ref={panelRef}
            role="dialog"
            aria-label={`Subscription detail — ${selected.barName}`}
            className="
              fixed right-0 top-0 z-50 h-full w-full max-w-md
              overflow-y-auto bg-[color:var(--color-surface)]
              shadow-2xl flex flex-col
              animate-[slideInRight_0.2s_ease-out]
            "
            style={{ animationFillMode: 'both' }}
          >
            {/* Panel header */}
            <div className="flex items-start justify-between gap-4 p-6 border-b border-[color:var(--color-border)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-0.5">
                  Subscription #{selected.id}
                </p>
                <h2 className="text-base font-semibold text-ink leading-snug">
                  {selected.barName}
                </h2>
                <p className="text-xs text-muted font-mono mt-0.5">Bar #{selected.barId}</p>
              </div>
              <button
                onClick={closeDetail}
                aria-label="Close detail panel"
                className="mt-0.5 shrink-0 rounded-md p-1.5 text-muted hover:text-ink hover:bg-[color:var(--color-hover)] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 p-6 space-y-6">
              {detailError && <ErrorBanner>{detailError}</ErrorBanner>}

              {/* Status & cycle */}
              <Section title="Plan">
                <Field label="Status">
                  <Badge tone={subTone(selected.status)}>{selected.status}</Badge>
                </Field>
                <Field label="Billing cycle">
                  <span className="text-ink">{selected.billingCycle}</span>
                </Field>
                <Field label="Price at signup">
                  <span className="font-numeric tabular-nums text-ink font-semibold">
                    {formatInr(selected.priceInPaiseAtSignup)}
                    <span className="text-muted font-normal">
                      /{selected.billingCycle === 'Yearly' ? 'yr' : 'mo'}
                    </span>
                  </span>
                </Field>
                <Field label="Started">
                  <span className="font-numeric tabular-nums text-ink">{fmtDate(selected.startedAt)}</span>
                </Field>
              </Section>

              {/* Billing period */}
              <Section title="Current period">
                <Field label="From">
                  <span className="font-numeric tabular-nums text-ink">{fmtDate(selected.currentPeriodStart)}</span>
                </Field>
                <Field label="To">
                  <span className="font-numeric tabular-nums text-ink">{fmtDate(selected.currentPeriodEnd)}</span>
                </Field>
                {selected.nextBillingAtUtc && (
                  <Field label="Next billing">
                    <span className="font-numeric tabular-nums text-ink">
                      {fmtDate(selected.nextBillingAtUtc)}
                    </span>
                  </Field>
                )}
                {selected.gracePeriodEndsAtUtc && (
                  <Field label="Grace period ends">
                    <span className="font-numeric tabular-nums font-semibold text-[color:var(--color-warning)]">
                      {fmtDate(selected.gracePeriodEndsAtUtc)}
                    </span>
                  </Field>
                )}
              </Section>

              {/* Payment health */}
              <Section title="Payment health">
                <Field label="Failed payments">
                  {selected.failedPaymentCount > 0 ? (
                    <span className="font-numeric tabular-nums font-semibold text-[color:var(--color-danger)]">
                      {selected.failedPaymentCount}
                    </span>
                  ) : (
                    <span className="font-numeric tabular-nums text-[color:var(--color-success)]">
                      0 — healthy
                    </span>
                  )}
                </Field>
                {selected.lastFailureReason && (
                  <Field label="Last failure reason">
                    <span className="text-[color:var(--color-danger)] text-xs leading-snug">
                      {selected.lastFailureReason}
                    </span>
                  </Field>
                )}
              </Section>

              {/* Plan ID (internal) */}
              <Section title="Internal">
                <Field label="Plan ID">
                  <span className="font-mono text-xs text-muted">{selected.subscriptionPlanId}</span>
                </Field>
                <Field label="Subscription ID">
                  <span className="font-mono text-xs text-muted">{selected.id}</span>
                </Field>
              </Section>
            </div>

            {/* Loading overlay */}
            {detailLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[color:var(--color-surface)]/60 backdrop-blur-[2px]">
                <svg className="animate-spin h-6 w-6 text-muted" viewBox="0 0 24 24" fill="none" aria-label="Loading">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
              </div>
            )}
          </aside>

          {/* Slide-in keyframe (injected once via style tag) */}
          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(100%); opacity: 0; }
              to   { transform: translateX(0);    opacity: 1; }
            }
          `}</style>
        </>
      )}
    </>
  );
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">{title}</p>
      <dl className="space-y-2.5">{children}</dl>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <dt className="text-muted shrink-0">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

// ─── Tone / format helpers ────────────────────────────────────────────────────

function rowTone(r: AdminSubscriptionRowDto): string {
  if (r.status === 'PastDue' || r.status === 'GracePeriod')
    return 'bg-[color:var(--color-danger-tint)]/40';
  if (r.status === 'Cancelled' || r.status === 'Expired') return 'opacity-60';
  return '';
}

function subTone(status: string): BadgeTone {
  switch (status) {
    case 'Active':      return 'success';
    case 'Trial':       return 'info';
    case 'PastDue':
    case 'GracePeriod': return 'danger';
    case 'Paused':      return 'warn';
    default:            return 'neutral';
  }
}

function formatInr(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
