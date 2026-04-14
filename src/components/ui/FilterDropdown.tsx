import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FilterDropdownProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

export default function FilterDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
}: FilterDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 px-3 h-9 text-xs font-medium
                   border border-light-border dark:border-dark-border rounded-lg
                   bg-light-surface dark:bg-dark-surface
                   text-gray-700 dark:text-gray-300
                   hover:border-primary transition-colors whitespace-nowrap"
      >
        <span className="text-gray-400 dark:text-gray-500">{label}:</span>
        <span>{selected?.label ?? label}</span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 min-w-[160px]
                      border border-light-border dark:border-dark-border rounded-lg
                      bg-light-surface dark:bg-dark-surface shadow-lg
                      py-1 animate-in fade-in slide-in-from-top-1"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors
                ${
                  opt.value === value
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-border'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
