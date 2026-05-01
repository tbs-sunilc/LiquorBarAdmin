'use client';

/**
 * SC-07 Dispute detail with audit trail timeline + resolution modal
 * offering the four decision types (wallet reversal with ml input,
 * rejected with reason, escalated).
 */

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ApiError,
  getDispute,
  resolveDispute,
  type DisputeDetailDto,
  type ResolveDisputePayload,
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

type Resolution = 'ApprovedReversal' | 'Rejected' | 'Escalated';

export default function DisputeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();

  const [d, setD] = useState<DisputeDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showResolve, setShowResolve] = useState(false);
  const [resolution, setResolution] = useState<Resolution>('ApprovedReversal');
  const [adminNotes, setAdminNotes] = useState('');
  const [reversalMl, setReversalMl] = useState<number>(0);
  const [rejectionReason, setRejectionReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    (async () => {
      try { setD(await getDispute(id)); }
      catch (err) { setError(err instanceof ApiError ? err.message : 'Failed to load'); }
      finally { setLoading(false); }
    })();
  }, [id]);

  async function submitResolve() {
    if (!d) return;
    setBusy(true); setError(null);
    try {
      const payload: ResolveDisputePayload = {
        resolution,
        adminNotes: adminNotes.trim() || undefined,
      };
      if (resolution === 'ApprovedReversal') {
        if (!d.disputedTransactionId) {
          setError('This dispute has no linked wallet transaction to reverse.');
          setBusy(false); return;
        }
        payload.originalWalletTransactionId = d.disputedTransactionId;
        if (reversalMl > 0) payload.reversalMl = reversalMl;
      } else if (resolution === 'Rejected') {
        if (rejectionReason.trim().length < 4) {
          setError('Rejection reason is required.');
          setBusy(false); return;
        }
        payload.rejectionReason = rejectionReason.trim();
      }
      const updated = await resolveDispute(id, payload);
      setD(updated);
      setShowResolve(false);
      router.push('/disputes');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-muted">Loading…</p>;
  if (error || !d) {
    return (
      <>
        <BackLink href="/disputes">Back</BackLink>
        <ErrorBanner>{error ?? 'Not found'}</ErrorBanner>
      </>
    );
  }

  const closed = d.status === 'Resolved' || d.status === 'Rejected';

  return (
    <>
      <BackLink href="/disputes">Back to disputes</BackLink>

      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[0.7rem] font-semibold tracking-[0.22em] uppercase text-accent-lo mb-1.5">Resolution</p>
          <h1 className="font-display text-4xl text-ink leading-tight">Dispute #{d.id}</h1>
          <p className="text-sm text-muted mt-2">
            <span className="font-semibold text-ink">{d.disputeType}</span>
            {' · '}User <span className="font-mono">{d.userMobile}</span>
            {' · '}Bar <span className="text-ink">{d.barName}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={disputeTone(d.status)}>{d.status}</Badge>
          {d.slaBreached && (d.status === 'Open' || d.status === 'UnderReview') && (
            <Badge tone="danger" dot>SLA breached</Badge>
          )}
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_22rem] gap-6">
        <Card title="User complaint">
          <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{d.description}</p>

          {d.supportingDocUrls.length > 0 && (
            <>
              <h3 className="font-display text-sm text-muted mt-6 mb-2 uppercase tracking-[0.15em]">Evidence</h3>
              <ul className="space-y-1.5">
                {d.supportingDocUrls.map((url, i) => (
                  <li key={i}>
                    <a href={url} target="_blank" rel="noreferrer" className="text-sm text-accent-lo hover:text-accent-hi underline underline-offset-2">
                      Attachment {i + 1} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}

          {d.disputedTransactionId && (
            <div className="mt-5 px-4 py-3 bg-ivory-2 rounded-md text-xs text-muted border border-hairline">
              Linked wallet transaction: <strong className="font-numeric tabular-nums text-ink">#{d.disputedTransactionId}</strong>
              {d.disputedPourRequestId && <> · pour request <strong className="font-numeric tabular-nums text-ink">#{d.disputedPourRequestId}</strong></>}
            </div>
          )}

          {d.adminNotes && (
            <div className="mt-4 px-4 py-3 bg-[color:var(--color-info-tint)] border border-[color:rgb(47_79_122/0.25)] rounded-md text-sm text-[color:var(--color-info)]">
              <strong>Admin notes:</strong> {d.adminNotes}
            </div>
          )}
          {d.rejectionReason && (
            <div className="mt-4 px-4 py-3 bg-[color:var(--color-danger-tint)] border border-[color:rgb(154_46_42/0.25)] rounded-md text-sm text-[color:var(--color-danger)]">
              <strong>Rejection reason:</strong> {d.rejectionReason}
            </div>
          )}

          {!closed && (
            <div className="mt-6 pt-5 border-t border-hairline">
              <button onClick={() => setShowResolve(true)} className="btn btn-primary">
                Resolve dispute
              </button>
            </div>
          )}
        </Card>

        <Card title="Audit trail">
          <ol className="relative pl-6 space-y-5 before:absolute before:top-1.5 before:bottom-1.5 before:left-[6px] before:w-px before:bg-strong/60">
            {d.auditTrail.map((e, i) => (
              <li key={i} className="relative">
                <span aria-hidden="true" className="absolute -left-[18px] top-1 w-3 h-3 rounded-full bg-accent ring-4 ring-surface" />
                <p className="font-semibold text-ink text-sm">{e.event}</p>
                <p className="text-xs text-muted font-numeric mt-0.5">
                  {new Date(e.atUtc).toLocaleString()} · {e.actor ?? '—'}
                </p>
                {e.detail && <p className="mt-1 text-xs text-muted">{e.detail}</p>}
              </li>
            ))}
          </ol>
          <div className="mt-6 pt-4 border-t border-hairline text-xs text-muted space-y-1 font-numeric">
            <p>Created {new Date(d.createdAtUtc).toLocaleString()}</p>
            <p>SLA deadline {new Date(d.slaDeadlineAtUtc).toLocaleString()}</p>
          </div>
        </Card>
      </div>

      {showResolve && (
        <Modal title="Resolve dispute" onClose={() => setShowResolve(false)}>
          <div>
            <label htmlFor="res-decision" className="field-label">Decision</label>
            <select
              id="res-decision"
              value={resolution}
              onChange={(e) => setResolution(e.target.value as Resolution)}
              className="select"
            >
              <option value="ApprovedReversal">Approve & reverse wallet deduction</option>
              <option value="Rejected">Reject dispute</option>
              <option value="Escalated">Escalate to senior admin</option>
            </select>
          </div>

          {resolution === 'ApprovedReversal' && (
            <div className="mt-3">
              <label htmlFor="res-ml" className="field-label">Reversal ml (0 = full original amount)</label>
              <input id="res-ml" type="number" min={0} value={reversalMl} onChange={(e) => setReversalMl(Number(e.target.value))} className="input font-mono" />
            </div>
          )}

          {resolution === 'Rejected' && (
            <div className="mt-3">
              <label htmlFor="res-reject-reason" className="field-label">Rejection reason (shown to user)</label>
              <textarea id="res-reject-reason" rows={3} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} maxLength={500} className="input" />
            </div>
          )}

          <div className="mt-3">
            <label htmlFor="res-notes" className="field-label">Admin notes (internal)</label>
            <textarea id="res-notes" rows={2} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} maxLength={1000} className="input" />
          </div>

          {error && <div className="mt-3"><ErrorBanner>{error}</ErrorBanner></div>}

          <ModalActions
            busy={busy}
            onCancel={() => setShowResolve(false)}
            onConfirm={submitResolve}
            confirmLabel="Confirm"
            tone={resolution === 'Rejected' ? 'danger' : resolution === 'Escalated' ? 'warn' : 'success'}
          />
        </Modal>
      )}
    </>
  );
}

function disputeTone(status: string): BadgeTone {
  switch (status) {
    case 'Resolved':    return 'success';
    case 'Rejected':    return 'danger';
    case 'UnderReview': return 'info';
    case 'Escalated':   return 'warn';
    default:            return 'neutral';
  }
}
