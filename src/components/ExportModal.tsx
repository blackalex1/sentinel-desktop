import React, { useState } from 'react';
import { X, Copy, Download, Check, FileText, Code2, Layers, ShieldCheck } from 'lucide-react';
import { VpnServer, AppSettings } from '../types/vpn';
import { ProxyParser } from '../services/proxyParser';
import { ConfigBuilder } from '../services/configBuilder';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  servers: VpnServer[];
  selectedServer: VpnServer | null;
  settings: AppSettings;
  onShowToast: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  servers,
  selectedServer,
  settings,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'links' | 'json' | 'core'>('links');
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const getLinksPayload = () => {
    return servers.map(s => ProxyParser.generateLink(s)).join('\n');
  };

  const getJsonPayload = () => {
    return JSON.stringify(servers, null, 2);
  };

  const getCorePayload = () => {
    if (!selectedServer) return '// Выберите сервер для формирования конфигурации';
    const compiled = ConfigBuilder.buildConfig(selectedServer, settings);
    return compiled.configJson;
  };

  const currentPayload = activeTab === 'links'
    ? getLinksPayload()
    : activeTab === 'json'
    ? getJsonPayload()
    : getCorePayload();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentPayload);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      onShowToast('Скопировано в буфер', 'Данные экспорта успешно скопированы', 'success');
    } catch (err) {
      onShowToast('Ошибка', 'Не удалось скопировать данные в буфер обмена', 'error');
    }
  };

  const handleDownload = () => {
    try {
      let filename = 'sentinel_servers.txt';
      let mimeType = 'text/plain;charset=utf-8';

      if (activeTab === 'json') {
        filename = `sentinel_servers_backup_${new Date().toISOString().slice(0, 10)}.json`;
        mimeType = 'application/json;charset=utf-8';
      } else if (activeTab === 'core') {
        filename = `${settings.activeCore}_config_${selectedServer?.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'server'}.json`;
        mimeType = 'application/json;charset=utf-8';
      }

      const blob = new Blob([currentPayload], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onShowToast('Файл сохранен', `Экспортирован файл ${filename}`, 'success');
    } catch (err) {
      onShowToast('Ошибка скачивания', 'Не удалось сохранить файл', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 animate-fade-in">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#161626] to-[#0d0d16] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-tr from-purple-500/20 to-teal-500/20 rounded-xl border border-purple-500/30 text-purple-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Экспорт и Резервное Копирование
              </h3>
              <p className="text-xs text-slate-400">
                Сохранение профилей ({servers.length} шт.), ссылок и конфигураций ядра
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center space-x-2 px-6 pt-4 border-b border-white/5 pb-3">
          <button
            onClick={() => setActiveTab('links')}
            className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'links'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-white bg-white/[0.02] border border-transparent'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Ссылки подключения (URI)</span>
          </button>

          <button
            onClick={() => setActiveTab('json')}
            className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'json'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-white bg-white/[0.02] border border-transparent'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Полный бэкап (JSON)</span>
          </button>

          <button
            onClick={() => setActiveTab('core')}
            className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'core'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-white bg-white/[0.02] border border-transparent'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Конфиг ядра ({settings.activeCore})</span>
          </button>
        </div>

        {/* Code Content Area */}
        <div className="p-6 flex-1 flex flex-col min-h-0">
          <div className="relative flex-1 bg-[#090910] border border-white/10 rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 bg-white/[0.02] border-b border-white/5 text-[11px] text-slate-400 font-mono">
              <span className="flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {activeTab === 'links' ? `${servers.length} ссылок в формате URI` : activeTab === 'json' ? 'Полный список серверов в JSON' : `Готовый JSON для запуска в ${settings.activeCore}`}
                </span>
              </span>
              <span>{currentPayload.length} символов</span>
            </div>
            <textarea
              readOnly
              value={currentPayload}
              className="w-full flex-1 p-3 bg-transparent text-slate-200 font-mono text-xs focus:outline-none resize-none select-all overflow-y-auto leading-relaxed"
              rows={12}
            />
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-white/[0.02]">
          <span className="text-xs text-slate-500 font-sans">
            Совместимо с Sentinel, v2rayN, sing-box, Xray и мобильным x-prox
          </span>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleCopy}
              className="flex items-center space-x-2 px-4 py-2 bg-white/[0.06] hover:bg-white/10 text-white rounded-xl text-xs font-semibold transition-all border border-white/10 active:scale-95 cursor-pointer"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
              <span>{isCopied ? 'Скопировано!' : 'Скопировать всё'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Скачать файл</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
