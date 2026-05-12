'use client';

import { useEffect, useState } from 'react';
import { RowAction } from '@/components/ui';
import {
  ApiError,
  type BarKycQueueRowDto,
  listBarKycQueue,
} from '@/lib/admin-api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type SlaStatus = 'SLA Breached' | 'Near SLA' | 'Within SLA';
type DocStatus = 'Pending' | 'Incomplete' | 'Approved' | 'Rejected' | 'ResubmitRequested';

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
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: number; sub: string; accent: 'orange' | 'green' | 'red' }) {
  const borderColor = accent === 'orange' ? '#f97316' : accent === 'green' ? '#22c55e' : '#ef4444';
  const subColor    = accent === 'orange' ? '#f97316' : accent === 'green' ? '#22c55e' : '#ef4444';
  return (
    <div style={{ borderLeft: `4px solid ${borderColor}`, background: '#fff', borderRadius: 12, padding: '20px 24px', flex: 1, minWidth: 200, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 36, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 12, color: subColor, marginTop: 6 }}>{sub}</p>
    </div>
  );
}

function SlaBadge({ status }: { status: SlaStatus }) {
  const styles: Record<SlaStatus, { bg: string; color: string }> = {
    'SLA Breached': { bg: '#fef2f2', color: '#ef4444' },
    'Near SLA':     { bg: '#fffbeb', color: '#d97706' },
    'Within SLA':   { bg: '#f0fdf4', color: '#16a34a' },
  };
  const s = styles[status];
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600, border: `1px solid ${s.color}33` }}>
      {status}
    </span>
  );
}

function StatusBadge({ status }: { status: DocStatus }) {
  const styles: Record<DocStatus, { bg: string; color: string }> = {
    Pending:            { bg: '#f3f4f6', color: '#374151' },
    Incomplete:         { bg: '#fffbeb', color: '#d97706' },
    Approved:           { bg: '#f0fdf4', color: '#16a34a' },
    Rejected:           { bg: '#fef2f2', color: '#ef4444' },
    ResubmitRequested:  { bg: '#eff6ff', color: '#2563eb' },
  };
  const s = styles[status];
  const label = status === 'ResubmitRequested' ? 'Resubmit' : status;
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
      {label}
    </span>
  );
}

function DecisionBadge({ decision }: { decision: 'Approved' | 'Rejected' }) {
  return (
    <span style={{
      background: decision === 'Approved' ? '#f0fdf4' : '#fef2f2',
      color: decision === 'Approved' ? '#16a34a' : '#ef4444',
      borderRadius: 20, padding: '3px 14px', fontSize: 12, fontWeight: 600,
      border: `1px solid ${decision === 'Approved' ? '#bbf7d0' : '#fecaca'}`,
    }}>
      {decision === 'Approved' ? '✓ Approved' : '✗ Rejected'}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BarKycQueuePage() {
  const [filter, setFilter] = useState('Rejected');
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const [pending,   setPending]   = useState<BarKycQueueRowDto[]>([]);
  const [approved,  setApproved]  = useState<BarKycQueueRowDto[]>([]);
  const [rejected,  setRejected]  = useState<BarKycQueueRowDto[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

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

  const slaBreachedCount = pending.filter(r => r.slaBreached).length;

  // "Recently Processed" combines approved + rejected, most recently verified first
  const processed = [...approved, ...rejected]
    .sort((a, b) => new Date(b.verifiedAt ?? 0).getTime() - new Date(a.verifiedAt ?? 0).getTime())
    .slice(0, 20);

  const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#9ca3af',
    borderBottom: '1px solid #f3f4f6',
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: '14px 16px',
    fontSize: 14,
    color: '#111827',
    borderBottom: '1px solid #f9fafb',
    verticalAlign: 'middle',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Bar KYC Queue</h1>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Review and approve bar registrations</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none' }}
            >
              <option value="Rejected">Rejected</option>
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
            </select>
            <button style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontWeight: 600, color: '#374151', background: '#fff', cursor: 'pointer' }}>
              Export CSV
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#dc2626', fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Stat Cards */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <StatCard
            label="Pending Review"
            value={loading ? 0 : pending.length}
            sub={slaBreachedCount > 0 ? `⚠ ${slaBreachedCount} past 48h SLA` : 'All within SLA'}
            accent="orange"
          />
          <StatCard
            label="Approved (total)"
            value={loading ? 0 : approved.length}
            sub="Verified bars"
            accent="green"
          />
          <StatCard
            label="Rejected (total)"
            value={loading ? 0 : rejected.length}
            sub="Awaiting correction"
            accent="red"
          />
        </div>

        {/* Applications Awaiting Review */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 24, overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px 0', borderBottom: '1px solid #f3f4f6' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>
              Applications Awaiting Review
              {!loading && <span style={{ fontSize: 13, fontWeight: 400, color: '#6b7280', marginLeft: 8 }}>({pending.length})</span>}
            </h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <p style={{ padding: 24, color: '#6b7280', fontSize: 14 }}>Loading…</p>
            ) : pending.length === 0 ? (
              <p style={{ padding: 24, color: '#6b7280', fontSize: 14 }}>No applications awaiting review.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th style={thStyle}>Bar Name</th>
                    <th style={thStyle}>City</th>
                    <th style={thStyle}>Owner</th>
                    <th style={thStyle}>Submitted</th>
                    <th style={thStyle}>SLA Status</th>
                    <th style={thStyle}>Documents</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((bar) => {
                    const slaStatus   = deriveSlaStatus(bar.hoursWaiting);
                    const docStatus   = deriveDocStatus(bar);
                    const isHovered   = hoveredRow === bar.barId;
                    const isSlaBreached = bar.slaBreached;
                    const rowBg = isHovered ? '#fff8f0' : isSlaBreached ? '#fffbf5' : '#fff';

                    return (
                      <tr
                        key={bar.barId}
                        onMouseEnter={() => setHoveredRow(bar.barId)}
                        onMouseLeave={() => setHoveredRow(null)}
                        style={{ background: rowBg, transition: 'background 0.15s' }}
                      >
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, color: '#111827' }}>{bar.businessName}</div>
                          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{bar.city}, {bar.stateCode}</div>
                        </td>
                        <td style={tdStyle}>{bar.city}</td>
                        <td style={tdStyle}>{bar.ownerFullName ?? bar.contactEmail}</td>
                        <td style={tdStyle}>
                          <span style={{ color: isSlaBreached ? '#ef4444' : '#374151' }}>
                            {Math.floor(bar.hoursWaiting)}h ago {isSlaBreached && '⚠'}
                          </span>
                        </td>
                        <td style={tdStyle}><SlaBadge status={slaStatus} /></td>
                        <td style={tdStyle}>
                          <span style={{ color: bar.docsUploaded >= bar.docsTotal ? '#16a34a' : '#d97706', fontWeight: 500 }}>
                            {bar.docsUploaded} of {bar.docsTotal} {bar.docsUploaded >= bar.docsTotal ? '✓' : ''}
                          </span>
                        </td>
                        <td style={tdStyle}><StatusBadge status={docStatus} /></td>
                        <td style={tdStyle} className="text-right">
                          {docStatus === 'Incomplete' ? (
                            <button style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13, fontWeight: 600, color: '#374151', background: '#fff', cursor: 'pointer' }}>
                              Send Reminder
                            </button>
                          ) : (
                            <RowAction href={`bar-kyc/${bar.barId}`} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recently Processed */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px 0', borderBottom: '1px solid #f3f4f6' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Recently Processed</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <p style={{ padding: 24, color: '#6b7280', fontSize: 14 }}>Loading…</p>
            ) : processed.length === 0 ? (
              <p style={{ padding: 24, color: '#6b7280', fontSize: 14 }}>No processed applications yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th style={thStyle}>Bar Name</th>
                    <th style={thStyle}>City</th>
                    <th style={thStyle}>Decision</th>
                    <th style={thStyle}>Decided</th>
                    <th style={thStyle}>Mobile</th>
                  </tr>
                </thead>
                <tbody>
                  {processed.map((bar) => (
                    <tr
                      key={bar.barId}
                      onMouseEnter={() => setHoveredRow(bar.barId)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{ background: hoveredRow === bar.barId ? '#f9fafb' : '#fff', transition: 'background 0.15s' }}
                    >
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{bar.businessName}</td>
                      <td style={tdStyle}>{bar.city}</td>
                      <td style={tdStyle}>
                        <DecisionBadge decision={bar.kycStatus === 'Approved' ? 'Approved' : 'Rejected'} />
                      </td>
                      <td style={{ ...tdStyle, color: '#6b7280' }}>{timeAgo(bar.verifiedAt)}</td>
                      <td style={{ ...tdStyle, color: '#6b7280' }}>{bar.contactMobile}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
