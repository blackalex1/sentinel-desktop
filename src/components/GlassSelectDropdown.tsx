import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption<T = string> {
  value: T;
  label: string;
  badge?: string;
  badgeType?: 'stable' | 'prerelease' | 'info';
  isInstalled?: boolean;
}

interface GlassSelectDropdownProps<T = string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
}

export function GlassSelectDropdown<T extends string = string>({
  value,
  options,
  onChange,
  placeholder = 'Выберите...',
  className = '',
}: GlassSelectDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* Selected Dropdown Trigger Button (Clean, crisp, no overflow) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none bg-[#080b18] hover:bg-[#0d1226] border-purple-500/30 text-purple-200 shadow-[0_2px_10px_rgba(0,0,0,0.3)] hover:border-purple-500/50 ${
          isOpen ? 'ring-2 ring-purple-500/40 border-purple-400' : ''
        }`}
      >
        <span className="truncate pr-1">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180 text-purple-400' : ''
          }`}
        />
      </button>

      {/* Floating Glass Dropdown Popup Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 max-h-60 overflow-y-auto bg-[#0a0e22] border border-purple-500/30 rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.9)] p-1 space-y-0.5 animate-fadeIn min-w-full w-max max-w-[220px]">
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 text-xs font-mono rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-purple-600/30 text-purple-200 font-bold border border-purple-500/40'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2 truncate pr-2">
                  <span className="truncate">{option.label}</span>
                  {option.badge && (
                    <span
                      className={`px-1.5 py-0.2 text-[9px] font-mono font-bold rounded flex-shrink-0 ${
                        option.badgeType === 'prerelease'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : option.badgeType === 'stable'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}
                    >
                      {option.badge}
                    </span>
                  )}
                  {option.isInstalled && (
                    <span className="text-[10px] text-slate-400 italic flex-shrink-0">
                      — [OK]
                    </span>
                  )}
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
