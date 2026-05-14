'use client';

/**
 * SC-02 Admin Home. Fully dynamic dashboard with 8 KPI tiles,
 * GMV charts, city leaderboard, and live activity log.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ApiError,
  getAnalytics,
  type DailyGmvDto,
  type PlatformActivityDto,
  type PlatformAnalyticsDto,
} from '@/lib/admin-api';
import {
  Badge,
  Card,
  ErrorBanner,
  PageHeader,
  SkeletonCards,
  StatCard,
} from '@/components/ui';

export default function AdminHomePage() {
  const [data, setData] = useState<PlatformAnalyticsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const analytics = await getAnalytics();
        setData(analytics);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <div className="space-y-8">
      <PageHeader title="Platform Dashboard" subtitle="Loading platform snapshot…" />
      <SkeletonCards count={8} />
    </div>
  );

  if (error || !data) return (
    <div className="space-y-6">
      <PageHeader title="Platform Dashboard" />
      <ErrorBanner>{error || 'No data available'}</ErrorBanner>
    </div>
  );

  const attentionRequired = (data.kycPendingCount ?? 0) + (data.openDisputes ?? 0) + (data.paymentFailureCount ?? 0);

  return (
    <div className="space-y-6 pb-12">
      <header className="flex items-center justify-between gap-4">
        <PageHeader
          eyebrow="Real-time operations overview"
          title="Platform Dashboard"
          subtitle={<>Last updated <span className="font-numeric">just now</span></>}
        />
        <div className="flex items-center gap-3">
          <Badge tone="success" dot>All systems operational</Badge>
          <button className="btn btn-ghost bg-white shadow-sm text-xs font-semibold px-3 py-1.5 flex items-center gap-1.5 border border-[color:var(--color-border)]">
            <span>⚕</span> Health Report
          </button>
          <button className="btn btn-primary text-xs py-1.5 px-4 flex items-center gap-2">
            <span>📣</span> Broadcast
          </button>
        </div>
      </header>

      {attentionRequired > 0 && (
        <div role="alert" className="flex items-center justify-between gap-4 bg-[color:var(--color-danger-tint)]/40 border border-[color:var(--color-danger)]/20 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)] flex items-center justify-center text-lg">🚨</span>
            <p className="text-sm font-medium text-ink">
              <strong className="text-[color:var(--color-danger)] uppercase tracking-wider text-[0.7rem] mr-2">Action Required:</strong>
              {data.kycPendingCount} bar KYC applications pending &middot; {data.openDisputes} open disputes &middot; {data.paymentFailureCount} subscription payment failures
            </p>
          </div>
          <button className="btn btn-primary bg-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/90 text-white text-xs px-4 py-2">Review Now &rarr;</button>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          index={0}
          label="Platform GMV (MTD)"
          value={formatInr(data.gmvInPaise)}
          delta={{ value: `${data.gmvGrowthPercent ?? 0}% vs last month`, positive: (data.gmvGrowthPercent ?? 0) >= 0 }}
        />
        <StatCard
          index={1}
          label="Active Bars"
          value={(data.activeBarCount ?? 0).toLocaleString('en-IN')}
          delta={{ value: `${data.barGrowthCount ?? 0} new this month`, positive: true }}
          tone="success"
        />
        <StatCard
          index={2}
          label="Total Active Users"
          value={(data.uniqueCustomerCount ?? 0).toLocaleString('en-IN')}
          delta={{ value: `${data.customerGrowthCount ?? 0} new this month`, positive: (data.customerGrowthCount ?? 0) >= 0 }}
          tone="success"
        />
        <StatCard
          index={3}
          label="Active Wallets"
          value={(data.activeWalletCount ?? 0).toLocaleString('en-IN')}
          delta={{ value: `${data.walletGrowthCount ?? 0} this month`, positive: true }}
          tone="gold"
        />
        <StatCard
          index={4}
          label="Subscription MRR"
          value={formatInr(data.subscriptionMrrInPaise)}
          delta={{ value: `${data.mrrGrowthPercent ?? 0}% vs last month`, positive: (data.mrrGrowthPercent ?? 0) >= 0 }}
        />
        <StatCard
          index={5}
          label="Featured Listing Revenue"
          value={formatInr(data.featuredListingRevenueInPaise)}
          delta={{ value: `${data.activeFeaturedListings ?? 0} active listings`, positive: true }}
          tone="gold"
        />
        <StatCard
          index={6}
          label="Open Disputes"
          value={(data.openDisputes ?? 0).toLocaleString('en-IN')}
          delta={{ value: `${data.disputesPastSla ?? 0} past 48h SLA`, positive: false }}
          tone="danger"
        />
        <StatCard
          index={7}
          label="KYC Pending"
          value={(data.kycPendingCount ?? 0).toLocaleString('en-IN')}
          delta={{ value: `Awaiting review`, positive: true }}
          tone="warn"
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <Card
          title="Platform GMV — Last 7 Days"
          action={<button className="text-[0.7rem] font-bold uppercase tracking-widest text-muted hover:text-ink transition-colors border-b border-transparent hover:border-ink">Export</button>}
        >
          <GmvBarChart data={data.dailyGmv ?? []} />
        </Card>

        <Card title="Top Cities by GMV">
          <CityHorizontalBars cities={data.cityMap ?? []} />
        </Card>
      </div>

      {/* Recent Activity */}
      <Card
        title="Recent Platform Activity"
        action={<Link href="/logs" className="text-[0.7rem] font-bold uppercase tracking-widest text-muted hover:text-ink transition-colors border-b border-transparent hover:border-ink">View All Logs</Link>}
        className="overflow-hidden"
      >
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-strong/5 border-y border-[color:var(--color-border)]">
                <th className="px-5 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-muted">Time</th>
                <th className="px-5 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-muted">Event</th>
                <th className="px-5 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-muted">Actor</th>
                <th className="px-5 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-muted">Target</th>
                <th className="px-5 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-muted text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {(data.recentActivity ?? []).map((act, i) => (
                <tr key={i} className="hover:bg-strong/5 transition-colors group">
                  <td className="px-5 py-4 text-xs text-muted font-numeric">{act.timeAgo}</td>
                  <td className="px-5 py-4 text-sm font-medium text-ink">{act.event}</td>
                  <td className="px-5 py-4 text-xs text-muted">{act.actor}</td>
                  <td className="px-5 py-4 text-xs text-ink font-medium">{act.target}</td>
                  <td className="px-5 py-4 text-right">
                    <Badge tone={act.statusColor as any} dot>{act.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function GmvBarChart({ data }: { data: DailyGmvDto[] }) {
  // Use last 7 days from data
  const last7 = data.slice(-7);
  const max = Math.max(...last7.map(d => d.gmvInPaise), 1);

  return (
    <div className="mt-6 flex items-end justify-between gap-2 h-48">
      {last7.map((d, i) => {
        const height = (d.gmvInPaise / max) * 100;
        const day = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' });
        const isToday = i === last7.length - 1;
        
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center group relative h-full">
            <div className="absolute -top-8 bg-ink text-accent text-[0.65rem] font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl z-10">
              {formatInr(d.gmvInPaise)}
            </div>
            <div className="flex-1 w-full flex items-end">
              <div 
                className={`w-full rounded-t-sm transition-all duration-700 ease-out cursor-pointer hover:brightness-110 ${isToday ? 'bg-gradient-to-t from-[color:var(--color-success)] to-[color:var(--color-success-hi)] shadow-[0_0_20px_rgba(var(--color-success-rgb),0.3)]' : 'bg-[color:var(--color-accent-lo)]'}`}
                style={{ height: `${height}%` }}
              />
            </div>
            <span className={`mt-3 text-[0.65rem] font-bold uppercase tracking-wider ${isToday ? 'text-[color:var(--color-success)]' : 'text-muted'}`}>
              {isToday ? 'Today' : day}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CityHorizontalBars({ cities }: { cities: PlatformAnalyticsDto['cityMap'] }) {
  const top5 = [...cities].sort((a, b) => b.gmvInPaise - a.gmvInPaise).slice(0, 5);
  const max = Math.max(...top5.map(c => c.gmvInPaise), 1);

  return (
    <div className="mt-4 space-y-5">
      {top5.map((c) => (
        <div key={c.city} className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-ink">{c.city}</span>
            <span className="text-accent-lo font-numeric">{formatInr(c.gmvInPaise)}</span>
          </div>
          <div className="h-1.5 w-full bg-strong/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[color:var(--color-accent-lo)] to-[color:var(--color-accent)] transition-all duration-1000 ease-in-out" 
              style={{ width: `${(c.gmvInPaise / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatInr(paise: number): string {
  const rupees = (paise ?? 0) / 100;
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(2)}Cr`;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(2)}L`;
  return '₹' + rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
