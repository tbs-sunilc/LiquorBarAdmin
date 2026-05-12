'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  BackLink,
  Badge,
  type BadgeTone,
  Card,
  Modal,
  ModalActions,
} from '@/components/ui';
import {
  ApiError,
  type BarKycReviewDetailDto,
  approveBarKyc,
  getBarKycDetail,
  rejectBarKyc,
  resubmitBarKyc,
} from '@/lib/admin-api';

// ─── Types ────────────────────────────────────────────────────────────────────

type DocVerdict = 'Valid' | 'Invalid' | 'Unclear';
type ModalState = 'approve' | 'reject' | 'resubmit' | null;

type DocRow = {
  id: string;
  label: string;
  signedUrl: string | null;
  verdict: DocVerdict;
};

type OpeningHoursRow = {
  day: string;
  hours: string;
  closed: boolean;
  sort: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveSlaLabel(hoursWaiting: number): string {
  if (hoursWaiting > 48) {
    const over = Math.floor(hoursWaiting - 48);
    return `Breached by ${over}h · ${Math.floor(hoursWaiting)}h waiting · 48h SLA`;
  }
  if (hoursWaiting > 36) return `Near SLA · ${Math.floor(hoursWaiting)}h waiting · 48h SLA`;
  return `Within SLA · ${Math.floor(hoursWaiting)}h waiting · 48h SLA`;
}

type SlaLevel = 'Breached' | 'Near' | 'OK';
function deriveSlaLevel(hoursWaiting: number): SlaLevel {
  if (hoursWaiting > 48) return 'Breached';
  if (hoursWaiting > 36) return 'Near';
  return 'OK';
}

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

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ALIASES: Record<string, string> = {
  mon: 'Monday',
  monday: 'Monday',
  tue: 'Tuesday',
  tues: 'Tuesday',
  tuesday: 'Tuesday',
  wed: 'Wednesday',
  wednesday: 'Wednesday',
  thu: 'Thursday',
  thur: 'Thursday',
  thurs: 'Thursday',
  thursday: 'Thursday',
  fri: 'Friday',
  friday: 'Friday',
  sat: 'Saturday',
  saturday: 'Saturday',
  sun: 'Sunday',
  sunday: 'Sunday',
};

function normalizeDay(day: unknown, fallbackIndex: number): string {
  if (typeof day === 'number') return DAY_ORDER[(day + 6) % 7] ?? `Day ${fallbackIndex + 1}`;
  const key = String(day ?? '').trim().toLowerCase();
  return DAY_ALIASES[key] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : `Day ${fallbackIndex + 1}`);
}

function daySort(day: string): number {
  const index = DAY_ORDER.indexOf(day);
  return index === -1 ? 99 : index;
}

function formatTime(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  const text = String(value).trim();
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
  if (!match) return text;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function buildHoursLabel(source: Record<string, unknown> | string): { hours: string; closed: boolean } {
  if (typeof source === 'string') {
    return { hours: source, closed: /closed/i.test(source) };
  }

  const closed = Boolean(source.closed ?? source.isClosed ?? source.isHoliday);
  if (closed) return { hours: 'Closed', closed: true };

  const open = formatTime(source.open ?? source.openTime ?? source.from ?? source.start);
  const close = formatTime(source.close ?? source.closeTime ?? source.to ?? source.end);
  const hours = open && close ? `${open} - ${close}` : String(source.label ?? source.hours ?? 'Hours not provided');

  return { hours, closed: false };
}

function parseOpeningHours(raw: string | null): { rows: OpeningHoursRow[]; fallback: string | null } {
  if (!raw) return { rows: [], fallback: null };

  try {
    const parsed = JSON.parse(raw) as unknown;
    let rows: OpeningHoursRow[] = [];

    if (Array.isArray(parsed)) {
      rows = parsed.map((entry, index) => {
        const item = typeof entry === 'object' && entry !== null ? entry as Record<string, unknown> : { hours: String(entry) };
        const day = normalizeDay(item.day ?? item.dayOfWeek ?? item.name ?? index, index);
        const { hours, closed } = buildHoursLabel(item);
        return { day, hours, closed, sort: daySort(day) };
      });
    } else if (typeof parsed === 'object' && parsed !== null) {
      rows = Object.entries(parsed as Record<string, unknown>).map(([key, value], index) => {
        const day = normalizeDay(key, index);
        const { hours, closed } =
          typeof value === 'object' && value !== null
            ? buildHoursLabel(value as Record<string, unknown>)
            : buildHoursLabel(String(value ?? 'Hours not provided'));
        return { day, hours, closed, sort: daySort(day) };
      });
    }

    return { rows: rows.sort((a, b) => a.sort - b.sort), fallback: rows.length > 0 ? null : raw };
  } catch {
    return { rows: [], fallback: raw };
  }
}

function OpeningHoursDisplay({ value }: { value: string | null }) {
  const { rows, fallback } = parseOpeningHours(value);

  if (!value) return <span className="text-muted">-</span>;

  if (fallback) {
    return (
      <div className="rounded-lg border border-hairline bg-ivory-2 px-3 py-2 text-sm text-ink">
        {fallback}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-hairline bg-ivory-2/70 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.day}
            className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-surface px-3 py-2"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{row.day.slice(0, 3)}</span>
            <span className={`text-sm font-semibold ${row.closed ? 'text-[color:var(--color-danger)]' : 'text-ink'}`}>
              {row.hours}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BarKycDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const barId  = Number(params.id);

  const [bar,          setBar]          = useState<BarKycReviewDetailDto | null>(null);
  const [docs,         setDocs]         = useState<DocRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [adminNote,    setAdminNote]    = useState('');
  const [modal,        setModal]        = useState<ModalState>(null);
  const [busy,         setBusy]         = useState(false);
  const [actionError,  setActionError]  = useState<string | null>(null);
  const [rejectReason,   setRejectReason]   = useState('');
  const [resubmitReason, setResubmitReason] = useState('');

  useEffect(() => {
    if (!Number.isFinite(barId)) return;
    (async () => {
      try {
        const detail = await getBarKycDetail(barId);
        setBar(detail);
        setDocs(buildDocRows(detail));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load bar details');
      } finally {
        setLoading(false);
      }
    })();
  }, [barId]);

  function buildDocRows(d: BarKycReviewDetailDto): DocRow[] {
    return [
      { id: 'gstin',   label: 'GSTIN Certificate',      signedUrl: d.gstinDocSignedUrl,          verdict: 'Valid' },
      { id: 'fssai',   label: 'FSSAI Certificate',       signedUrl: d.fssaiDocSignedUrl,           verdict: 'Valid' },
      { id: 'liquor',  label: 'State Liquor Licence',    signedUrl: d.liquorLicenceDocSignedUrl,   verdict: 'Valid' },
      { id: 'photos',  label: 'Bar Photos',               signedUrl: d.photoGallerySignedUrls[0] ?? null, verdict: d.photoGallerySignedUrls.length > 0 ? 'Valid' : 'Unclear' },
    ];
  }

  function updateVerdict(docId: string, v: DocVerdict) {
    setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, verdict: v } : d));
  }

  async function handleApprove() {
    setBusy(true);
    setActionError(null);
    try {
      await approveBarKyc(barId, adminNote || undefined);
      router.push('/bar-kyc');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Approve failed');
      setBusy(false);
      setModal(null);
    }
  }

  async function handleReject() {
    setBusy(true);
    setActionError(null);
    try {
      await rejectBarKyc(barId, rejectReason);
      router.push('/bar-kyc');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Reject failed');
      setBusy(false);
      setModal(null);
    }
  }

  async function handleResubmit() {
    setBusy(true);
    setActionError(null);
    try {
      await resubmitBarKyc(barId, resubmitReason);
      router.push('/bar-kyc');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Resubmit request failed');
      setBusy(false);
      setModal(null);
    }
  }

  // ── Loading / Error states ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-muted text-sm">Loading bar details…</p>
      </div>
    );
  }

  if (error || !bar) {
    return (
      <div>
        <BackLink href="/bar-kyc">Back to Queue</BackLink>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '16px', marginTop: 16, color: '#dc2626', fontSize: 14 }}>
          {error ?? 'Bar not found.'}
        </div>
      </div>
    );
  }

  const slaLevel  = deriveSlaLevel(bar.hoursWaiting);
  const slaDetail = deriveSlaLabel(bar.hoursWaiting);
  const closed    = bar.kycStatus === 'Approved';

  const slaBorderColor = slaLevel === 'Breached' ? 'var(--color-danger)' : slaLevel === 'Near' ? 'var(--color-accent)' : 'var(--color-success)';
  const slaTextColor   = slaLevel === 'Breached' ? 'var(--color-danger)' : slaLevel === 'Near' ? 'var(--color-accent)' : 'var(--color-success)';

  const docsUploaded = docs.filter(d => d.signedUrl !== null).length;

  return (
    <>
      {/* ── Top bar ── */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <BackLink href="/bar-kyc">Back to Queue</BackLink>
          <h1 className="font-display text-2xl text-ink mt-1">
            KYC Review — {bar.businessName}
          </h1>
          <p className="text-sm text-muted mt-1">
            {bar.city}, {bar.stateCode} · {Math.floor(bar.hoursWaiting)}h waiting
            {bar.slaBreached && (
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

      {/* ── Action error ── */}
      {actionError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#dc2626', fontSize: 14 }}>
          {actionError}
        </div>
      )}

      {/* ── 3 stat cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* SLA */}
        <div style={{ borderLeft: `4px solid ${slaBorderColor}`, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', boxShadow: 'var(--shadow-xs)' }}>
          <p className="text-xs text-muted uppercase tracking-widest font-semibold mb-2">SLA Status</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: slaTextColor }}>
            {slaLevel === 'Breached' ? `Breached by ${Math.floor(bar.hoursWaiting - 48)}h` : slaLevel === 'Near' ? 'Near SLA' : 'Within SLA'}
          </p>
          <p className="text-xs text-muted mt-1">{slaDetail}</p>
        </div>

        {/* Documents */}
        <div style={{ borderLeft: '4px solid var(--color-accent)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', boxShadow: 'var(--shadow-xs)' }}>
          <p className="text-xs text-muted uppercase tracking-widest font-semibold mb-2">Documents</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>{docsUploaded} / {docs.length}</p>
          {docsUploaded < docs.length && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-accent)' }}>
              {docs.filter(d => d.signedUrl === null).map(d => d.label).join(', ')} missing
            </p>
          )}
        </div>

        {/* Applicant */}
        <div style={{ borderLeft: '4px solid var(--color-info)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', boxShadow: 'var(--shadow-xs)' }}>
          <p className="text-xs text-muted uppercase tracking-widest font-semibold mb-2">Applicant</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>{bar.ownerFullName ?? bar.contactEmail}</p>
          <p className="text-xs text-muted mt-1">{bar.contactEmail}</p>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">

        {/* Business Information */}
        <Card title="Business Information">
          <table className="w-full text-sm">
            <tbody>
              {[
                { label: 'Bar Name',        value: bar.businessName },
                { label: 'Legal Name',      value: bar.legalName ?? '—' },
                { label: 'Owner',           value: bar.ownerFullName ?? '—' },
                { label: 'Address',         value: [bar.addressLine1, bar.addressLine2, bar.locality, bar.city, bar.stateCode, bar.pincode].filter(Boolean).join(', ') },
                { label: 'Mobile',          value: bar.contactMobile },
                { label: 'Email',           value: bar.contactEmail },
                { label: 'GSTIN',           value: <span className="font-mono text-xs">{bar.gstin}</span> },
                { label: 'FSSAI',           value: bar.fssaiLicenceNumber },
                { label: 'Liquor Licence',  value: bar.liquorLicenceNumber },
                { label: 'Opening Hours',   value: <OpeningHoursDisplay value={bar.openingHoursJson} /> },
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
              const missing = doc.signedUrl === null;
              return (
                <div key={doc.id} className="flex items-start justify-between gap-3 pb-4 border-b border-[color:var(--color-border)] last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-semibold text-ink">{doc.label}</p>
                    {missing
                      ? <p className="text-xs mt-0.5" style={{ color: 'var(--color-danger)' }}>Not uploaded yet</p>
                      : <p className="text-xs text-muted mt-0.5">Uploaded</p>
                    }
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!missing && (
                      <a
                        href={doc.signedUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-ghost text-xs"
                      >
                        👁 View
                      </a>
                    )}
                    {missing ? (
                      verdictBadge(doc.verdict, true)
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

            {/* Photo gallery previews */}
            {bar.photoGallerySignedUrls.length > 1 && (
              <div>
                <p className="text-xs text-muted mb-2">Photo Gallery ({bar.photoGallerySignedUrls.length} photos)</p>
                <div className="flex gap-2 flex-wrap">
                  {bar.photoGallerySignedUrls.slice(1).map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-ghost text-xs">
                      Photo {i + 2}
                    </a>
                  ))}
                </div>
              </div>
            )}
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
          <ModalActions
            busy={busy || rejectReason.trim().length < 4}
            onCancel={() => setModal(null)}
            onConfirm={handleReject}
            confirmLabel="Reject"
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
