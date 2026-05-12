'use client';

import { useState } from 'react';
import { RowAction } from '@/components/ui';

// ─── Types ────────────────────────────────────────────────────────────────────

type SlaStatus = 'SLA Breached' | 'Near SLA' | 'Within SLA';
type DocStatus = 'Pending' | 'Incomplete' | 'Approved' | 'Rejected';

type PendingBar = {
  id: number;
  barName: string;
  city: string;
  state: string;
  owner: string;
  submittedAgo: string;
  slaStatus: SlaStatus;
  docsUploaded: number;
  docsTotal: number;
  docsComplete: boolean;
  status: DocStatus;
};

type ProcessedBar = {
  id: number;
  barName: string;
  city: string;
  decision: 'Approved' | 'Rejected';
  decidedAgo: string;
  decidedBy: string;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const pendingBars: PendingBar[] = [
  { id: 1, barName: 'The Rooftop Bar', city: 'Pune', state: 'Maharashtra', owner: 'Vikrant Joshi', submittedAgo: '3 days ago', slaStatus: 'SLA Breached', docsUploaded: 3, docsTotal: 4, docsComplete: false, status: 'Pending' },
  { id: 2, barName: 'Craft & Co. Brewpub', city: 'Bengaluru', state: 'Karnataka', owner: 'Priya Nambiar', submittedAgo: '2 days ago', slaStatus: 'Near SLA', docsUploaded: 4, docsTotal: 4, docsComplete: true, status: 'Pending' },
  { id: 3, barName: 'Harbour Bar', city: 'Mumbai', state: 'Maharashtra', owner: 'Rohit Kapoor', submittedAgo: '18 hours ago', slaStatus: 'Within SLA', docsUploaded: 4, docsTotal: 4, docsComplete: true, status: 'Pending' },
  { id: 4, barName: 'The Underground', city: 'Hyderabad', state: 'Telangana', owner: 'Meena Reddy', submittedAgo: '6 hours ago', slaStatus: 'Within SLA', docsUploaded: 2, docsTotal: 4, docsComplete: false, status: 'Incomplete' },
  { id: 5, barName: 'Neon Nights Club', city: 'Delhi NCR', state: 'Delhi', owner: 'Suresh Arora', submittedAgo: '4 hours ago', slaStatus: 'Within SLA', docsUploaded: 4, docsTotal: 4, docsComplete: true, status: 'Pending' },
];

const processedBars: ProcessedBar[] = [
  { id: 6, barName: 'Skyline Lounge', city: 'Chennai', decision: 'Approved', decidedAgo: '1 hour ago', decidedBy: 'Admin: You' },
  { id: 7, barName: 'The Cave Bar', city: 'Goa', decision: 'Rejected', decidedAgo: 'Yesterday', decidedBy: 'Admin: Priya S.' },
  { id: 8, barName: 'Moonrise Lounge', city: 'Mumbai', decision: 'Approved', decidedAgo: 'Yesterday', decidedBy: 'Admin: Priya S.' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: number; sub: string; accent: 'orange' | 'green' | 'red' }) {
  const borderColor = accent === 'orange' ? '#f97316' : accent === 'green' ? '#22c55e' : '#ef4444';
  const subColor = accent === 'orange' ? '#f97316' : accent === 'green' ? '#22c55e' : '#ef4444';
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
    Pending:    { bg: '#f3f4f6', color: '#374151' },
    Incomplete: { bg: '#fffbeb', color: '#d97706' },
    Approved:   { bg: '#f0fdf4', color: '#16a34a' },
    Rejected:   { bg: '#fef2f2', color: '#ef4444' },
  };
  const s = styles[status];
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
      {status}
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
      {/* Inject Google Font */}
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
              <option>Rejected</option>
              <option>Approved</option>
              <option>Pending</option>
            </select>
            <button style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontWeight: 600, color: '#374151', background: '#fff', cursor: 'pointer' }}>
              Export CSV
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <StatCard label="Pending Review" value={7} sub="⚠ 2 past 48h SLA" accent="orange" />
          <StatCard label="Approved (MTD)" value={18} sub="↑ Avg review time: 14h" accent="green" />
          <StatCard label="Rejected (MTD)" value={5} sub="Expired licences (3), Unclear docs (2)" accent="red" />
        </div>

        {/* Applications Awaiting Review */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 24, overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px 0', borderBottom: '1px solid #f3f4f6' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Applications Awaiting Review</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
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
                {pendingBars.map((bar) => {
                  const isHovered = hoveredRow === bar.id;
                  const isSlaBreached = bar.slaStatus === 'SLA Breached';
                  const rowBg = isHovered
                    ? '#fff8f0'
                    : isSlaBreached
                    ? '#fffbf5'
                    : '#fff';

                  return (
                    <tr
                      key={bar.id}
                      onMouseEnter={() => setHoveredRow(bar.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{ background: rowBg, transition: 'background 0.15s' }}
                    >
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{bar.barName}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{bar.city}, {bar.state}</div>
                      </td>
                      <td style={tdStyle}>{bar.city}</td>
                      <td style={tdStyle}>{bar.owner}</td>
                      <td style={tdStyle}>
                        <span style={{ color: isSlaBreached ? '#ef4444' : '#374151' }}>
                          {bar.submittedAgo} {isSlaBreached && '⚠'}
                        </span>
                      </td>
                      <td style={tdStyle}><SlaBadge status={bar.slaStatus} /></td>
                      <td style={tdStyle}>
                        <span style={{ color: bar.docsComplete ? '#16a34a' : '#d97706', fontWeight: 500 }}>
                          {bar.docsUploaded} of {bar.docsTotal} {bar.docsComplete ? '✓' : ''}
                        </span>
                      </td>
                      <td style={tdStyle}><StatusBadge status={bar.status} /></td>
                      <td style={tdStyle} className="text-right">
                      {bar.status === 'Incomplete' ? (
                        <button style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13, fontWeight: 600, color: '#374151', background: '#fff', cursor: 'pointer' }}>
                          Send Reminder
                        </button>
                      ) : (
                        <RowAction href={`bar-kyc/${bar.id}`} />
                      )}
                    </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recently Processed */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px 0', borderBottom: '1px solid #f3f4f6' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Recently Processed</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th style={thStyle}>Bar Name</th>
                  <th style={thStyle}>City</th>
                  <th style={thStyle}>Decision</th>
                  <th style={thStyle}>Decided</th>
                  <th style={thStyle}>Decided By</th>
                </tr>
              </thead>
              <tbody>
                {processedBars.map((bar) => (
                  <tr
                    key={bar.id}
                    onMouseEnter={() => setHoveredRow(bar.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{ background: hoveredRow === bar.id ? '#f9fafb' : '#fff', transition: 'background 0.15s' }}
                  >
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{bar.barName}</td>
                    <td style={tdStyle}>{bar.city}</td>
                    <td style={tdStyle}><DecisionBadge decision={bar.decision} /></td>
                    <td style={{ ...tdStyle, color: '#6b7280' }}>{bar.decidedAgo}</td>
                    <td style={{ ...tdStyle, color: '#6b7280' }}>{bar.decidedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}