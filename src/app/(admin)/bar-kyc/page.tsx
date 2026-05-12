'use client';

import { useEffect, useState } from 'react';
import {
  Badge,
  type BadgeTone,
  ErrorBanner,
  PageHeader,
  RowAction,
  SkeletonRow,
  StatCard,
  Toolbar,
} from '@/components/ui';
import {
  ApiError,
  type BarKycQueueRowDto,
  listBarKycQueue,
} from '@/lib/admin-api';

type SlaStatus = 'SLA Breached' | 'Near SLA' | 'Within SLA';
type DocStatus = 'Pending' | 'Incomplete' | 'Approved' | 'Rejected' | 'ResubmitRequested';

const FILTER_OPTIONS = ['Rejected', 'Approved', 'Pending'] as const;

function deriveSlaStatus(hoursWaiting: number): SlaStatus {
  if (hoursWaiting > 48) return 'SLA Breached';
  if (hoursWaiting > 36) return 'Near SLA';
  return 'Within SLA';
}

function deriveDocStatus(row: BarKycQueueRowDto): DocStatus {
  if (row.kycStatus === 'Approved') return 'Approved';
  if (row.kycStatus === 'Rejected') return 'Rejected';
  if (row.kycStatus === 'ResubmitRequested') return 'ResubmitRequested';
  return row.docsUploaded < row.docsTotal ? 'Incomplete' : 'Pending';
}

function timeAgo(iso: string | null): string {
  if (!iso) return '-';
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

function slaTone(status: SlaStatus): BadgeTone {
  if (status === 'SLA Breached') return 'danger';
  if (status === 'Near SLA') return 'warn';
  return 'success';
}

function docTone(status: DocStatus): BadgeTone {
  switch (status) {
    case 'Approved':
      return 'success';
    case 'Rejected':
      return 'danger';
    case 'ResubmitRequested':
      return 'info';
    case 'Incomplete':
      return 'warn';
    default:
      return 'neutral';
  }
}

function docLabel(status: DocStatus): string {
  return status === 'ResubmitRequested' ? 'Resubmit' : status;
}

function rowTone(row: BarKycQueueRowDto): string {
  if (row.slaBreached) return 'bg-[color:var(--color-danger-tint)]/50';
  if (row.hoursWaiting >= 36) return 'bg-[color:var(--color-warn-tint)]/60';
  return '';
}

export default function BarKycQueuePage() {
  const [filter, setFilter] = useState('Rejected');
  const [pending, setPending] = useState<BarKycQueueRowDto[]>([]);
  const [approved, setApproved] = useState<BarKycQueueRowDto[]>([]);
  const [rejected, setRejected] = useState<BarKycQueueRowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, a, r] = await Promise.all([
          listBarKycQueue('PendingReview'),
          listBarKycQueue('Approved'),
          listBarKycQueue('Rejected'),
        ]);
        setPending(p);
        setApproved(a);
        setRejected(r);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load bar KYC queue');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const slaBreachedCount = pending.filter((row) => row.slaBreached).length;
  const processed = [...approved, ...rejected]
    .sort((a, b) => new Date(b.verifiedAt ?? 0).getTime() - new Date(a.verifiedAt ?? 0).getTime())
    .slice(0, 20);

  return (
    <>
      <PageHeader
        eyebrow="Compliance"
        title="Bar KYC Queue"
        subtitle="Review and approve bar registrations - 48-hour SLA, oldest first."
        actions={
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="font-numeric font-semibold text-ink">{pending.length}</span>
            <span className="uppercase tracking-wider">awaiting review</span>
          </div>
        }
      />

      <Toolbar>
        {/* <label htmlFor="bar-kyc-filter" className="text-xs font-semibold uppercase tracking-wider text-muted">
          Filter
        </label>
        <select
          id="bar-kyc-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="select max-w-[14rem]"
          aria-label="Filter by bar KYC status"
        >
          {FILTER_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select> */}
        <button type="button" className="btn btn-ghost btn-sm ml-auto">
          Export CSV
        </button>
      </Toolbar>

      {error && <div className="mb-4"><ErrorBanner>{error}</ErrorBanner></div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Pending Review"
          value={loading ? 0 : pending.length}
          delta={{
            value: slaBreachedCount > 0 ? `${slaBreachedCount} past 48h SLA` : 'All within SLA',
            positive: slaBreachedCount === 0,
          }}
          tone="gold"
          index={0}
        />
        <StatCard
          label="Approved Total"
          value={loading ? 0 : approved.length}
          delta={{ value: 'Verified bars', positive: true }}
          tone="success"
          index={1}
        />
        <StatCard
          label="Rejected Total"
          value={loading ? 0 : rejected.length}
          delta={{ value: 'Awaiting correction', positive: false }}
          tone="danger"
          index={2}
        />
      </div>

      <section className="card-raised overflow-hidden mb-6">
        <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <h2 className="font-display text-lg text-ink leading-snug">Applications Awaiting Review</h2>
            <p className="text-xs text-muted mt-0.5">
              {!loading ? `${pending.length} pending applications` : 'Loading pending applications'}
            </p>
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Bar Name</th>
                <th scope="col">City</th>
                <th scope="col">Owner</th>
                <th scope="col">Submitted</th>
                <th scope="col">SLA Status</th>
                <th scope="col">Documents</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}
              {!loading && pending.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-8">
                    No applications awaiting review.
                  </td>
                </tr>
              )}
              {!loading && pending.map((bar) => {
                const slaStatus = deriveSlaStatus(bar.hoursWaiting);
                const docStatus = deriveDocStatus(bar);
                const docsComplete = bar.docsUploaded >= bar.docsTotal;

                return (
                  <tr key={bar.barId} className={rowTone(bar)}>
                    <td>
                      <div className="font-semibold text-ink">{bar.businessName}</div>
                      <div className="text-xs text-muted">{bar.city}, {bar.stateCode}</div>
                    </td>
                    <td className="text-muted">{bar.city}</td>
                    <td className="text-muted">{bar.ownerFullName ?? bar.contactEmail}</td>
                    <td>
                      <span className={`font-numeric tabular-nums text-xs ${bar.slaBreached ? 'text-[color:var(--color-danger)] font-semibold' : 'text-muted'}`}>
                        {Math.floor(bar.hoursWaiting)}h ago
                      </span>
                    </td>
                    <td><Badge tone={slaTone(slaStatus)}>{slaStatus}</Badge></td>
                    <td>
                      <span className={`font-numeric text-xs font-semibold ${docsComplete ? 'text-[color:var(--color-success)]' : 'text-accent-lo'}`}>
                        {bar.docsUploaded} of {bar.docsTotal}
                      </span>
                    </td>
                    <td><Badge tone={docTone(docStatus)}>{docLabel(docStatus)}</Badge></td>
                    <td className="text-right">
                      {docStatus === 'Incomplete' ? (
                        <button type="button" className="btn btn-ghost btn-sm">
                          Send Reminder
                        </button>
                      ) : (
                        <RowAction href={`/bar-kyc/${bar.barId}`} label="Review" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-raised overflow-hidden">
        <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <h2 className="font-display text-lg text-ink leading-snug">Recently Processed</h2>
            <p className="text-xs text-muted mt-0.5">Latest approved and rejected bar applications.</p>
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Bar Name</th>
                <th scope="col">City</th>
                <th scope="col">Decision</th>
                <th scope="col">Decided</th>
                <th scope="col">Mobile</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}
              {!loading && processed.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-8">
                    No processed applications yet.
                  </td>
                </tr>
              )}
              {!loading && processed.map((bar) => {
                const approvedDecision = bar.kycStatus === 'Approved';

                return (
                  <tr key={bar.barId}>
                    <td className="font-semibold text-ink">{bar.businessName}</td>
                    <td className="text-muted">{bar.city}</td>
                    <td>
                      <Badge tone={approvedDecision ? 'success' : 'danger'}>
                        {approvedDecision ? 'Approved' : 'Rejected'}
                      </Badge>
                    </td>
                    <td className="text-muted font-numeric tabular-nums text-xs">{timeAgo(bar.verifiedAt)}</td>
                    <td className="text-muted font-mono text-xs">{bar.contactMobile}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
