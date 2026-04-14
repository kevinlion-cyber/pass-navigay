import { useEffect, type ReactNode } from 'react';
import { X, Loader2 } from 'lucide-react';

interface AdminEditSidebarProps {
  open: boolean;
  title: string;
  loading: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
}

function SkeletonLoader() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i}>
          <div className="h-3 w-20 bg-[#1e1e2e] rounded mb-2" />
          <div className="h-12 bg-[#1e1e2e] rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export default function AdminEditSidebar({
  open,
  title,
  loading,
  saving,
  onClose,
  onSave,
  children,
}: AdminEditSidebarProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleEsc);
    }
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-[999] transition-opacity duration-[250ms] ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed top-0 right-0 h-screen z-[1000] w-full md:w-[420px] transition-transform duration-[250ms] ease-out flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ background: '#0f0f17', borderLeft: '1px solid #1e1e2e' }}
      >
        <div
          className="shrink-0 flex items-center justify-between px-6 py-5 sticky top-0 z-10"
          style={{ background: '#14141e', borderBottom: '1px solid #1e1e2e' }}
        >
          <span className="text-[16px] font-bold text-white">{title}</span>
          <button onClick={onClose} className="text-[#606070] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <SkeletonLoader />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {children}
            </div>

            <div
              className="shrink-0 flex gap-3 px-6 py-5 sticky bottom-0"
              style={{ background: '#14141e', borderTop: '1px solid #1e1e2e' }}
            >
              <button
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg text-[14px] transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ background: 'transparent', border: '1px solid #2a2a3a', color: '#a0a0b0' }}
              >
                Annuler
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className="flex-[2] py-2.5 rounded-lg text-[14px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: '#7B2D8B' }}
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export function SidebarField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <label className="block text-[12px] uppercase tracking-[0.5px] text-[#a0a0b0] mb-1.5">{label}</label>
      {children}
      {error && <p className="text-[12px] text-[#c0392b] mt-1">{error}</p>}
    </div>
  );
}

export function SidebarInput({
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  error,
  min,
  max,
  step,
}: {
  value: string | number;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  error?: boolean;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      min={min}
      max={max}
      step={step}
      className="w-full px-3.5 py-2.5 rounded-lg text-[14px] text-white outline-none transition-colors"
      style={{
        background: '#1a1a24',
        border: `1px solid ${error ? '#c0392b' : '#2a2a3a'}`,
      }}
      onFocus={(e) => { if (!error) (e.target as HTMLInputElement).style.borderColor = '#7B2D8B'; }}
      onBlur={(e) => { if (!error) (e.target as HTMLInputElement).style.borderColor = '#2a2a3a'; }}
    />
  );
}

export function SidebarTextarea({
  value,
  onChange,
  placeholder,
  error,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  error?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3.5 py-2.5 rounded-lg text-[14px] text-white outline-none resize-y transition-colors"
      style={{
        background: '#1a1a24',
        border: `1px solid ${error ? '#c0392b' : '#2a2a3a'}`,
        minHeight: '100px',
      }}
      onFocus={(e) => { if (!error) (e.target as HTMLTextAreaElement).style.borderColor = '#7B2D8B'; }}
      onBlur={(e) => { if (!error) (e.target as HTMLTextAreaElement).style.borderColor = '#2a2a3a'; }}
    />
  );
}

export function SidebarSelect({
  value,
  onChange,
  options,
  error,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  error?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3.5 py-2.5 rounded-lg text-[14px] text-white outline-none appearance-none transition-colors"
      style={{
        background: '#1a1a24',
        border: `1px solid ${error ? '#c0392b' : '#2a2a3a'}`,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23606070' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        paddingRight: '36px',
      }}
      onFocus={(e) => { if (!error) (e.target as HTMLSelectElement).style.borderColor = '#7B2D8B'; }}
      onBlur={(e) => { if (!error) (e.target as HTMLSelectElement).style.borderColor = '#2a2a3a'; }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function SidebarToggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className="w-[44px] h-[24px] rounded-full transition-colors relative shrink-0"
          style={{ background: checked ? '#7B2D8B' : '#2a2a3a' }}
        >
          <span
            className="absolute top-[2px] w-[20px] h-[20px] rounded-full bg-white transition-transform"
            style={{ left: checked ? '22px' : '2px' }}
          />
        </button>
        <span className="text-[14px] text-white">{label}</span>
      </div>
      {description && (
        <p className="text-[12px] text-[#606070] mt-1 ml-[56px]">{description}</p>
      )}
    </div>
  );
}
