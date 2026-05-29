'use client';

/**
 * SC-04 KYC review detail.
 *
 * Document verdict dropdowns for ID/name/DOB match — they're advisory
 * (stored as part of the rejection/approval reason).  Approve / Reject /
 * Resubmit each open a confirm modal so the action is deliberate.
 */

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ApiError,
  approveKyc,
  getKycDetail,
  getUser,
  listKycQueue,
  rejectKyc,
  resubmitKyc,
  type AdminUserDetailDto,
  type KycReviewDetailDto,
} from '@/lib/admin-api';
import {
  BackLink,
  Badge,
  type BadgeTone,
  Card,
  ErrorBanner,
  Modal,
  ModalActions,
} from '@/components/ui';

type Verdict = 'Match' | 'Mismatch' | 'Unclear';
type ModalState = 'approve' | 'reject' | 'resubmit' | null;

export default function KycReviewPage() {
  const getImageUrl = (url?: string | null) => {
    if (!url) return '';
    let normalizedUrl = url.replace(/\\/g, '/');
    if (normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')) return normalizedUrl;
    
    // The backend serves files from the "User Documents" folder, so we need to prepend it
    // if the stored path is just a relative path like "kyc/3040/..."
    if (!normalizedUrl.startsWith('User Documents/') && !normalizedUrl.startsWith('/User Documents/')) {
      normalizedUrl = `User Documents/${normalizedUrl.startsWith('/') ? normalizedUrl.slice(1) : normalizedUrl}`;
    }

    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
    return `${base}/${normalizedUrl.startsWith('/') ? normalizedUrl.slice(1) : normalizedUrl}`;
  };

  const params = useParams<{ id: string }>();
  const userId = Number(params.id);
  const router = useRouter();

  const [detail, setDetail] = useState<KycReviewDetailDto | null>(null);
  const [userProfile, setUserProfile] = useState<AdminUserDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [idVerdict, setIdVerdict]     = useState<Verdict>('Match');
  const [nameVerdict, setNameVerdict] = useState<Verdict>('Match');
  const [dobVerdict, setDobVerdict]   = useState<Verdict>('Match');

  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);

  const [dob, setDob] = useState<string>('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectPermanent, setRejectPermanent] = useState(false);
  const [resubmitReason, setResubmitReason] = useState('');

  useEffect(() => {
    if (!Number.isFinite(userId)) return;
    (async () => {
      try {
        const [d, u] = await Promise.all([
          getKycDetail(userId),
          getUser(userId).catch(() => null)
        ]);
        setDetail(d);
        if (u) setUserProfile(u);
        if (d.dateOfBirth) setDob(d.dateOfBirth);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  async function doAction(fn: () => Promise<KycReviewDetailDto>) {
    setBusy(true);
    try {
      const d = await fn();
      setDetail(d);
      setModal(null);
      router.push('/kyc');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

async function approveAndSyncBar(approveFn: () => Promise<KycReviewDetailDto>) {
  setBusy(true);
  try {
    // Step 1: Get barId using correct status 'Pending'
    const pendingList = await listKycQueue('Pending', 0, 100);
    const match = pendingList.find((x) => x.userId === userId);
    const barId = match?.barId;

    // Step 2: Approve KYC
    const d = await approveFn();
    setDetail(d);

    // Step 3: Call bar status API with PUT method
    if (barId != null) {
      const token = window.sessionStorage.getItem('sipsave-admin-access-token');
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

      await fetch(`${baseUrl}/api/v1/bars/${barId}/status`, {
        method: 'PUT',                                       // ← PUT not POST
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'Approve', reason: null }),
      });
    }

    setModal(null);
    router.push('/kyc');
  } catch (err) {
    setError(err instanceof ApiError ? err.message : 'Action failed');
  } finally {
    setBusy(false);
  }
}



  if (loading) return <p className="text-muted">Loading…</p>;
  if (error || !detail) {
    return (
      <>
        <BackLink href="/kyc">Back to queue</BackLink>
        <ErrorBanner>{error ?? 'Not found'}</ErrorBanner>
      </>
    );
  }

  const closed = detail.kycStatus === 'Approved' || detail.kycStatus === 'PermanentlyRejected';

  const docUrl = detail.kycDocSignedUrl || userProfile?.kycDocUrl;
  const docType = detail.kycDocType || userProfile?.kycDocType;

  return (
    <>
      <BackLink href="/kyc">Back to queue</BackLink>

      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[0.7rem] font-semibold tracking-[0.22em] uppercase text-accent-lo mb-1.5">KYC Review</p>
          <h1 className="font-display text-4xl text-ink leading-tight">{detail.fullName ?? 'Unnamed'}</h1>
          <p className="text-sm text-muted mt-2 font-mono">{detail.mobileNumber} · {detail.email ?? 'no email on file'}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={kycTone(detail.kycStatus)}>{detail.kycStatus}</Badge>
          {detail.slaBreached && <Badge tone="danger" dot>SLA breached</Badge>}
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_22rem] gap-6 mb-6">
        <div className="space-y-6">
          <Card
            title="Document"
            action={
              docUrl && (
                <a href={getImageUrl(docUrl)} target="_blank" rel="noreferrer"
                   className="text-xs font-semibold uppercase tracking-wider text-accent-lo hover:text-accent-hi">
                  Open in new tab ↗
                </a>
              )
            }
          >
            <div className="-mx-5 -mb-5">
              <div className="bg-ivory-2 aspect-[4/3] flex items-center justify-center border-y border-hairline">
                {docUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getImageUrl(docUrl)} alt={`KYC document — ${docType ?? 'document'}`} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-muted text-sm">Document not uploaded</span>
                )}
              </div>
              <div className="px-5 py-4 text-xs text-muted flex flex-wrap gap-x-6 gap-y-1">
                <span>Type: <strong className="text-ink">{docType ?? '—'}</strong></span>
                <span>Submitted: <span className="font-numeric">{detail.kycSubmittedAtUtc ? new Date(detail.kycSubmittedAtUtc).toLocaleString() : '—'}</span></span>
              </div>
            </div>
          </Card>
        </div>

        <Card title="Verification checklist">
          <div className="space-y-3">
            <VerdictRow id="v-id" label="ID photo matches" value={idVerdict} onChange={setIdVerdict} />
            <VerdictRow id="v-name" label="Name matches" value={nameVerdict} onChange={setNameVerdict} />
            <VerdictRow id="v-dob" label="DOB matches" value={dobVerdict} onChange={setDobVerdict} />
          </div>

          {detail.kycRejectionReason && (
            <div className="mt-4 rounded-md border border-[color:rgb(154_46_42/0.3)] bg-[color:var(--color-danger-tint)] text-[color:var(--color-danger)] p-3 text-xs">
              <strong>Previous rejection:</strong> {detail.kycRejectionReason}
            </div>
          )}

          {!closed ? (
            <div className="mt-5 pt-5 border-t border-hairline space-y-2">
              <button onClick={() => setModal('approve')} className="btn w-full" style={{ background: 'var(--color-success)', color: 'white' }}>
                ✓ Approve
              </button>
              <button onClick={() => setModal('resubmit')} className="btn w-full" style={{ background: 'var(--color-accent-lo)', color: 'white' }}>
                ↻ Ask for resubmit
              </button>
              <button onClick={() => setModal('reject')} className="btn w-full" style={{ background: 'var(--color-danger)', color: 'white' }}>
                ✗ Reject
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted mt-4">This review is closed.</p>
          )}
        </Card>
      </div>

      {modal === 'approve' && (
        <Modal title="Approve KYC" onClose={() => setModal(null)}>
          <p className="text-sm text-muted">Confirms identity for wallet purchases. Capture DOB if it&apos;s missing.</p>
          <div className="mt-4">
            <label htmlFor="dob" className="field-label">Date of birth (if known)</label>
            <input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="input" />
          </div>
          <ModalActions
            busy={busy}
            onCancel={() => setModal(null)}
            onConfirm={() => approveAndSyncBar(() => approveKyc(userId, dob || null))}
            confirmLabel="Approve"
            tone="success"
          />
        </Modal>
      )}

      {modal === 'reject' && (
        <Modal title="Reject KYC" onClose={() => setModal(null)}>
          <div>
            <label htmlFor="rej-reason" className="field-label">Reason (shown to user)</label>
            <textarea id="rej-reason" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={500} className="input" />
          </div>
          <label className="mt-3 inline-flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={rejectPermanent} onChange={(e) => setRejectPermanent(e.target.checked)} className="accent-[color:var(--color-accent)]" />
            Permanent — block re-registration with the same document
          </label>
          <ModalActions
            busy={busy || rejectReason.trim().length < 4}
            onCancel={() => setModal(null)}
            onConfirm={() => doAction(() => rejectKyc(userId, rejectReason.trim(), rejectPermanent))}
            confirmLabel={rejectPermanent ? 'Reject permanently' : 'Reject'}
            tone="danger"
          />
        </Modal>
      )}

      {modal === 'resubmit' && (
        <Modal title="Request resubmit" onClose={() => setModal(null)}>
          <div>
            <label htmlFor="res-reason" className="field-label">Reason (shown to user)</label>
            <textarea id="res-reason" rows={3} value={resubmitReason} onChange={(e) => setResubmitReason(e.target.value)} maxLength={500} className="input" />
          </div>
          <ModalActions
            busy={busy || resubmitReason.trim().length < 4}
            onCancel={() => setModal(null)}
            onConfirm={() => doAction(() => resubmitKyc(userId, resubmitReason.trim()))}
            confirmLabel="Send to user"
            tone="warn"
          />
        </Modal>
      )}
    </>
  );
}

function VerdictRow({ id, label, value, onChange }: { id: string; label: string; value: Verdict; onChange: (v: Verdict) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm text-ink">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as Verdict)}
        className="select max-w-[10rem] text-xs py-1.5"
      >
        <option value="Match">✓ Match</option>
        <option value="Mismatch">✗ Mismatch</option>
        <option value="Unclear">? Unclear</option>
      </select>
    </div>
  );
}

function kycTone(status: string): BadgeTone {
  switch (status) {
    case 'Approved':            return 'success';
    case 'PendingReview':       return 'warn';
    case 'Rejected':
    case 'PermanentlyRejected': return 'danger';
    default:                    return 'neutral';
  }
}
