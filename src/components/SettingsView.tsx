import React from 'react';
import { Sliders, Network, Cpu, Globe } from 'lucide-react';
import { AppSettings, CoreType, LogLevel } from '../types/vpn';
import { GlassSelectDropdown, SelectOption } from './GlassSelectDropdown';
import { TauriBridge } from '../services/tauriBridge';
import { useI18n } from '../i18n/i18nContext';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onOpenRoutingManager: () => void;
}

const CORE_OPTIONS: SelectOption<CoreType>[] = [
  { value: 'singbox', label: 'Sing-box' },
  { value: 'xray', label: 'Xray' },
  { value: 'hysteria', label: 'Hysteria 2' },
];

const LOG_LEVEL_OPTIONS: SelectOption<LogLevel>[] = [
  { value: 'info', label: 'INFO', badge: 'INFO', badgeType: 'stable' },
  { value: 'debug', label: 'DEBUG', badge: 'DEBUG', badgeType: 'info' },
  { value: 'warn', label: 'WARN', badge: 'WARN', badgeType: 'prerelease' },
  { value: 'error', label: 'ERROR', badge: 'ERROR', badgeType: 'prerelease' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-[#060812] select-none animate-fadeIn space-y-6 max-w-6xl mx-auto">
      {/* Top Banner Header */}
      <div className="flex items-center justify-between pb-5 border-b border-white/10">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-600/30 to-indigo-700/20 border border-purple-500/30 text-purple-300 shadow-glow-violet">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-base font-extrabold text-slate-100 font-sans tracking-wide">
                {t('set_title')}
              </h1>
              <span className="px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-widest font-bold rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300">
                System Options
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1">
              {t('set_subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Language Selector Top Row Card */}
      <div className="p-5 rounded-2xl bg-[#0a0d1a] border border-white/10 flex items-center justify-between shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-100 font-sans block">{t('set_language')}</span>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">{t('set_language_desc')}</p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 p-1 bg-[#060812] border border-white/15 rounded-xl font-mono text-xs">
          <button
            type="button"
            onClick={() => setLanguage('ru')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              language === 'ru'
                ? 'bg-purple-600 text-white shadow-glow-violet'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🇷🇺 Русский
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              language === 'en'
                ? 'bg-purple-600 text-white shadow-glow-violet'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🇬🇧 English
          </button>
        </div>
      </div>

      {/* Grid Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Network & Protocol Settings Card */}
        <div className="p-5 rounded-2xl bg-[#0a0d1a] border border-white/10 space-y-4 shadow-xl">
          <div className="flex items-center space-x-2.5 text-xs font-bold text-purple-400 font-mono pb-2 border-b border-white/5">
            <Network className="w-4 h-4" />
            <span>{t('set_section_network')}</span>
          </div>

          {/* TUN Mode Toggle */}
          <div className="flex items-center justify-between py-2">
            <div className="flex-1 min-w-0 pr-3">
              <span className="text-xs font-bold text-slate-100 font-sans block">{t('set_tun_mode')}</span>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {t('set_tun_mode_desc')}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                const nextTun = !settings.tunMode;
                if (nextTun) {
                  const isAdmin = await TauriBridge.checkIsAdmin();
                  if (!isAdmin) {
                    await TauriBridge.requestAdminElevation();
                    return;
                  }
                  const cores = await TauriBridge.checkInstalledCores();
                  if (cores && !cores.wintun) {
                    await TauriBridge.downloadCoreFromGithub('wintun' as any, '');
                  }
                }
                onUpdateSettings({ tunMode: nextTun });
              }}
              className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 flex items-center flex-shrink-0 cursor-pointer ${
                settings.tunMode ? 'bg-purple-600 justify-end' : 'bg-slate-800 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-md" />
            </button>
          </div>

          {/* System Proxy Toggle */}
          <div className="flex items-center justify-between py-2 border-t border-white/5">
            <div className="flex-1 min-w-0 pr-3">
              <span className="text-xs font-bold text-slate-100 font-sans block">{t('set_sys_proxy')}</span>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {t('set_sys_proxy_desc')} (127.0.0.1:{settings.httpPort || 10809})
              </p>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ systemProxy: !settings.systemProxy })}
              className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 flex items-center flex-shrink-0 cursor-pointer ${
                settings.systemProxy ? 'bg-purple-600 justify-end' : 'bg-slate-800 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-md" />
            </button>
          </div>

          {/* LAN Sharing Toggle */}
          <div className="flex items-center justify-between py-2 border-t border-white/5">
            <div className="flex-1 min-w-0 pr-3">
              <span className="text-xs font-bold text-slate-100 font-sans block">{t('set_lan_sharing')}</span>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {t('set_lan_sharing_desc')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ lanSharing: !settings.lanSharing })}
              className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 flex items-center flex-shrink-0 cursor-pointer ${
                settings.lanSharing ? 'bg-purple-600 justify-end' : 'bg-slate-800 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-md" />
            </button>
          </div>
        </div>

        {/* Engine & Automation Settings Card */}
        <div className="p-5 rounded-2xl bg-[#0a0d1a] border border-white/10 space-y-4 shadow-xl">
          <div className="flex items-center space-x-2.5 text-xs font-bold text-emerald-400 font-mono pb-2 border-b border-white/5">
            <Cpu className="w-4 h-4" />
            <span>{t('set_section_engine')}</span>
          </div>

          {/* Core Selection Dropdown */}
          <div className="flex items-center justify-between py-2 gap-3">
            <div className="flex-1 min-w-0 pr-2">
              <span className="text-xs font-bold text-slate-100 font-sans block">{t('set_default_core')}</span>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {t('set_default_core_desc')}
              </p>
            </div>
            <div className="w-36 flex-shrink-0">
              <GlassSelectDropdown
                value={settings.activeCore}
                options={CORE_OPTIONS}
                onChange={(val) => onUpdateSettings({ activeCore: val })}
              />
            </div>
          </div>

          {/* Log Level Selection Dropdown */}
          <div className="flex items-center justify-between py-2 border-t border-white/5 gap-3">
            <div className="flex-1 min-w-0 pr-2">
              <span className="text-xs font-bold text-slate-100 font-sans block">{t('set_log_level')}</span>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {t('set_log_level_desc')}
              </p>
            </div>
            <div className="w-36 flex-shrink-0">
              <GlassSelectDropdown
                value={settings.logLevel || 'info'}
                options={LOG_LEVEL_OPTIONS}
                onChange={(val) => onUpdateSettings({ logLevel: val })}
              />
            </div>
          </div>

          {/* Auto Connect Toggle */}
          <div className="flex items-center justify-between py-2 border-t border-white/5">
            <div className="flex-1 min-w-0 pr-3">
              <span className="text-xs font-bold text-slate-100 font-sans block">{t('set_auto_connect')}</span>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {t('set_auto_connect_desc')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ autoConnect: !settings.autoConnect })}
              className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 flex items-center flex-shrink-0 cursor-pointer ${
                settings.autoConnect ? 'bg-purple-600 justify-end' : 'bg-slate-800 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-md" />
            </button>
          </div>

          {/* Auto Start Toggle */}
          <div className="flex items-center justify-between py-2 border-t border-white/5">
            <div className="flex-1 min-w-0 pr-3">
              <span className="text-xs font-bold text-slate-100 font-sans block">{t('set_auto_start')}</span>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {t('set_auto_start_desc')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ autoStart: !settings.autoStart })}
              className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 flex items-center flex-shrink-0 cursor-pointer ${
                settings.autoStart ? 'bg-purple-600 justify-end' : 'bg-slate-800 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-md" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
