import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  id: string;
  label: string;
}

interface ModernSelectProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string; // wrapper class
}

function useOnClickOutside<T extends HTMLElement>(ref: React.RefObject<T | null>, handler: () => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler();
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

export function ModernSelect({ value, options, onChange, placeholder = 'Select...', className = '' }: ModernSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useOnClickOutside(ref, () => setIsOpen(false));

  const selectedLabel = options.find((o) => o.id === value)?.label || placeholder;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-3 w-full rounded-xl bg-bg-element hover:bg-bg-panel-hover border border-border transition-colors text-sm font-medium text-text-primary justify-between active:scale-95 text-left focus:outline-none focus:border-accent-primary"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-full min-w-[160px] bg-bg-panel border border-border rounded-xl shadow-xl overflow-hidden py-1 z-[100] animate-in fade-in zoom-in-95 duration-100">
          <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
            {options.map((option) => (
                <button
                key={option.id}
                onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors text-left ${
                    value === option.id 
                    ? 'bg-accent-primary/10 text-accent-primary font-medium' 
                    : 'text-text-secondary hover:bg-bg-panel-hover hover:text-text-primary'
                }`}
                >
                <span className="truncate mr-2">{option.label}</span>
                {value === option.id && <Check className="w-4 h-4 flex-shrink-0" />}
                </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
