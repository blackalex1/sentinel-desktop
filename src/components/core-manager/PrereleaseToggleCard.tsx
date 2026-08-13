import React from 'react';
import { Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n/i18nContext';

interface PrereleaseToggleCardProps {
  includePrereleases: boolean;
  onToggle: (val: boolean) => void;
}

export const PrereleaseToggleCard: React.FC<PrereleaseToggleCardProps> = ({
  includePrereleases,
  onToggle,
}) => {
  const { t } = useI18n();

  return (
    <div className="p-5 rounded-2xl bg-[#0a0d1a] border border-white/10 shadow-xl flex items-center justify-between">
      <div className="flex items-center space-x-3.5 pr-4">
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex-shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-100 font-sans">{t('cores_prereleases')}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onToggle(!includePrereleases)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          includePrereleases ? 'bg-amber-500' : 'bg-slate-800'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
            includePrereleases ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};
