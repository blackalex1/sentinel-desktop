import React from 'react';
import { Cpu, RefreshCw, Clock } from 'lucide-react';
import { useI18n } from '../../i18n/i18nContext';

interface CoreManagerHeaderProps {
  lastCheckTime: string;
  isChecking: boolean;
  onRefresh: () => void;
}

export const CoreManagerHeader: React.FC<CoreManagerHeaderProps> = ({
  lastCheckTime,
  isChecking,
  onRefresh,
}) => {
  const { t } = useI18n();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-white/10 gap-4">
      <div className="flex items-center space-x-3.5">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-600/30 to-indigo-700/20 border border-purple-500/30 text-purple-300 shadow-glow-violet flex-shrink-0">
          <Cpu className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-base font-extrabold text-slate-100 font-sans tracking-wide">
              {t('cores_title')}
            </h1>
            <span className="px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-widest font-bold rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 whitespace-nowrap">
              Multi-Core Engine
            </span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-purple-400 font-mono mt-1">
            <Clock className="w-3 h-3" />
            <span>{t('cores_cache_label')} ({lastCheckTime})</span>
          </div>
        </div>
      </div>

      <button
        onClick={onRefresh}
        disabled={isChecking}
        className="flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-glow-violet transition-all active:scale-95 disabled:opacity-50 cursor-pointer whitespace-nowrap flex-shrink-0"
      >
        <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
        <span>{isChecking ? '...' : t('cores_check_updates')}</span>
      </button>
    </div>
  );
};
