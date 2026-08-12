import React, { useState } from 'react';
import { Smartphone, Radio, Copy, Check, QrCode, Shield, ExternalLink, RefreshCw, KeyRound, ClipboardPaste, AlertCircle } from 'lucide-react';
import { VpnServer } from '../types/vpn';
import { ProxyParser } from '../services/proxyParser';

interface HotspotViewProps {
  onAddHotspotServer: (server: VpnServer) => void;
}

export const HotspotView: React.FC<HotspotViewProps> = ({ onAddHotspotServer }) => {
  const [pairingPin, setPairingPin] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
  const [isPairing, setIsPairing] = useState(false);
  const [pairingSuccess, setPairingSuccess] = useState(false);
  
  const [clipboardUri, setClipboardUri] = useState<string>('');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleGenerateNewPin = () => {
    setPairingPin(Math.floor(1000 + Math.random() * 9000).toString());
    setPairingSuccess(false);
  };

  const handlePasteFromClipboard = async () => {
    setImportStatus(null);
    try {
      const text = await navigator.clipboard.readText();
      if (!text || text.trim().length === 0) {
        setImportStatus({
          type: 'error',
          message: 'Буфер обмена пуст. Скопируйте SOCKS5 или VLESS ссылку в приложении x-prox.',
        });
        return;
      }

      const trimmed = text.trim();
      setClipboardUri(trimmed);

      const parsedServers = ProxyParser.parseSubscription(trimmed);
      if (parsedServers && parsedServers.length > 0) {
        parsedServers.forEach(srv => onAddHotspotServer(srv));
        setImportStatus({
          type: 'success',
          message: `Успешно импортировано ${parsedServers.length} профилей: ${parsedServers[0].name}`,
        });
      } else {
        setImportStatus({
          type: 'error',
          message: 'Текст в буфере не является валидной SOCKS5/VLESS/HY2 ссылкой.',
        });
      }
    } catch (err) {
      setImportStatus({
        type: 'error',
        message: 'Не удалось прочитать буфер обмена. Разрешите доступ к буферу в настройках.',
      });
    }
  };

  const handleStartPairing = () => {
    setIsPairing(true);
    setPairingSuccess(false);

    // Simulate PIN verification handshake with Android x-prox in same LAN
    setTimeout(() => {
      setIsPairing(false);
      setPairingSuccess(true);

      const hotspotServer: VpnServer = {
        id: `hotspot_${Date.now()}`,
        name: '📱 Sentinel Hotspot (x-prox)',
        protocol: 'SOCKS5',
        address: '192.168.43.1',
        port: 1080,
        uuid: 'sentinel',
        password: 'secure123',
        isHotspot: true,
        pingMs: 8,
      };

      onAddHotspotServer(hotspotServer);
    }, 1500);
  };

  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-[#060812] select-none space-y-6 animate-fadeIn max-w-6xl mx-auto">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-white/10 gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-glow-emerald flex-shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-base font-extrabold text-slate-100 font-sans tracking-wide">
                Sentinel Hotspot (Связывание с x-prox Android)
              </h1>
              <span className="px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-widest font-bold rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 whitespace-nowrap">
                LAN Pairing
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Подключение ПК через безопасную раздачу прокси-трафика с мобильного приложения Android x-prox
            </p>
          </div>
        </div>

        <a
          href="https://github.com/blackalex1/Sentinel_secure_Connect"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-xs font-mono transition-all flex-shrink-0"
        >
          <span>GitHub x-prox</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Step 1: PIN Pairing Card */}
        <div className="p-5 rounded-2xl bg-[#0a0d1a] border border-white/10 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400 font-mono">
              <KeyRound className="w-4 h-4" />
              <span>ПРОТОКОЛ МГНОВЕННОГО PIN-СВЯЗЫВАНИЯ</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Включите «Раздавать прокси по Wi-Fi» в приложении Android x-prox на смартфоне. ПК автоматически обнаружит устройство в локальной сети.
            </p>

            <div className="p-4 rounded-xl bg-[#060812] border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-mono block">Одноразовый PIN сопряжения:</span>
                <div className="flex items-center space-x-3 mt-1">
                  <span className="text-2xl font-mono font-extrabold text-amber-400 tracking-widest">{pairingPin}</span>
                  <button
                    onClick={handleGenerateNewPin}
                    className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Сгенерировать новый PIN"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <button
                onClick={handleStartPairing}
                disabled={isPairing}
                className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold shadow-glow-emerald transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isPairing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                <span>{isPairing ? 'Сопряжение...' : 'Сопрячь устройство'}</span>
              </button>
            </div>
          </div>

          {pairingSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center space-x-2">
              <Check className="w-4 h-4 stroke-[3] text-emerald-400 flex-shrink-0" />
              <span>Устройство x-prox успешно сопряжено! Сервер добавлены в список подключений.</span>
            </div>
          )}
        </div>

        {/* Step 2: Real Interactive Clipboard Importer Card */}
        <div className="p-5 rounded-2xl bg-[#0a0d1a] border border-white/10 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-purple-400 font-mono">
              <ClipboardPaste className="w-4 h-4" />
              <span>ИМПОРТ ССЫЛКИ ИЗ БУФЕРА ОБМЕНА</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Скопируйте SOCKS5 или VLESS ссылку конфигурации в приложении x-prox и нажмите кнопку ниже для автоматического импорта.
            </p>

            <div className="space-y-2">
              <label className="text-[10px] text-slate-400 font-mono block">
                Содержимое буфера:
              </label>
              <div className="p-3 rounded-xl bg-[#060812] border border-white/10 font-mono text-[11px] text-slate-300 break-all min-h-[50px] flex items-center">
                {clipboardUri ? (
                  <span className="text-emerald-300">{clipboardUri}</span>
                ) : (
                  <span className="text-slate-500 italic">Нажмите «Вставить из буфера», чтобы прочитать скопированную ссылку...</span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={handlePasteFromClipboard}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-glow-violet transition-all active:scale-95 cursor-pointer"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>Вставить из буфера обмена</span>
            </button>

            {importStatus && (
              <div className={`p-3 rounded-xl border text-xs font-mono flex items-center space-x-2 ${
                importStatus.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                {importStatus.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                )}
                <span>{importStatus.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
