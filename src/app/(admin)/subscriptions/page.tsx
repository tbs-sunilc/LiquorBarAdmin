'use client';

/**
 * SC-05 Subscription list.  Failed-payment rows render with a danger tint
 * so support can scan for churn risks at a glance.
 */

import { useEffect, useState } from 'react';
import { ApiError, listSubscriptions, type AdminSubscriptionRowDto } from '@/lib/admin-api';
import {
  Badge,
  type BadgeTone,
  EmptyState,
  ErrorBanner,
  PageHeader,
  SkeletonRow,
  Toolbar,
} from '@/components/ui';

const STATUS_OPTIONS = ['All', 'Trial', 'Active', 'PastDue', 'GracePeriod', 'Cancelled', 'Expired', 'Paused'] as const;

export default function AdminSubscriptionsPage() {
  const [status, setStatus] = useState<string>('All');
  const [rows, setRows] = useState<AdminSubscriptionRowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const filter = status === 'All' ? undefined : status;
        setRows(await listSubscriptions(filter, 0, 200));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load subscriptions');
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  const atRisk = rows.filter((r) => r.status === 'PastDue' || r.status === 'GracePeriod').length;

  return (
    <>
      <PageHeader
        eyebrow="Revenue"
        title="Bar subscriptions"
        subtitle="Platform-wide subscription view for support triage."
        actions={
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted"><span className="font-numeric font-semibold text-ink">{rows.length}</span> total</span>
            {atRisk > 0 && <Badge tone="danger" dot>{atRisk} at risk</Badge>}
          </div>
        }
      />

      <Toolbar>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="select max-w-[14rem]" aria-label="Filter by subscription status">
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
              {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}
              {!loading && rows.map((r) => (
                <tr key={r.id} className={rowTone(r)}>
                  <td>
                    <div className="font-medium text-ink">{r.barName}</div>
                    <div className="text-xs text-muted font-mono">Bar #{r.barId}</div>
                  </td>
                  <td><Badge tone={subTone(r.status)}>{r.status}</Badge></td>
                  <td className="text-muted">{r.billingCycle}</td>
                  <td className="text-right font-numeric tabular-nums text-ink">{formatInr(r.priceInPaiseAtSignup)}</td>
                  <td className="text-xs text-muted font-numeric tabular-nums">
                    {new Date(r.currentPeriodStart).toLocaleDateString()} → {new Date(r.currentPeriodEnd).toLocaleDateString()}
                  </td>
                  <td className="text-right">
                    {r.failedPaymentCount > 0 ? (
                      <span className="font-numeric tabular-nums font-semibold text-[color:var(--color-danger)]">{r.failedPaymentCount}</span>
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
    </>
  );
}

function rowTone(r: AdminSubscriptionRowDto): string {
  if (r.status === 'PastDue' || r.status === 'GracePeriod') return 'bg-[color:var(--color-danger-tint)]/40';
  if (r.status === 'Cancelled' || r.status === 'Expired') return 'opacity-60';
  return '';
}

function subTone(status: string): BadgeTone {
  switch (status) {
    case 'Active':       return 'success';
    case 'Trial':        return 'info';
    case 'PastDue':
    case 'GracePeriod':  return 'danger';
    case 'Paused':       return 'warn';
    default:             return 'neutral';
  }
}

function formatInr(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
