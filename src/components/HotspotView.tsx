import React, { useState, useEffect } from 'react';
import { Smartphone, Radio, Copy, Check, QrCode, Shield, ExternalLink, RefreshCw, KeyRound, ClipboardPaste, AlertCircle } from 'lucide-react';
import { VpnServer } from '../types/vpn';
import { ProxyParser } from '../services/proxyParser';
import { SentinelPairingService } from '../services/pairingService';
import { TauriBridge } from '../services/tauriBridge';

interface HotspotViewProps {
  onAddHotspotServer: (server: VpnServer) => void;
}

export const HotspotView: React.FC<HotspotViewProps> = ({ onAddHotspotServer }) => {
  const [gatewayIp, setGatewayIp] = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [pairingStatus, setPairingStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [activePin, setActivePin] = useState<string | null>(null);
  
  const [clipboardUri, setClipboardUri] = useState<string>('');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    // Automatically detect Windows Default Gateways dynamically from the OS
    TauriBridge.getDefaultGateways().then((gws) => {
      if (gws && gws.length > 0) {
        console.log('[HotspotView] Pre-filling primary detected gateway IP:', gws[0]);
        setGatewayIp(gws[0]);
      }
    });
  }, []);

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

  const handleStartPairing = async () => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    setIsPairing(true);
    setActivePin(pin);
    setPairingStatus({
      type: 'info',
      message: `Код ${pin} отправлен. Сверьте код на экране смартфона и нажмите «Разрешить»!`,
    });

    const result = await SentinelPairingService.requestPairing(gatewayIp, pin);
    setIsPairing(false);

    if (result.success) {
      setActivePin(result.pin || pin);
      setPairingStatus({
        type: 'success',
        message: `Сопряжение подтверждено! Добавлен сервер: ${result.ip}:${result.port}`,
      });

      const hotspotServer: VpnServer = {
        id: `hotspot_${result.ip}_${result.port}_${Date.now()}`,
        name: `📱 Sentinel Hotspot (${result.ip})`,
        protocol: (result.proxyType as any) || 'SOCKS5',
        address: result.ip || gatewayIp,
        port: result.port || 10808,
        uuid: result.username,
        password: result.password,
        isHotspot: true,
        countryCode: 'LAN',
        pingMs: 8,
      };

      onAddHotspotServer(hotspotServer);
    } else {
      setPairingStatus({
        type: 'error',
        message: result.message || 'Ошибка сопряжения со смартфоном.',
      });
    }
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
                Sentinel Hotspot (Связывание с Android)
              </h1>
              <span className="px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-widest font-bold rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 whitespace-nowrap">
                LAN Pairing
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Безопасная передача настроек прокси и туннелирование трафика ПК через смартфон
            </p>
          </div>
        </div>

        <a
          href="https://github.com/blackalex1/sentinel-mobile"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-xs font-mono transition-all flex-shrink-0"
        >
          <span>GitHub Sentinel Mobile</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Step 1: PIN Pairing Card */}
        <div className="p-5 rounded-2xl bg-[#0a0d1a] border border-white/10 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400 font-mono">
              <KeyRound className="w-4 h-4" />
              <span>ИНТЕРАКТИВНОЕ СОПРЯЖЕНИЕ С ПОДТВЕРЖДЕНИЕМ</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Запустите VPN на смартфоне. При нажатии кнопки на ПК сгенерируется 4-значный PIN-код и отправится запрос на телефон.
            </p>

            <div className="space-y-2">
              <label className="text-[10px] text-slate-400 font-mono block">
                IP-адрес телефона (Точка доступа или Wi-Fi IP):
              </label>
              <input
                type="text"
                value={gatewayIp}
                onChange={(e) => setGatewayIp(e.target.value)}
                placeholder="Автоматически определяется из сетевого шлюза"
                className="w-full px-3 py-2 text-xs font-mono bg-[#060812] border border-white/10 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {/* Glowing PIN Display Badge on PC Screen */}
            {activePin && (
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-transparent border border-emerald-500/40 flex items-center justify-between animate-fadeIn">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-bold text-emerald-200">Код подтверждения на ПК:</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Сверьте код с всплывающим окном на телефоне</p>
                </div>
                <div className="px-4 py-1.5 bg-black/70 border border-emerald-400/50 rounded-xl text-xl font-mono font-black text-emerald-300 tracking-[0.25em] shadow-glow-emerald">
                  {activePin}
                </div>
              </div>
            )}

            <button
              onClick={handleStartPairing}
              disabled={isPairing}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold shadow-glow-emerald transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isPairing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              <span>{isPairing ? 'Ожидание подтверждения на смартфоне...' : 'Отправить запрос на сопряжение'}</span>
            </button>
          </div>

          {pairingStatus && (
            <div className={`p-3 rounded-xl border text-xs font-mono flex items-center space-x-2 ${
              pairingStatus.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : pairingStatus.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 animate-pulse'
            }`}>
              {pairingStatus.type === 'success' && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
              {pairingStatus.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
              <span>{pairingStatus.message}</span>
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
              Скопируйте SOCKS5 или VLESS ссылку конфигурации в мобильном приложении и нажмите кнопку ниже для мгновенного импорта.
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
