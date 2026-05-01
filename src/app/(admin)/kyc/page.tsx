'use client';

/**
 * SC-03 KYC Queue.
 *
 * Row background encodes SLA state:
 *   - default    : waiting < 36h (comfortable)
 *   - warn tint  : 36–48h
 *   - danger     : > 48h (SLA breached)
 */

import { useEffect, useState } from 'react';
import { ApiError, listKycQueue, type KycQueueRowDto } from '@/lib/admin-api';
import {
  Badge,
  EmptyState,
  ErrorBanner,
  PageHeader,
  RowAction,
  SkeletonRow,
  Toolbar,
} from '@/components/ui';

const STATUS_OPTIONS = ['PendingReview', 'Pending', 'Approved', 'Rejected', 'PermanentlyRejected'] as const;

export default function KycQueuePage() {
  const [status, setStatus] = useState<string>('PendingReview');
  const [rows, setRows] = useState<KycQueueRowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true); setError(null);
        setRows(await listKycQueue(status, 0, 100));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load queue');
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  return (
    <>
      <PageHeader
        eyebrow="Compliance"
        title="KYC Queue"
        subtitle="Customer document review — 48-hour SLA, oldest first."
        actions={
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="font-numeric font-semibold text-ink">{rows.length}</span>
            <span className="uppercase tracking-wider">in {status}</span>
          </div>
        }
      />

      <Toolbar>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted">Filter</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="select max-w-[14rem]"
          aria-label="Filter by KYC status"
        >
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Toolbar>

      {error && <div className="mb-4"><ErrorBanner>{error}</ErrorBanner></div>}

      {!loading && rows.length === 0 && (
        <EmptyState
          icon="✓"
          title="Queue clear"
          description={`No applications currently in ${status}.`}
        />
      )}

      {(loading || rows.length > 0) && (
        <div className="card-raised overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Document</th>
                <th scope="col">Submitted</th>
                <th scope="col" className="text-right">Waiting</th>
                <th scope="col" className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}
              {!loading && rows.map((r) => (
                <tr key={r.userId} className={rowTone(r)}>
                  <td>
                    <div className="font-semibold text-ink">{r.fullName ?? '—'}</div>
                    <div className="text-xs text-muted font-mono">{r.mobileNumber}</div>
                  </td>
                  <td className="text-muted">{r.kycDocType ?? '—'}</td>
                  <td className="text-muted font-numeric tabular-nums text-xs">
                    {r.kycSubmittedAtUtc ? new Date(r.kycSubmittedAtUtc).toLocaleString() : '—'}
                  </td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-2 justify-end">
                      <span className="font-numeric tabular-nums text-ink">
                        {r.hoursWaiting != null ? `${r.hoursWaiting}h` : '—'}
                      </span>
                      {r.slaBreached && <Badge tone="danger">SLA</Badge>}
                    </div>
                  </td>
                  <td className="text-right">
                    <RowAction href={`/kyc/${r.userId}`} label="Review" />
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

function rowTone(r: KycQueueRowDto): string {
  if (r.slaBreached) return 'bg-[color:var(--color-danger-tint)]/50';
  if (r.hoursWaiting != null && r.hoursWaiting >= 36) return 'bg-[color:var(--color-warn-tint)]/60';
  return '';
}
