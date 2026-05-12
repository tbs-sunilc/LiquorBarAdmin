'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  BackLink,
  Badge,
  type BadgeTone,
  Card,
  Modal,
  ModalActions,
} from '@/components/ui';

// ─── Types ────────────────────────────────────────────────────────────────────

type DocVerdict = 'Valid' | 'Invalid' | 'Unclear';

type Document = {
  id: string;
  label: string;
  fileName: string | null;
  verdict: DocVerdict;
};

// ─── Mock Data (replace with real API call) ───────────────────────────────────

const mockBar = {
  id: 1,
  barName: 'The Rooftop Bar',
  city: 'Pune',
  state: 'Maharashtra',
  owner: 'Vikrant Joshi',
  email: 'vikrant@rooftop.in',
  mobile: '+91 98123 45678',
  address: 'Level 9, Icon Tower, Baner, Pune 411045',
  gstin: '27AAPFU0939F1ZV',
  gstinVerified: true,
  openingHours: '6:00 PM – 1:00 AM',
  submittedAgo: '3 days ago',
  slaStatus: 'Breached' as 'Breached' | 'Near' | 'OK',
  slaDetail: 'Breached by 1 day · Submitted 3 days ago · 48h SLA',
  docsUploaded: 3,
  docsTotal: 4,
  docsMissingLabel: 'Bar photos missing',
  kycStatus: 'PendingReview',
};

const mockDocs: Document[] = [
  { id: 'liquor',  label: 'State Liquor Licence',  fileName: 'Maharashtra_LQ_2024_08821.pdf', verdict: 'Valid' },
  { id: 'fssai',   label: 'FSSAI Certificate',     fileName: 'FSSAI_2024_cert.pdf',           verdict: 'Valid' },
  { id: 'gstin',   label: 'GSTIN Certificate',     fileName: 'GST_certificate.pdf',           verdict: 'Valid' },
  { id: 'photos',  label: 'Bar Photos',             fileName: null,                            verdict: 'Unclear' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ModalState = 'approve' | 'reject' | 'resubmit' | null;

function verdictBadge(v: DocVerdict, missing: boolean) {
  if (missing) return <span className="badge badge-danger">Missing</span>;
  const map: Record<DocVerdict, { tone: BadgeTone; label: string }> = {
    Valid:   { tone: 'success', label: 'Valid ✓' },
    Invalid: { tone: 'danger',  label: 'Invalid ✗' },
    Unclear: { tone: 'warn',    label: '? Unclear' },
  };
  const { tone, label } = map[v];
  return <Badge tone={tone}>{label}</Badge>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BarKycDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const barId = Number(params.id);

  // In production replace with useEffect + API call using barId
  const bar = mockBar;
  const [docs, setDocs] = useState<Document[]>(mockDocs);
  const [adminNote, setAdminNote] = useState('Bar photos missing — sent reminder email to vikrant@rooftop.in on Apr 9. Owner confirmed uploading within 24h. Liquor licence valid until Mar 2025.');
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [resubmitReason, setResubmitReason] = useState('');
  const [rejectPermanent, setRejectPermanent] = useState(false);

  const closed = bar.kycStatus === 'Approved' || bar.kycStatus === 'PermanentlyRejected';

  function updateVerdict(docId: string, v: DocVerdict) {
    setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, verdict: v } : d));
  }

  async function handleApprove() {
    setBusy(true);
    // TODO: call approveBar(barId) API
    setTimeout(() => { setBusy(false); setModal(null); router.push('/bar-kyc'); }, 800);
  }

  async function handleReject() {
    setBusy(true);
    // TODO: call rejectBar(barId, rejectReason, rejectPermanent) API
    setTimeout(() => { setBusy(false); setModal(null); router.push('/bar-kyc'); }, 800);
  }

  async function handleResubmit() {
    setBusy(true);
    // TODO: call resubmitBar(barId, resubmitReason) API
    setTimeout(() => { setBusy(false); setModal(null); router.push('/bar-kyc'); }, 800);
  }

  const slaBorderColor = bar.slaStatus === 'Breached' ? 'var(--color-danger)' : bar.slaStatus === 'Near' ? 'var(--color-accent)' : 'var(--color-success)';
  const slaTextColor   = bar.slaStatus === 'Breached' ? 'var(--color-danger)' : bar.slaStatus === 'Near' ? 'var(--color-accent)' : 'var(--color-success)';

  return (
    <>
      {/* ── Top bar ── */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <BackLink href="/bar-kyc">Back to Queue</BackLink>
          <h1 className="font-display text-2xl text-ink mt-1">
            KYC Review — {bar.barName}
          </h1>
          <p className="text-sm text-muted mt-1">
            {bar.city}, {bar.state} · Submitted {bar.submittedAgo}
            {bar.slaStatus === 'Breached' && (
              <span className="ml-2 text-[color:var(--color-danger)]">⚠ SLA Breached</span>
            )}
          </p>
        </div>

        {!closed && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setModal('approve')}
              className="btn"
              style={{ background: 'var(--color-success)', color: '#fff', border: 'none' }}
            >
              ✓ Approve Bar
            </button>
            <button
              onClick={() => setModal('reject')}
              className="btn"
              style={{ background: 'var(--color-danger)', color: '#fff', border: 'none' }}
            >
              ✗ Reject Bar
            </button>
            <button
              onClick={() => setModal('resubmit')}
              className="btn"
              style={{ background: 'var(--color-accent)', color: 'var(--color-ink)', border: 'none' }}
            >
              ↻ Request Resubmission
            </button>
          </div>
        )}
      </div>

      {/* ── 3 stat cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* SLA */}
        <div style={{ borderLeft: `4px solid ${slaBorderColor}`, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', boxShadow: 'var(--shadow-xs)' }}>
          <p className="text-xs text-muted uppercase tracking-widest font-semibold mb-2">SLA Status</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: slaTextColor }}>
            {bar.slaStatus === 'Breached' ? 'Breached by 1 day' : bar.slaStatus === 'Near' ? 'Near SLA' : 'Within SLA'}
          </p>
          <p className="text-xs text-muted mt-1">{bar.slaDetail}</p>
        </div>

        {/* Documents */}
        <div style={{ borderLeft: '4px solid var(--color-accent)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', boxShadow: 'var(--shadow-xs)' }}>
          <p className="text-xs text-muted uppercase tracking-widest font-semibold mb-2">Documents</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>{bar.docsUploaded} / {bar.docsTotal}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-accent)' }}>{bar.docsMissingLabel}</p>
        </div>

        {/* Applicant */}
        <div style={{ borderLeft: '4px solid var(--color-info)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', boxShadow: 'var(--shadow-xs)' }}>
          <p className="text-xs text-muted uppercase tracking-widest font-semibold mb-2">Applicant</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>{bar.owner}</p>
          <p className="text-xs text-muted mt-1">{bar.email}</p>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">

        {/* Business Information */}
        <Card title="Business Information">
          <table className="w-full text-sm">
            <tbody>
              {[
                { label: 'Bar Name',      value: bar.barName },
                { label: 'Owner',         value: bar.owner },
                { label: 'Address',       value: bar.address },
                { label: 'Mobile',        value: bar.mobile },
                { label: 'Email',         value: bar.email },
                { label: 'GSTIN',         value: (
                  <span>
                    <span className="font-mono text-xs">{bar.gstin}</span>
                    {bar.gstinVerified && <span className="ml-1 text-[color:var(--color-success)]">✓</span>}
                  </span>
                )},
                { label: 'Opening Hours', value: bar.openingHours },
              ].map(({ label, value }) => (
                <tr key={label} className="border-b border-[color:var(--color-border)] last:border-0">
                  <td className="py-2.5 pr-4 text-muted w-36 align-top">{label}</td>
                  <td className="py-2.5 text-ink font-medium">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Document Verification */}
        <Card title="Document Verification">
          <div className="space-y-4">
            {docs.map((doc) => {
              const missing = doc.fileName === null;
              return (
                <div key={doc.id} className="flex items-start justify-between gap-3 pb-4 border-b border-[color:var(--color-border)] last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-semibold text-ink">{doc.label}</p>
                    {doc.fileName
                      ? <p className="text-xs text-muted mt-0.5">{doc.fileName}</p>
                      : <p className="text-xs mt-0.5" style={{ color: 'var(--color-danger)' }}>Not uploaded yet</p>
                    }
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!missing && (
                      <button className="btn btn-sm btn-ghost text-xs">👁 View</button>
                    )}
                    {missing ? (
                      <span className="badge badge-danger">Missing</span>
                    ) : (
                      <select
                        value={doc.verdict}
                        onChange={(e) => updateVerdict(doc.id, e.target.value as DocVerdict)}
                        className="select text-xs py-1 max-w-[7rem]"
                      >
                        <option value="Valid">Valid ✓</option>
                        <option value="Invalid">Invalid ✗</option>
                        <option value="Unclear">? Unclear</option>
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Admin Notes ── */}
      <Card title="Internal Admin Notes">
        <textarea
          rows={4}
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          className="input"
          placeholder="Add internal notes visible only to admins…"
        />
        <div className="flex justify-end mt-3">
          <button className="btn btn-ghost btn-sm">Save Note</button>
        </div>
      </Card>

      {/* ── Approve Modal ── */}
      {modal === 'approve' && (
        <Modal title="Approve Bar" onClose={() => setModal(null)}>
          <p className="text-sm text-muted">This will approve the bar and allow it to onboard customers. Make sure all documents are valid.</p>
          <ModalActions
            busy={busy}
            onCancel={() => setModal(null)}
            onConfirm={handleApprove}
            confirmLabel="Approve Bar"
            tone="success"
          />
        </Modal>
      )}

      {/* ── Reject Modal ── */}
      {modal === 'reject' && (
        <Modal title="Reject Bar" onClose={() => setModal(null)}>
          <div>
            <label htmlFor="rej-reason" className="field-label">Reason (shown to bar owner)</label>
            <textarea
              id="rej-reason"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={500}
              className="input"
            />
          </div>
          <label className="mt-3 inline-flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={rejectPermanent}
              onChange={(e) => setRejectPermanent(e.target.checked)}
              className="accent-[color:var(--color-accent)]"
            />
            Permanent — block re-registration with the same documents
          </label>
          <ModalActions
            busy={busy || rejectReason.trim().length < 4}
            onCancel={() => setModal(null)}
            onConfirm={handleReject}
            confirmLabel={rejectPermanent ? 'Reject Permanently' : 'Reject'}
            tone="danger"
          />
        </Modal>
      )}

      {/* ── Resubmit Modal ── */}
      {modal === 'resubmit' && (
        <Modal title="Request Resubmission" onClose={() => setModal(null)}>
          <div>
            <label htmlFor="res-reason" className="field-label">Reason (shown to bar owner)</label>
            <textarea
              id="res-reason"
              rows={3}
              value={resubmitReason}
              onChange={(e) => setResubmitReason(e.target.value)}
              maxLength={500}
              className="input"
            />
          </div>
          <ModalActions
            busy={busy || resubmitReason.trim().length < 4}
            onCancel={() => setModal(null)}
            onConfirm={handleResubmit}
            confirmLabel="Send to Bar Owner"
            tone="warn"
          />
        </Modal>
      )}
    </>
  );
}