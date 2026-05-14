'use client';

/**
 * SC-12 Platform Analytics.  City bubbles + top-bars leaderboard + KPIs.
 * The bubble grid is a deliberate simplification — full leaflet/mapbox
 * integration ships in Phase 10.
 */

import { useEffect, useState } from 'react';
import { ApiError, getAnalytics, type PlatformAnalyticsDto } from '@/lib/admin-api';
import {
  Card,
  ErrorBanner,
  PageHeader,
  SkeletonCards,
  StatCard,
} from '@/components/ui';

export default function AnalyticsPage() {
  const [data, setData] = useState<PlatformAnalyticsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try { setData(await getAnalytics()); }
      catch (err) { setError(err instanceof ApiError ? err.message : 'Failed to load analytics'); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Insight"
        title="Platform analytics"
        subtitle={
          data
            ? <>Rolling 30 days · <span className="font-mono">{data.fromDate}</span> → <span className="font-mono">{data.toDate}</span></>
            : 'Loading…'
        }
      />

      {error && <div className="mb-4"><ErrorBanner>{error}</ErrorBanner></div>}

      {loading && <SkeletonCards count={4} />}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard index={0} tone="gold" label="GMV" value={formatInr(data.gmvInPaise)} icon="₹" />
            <StatCard index={1} label="Transactions" value={(data.transactionCount ?? 0).toLocaleString('en-IN')} />
            <StatCard index={2} label="Unique customers" value={(data.uniqueCustomerCount ?? 0).toLocaleString('en-IN')} />
            <StatCard index={3} label="Active bars" value={(data.activeBarCount ?? 0).toLocaleString('en-IN')} />
          </div>

          <div className="grid lg:grid-cols-[1fr_22rem] gap-4">
            <Card title="City bubble map" subtitle="Bubble area is proportional to bar count.">
              <CityBubbleGrid cities={data.cityMap} />
            </Card>

            <Card title="Top bars leaderboard" subtitle="Ranked by 30-day GMV">
              {data.topBars.length === 0 ? (
                <p className="text-sm text-muted">No paid transactions yet.</p>
              ) : (
                <ol className="divide-y divide-[color:var(--color-border)]">
                  {data.topBars.map((b, i) => (
                    <li key={b.barId} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-full bg-ink text-accent font-display text-xs flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{b.barName}</p>
                          <p className="text-[0.7rem] text-muted">{b.city}, {b.stateCode}</p>
                        </div>
                      </div>
                      <span className="font-numeric font-bold text-accent-lo whitespace-nowrap text-sm">
                        {formatInr(b.gmvInPaise)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}

function CityBubbleGrid({ cities }: { cities: PlatformAnalyticsDto['cityMap'] }) {
  if (cities.length === 0) {
    return <div className="h-48 flex items-center justify-center text-muted text-sm">No active bars yet.</div>;
  }
  const maxCount = Math.max(...cities.map((c) => c.barCount));
  return (
    <div
      className="flex flex-wrap items-end gap-5 min-h-[14rem] py-4"
      role="list"
      aria-label="City bubble distribution"
    >
      {cities.map((c, i) => {
        const ratio = c.barCount / maxCount;
        const size = 36 + Math.round(ratio * 80);
        return (
          <div
            key={c.city + c.stateCode}
            role="listitem"
            className="flex flex-col items-center gap-1.5 reveal"
            style={{ ['--index' as string]: i }}
            title={`${c.city} · ${c.barCount} bar${c.barCount === 1 ? '' : 's'} · ${formatInr(c.gmvInPaise)}`}
          >
            <div
              className="rounded-full flex items-center justify-center text-[0.7rem] font-display font-medium text-ink shadow-card"
              style={{
                width: size,
                height: size,
                background: `radial-gradient(circle at 30% 25%, var(--color-accent-hi), var(--color-accent-lo))`,
                boxShadow: `0 8px 20px -8px rgb(184 134 11 / ${0.25 + ratio * 0.5})`,
              }}
            >
              {c.barCount}
            </div>
            <span className="text-[0.7rem] text-muted">{c.city}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatInr(paise: number): string {
  const rupees = (paise ?? 0) / 100;
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(2)}Cr`;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(2)}L`;
  return '₹' + rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
