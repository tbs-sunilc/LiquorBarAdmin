'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  ApiError,
  createEmailTemplate,
  listEmailTemplates,
  softDeleteEmailTemplate,
  updateEmailTemplate,
  type EmailTemplateRowDto,
  type EmailTemplateUpsertPayload,
} from '@/lib/admin-api';
import {
  Badge,
  type BadgeTone,
  Card,
  EmptyState,
  ErrorBanner,
  Modal,
  ModalActions,
  PageHeader,
  SkeletonRow,
  StatCard,
  Toolbar,
} from '@/components/ui';

type TemplateFilter = 'All' | 'Active' | 'Inactive' | 'Deleted';

type TemplateModalState =
  | { kind: 'create' }
  | { kind: 'edit'; row: EmailTemplateRowDto }
  | { kind: 'delete'; row: EmailTemplateRowDto }
  | null;

type TemplateFormState = {
  type: string;
  subject: string;
  text: string;
  isActive: boolean;
};

const FILTER_OPTIONS: TemplateFilter[] = ['All', 'Active', 'Inactive', 'Deleted'];

export default function EmailTemplatesPage() {
  const [rows, setRows] = useState<EmailTemplateRowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<TemplateFilter>('All');
  const [modal, setModal] = useState<TemplateModalState>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateFormState>(emptyForm());

  useEffect(() => {
    void loadTemplates();
  }, []);

  useEffect(() => {
    if (!modal) return;
    setFormError(null);
    if (modal.kind === 'create') {
      setForm(emptyForm());
      return;
    }
    if (modal.kind === 'edit') {
      setForm(fromRow(modal.row));
    }
  }, [modal]);

  async function loadTemplates(silent = false) {
    if (!silent) setLoading(true);
    try {
      setError(null);
      const data = await listEmailTemplates(true);
      setRows(sortTemplates(data));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load email templates');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function openCreate() {
    setFormError(null);
    setModal({ kind: 'create' });
  }

  function openEdit(row: EmailTemplateRowDto) {
    setFormError(null);
    setModal({ kind: 'edit', row });
  }

  function openDelete(row: EmailTemplateRowDto) {
    setFormError(null);
    setModal({ kind: 'delete', row });
  }

  async function handleSave() {
    if (!form.type.trim() || !form.subject.trim() || !form.text.trim()) {
      setFormError('Type, subject, and text are required.');
      return;
    }

    const payload: EmailTemplateUpsertPayload = {
      type: form.type.trim(),
      subject: form.subject.trim(),
      text: form.text.trim(),
      isActive: form.isActive,
    };

    setBusy(true);
    setFormError(null);
    try {
      if (modal?.kind === 'edit') {
        await updateEmailTemplate(modal.row.id, payload);
      } else {
        await createEmailTemplate(payload);
      }
      setModal(null);
      await loadTemplates(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save template');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (modal?.kind !== 'delete') return;
    setBusy(true);
    setFormError(null);
    try {
      await softDeleteEmailTemplate(modal.row.id);
      setModal(null);
      await loadTemplates(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to delete template');
    } finally {
      setBusy(false);
    }
  }

  const filteredRows = rows.filter((row) => {
    const matchesStatus =
      filter === 'All'
        ? true
        : filter === 'Deleted'
          ? row.isDelete
          : filter === 'Active'
            ? !row.isDelete && row.isActive
            : !row.isDelete && !row.isActive;

    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [row.type, row.subject, row.text, row.createdBy ?? '', row.updatedBy ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query);

    return matchesStatus && matchesSearch;
  });

  const activeCount = rows.filter((row) => !row.isDelete && row.isActive).length;
  const inactiveCount = rows.filter((row) => !row.isDelete && !row.isActive).length;
  const deletedCount = rows.filter((row) => row.isDelete).length;

  return (
    <>
      <PageHeader
        eyebrow="Messaging"
        title="Email templates"
        subtitle="Manage email templates for transactional communications like welcome emails, password resets, and notifications."
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + Add Template
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard
          tone="success"
          label="Active templates"
          value={String(activeCount)}
          index={0}
        />
        <StatCard
          tone="gold"
          label="Inactive templates"
          value={String(inactiveCount)}
          index={1}
        />
        <StatCard
          tone="danger"
          label="Deleted templates"
          value={String(deletedCount)}
          index={2}
        />
      </div>

      <Toolbar>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Search</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Type, subject, text, created by..."
          className="input flex-1 max-w-md"
          aria-label="Search email templates"
        />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Status</span>
        <select
          className="select max-w-[12rem]"
          value={filter}
          onChange={(event) => setFilter(event.target.value as TemplateFilter)}
          aria-label="Filter email templates"
        >
          {FILTER_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </Toolbar>

      
      {error && <div className="mb-4"><ErrorBanner>{error}</ErrorBanner></div>}

      {!loading && filteredRows.length === 0 && !error ? (
        <EmptyState
          icon={<EnvelopeIcon />}
          title={search || filter !== 'All' ? 'No matching templates' : 'No email templates'}
          description={
            search || filter !== 'All'
              ? 'Try a different search term or status filter.'
              : 'Add your first transactional template to get started.'
          }
          cta={<button type="button" className="btn btn-primary" onClick={openCreate}>Add Template</button>}
        />
      ) : (loading || filteredRows.length > 0) ? (
        <Card title="Template Library" subtitle="Create, edit, and soft delete transactional email copy.">
          <div className="overflow-x-auto">
            <table className="table min-w-[1280px]">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Subject</th>
                  <th>Text Preview</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>Created Date</th>
                  <th>Updated By</th>
                  <th>Updated Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, index) => <SkeletonRow key={index} cols={9} />)}
                {!loading && filteredRows.map((row) => {
                  const isDeleted = row.isDelete;
                  return (
                    <tr key={row.id} className={isDeleted ? 'opacity-70 bg-[color:var(--color-danger-tint)]/20' : ''}>
                      <td>
                        <div className="font-semibold text-ink">{row.type}</div>
                      </td>
                      <td className="text-ink">{row.subject}</td>
                      <td className="text-muted max-w-[24rem]">
                        <span className="block truncate">{previewText(row.text)}</span>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={isDeleted ? 'danger' : 'neutral'}>
                            {isDeleted ? 'Deleted' : 'Live'}
                          </Badge>
                          <Badge tone={templateActiveTone(row)}>
                            {row.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </td>
                      <td className="text-sm text-ink">{row.createdBy ?? '-'}</td>
                      <td className="text-sm text-muted font-numeric">{formatDateTime(row.createdDate)}</td>
                      <td className="text-sm text-ink">{row.updatedBy ?? '-'}</td>
                      <td className="text-sm text-muted font-numeric">
                        {row.updatedDate ? formatDateTime(row.updatedDate) : '-'}
                      </td>
                      <td>
                        {isDeleted ? (
                          <Badge tone="danger" dot>Soft deleted</Badge>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(row)}>
                              Edit
                            </button>
                            <button type="button" className="btn btn-sm bg-[color:var(--color-danger)] text-white hover:opacity-90" onClick={() => openDelete(row)}>
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {modal && (modal.kind === 'create' || modal.kind === 'edit') && (
        <Modal
          title={modal.kind === 'create' ? 'Add Email Template' : 'Edit Email Template'}
          onClose={() => !busy && setModal(null)}
          width="48rem"
        >
          <div className="space-y-5">
            {formError && <ErrorBanner>{formError}</ErrorBanner>}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type *" htmlFor="template-type" hint="Use a stable key like WELCOME_EMAIL or PASSWORD_RESET.">
                <input
                  id="template-type"
                  type="text"
                  className="input"
                  value={form.type}
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                  placeholder="WELCOME_EMAIL"
                  disabled={busy}
                />
              </Field>

              <Field label="Subject *" htmlFor="template-subject">
                <input
                  id="template-subject"
                  type="text"
                  className="input"
                  value={form.subject}
                  onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                  placeholder="Welcome to SipSave"
                  disabled={busy}
                />
              </Field>
            </div>

            <Field label="Text *" htmlFor="template-text" hint="Plain text or message body with placeholders like {{fullName}}.">
              <textarea
                id="template-text"
                className="input min-h-[14rem] resize-y"
                value={form.text}
                onChange={(event) => setForm((current) => ({ ...current, text: event.target.value }))}
                placeholder="Email body goes here..."
                disabled={busy}
              />
            </Field>

            <Toggle
              id="template-active"
              label="Template is active"
              description="Inactive templates stay saved but are skipped by the mailer."
              checked={form.isActive}
              onChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
              disabled={busy}
            />

            <ModalActions
              busy={busy}
              onCancel={() => setModal(null)}
              onConfirm={handleSave}
              confirmLabel={modal.kind === 'create' ? 'Create Template' : 'Update Template'}
            />
          </div>
        </Modal>
      )}

      {modal?.kind === 'delete' && (
        <Modal title="Soft delete template?" onClose={() => !busy && setModal(null)} width="40rem">
          <div className="space-y-5">
            {formError && <ErrorBanner>{formError}</ErrorBanner>}
            <p className="text-sm text-muted">
              This will set <span className="font-semibold text-ink">Is_Delete = 1</span> and
              <span className="font-semibold text-ink"> Is_Active = 0</span>. The row will stay in
              the audit trail, but the mailer should stop using it.
            </p>
            <div className="rounded-2xl border border-hairline bg-ivory-2 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">Template</p>
              <p className="mt-1 font-semibold text-ink">{modal.row.type}</p>
              <p className="text-sm text-muted mt-1">{modal.row.subject}</p>
            </div>
            <ModalActions
              busy={busy}
              onCancel={() => setModal(null)}
              onConfirm={handleDelete}
              confirmLabel="Soft Delete"
              tone="danger"
            />
          </div>
        </Modal>
      )}
    </>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="field-label block mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-hairline bg-ivory-2 p-4">
      <div>
        <label htmlFor={id} className="font-semibold text-sm text-ink cursor-pointer block">
          {label}
        </label>
        {description && <p className="text-xs text-muted mt-1">{description}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
        <input
          type="checkbox"
          id={id}
          className="sr-only peer"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
        />
        <div className="w-11 h-6 bg-[color:var(--color-border-strong)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[color:var(--color-accent-tint)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[color:var(--color-border-strong)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[color:var(--color-success)] peer-checked:after:border-transparent" />
      </label>
    </div>
  );
}

function emptyForm(): TemplateFormState {
  return {
    type: '',
    subject: '',
    text: '',
    isActive: true,
  };
}

function fromRow(row: EmailTemplateRowDto): TemplateFormState {
  return {
    type: row.type,
    subject: row.subject,
    text: row.text,
    isActive: row.isActive,
  };
}

function sortTemplates(rows: EmailTemplateRowDto[]): EmailTemplateRowDto[] {
  return [...rows].sort((a, b) => {
    const aTime = new Date(a.updatedDate ?? a.createdDate).getTime();
    const bTime = new Date(b.updatedDate ?? b.createdDate).getTime();
    return bTime - aTime;
  });
}

function previewText(text: string, length = 110): string {
  const flattened = text.replace(/\s+/g, ' ').trim();
  if (flattened.length <= length) return flattened;
  return `${flattened.slice(0, length - 1)}...`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function templateActiveTone(row: EmailTemplateRowDto): BadgeTone {
  if (row.isDelete) return 'danger';
  return row.isActive ? 'success' : 'warn';
}

function EnvelopeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}
