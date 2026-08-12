import React, { useState, useEffect } from 'react';
import { X, Cpu, Download, RefreshCw, GitBranch, ExternalLink, Sparkles } from 'lucide-react';
import { CoreInfo, GitHubRelease, CoreType } from '../types/vpn';
import { GitHubCoreService } from '../services/githubService';
import { TauriBridge } from '../services/tauriBridge';

interface CoreManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCore: CoreType;
  onSelectActiveCore: (core: CoreType) => void;
  includePrereleases: boolean;
  onToggleIncludePrereleases: (value: boolean) => void;
}

export const CoreManagerModal: React.FC<CoreManagerModalProps> = ({
  isOpen,
  onClose,
  activeCore,
  onSelectActiveCore,
  includePrereleases,
  onToggleIncludePrereleases,
}) => {
  const [cores, setCores] = useState<CoreInfo[]>(GitHubCoreService.getCoresList());
  const [selectedCoreType, setSelectedCoreType] = useState<Exclude<CoreType, 'auto'>>('singbox');
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [isLoadingReleases, setIsLoadingReleases] = useState(false);
  const [downloadingTag, setDownloadingTag] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    if (isOpen) {
      loadReleases(selectedCoreType);
    }
  }, [isOpen, selectedCoreType, includePrereleases]);

  const loadReleases = async (coreType: Exclude<CoreType, 'auto'>) => {
    setIsLoadingReleases(true);
    try {
      const rels = await GitHubCoreService.fetchReleases(coreType, includePrereleases);
      setReleases(rels);
    } catch (err) {
      console.error('Error loading releases:', err);
    } finally {
      setIsLoadingReleases(false);
    }
  };

  const handleDownload = async (release: GitHubRelease) => {
    const downloadUrl = GitHubCoreService.findWindowsAsset(release, selectedCoreType);
    if (!downloadUrl) {
      alert(`Не найден бинарник Windows x64 для релиза ${release.tag_name}`);
      return;
    }

    setDownloadingTag(release.tag_name);
    setDownloadProgress(0);

    const success = await TauriBridge.downloadCoreFromGithub(
      selectedCoreType,
      downloadUrl,
      (percent) => setDownloadProgress(percent)
    );

    if (success) {
      setCores(prev => prev.map(c => 
        c.type === selectedCoreType ? { ...c, installedVersion: release.tag_name } : c
      ));
    }
    setDownloadingTag(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-xl double-bezel-shell bg-[#0a0a12] border border-white/10 shadow-2xl overflow-hidden">
        <div className="double-bezel-core p-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 font-sans">Менеджер ядер & GitHub Релизов</h3>
                <p className="text-xs text-slate-400 font-mono">
                  Скачивание Xray, Sing-box, Hysteria 2
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Pre-releases Toggle Bar */}
          <div className="flex items-center justify-between py-2.5 my-2 px-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div>
                <span className="text-xs font-medium text-slate-200">Показывать Pre-release (Бета)</span>
                <p className="text-[10px] text-slate-400">Свежие сборки с новейшими протоколами</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={includePrereleases}
                onChange={(e) => onToggleIncludePrereleases(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* Core Tabs & Active Selector */}
          <div className="grid grid-cols-3 gap-2 my-3">
            {cores.map(core => {
              const isActive = activeCore === core.type;
              return (
                <button
                  key={core.type}
                  onClick={() => {
                    setSelectedCoreType(core.type);
                    onSelectActiveCore(core.type);
                  }}
                  className={`relative p-2.5 rounded-xl border text-left spring-transition flex flex-col justify-between ${
                    isActive
                      ? 'bg-purple-500/15 border-purple-500/50 shadow-glow-violet text-purple-200'
                      : 'bg-white/[0.02] border-white/5 hover:border-white/20 text-slate-300'
                  }`}
                >
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between space-x-1">
                      <span className="text-xs font-bold font-sans truncate">{core.name}</span>
                      {isActive && (
                        <span className="px-1.5 py-0.2 text-[8px] font-mono bg-purple-500/40 text-purple-100 rounded border border-purple-400/30 whitespace-nowrap flex-shrink-0">
                          Активно
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] font-mono text-slate-400 whitespace-nowrap">
                    Версия: <span className="text-slate-200">{core.installedVersion || '—'}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* GitHub Releases Downloader List */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider flex items-center space-x-1.5">
                <GitBranch className="w-3.5 h-3.5 text-purple-400" />
                <span>Релизы GitHub ({selectedCoreType})</span>
              </h4>
              {isLoadingReleases && (
                <RefreshCw className="w-3.5 h-3.5 text-purple-400 animate-spin" />
              )}
            </div>

            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {releases.map(release => (
                <div
                  key={release.id}
                  className="p-2.5 rounded-xl bg-surface-elevated/70 border border-surface-border flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-100 font-mono truncate">{release.tag_name}</span>
                      {release.prerelease ? (
                        <span className="px-1.5 py-0.2 text-[9px] font-mono bg-amber-500/20 text-amber-300 rounded border border-amber-500/30 whitespace-nowrap">
                          Pre-release
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 text-[9px] font-mono bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 whitespace-nowrap">
                          Stable
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5 font-sans">
                      {release.name || release.body}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <a
                      href={release.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                      title="Открыть на GitHub"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    {downloadingTag === release.tag_name ? (
                      <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-purple-500/20 rounded-xl border border-purple-500/40 text-xs font-mono text-purple-300">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>{downloadProgress}%</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDownload(release)}
                        className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow transition-all duration-200 active:scale-95 whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Скачать</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
