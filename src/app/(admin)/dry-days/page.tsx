'use client';

import { useEffect, useState } from 'react';
import {
  addDryDay,
  ApiError,
  listDryDays,
  updateDryDay,
  deleteDryDay,
  type DryDayRowDto,
} from '@/lib/admin-api';
import {
  Card,
  ErrorBanner,
  Modal,
  ModalActions,
} from '@/components/ui';

// Static states for coverage panel
const INDIAN_STATES = [
  { name: 'Maharashtra', code: 'MH' },
  { name: 'Karnataka', code: 'KA' },
  { name: 'Goa', code: 'GA' },
  { name: 'Tamil Nadu', code: 'TN' },
  { name: 'Delhi NCR', code: 'DL' },
  { name: 'Telangana', code: 'TG' },
  { name: 'Rajasthan', code: 'RJ' },
];

export default function DryDaysPage() {
  const [rows, setRows] = useState<DryDayRowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeItem, setActiveItem] = useState<DryDayRowDto | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [stateCode, setStateCode] = useState('ALL');
  const [dryDate, setDryDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [recurring, setRecurring] = useState(false);

  async function reload() {
    try {
      setLoading(true); setError(null);
      const allDays = await listDryDays();
      setRows(allDays);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  function openAdd() {
    setActiveItem(null);
    setStateCode('ALL');
    setDryDate(new Date().toISOString().slice(0, 10));
    setTitle('');
    setDescription('');
    setRecurring(false);
    setShowFormModal(true);
  }

  function openEdit(row: DryDayRowDto) {
    setActiveItem(row);
    setStateCode(row.stateCode);
    setDryDate(row.dryDate);
    setTitle(row.title);
    setDescription(row.description || '');
    setRecurring(row.isRecurringYearly);
    setShowFormModal(true);
  }

  function openDelete(row: DryDayRowDto) {
    setActiveItem(row);
    setShowDeleteModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !stateCode.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        stateCode: stateCode.trim().toUpperCase(),
        dryDate,
        title: title.trim(),
        description: description.trim() || undefined,
        isRecurringYearly: recurring,
      };

      if (activeItem) {
        await updateDryDay(activeItem.id, payload);
      } else {
        await addDryDay(payload);
      }
      setShowFormModal(false);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!activeItem) return;
    setSubmitting(true);
    try {
      await deleteDryDay(activeItem.id);
      setShowDeleteModal(false);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete');
    } finally {
      setSubmitting(false);
    }
  }

  // Filter next 30 days for table
  const today = new Date();
  today.setHours(0,0,0,0);
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);
  
  const upcomingDays = rows.filter(r => {
      if (!r.isActive) return false;
      const d = new Date(r.dryDate);
      if (r.isRecurringYearly) {
         d.setFullYear(today.getFullYear());
         if (d < today) d.setFullYear(today.getFullYear() + 1);
      }
      return d >= today && d <= thirtyDaysFromNow;
  }).sort((a, b) => {
      const da = new Date(a.dryDate);
      if (a.isRecurringYearly) da.setFullYear(da.getFullYear() < today.getFullYear() ? today.getFullYear() : da.getFullYear());
      const db = new Date(b.dryDate);
      if (b.isRecurringYearly) db.setFullYear(db.getFullYear() < today.getFullYear() ? today.getFullYear() : db.getFullYear());
      return da.getTime() - db.getTime();
  });

  const getScope = (code: string) => code === 'ALL' ? 'National' : 'State';
  const formatDisplayDate = (dString: string) => {
     const d = new Date(dString);
     return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  
  const getStateName = (code: string) => INDIAN_STATES.find(s => s.code === code)?.name || code;

  // Coverage status calculation
  const getCoverageStatus = (code: string) => {
      const activeRows = rows.filter(r => r.isActive);
      const hasNational = activeRows.some(r => r.stateCode === 'ALL');
      const hasState = activeRows.some(r => r.stateCode === code);
      if (hasNational || hasState) return 'Configured';
      return 'Not configured';
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
           <h1 className="font-display text-2xl text-ink">Dry Day Calendar</h1>
           <p className="text-sm text-muted mt-1">Manage state-wise alcohol purchase restrictions</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary bg-[#4f46e5] border-none text-white hover:bg-[#4338ca] shadow-sm">
          + Add Dry Day
        </button>
      </div>

      <div className="bg-[#fffbeb] border border-[#fde68a] text-[#92400e] text-sm px-4 py-3 rounded-md mb-6 flex items-start gap-2 shadow-sm">
        <span aria-hidden="true" className="text-[#d97706] font-bold">⚠</span>
        <span>Dry day rules apply to <strong>new wallet purchases only</strong>. Users with existing wallets can continue to consume if the bar is serving. Dry day calendar is enforced automatically at checkout.</span>
      </div>

      {error && <div className="mb-4"><ErrorBanner>{error}</ErrorBanner></div>}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="h-full !p-0 overflow-hidden border-[#e5e7eb]">
             <div className="p-4 border-b border-[#e5e7eb] bg-white">
               <h3 className="font-display text-lg text-ink">Upcoming Dry Days (Next 30 Days)</h3>
             </div>
             <div className="overflow-x-auto bg-white">
               <table className="w-full text-left text-sm">
                 <thead className="text-[0.65rem] font-bold uppercase tracking-widest text-muted bg-gray-50 border-b border-gray-100">
                   <tr>
                     <th className="px-5 py-3">Date</th>
                     <th className="px-5 py-3">State / Region</th>
                     <th className="px-5 py-3">Occasion</th>
                     <th className="px-5 py-3">Scope</th>
                     <th className="px-5 py-3 text-right">Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {loading && upcomingDays.length === 0 ? (
                     <tr>
                       <td colSpan={5} className="text-center py-8 text-muted">Loading...</td>
                     </tr>
                   ) : upcomingDays.length === 0 ? (
                     <tr>
                       <td colSpan={5} className="text-center py-8 text-muted bg-white">No dry days in the next 30 days</td>
                     </tr>
                   ) : upcomingDays.map((r) => (
                     <tr key={r.id} className="bg-[#d97706] text-white border-b border-[#b45309]/30 last:border-0 hover:bg-[#c26a05] transition-colors">
                       <td className="px-5 py-4 font-medium whitespace-nowrap">{formatDisplayDate(r.dryDate)}</td>
                       <td className="px-5 py-4 whitespace-nowrap">{r.stateCode === 'ALL' ? 'All States' : getStateName(r.stateCode)}</td>
                       <td className="px-5 py-4">{r.title}</td>
                       <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white ${getScope(r.stateCode) === 'National' ? 'text-[#be123c]' : 'text-[#d97706]'}`}>
                             {getScope(r.stateCode)}
                          </span>
                       </td>
                       <td className="px-5 py-4 text-right whitespace-nowrap">
                         <button onClick={() => openEdit(r)} className="btn btn-sm bg-white border-none text-[#d97706] hover:bg-gray-100 mr-2 rounded-full px-4 font-semibold shadow-sm">Edit</button>
                         <button onClick={() => openDelete(r)} className="btn btn-sm bg-[#be123c] border-none text-white hover:bg-[#9f1239] rounded-full px-4 font-semibold shadow-sm">Remove</button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="h-full !p-0 border-[#e5e7eb] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[#e5e7eb] bg-white">
               <h3 className="font-display text-lg text-ink">State Coverage</h3>
            </div>
            <div className="p-4 bg-white flex-1">
                <ul className="divide-y divide-gray-100">
                {INDIAN_STATES.map((state) => {
                    const status = getCoverageStatus(state.code);
                    return (
                    <li key={state.code} className="flex items-center justify-between py-3 text-sm">
                        <span className="text-ink font-medium">{state.name}</span>
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full ${
                        status === 'Configured' ? 'bg-[#dcfce7] text-[#166534]' : 
                        status === 'Partial' ? 'bg-[#fef08a] text-[#854d0e]' : 'bg-gray-100 text-gray-500'
                        }`}>
                        {status === 'Configured' ? 'Configured ✓' : status}
                        </span>
                    </li>
                    );
                })}
                </ul>
            </div>
            <div className="p-4 bg-gray-50 border-t border-[#e5e7eb]">
               <button className="w-full btn btn-primary bg-[#4f46e5] border-none text-white hover:bg-[#4338ca] shadow-sm">Configure New State</button>
            </div>
          </Card>
        </div>
      </div>

      {showFormModal && (
        <Modal title={activeItem ? "Edit Dry Day" : "Add Dry Day"} onClose={() => !submitting && setShowFormModal(false)}>
          <form id="dryDayForm" onSubmit={handleSave} className="grid gap-4 mt-4">
            <Field label="State / Region" htmlFor="modal-state">
              <select id="modal-state" value={stateCode} onChange={e => setStateCode(e.target.value)} className="input">
                 <option value="ALL">All States (National)</option>
                 {INDIAN_STATES.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
                 {/* For cases where state isn't in static list but was saved in db */}
                 {activeItem && activeItem.stateCode !== 'ALL' && !INDIAN_STATES.some(s => s.code === activeItem.stateCode) && (
                     <option value={activeItem.stateCode}>{activeItem.stateCode} (Other)</option>
                 )}
              </select>
            </Field>
            <Field label="Date" htmlFor="modal-date">
              <input id="modal-date" type="date" required value={dryDate} onChange={e => setDryDate(e.target.value)} className="input" />
            </Field>
            <Field label="Occasion / Title" htmlFor="modal-title">
              <input id="modal-title" required value={title} onChange={e => setTitle(e.target.value)} maxLength={120} className="input" placeholder="e.g. Republic Day" />
            </Field>
            <Field label="Description (optional)" htmlFor="modal-desc">
              <textarea id="modal-desc" value={description} onChange={e => setDescription(e.target.value)} className="input min-h-[80px] py-2" placeholder="Internal notes or specific details about this dry day..." />
            </Field>
            <Field label="Recurrence" htmlFor="modal-rec">
              <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer h-10">
                <input id="modal-rec" type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} className="w-4 h-4 accent-[color:var(--color-accent)]" />
                Repeats yearly on this date
              </label>
            </Field>
          </form>
          <ModalActions busy={submitting} onCancel={() => setShowFormModal(false)} onConfirm={() => {
              const form = document.getElementById('dryDayForm');
              if (form) {
                  const event = new Event('submit', { cancelable: true, bubbles: true });
                  form.dispatchEvent(event);
              }
          }} confirmLabel={activeItem ? "Save Changes" : "Add Dry Day"} />
        </Modal>
      )}

      {showDeleteModal && (
        <Modal title="Remove Dry Day" onClose={() => !submitting && setShowDeleteModal(false)} width="26rem">
          <p className="text-sm text-muted mt-4">
            Are you sure you want to remove <strong>{activeItem?.title}</strong> ({activeItem ? formatDisplayDate(activeItem.dryDate) : ''})? 
          </p>
          <p className="text-sm text-muted mt-2">
            This will re-enable wallet purchases on this date for the affected region.
          </p>
          <div className="mt-6">
            <ModalActions busy={submitting} onCancel={() => setShowDeleteModal(false)} onConfirm={handleDelete} confirmLabel="Remove" tone="danger" />
          </div>
        </Modal>
      )}
    </>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="field-label block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
