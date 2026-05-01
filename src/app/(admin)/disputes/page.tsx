'use client';

import { useEffect, useState } from 'react';
import { ApiError, listDisputes, type DisputeRowDto } from '@/lib/admin-api';
import {
  Badge,
  type BadgeTone,
  EmptyState,
  ErrorBanner,
  PageHeader,
  RowAction,
  SkeletonRow,
  Toolbar,
} from '@/components/ui';

const STATUS_OPTIONS = ['All', 'Open', 'UnderReview', 'Resolved', 'Rejected', 'Escalated'] as const;

export default function DisputesPage() {
  const [status, setStatus] = useState<string>('All');
  const [rows, setRows] = useState<DisputeRowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const filter = status === 'All' ? undefined : status;
        setRows(await listDisputes(filter, 0, 200));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load disputes');
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  const breached = rows.filter((d) => d.slaBreached && (d.status === 'Open' || d.status === 'UnderReview')).length;

  return (
    <>
      <PageHeader
        eyebrow="Resolution"
        title="Disputes"
        subtitle="Customer complaints requiring resolution within SLA."
        actions={
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted"><span className="font-numeric font-semibold text-ink">{rows.length}</span> total</span>
            {breached > 0 && <Badge tone="danger" dot>{breached} SLA breached</Badge>}
          </div>
        }
      />

      <Toolbar>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="select max-w-[14rem]" aria-label="Filter by dispute status">
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Toolbar>

      {error && <div className="mb-4"><ErrorBanner>{error}</ErrorBanner></div>}

      {!loading && rows.length === 0 && (
        <EmptyState icon="✓" title="Nothing to resolve" description={`No disputes in ${status}.`} />
      )}

      {(loading || rows.length > 0) && (
        <div className="card-raised overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Bar</th>
                <th>Type</th>
                <th>Status</th>
                <th>SLA</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}
              {!loading && rows.map((r) => {
                const open = r.status === 'Open' || r.status === 'UnderReview';
                return (
                  <tr key={r.id} className={r.slaBreached && open ? 'bg-[color:var(--color-danger-tint)]/50' : ''}>
                    <td className="text-ink font-mono text-xs">{r.userMobile}</td>
                    <td className="text-ink font-medium">{r.barName}</td>
                    <td className="text-muted">{r.disputeType}</td>
                    <td><Badge tone={disputeTone(r.status)}>{r.status}</Badge></td>
                    <td className="font-numeric text-xs tabular-nums text-muted">
                      <div className="flex items-center gap-2">
                        <span>{new Date(r.slaDeadlineAtUtc).toLocaleDateString()}</span>
                        {r.slaBreached && open && <Badge tone="danger">Breached</Badge>}
                      </div>
                    </td>
                    <td className="text-right"><RowAction href={`/disputes/${r.id}`} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function disputeTone(status: string): BadgeTone {
  switch (status) {
    case 'Resolved':    return 'success';
    case 'Rejected':    return 'danger';
    case 'UnderReview': return 'info';
    case 'Escalated':   return 'warn';
    default:            return 'neutral';
  }
}
