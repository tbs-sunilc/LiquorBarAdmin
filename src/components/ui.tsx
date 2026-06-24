'use client';

import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';

/* ─────────────────────────────────────────────────
   PageHeader — editorial title block with gold rule
   ───────────────────────────────────────────────── */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 mb-8">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="text-[0.7rem] font-semibold tracking-[0.2em] uppercase text-accent-lo mb-2">
            {eyebrow}
          </p>
        )}
        <h1 className="font-sans-ui text-3xl font-bold leading-tight text-ink text-balance">{title}</h1>
        <span className="gold-rule mt-3 mb-3" aria-hidden="true" />
        {subtitle && <p className="text-sm text-muted text-pretty">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

/* ─────────────────────────────────────────────────
   StatCard — KPI tile
   ───────────────────────────────────────────────── */
export function StatCard({
  label,
  value,
  delta,
  icon,
  tone = 'default',
  index = 0,
}: {
  label: string;
  value: ReactNode;
  delta?: { value: string; positive?: boolean };
  icon?: ReactNode;
  tone?: 'default' | 'gold' | 'danger' | 'success';
  index?: number;
}) {
  const toneBar: Record<string, string> = {
    default: 'bg-strong',
    gold: 'bg-accent',
    danger: 'bg-[color:var(--color-danger)]',
    success: 'bg-[color:var(--color-success)]',
  };
  return (
    <div
      className="card-raised reveal relative overflow-hidden p-5"
      style={{ ['--index' as string]: index }}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${toneBar[tone]}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-semibold tracking-[0.15em] uppercase text-muted">{label}</p>
          <p className="mt-2 font-display text-3xl font-medium text-ink font-numeric">{value}</p>
          {delta && (
            <p className={`mt-1 text-xs font-semibold ${delta.positive ? 'text-[color:var(--color-success)]' : 'text-[color:var(--color-danger)]'}`}>
              {delta.positive ? '▲' : '▼'} {delta.value}
            </p>
          )}
        </div>
        {icon && <div className="text-2xl shrink-0 text-accent" aria-hidden="true">{icon}</div>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Card — generic surface
   ───────────────────────────────────────────────── */
export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card-raised ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            {title && <h2 className="font-sans-ui text-lg font-bold text-ink leading-snug">{title}</h2>}
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={title ? 'px-5 pb-5' : 'p-5'}>{children}</div>
    </section>
  );
}

/* ─────────────────────────────────────────────────
   Status badge
   ───────────────────────────────────────────────── */
export type BadgeTone = 'neutral' | 'success' | 'warn' | 'danger' | 'info';
export function Badge({
  tone = 'neutral',
  children,
  dot = false,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  dot?: boolean;
}) {
  return <span className={`badge badge-${tone} ${dot ? 'badge-dot' : ''}`}>{children}</span>;
}

/* ─────────────────────────────────────────────────
   Empty state — always context + CTA
   ───────────────────────────────────────────────── */
export function EmptyState({
  icon = '✦',
  title,
  description,
  cta,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  cta?: ReactNode;
}) {
  return (
    <div
      role="status"
      className="card-raised text-center py-14 px-6 flex flex-col items-center"
    >
      <div className="w-14 h-14 rounded-full bg-accent-tint flex items-center justify-center text-accent-lo text-2xl mb-4" aria-hidden="true">
        {icon}
      </div>
      <h3 className="font-sans-ui text-xl font-bold text-ink">{title}</h3>
      <span className="gold-rule my-3" aria-hidden="true" />
      {description && <p className="text-sm text-muted max-w-sm">{description}</p>}
      {cta && <div className="mt-5">{cta}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Error banner
   ───────────────────────────────────────────────── */
export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-[color:rgb(154_46_42/0.3)] bg-[color:var(--color-danger-tint)] text-[color:var(--color-danger)] px-4 py-3 text-sm flex items-start gap-2"
    >
      <span aria-hidden="true">⚠︎</span>
      <span>{children}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Loading skeletons
   ───────────────────────────────────────────────── */
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className="skeleton h-3 w-full max-w-[12rem]" />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-raised p-5">
          <div className="skeleton h-2.5 w-20 mb-3" />
          <div className="skeleton h-8 w-28" />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Toolbar — filter row above tables
   ───────────────────────────────────────────────── */
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="card-raised flex flex-wrap items-center gap-3 p-3 mb-4">
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Linked action cell helper
   ───────────────────────────────────────────────── */
export function RowAction({ href, label = 'Open' }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-semibold tracking-wide uppercase text-accent-lo hover:text-accent-hi transition-colors"
    >
      {label} <span aria-hidden="true">→</span>
    </Link>
  );
}

/* ─────────────────────────────────────────────────
   BackLink — page-level back nav
   ───────────────────────────────────────────────── */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-muted hover:text-accent-lo transition-colors mb-4"
    >
      <span aria-hidden="true">←</span> {children}
    </Link>
  );
}

/* ─────────────────────────────────────────────────
   Modal — focus-trapped, Escape-to-close, backdrop-click-to-close
   ───────────────────────────────────────────────── */
export function Modal({
  title,
  onClose,
  children,
  width = '28rem',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    first?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const focusables = ref.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus();
    };
  }, []);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="card-raised shadow-card-md p-6 w-full"
        style={{ maxWidth: width }}
      >
        <h3 id="modal-title" className="font-display text-xl text-ink leading-tight">{title}</h3>
        <span className="gold-rule my-3 block" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   ModalActions — standard footer for dialogs
   ───────────────────────────────────────────────── */
export function ModalActions({
  busy,
  onCancel,
  onConfirm,
  confirmLabel,
  tone = 'primary',
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  tone?: 'primary' | 'gold' | 'danger' | 'warn' | 'success';
}) {
  const toneClass =
    tone === 'gold'    ? 'btn-gold'
    : tone === 'danger'? 'btn-primary bg-[color:var(--color-danger)] !text-white'
    : tone === 'warn'  ? 'btn-primary bg-[color:var(--color-accent-lo)] !text-white'
    : tone === 'success'? 'btn-primary bg-[color:var(--color-success)] !text-white'
    : 'btn-primary';
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="btn btn-ghost">Cancel</button>
      <button type="button" onClick={onConfirm} disabled={busy} className={`btn ${toneClass}`}>
        {busy ? 'Working…' : confirmLabel}
      </button>
    </div>
  );
}
