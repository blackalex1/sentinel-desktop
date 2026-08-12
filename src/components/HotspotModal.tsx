import React, { useState, useEffect } from 'react';
import { X, Smartphone, Zap, Info, ChevronDown, ChevronUp, ClipboardCheck, ShieldCheck, RefreshCw, KeyRound } from 'lucide-react';
import { VpnServer } from '../types/vpn';
import { ProxyParser } from '../services/proxyParser';
import { SentinelPairingService } from '../services/pairingService';
import { TauriBridge } from '../services/tauriBridge';

interface HotspotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddHotspotServer: (server: VpnServer) => void;
}

export const HotspotModal: React.FC<HotspotModalProps> = ({
  isOpen,
  onClose,
  onAddHotspotServer,
}) => {
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('10808');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showFullGuide, setShowFullGuide] = useState(false);
  const [autoDetectedMessage, setAutoDetectedMessage] = useState<string | null>(null);

  // Pairing state
  const [isPairing, setIsPairing] = useState(false);
  const [pairPin, setPairPin] = useState<string | null>(null);
  const [pairStatus, setPairStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      handlePasteFromClipboard(true);
      TauriBridge.getDefaultGateways().then((gws) => {
        if (gws && gws.length > 0) {
          console.log('[HotspotModal] Auto-detected gateway IP:', gws[0]);
          setIp(gws[0]);
        }
      });
    }
  }, [isOpen]);

  const handlePasteFromClipboard = async (silent: boolean = false) => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.includes('socks5://') || text.includes('socks://') || text.includes('http://'))) {
        const parsed = ProxyParser.parseLink(text.trim());
        if (parsed) {
          setIp(parsed.address);
          setPort(parsed.port.toString());
          if (parsed.uuid) setUsername(parsed.uuid);
          if (parsed.password) setPassword(parsed.password);
          setAutoDetectedMessage(`Распознано из буфера: ${parsed.address}:${parsed.port}${parsed.uuid ? ' (с авторизацией)' : ''}`);
          return;
        }
      }
      if (!silent) {
        alert('В буфере обмена не найдена ссылка прокси. Скопируйте ссылку в x-prox на смартфоне.');
      }
    } catch (err) {
      if (!silent) {
        console.warn('Clipboard read failed:', err);
      }
    }
  };

  const handleRequestPhonePairing = async () => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    setIsPairing(true);
    setPairPin(pin);
    setPairStatus(`Код ${pin} отправлен. Подтвердите сопряжение на телефоне!`);
    setAutoDetectedMessage(null);

    const result = await SentinelPairingService.requestPairing(ip, pin);

    if (result.success) {
      setPairPin(result.pin || pin);
      setPairStatus(`Сопряжение успешно подтверждено на смартфоне!`);

      if (result.ip) setIp(result.ip);
      if (result.port) setPort(result.port.toString());
      if (result.username) setUsername(result.username);
      if (result.password) setPassword(result.password);

      setAutoDetectedMessage(`Данные получены: ${result.ip}:${result.port} (Логин: ${result.username || 'Без логина'})`);
    } else {
      setPairPin(null);
      setPairStatus(result.message || 'Запрос отклонен или смартфон недоступен в сети.');
    }

    setIsPairing(false);
  };

  if (!isOpen) return null;

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    const portNum = parseInt(port, 10) || 1080;

    const server: VpnServer = {
      id: `hotspot_${ip}_${portNum}_${Date.now()}`,
      name: `Sentinel Hotspot (${ip})`,
      protocol: 'SOCKS5',
      address: ip,
      port: portNum,
      uuid: username || undefined,
      password: password || undefined,
      isHotspot: true,
      countryCode: 'LAN',
      rawLink: `socks5://${username ? `${username}:${password}@` : ''}${ip}:${portNum}#Sentinel%20Hotspot`,
    };

    onAddHotspotServer(server);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-lg double-bezel-shell bg-[#0a0a12] border border-white/10 shadow-2xl overflow-hidden">
        <div className="double-bezel-core p-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 font-sans">Sentinel Hotspot Pairing</h3>
                <p className="text-xs text-slate-400 font-mono">
                  Безопасное сопряжение ПК с Android x-prox
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

          {/* Secure Phone Pairing Action Card */}
          <div className="my-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-100">Zero-Touch PIN Сопряжение</span>
                  <p className="text-[10px] text-slate-400">Запрос подтверждения на смартфоне</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRequestPhonePairing}
                disabled={isPairing}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-medium shadow-glow-emerald transition-all active:scale-95 whitespace-nowrap"
              >
                {isPairing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <KeyRound className="w-3.5 h-3.5" />
                )}
                <span>{isPairing ? 'Запрос...' : 'Запросить с телефона'}</span>
              </button>
            </div>

            {/* Display pairing PIN code status */}
            {pairPin && (
              <div className="mt-3 p-2.5 rounded-xl bg-black/40 border border-emerald-500/40 flex items-center justify-between animate-fadeIn">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-emerald-200">Код подтверждения на смартфоне:</span>
                  <span className="px-2 py-0.5 text-sm font-mono font-extrabold text-emerald-300 bg-emerald-500/20 rounded border border-emerald-500/40 tracking-widest">
                    {pairPin}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 animate-pulse">Ожидание нажатия OK...</span>
              </div>
            )}
          </div>

          {/* Quick Paste Clipboard Option */}
          <div className="mb-3 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between">
            <span className="text-xs text-purple-200">Быстрая вставка скопированной ссылки SOCKS5</span>
            <button
              type="button"
              onClick={() => handlePasteFromClipboard(false)}
              className="flex items-center space-x-1 px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition-all active:scale-95"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Из буфера</span>
            </button>
          </div>

          {autoDetectedMessage && (
            <div className="mb-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-center space-x-2 animate-fadeIn">
              <ClipboardCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="font-mono">{autoDetectedMessage}</span>
            </div>
          )}

          {/* Step-by-step Guide Accordion */}
          <div className="my-2 rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowFullGuide(!showFullGuide)}
              className="w-full flex items-center justify-between p-2.5 text-xs font-medium text-slate-300 hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Info className="w-3.5 h-3.5 text-emerald-400" />
                <span>Пошаговая инструкция</span>
              </div>
              {showFullGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showFullGuide && (
              <div className="px-3.5 pb-3.5 pt-1 space-y-2 border-t border-white/5 text-xs text-slate-300 font-sans">
                <div className="flex items-start space-x-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-mono font-bold text-[9px] flex-shrink-0 mt-0.5">1</div>
                  <p className="text-[11px] text-slate-400">Нажмите <b>"Запросить с телефона"</b> выше.</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-mono font-bold text-[9px] flex-shrink-0 mt-0.5">2</div>
                  <p className="text-[11px] text-slate-400">На смартфоне в x-prox появится всплывающее диалоговое окно с 4-значным PIN-кодом.</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-mono font-bold text-[9px] flex-shrink-0 mt-0.5">3</div>
                  <p className="text-[11px] text-slate-400">Нажмите <b>"Разрешить"</b> на телефоне — прокси и данные авторизации передадутся на ПК защищенным образом!</p>
                </div>
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleConnect} className="space-y-3 mt-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[11px] font-mono text-slate-300 mb-1">
                  IP-адрес телефона (Gateway)
                </label>
                <input
                  type="text"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  placeholder="Автоматически из шлюза"
                  required
                  className="w-full px-3 py-1.5 text-xs font-mono bg-surface-elevated/80 border border-surface-border rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-300 mb-1">
                  SOCKS5 Порт
                </label>
                <input
                  type="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="1080"
                  required
                  className="w-full px-3 py-1.5 text-xs font-mono bg-surface-elevated/80 border border-surface-border rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Логин SOCKS5 (Авто-получен)
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Логин"
                  className="w-full px-3 py-1.5 text-xs font-mono bg-surface-elevated/80 border border-surface-border rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Пароль SOCKS5 (Авто-получен)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-3 py-1.5 text-xs font-mono bg-surface-elevated/80 border border-surface-border rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs rounded-xl shadow-glow-emerald transition-all active:scale-95"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Подключить Hotspot</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
