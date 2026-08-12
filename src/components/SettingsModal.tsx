import React from 'react';
import { X, Settings, Shield, Cpu, Globe, Network, SlidersHorizontal, ExternalLink } from 'lucide-react';
import { AppSettings, CoreType } from '../types/vpn';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onOpenRoutingManager: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onOpenRoutingManager,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-lg double-bezel-shell bg-[#080914] border border-white/10 shadow-2xl overflow-hidden">
        <div className="double-bezel-core p-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 font-sans tracking-wide">Настройки Sentinel Secure Connect</h3>
                <p className="text-xs text-slate-400 font-mono">
                  Конфигурация режимов сетевого туннелирования и системного взаимодействия
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

          <div className="space-y-3.5 my-3.5 max-h-[70vh] overflow-y-auto pr-1">
            {/* Quick Open Full Routing Rules Manager Button */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-transparent border border-purple-500/30 flex items-center justify-between shadow-glow-violet">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-100 block">Менеджер правил маршрутизации</span>
                  <span className="text-[10px] text-slate-400 font-mono block">Быстрые блокировки Ads/BitTorrent и Drag-and-Drop таблица</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRoutingManager();
                }}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-glow-violet transition-all active:scale-95 whitespace-nowrap cursor-pointer"
              >
                <span>Открыть</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* TUN Mode (Wintun Adapter) */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0e1324] border border-white/5">
              <div className="flex items-start space-x-3">
                <Shield className="w-4 h-4 text-emerald-400 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-slate-200">TUN Режим (Wintun.dll)</span>
                  <p className="text-[11px] text-slate-400">
                    Нативный виртуальный VPN-адаптер Windows 11. Направляет 100% трафика ПК.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.tunMode}
                  onChange={(e) => onUpdateSettings({ tunMode: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* System Proxy */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0e1324] border border-white/5">
              <div className="flex items-start space-x-3">
                <Network className="w-4 h-4 text-cyan-400 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-slate-200">Системный прокси (SOCKS5/HTTP)</span>
                  <p className="text-[11px] text-slate-400">
                    Устанавливает прокси 127.0.0.1:{settings.socksPort || 10808} в параметры Windows.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.systemProxy}
                  onChange={(e) => onUpdateSettings({ systemProxy: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            {/* Visual Theme Selector */}
            <div className="p-3.5 rounded-xl bg-[#0e1324] border border-white/5">
              <div className="flex items-center space-x-2 mb-2">
                <Globe className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-slate-200">Визуальная тема оформления</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ theme: 'cosmic' })}
                  className={`py-2 px-3 text-xs rounded-xl border transition-all ${
                    settings.theme === 'cosmic'
                      ? 'bg-purple-600/30 text-purple-200 border-purple-500/50 font-bold shadow-glow-violet'
                      : 'bg-white/[0.02] text-slate-400 border-white/5 hover:text-slate-200'
                  }`}
                >
                  🌌 Cosmic Night Glass
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ theme: 'oled' })}
                  className={`py-2 px-3 text-xs rounded-xl border transition-all ${
                    settings.theme === 'oled'
                      ? 'bg-emerald-600/30 text-emerald-200 border-emerald-500/50 font-bold shadow-glow-emerald'
                      : 'bg-white/[0.02] text-slate-400 border-white/5 hover:text-slate-200'
                  }`}
                >
                  🖤 Minimalist OLED Dark
                </button>
              </div>
            </div>

            {/* Active Proxy Core Default */}
            <div className="p-3.5 rounded-xl bg-[#0e1324] border border-white/5">
              <div className="flex items-center space-x-2 mb-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-slate-200">Основное ядро прокси по умолчанию</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['singbox', 'xray', 'hysteria'] as CoreType[]).map(core => (
                  <button
                    key={core}
                    onClick={() => onUpdateSettings({ activeCore: core })}
                    className={`py-1.5 px-3 text-xs font-mono capitalize rounded-lg border transition-all ${
                      settings.activeCore === core
                        ? 'bg-purple-500/20 text-purple-200 border-purple-500/40 font-bold'
                        : 'bg-white/[0.02] text-slate-400 border-white/5 hover:text-slate-200'
                    }`}
                  >
                    {core}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto Start & Auto Connect */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e1324] border border-white/5">
                <span className="text-xs text-slate-300">Автозапуск с Windows</span>
                <input
                  type="checkbox"
                  checked={settings.autoStart}
                  onChange={(e) => onUpdateSettings({ autoStart: e.target.checked })}
                  className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e1324] border border-white/5">
                <span className="text-xs text-slate-300">Автоподключение</span>
                <input
                  type="checkbox"
                  checked={settings.autoConnect}
                  onChange={(e) => onUpdateSettings({ autoConnect: e.target.checked })}
                  className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-white/10">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-medium transition-all active:scale-95 shadow-glow-violet cursor-pointer"
            >
              Сохранить и закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
