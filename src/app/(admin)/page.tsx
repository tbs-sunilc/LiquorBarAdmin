'use client';

/**
 * SC-02 Admin Home.  Urgent alert strip (SLA-breached KYC + open disputes)
 * above KPI tiles, with top-bars leaderboard and activity log below.
 */

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  getAnalytics,
  listDisputes,
  listKycQueue,
  type DisputeRowDto,
  type KycQueueRowDto,
  type PlatformAnalyticsDto,
} from '@/lib/admin-api';
import {
  Card,
  ErrorBanner,
  PageHeader,
  SkeletonCards,
  StatCard,
} from '@/components/ui';

export default function AdminHomePage() {
  const [data, setData] = useState<PlatformAnalyticsDto | null>(null);
  const [kyc, setKyc] = useState<KycQueueRowDto[]>([]);
  const [disputes, setDisputes] = useState<DisputeRowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [analytics, kycRows, openDisputes] = await Promise.all([
          getAnalytics(),
          listKycQueue('PendingReview', 0, 50),
          listDisputes(undefined, 0, 50),
        ]);
        setData(analytics);
        setKyc(kycRows);
        setDisputes(openDisputes);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const kycBreaches = useMemo(() => kyc.filter((k) => k.slaBreached), [kyc]);
  const disputeBreaches = useMemo(
    () => disputes.filter((d) => d.slaBreached && (d.status === 'Open' || d.status === 'UnderReview')),
    [disputes],
  );
  const openDisputeCount = disputes.filter((d) => d.status === 'Open' || d.status === 'UnderReview').length;

  return (
    <>
      <PageHeader
        eyebrow="Operator Console"
        title="Platform Dashboard"
        subtitle={
          data
            ? <>Rolling 30 days · <span className="font-mono tabular-nums">{data.fromDate}</span> → <span className="font-mono tabular-nums">{data.toDate}</span></>
            : 'Loading platform snapshot…'
        }
      />

      {(kycBreaches.length > 0 || disputeBreaches.length > 0) && (
        <div
          role="alert"
          className="mb-8 card-raised border-l-4 border-l-[color:var(--color-danger)] bg-[color:var(--color-danger-tint)]/40 p-5"
        >
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-0.5 text-[color:var(--color-danger)] text-xl">⚠︎</span>
            <div className="flex-1">
              <p className="font-display text-lg text-ink">Attention required</p>
              <ul className="mt-2 space-y-1 text-sm text-ink">
                {kycBreaches.length > 0 && (
                  <li>
                    <strong className="font-numeric">{kycBreaches.length}</strong> KYC submission{kycBreaches.length === 1 ? '' : 's'} past the 48-hour SLA.{' '}
                    <Link href="/kyc" className="text-accent-lo font-semibold hover:text-accent-hi underline underline-offset-2">Review →</Link>
                  </li>
                )}
                {disputeBreaches.length > 0 && (
                  <li>
                    <strong className="font-numeric">{disputeBreaches.length}</strong> dispute{disputeBreaches.length === 1 ? '' : 's'} past SLA deadline.{' '}
                    <Link href="/disputes" className="text-accent-lo font-semibold hover:text-accent-hi underline underline-offset-2">Resolve →</Link>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {error && <div className="mb-6"><ErrorBanner>{error}</ErrorBanner></div>}

      {loading && <SkeletonCards count={4} />}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard index={0} tone="gold" label="GMV (30d)" value={formatInr(data.gmvInPaise)} icon="₹" />
            <StatCard index={1} label="Transactions" value={data.transactionCount.toLocaleString('en-IN')} />
            <StatCard index={2} label="Unique customers" value={data.uniqueCustomerCount.toLocaleString('en-IN')} />
            <StatCard index={3} label="Active bars" value={data.activeBarCount.toLocaleString('en-IN')} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
            <Card
              title="Top bars by GMV"
              subtitle="Ranked by 30-day gross merchandise value"
            >
              {data.topBars.length === 0 ? (
                <p className="text-sm text-muted py-4">No paid transactions in this window.</p>
              ) : (
                <ol className="divide-y divide-[color:var(--color-border)]">
                  {data.topBars.map((b, i) => (
                    <li
                      key={b.barId}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-full bg-ink text-accent font-display text-xs flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-ink truncate">{b.barName}</p>
                          <p className="text-xs text-muted">{b.city}, {b.stateCode}</p>
                        </div>
                      </div>
                      <span className="font-display text-lg text-accent-lo font-numeric whitespace-nowrap">
                        {formatInr(b.gmvInPaise)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card title="Activity pulse">
              <ul className="space-y-3 text-sm">
                <LogLine tone="warn" count={kyc.length} label={`KYC submission${kyc.length === 1 ? '' : 's'} pending review`} />
                <LogLine tone="danger" count={openDisputeCount} label={`open dispute${openDisputeCount === 1 ? '' : 's'}`} />
                <LogLine tone="success" count={data.activeBarCount} label="active bars serving customers" />
              </ul>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

function LogLine({ tone, count, label }: { tone: 'warn' | 'danger' | 'success'; count: number; label: string }) {
  const color =
    tone === 'danger' ? 'var(--color-danger)'
    : tone === 'warn'   ? 'var(--color-accent)'
    : 'var(--color-success)';
  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: color, boxShadow: `0 0 0 4px color-mix(in srgb, ${color} 15%, transparent)` }}
      />
      <span className="font-numeric font-semibold text-ink tabular-nums">{count}</span>
      <span className="text-muted">{label}</span>
    </li>
  );
}

function formatInr(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(2)}Cr`;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(2)}L`;
  return '₹' + rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
