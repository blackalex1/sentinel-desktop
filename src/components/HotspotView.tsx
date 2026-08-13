import React, { useState, useEffect } from 'react';
import { Smartphone, Radio, Copy, Check, QrCode, Shield, ExternalLink, RefreshCw, KeyRound, ClipboardPaste, AlertCircle } from 'lucide-react';
import { VpnServer } from '../types/vpn';
import { ProxyParser } from '../services/proxyParser';
import { SentinelPairingService } from '../services/pairingService';
import { TauriBridge } from '../services/tauriBridge';
import { useI18n } from '../i18n/i18nContext';

interface HotspotViewProps {
  onAddHotspotServer: (server: VpnServer) => void;
}

export const HotspotView: React.FC<HotspotViewProps> = ({ onAddHotspotServer }) => {
  const { t } = useI18n();
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
          message: t('hotspot_status_clipboard_empty'),
        });
        return;
      }

      setClipboardUri(text.trim());
      const parsedServer = ProxyParser.parseLink(text.trim());

      if (parsedServer) {
        onAddHotspotServer(parsedServer);
        setImportStatus({
          type: 'success',
          message: t('hotspot_status_imported_success', { name: parsedServer.name, protocol: parsedServer.protocol }),
        });
      } else {
        setImportStatus({
          type: 'error',
          message: t('hotspot_status_invalid_format'),
        });
      }
    } catch (err) {
      setImportStatus({
        type: 'error',
        message: t('hotspot_status_clipboard_error'),
      });
    }
  };

  const handleStartPairing = async () => {
    if (!gatewayIp.trim()) {
      setPairingStatus({ type: 'error', message: t('hotspot_status_enter_ip') });
      return;
    }

    setIsPairing(true);
    setPairingStatus({ type: 'info', message: t('hotspot_status_generating_pin') });

    // Generate real 4-digit PIN code
    const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();
    setActivePin(generatedPin);

    setPairingStatus({ type: 'info', message: t('hotspot_status_pin_generated', { pin: generatedPin, ip: gatewayIp }) });

    // Send HTTP POST request to Android device
    const result = await SentinelPairingService.requestPairing(gatewayIp.trim(), generatedPin);
    setIsPairing(false);

    if (result.success) {
      setPairingStatus({
        type: 'success',
        message: result.message || t('hotspot_status_pairing_success'),
      });
      if (result.server) {
        onAddHotspotServer(result.server);
      }
    } else {
      setPairingStatus({
        type: 'error',
        message: result.message || t('hotspot_status_pairing_error'),
      });
    }
  };

  const handleDirectFetchConfig = async () => {
    setIsPairing(true);
    setPairingStatus({ type: 'info', message: 'Запрос активной конфигурации с телефона...' });

    const result = await SentinelPairingService.fetchLiveConfig(gatewayIp.trim());
    setIsPairing(false);

    if (result.success && result.server) {
      setPairingStatus({
        type: 'success',
        message: result.message || 'Конфигурация успешно получена со смартфона!',
      });
      onAddHotspotServer(result.server);
    } else {
      setPairingStatus({
        type: 'error',
        message: result.message || 'Не удалось получить активную конфигурацию.',
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
                {t('hotspot_title')}
              </h1>
              <span className="px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-widest font-bold rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 whitespace-nowrap">
                LAN Pairing
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1">
              {t('hotspot_subtitle')}
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
              <span>{t('hotspot_step1_title')}</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {t('hotspot_step1_desc')}
            </p>

            <div className="space-y-2">
              <label className="text-[10px] text-slate-400 font-mono block">
                {t('hotspot_phone_ip')}
              </label>
              <input
                type="text"
                value={gatewayIp}
                onChange={(e) => setGatewayIp(e.target.value)}
                placeholder="192.168.1.1"
                className="w-full px-3 py-2 text-xs font-mono bg-[#060812] border border-white/10 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {/* Glowing PIN Display Badge on PC Screen */}
            {activePin && (
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-transparent border border-emerald-500/40 flex items-center justify-between animate-fadeIn">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-bold text-emerald-200">{t('hotspot_pin_code')}</span>
                  </div>
                </div>
                <div className="px-4 py-1.5 bg-black/70 border border-emerald-400/50 rounded-xl text-xl font-mono font-black text-emerald-300 tracking-[0.25em] shadow-glow-emerald">
                  {activePin}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                onClick={handleStartPairing}
                disabled={isPairing}
                className="flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold shadow-glow-emerald transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isPairing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                <span>{t('hotspot_request_btn')}</span>
              </button>

              <button
                onClick={handleDirectFetchConfig}
                disabled={isPairing}
                className="flex items-center justify-center space-x-1.5 py-2.5 px-3 bg-white/5 hover:bg-white/10 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-mono transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Получить готовый конфиг со смартфона напрямую"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPairing ? 'animate-spin' : ''}`} />
                <span>Запросить конфиг</span>
              </button>
            </div>
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
              <span>{t('hotspot_paste_card_title')}</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {t('hotspot_paste_card_desc')}
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-mono block">
                {t('hotspot_clipboard_content')}
              </label>
              <div className="p-3 bg-[#060812] border border-white/10 rounded-xl font-mono text-xs text-slate-300 break-all min-h-[70px] max-h-[100px] overflow-y-auto">
                {clipboardUri ? (
                  <span className="text-purple-300 font-bold">{clipboardUri}</span>
                ) : (
                  <span className="text-slate-500 italic">
                    {t('hotspot_clipboard_empty_hint')}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handlePasteFromClipboard}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-glow-violet transition-all active:scale-95 cursor-pointer"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>{t('hotspot_paste_btn')}</span>
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
