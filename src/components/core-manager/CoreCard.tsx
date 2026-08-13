import React from 'react';
import { CheckCircle, ExternalLink, Download, Check } from 'lucide-react';
import { CoreType } from '../../types/vpn';
import { ExtendedCoreInfo, cleanTagVersion } from './types';
import { GlassSelectDropdown, SelectOption } from '../GlassSelectDropdown';
import { useI18n } from '../../i18n/i18nContext';

interface CoreCardProps {
  core: ExtendedCoreInfo;
  activeCore: CoreType;
  includePrereleases: boolean;
  selectedVersion: string;
  onSelectVersion: (coreType: string, version: string) => void;
  onDownloadCore: (coreType: Exclude<CoreType, 'auto'>) => void;
  onSelectActiveCore: (core: CoreType) => void;
}

export const CoreCard: React.FC<CoreCardProps> = ({
  core,
  activeCore,
  includePrereleases,
  selectedVersion,
  onSelectVersion,
  onDownloadCore,
  onSelectActiveCore,
}) => {
  const { t } = useI18n();

  const isSelected = activeCore === core.type;
  const normVer = (v: string) => cleanTagVersion(v).replace(/^v/i, '');

  // Filter versions based on Pre-release toggle
  const filteredVersions = core.availableVersions.filter(v => includePrereleases || !v.isPrerelease);

  const currentVerStr = cleanTagVersion(selectedVersion || core.latestVersion);
  const selectedVerObj = core.availableVersions.find(v => normVer(v.version) === normVer(currentVerStr));
  const isCurrentInstalled = !!core.installedVersion && normVer(currentVerStr) === normVer(core.installedVersion);

  // Convert to standardized SelectOption items
  const versionOptions: SelectOption[] = filteredVersions.map((item) => ({
    value: item.version,
    label: item.version,
    badge: item.isPrerelease ? 'Pre-release' : 'Stable',
    badgeType: item.isPrerelease ? 'prerelease' : 'stable',
    isInstalled: !!core.installedVersion && normVer(item.version) === normVer(core.installedVersion),
  }));

  return (
    <div
      className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-5 ${
        isSelected
          ? 'bg-gradient-to-b from-[#12182e] to-[#0a0d1a] border-purple-500/40 shadow-glow-violet'
          : 'bg-[#0a0d1a] border-white/10 hover:border-white/20'
      }`}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-extrabold text-slate-100 font-sans tracking-wide">{core.name}</span>
          {isSelected ? (
            <span className="px-2.5 py-0.5 text-[9px] font-mono font-bold rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center space-x-1">
              <CheckCircle className="w-3 h-3" />
              <span>{t('cores_active_badge')}</span>
            </span>
          ) : (
            <span className="px-2 py-0.5 text-[9px] font-mono text-slate-500 uppercase">
              {t('cores_available_badge')}
            </span>
          )}
        </div>

        <a
          href={`https://github.com/${core.repo}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-1.5 text-xs text-purple-400 hover:text-purple-300 font-mono transition-colors"
        >
          <span>{core.repo}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>

        {/* Installed Version Row */}
        <div className="space-y-2 pt-3 border-t border-white/5 font-mono text-xs">
          <div className="flex justify-between items-center gap-2 text-slate-400">
            <span className="shrink-0">{t('cores_installed_label')}</span>
            <span className={core.installedVersion || core.type === ('wintun' as any) ? "text-slate-200 font-bold truncate" : "text-amber-400 font-medium shrink-0"}>
              {core.type === ('wintun' as any) ? 'v0.14.1 (Встроен)' : (core.installedVersion ? cleanTagVersion(core.installedVersion) : t('cores_not_installed'))}
            </span>
          </div>
        </div>

        {core.type !== ('wintun' as any) && (
          <div className="space-y-1.5 pt-1 font-mono text-xs">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-400 font-mono">{t('cores_available_github')}</span>
            </div>

            <GlassSelectDropdown
              options={versionOptions}
              value={currentVerStr}
              onChange={(val) => onSelectVersion(core.type, val)}
              placeholder="Выберите версию..."
            />
          </div>
        )}
      </div>

      {/* Action Buttons & Progress Bar */}
      <div className="space-y-2 pt-2">
        {core.type === ('wintun' as any) ? (
          <div className="flex items-center space-x-2">
            <div className="flex-1 flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-semibold font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 cursor-default">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Встроен в дистрибутив</span>
            </div>
          </div>
        ) : core.isDownloading ? (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-mono text-purple-300">
              <span>{t('cores_downloading')}...</span>
              <span>{core.downloadProgress || 0}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-200"
                style={{ width: `${core.downloadProgress || 0}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onDownloadCore(core.type)}
              disabled={isCurrentInstalled}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-xl text-xs font-semibold font-mono transition-all cursor-pointer ${
                isCurrentInstalled
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 cursor-default opacity-90'
                  : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 active:scale-95'
              }`}
            >
              {isCurrentInstalled ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('cores_installed_label')}</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('cores_install_ver')}</span>
                </>
              )}
            </button>

            <button
              onClick={() => onSelectActiveCore(core.type)}
              disabled={isSelected || !core.installedVersion}
              className={`py-2 px-3 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                isSelected
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : core.installedVersion
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-glow-violet active:scale-95'
                  : 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed'
              }`}
            >
              {isSelected ? t('cores_selected_btn') : t('cores_select_btn')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
