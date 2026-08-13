import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { CoreVersionItem } from './CoreManagerView';

interface CustomSelectDropdownProps {
  value: string;
  options: CoreVersionItem[];
  installedVersion: string;
  onChange: (version: string) => void;
}

export const CustomSelectDropdown: React.FC<CustomSelectDropdownProps> = ({
  value,
  options,
  installedVersion,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanTagVersion = (v: string) => {
    if (!v) return '';
    let cleaned = v.trim();
    if (cleaned.toLowerCase().startsWith('app/')) {
      cleaned = cleaned.substring(4);
    }
    if (!cleaned.startsWith('v') && !cleaned.startsWith('V')) {
      cleaned = `v${cleaned}`;
    }
    return cleaned;
  };

  const normVer = (v: string) => cleanTagVersion(v).replace(/^v/i, '');

  const selectedItem = options.find((o) => normVer(o.version) === normVer(value)) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatOptionLabel = (item: CoreVersionItem) => {
    const isInstalled = normVer(item.version) === normVer(installedVersion);
    const tagStr = item.isPrerelease ? 'Pre-release' : 'Stable';
    const verText = cleanTagVersion(item.version);
    return `${verText} (${tagStr})${isInstalled ? ' — [Установлено]' : ''}`;
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Selected Dropdown Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none ${
          selectedItem?.isPrerelease
            ? 'bg-[#080b18] border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
            : 'bg-[#080b18] border-purple-500/30 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
        }`}
      >
        <span className="truncate pr-2">
          {selectedItem ? formatOptionLabel(selectedItem) : cleanTagVersion(value)}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180 text-purple-400' : ''
          }`}
        />
      </button>

      {/* Custom Glass Dropdown Popup Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-56 overflow-y-auto bg-[#0a0e22] border border-purple-500/30 rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.85)] p-1 space-y-0.5 animate-fadeIn">
          {options.map((item) => {
            const isSelected = normVer(item.version) === normVer(value);

            return (
              <button
                key={item.version}
                type="button"
                onClick={() => {
                  onChange(cleanTagVersion(item.version));
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs font-mono rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-purple-600/30 text-purple-200 font-bold border border-purple-500/40'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="truncate pr-2">
                  {formatOptionLabel(item)}
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
