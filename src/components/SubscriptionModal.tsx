import React, { useState } from 'react';
import { X, Link, Download, Layers, Shield } from 'lucide-react';
import { VpnServer } from '../types/vpn';
import { ProxyParser } from '../services/proxyParser';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddServers: (servers: VpnServer[]) => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  onAddServers,
}) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setIsLoading(true);
    let rawContent = inputText.trim();

    // Check if it's an HTTP/HTTPS subscription URL from Spectre-panel
    if (rawContent.startsWith('http://') || rawContent.startsWith('https://')) {
      try {
        const response = await fetch(rawContent);
        if (response.ok) {
          rawContent = await response.text();
        }
      } catch (err) {
        console.warn('Direct CORS fetch failed, attempting link parser fallback:', err);
      }
    }

    const parsedServers = ProxyParser.parseSubscription(rawContent);

    if (parsedServers.length > 0) {
      onAddServers(parsedServers);
      setInputText('');
      onClose();
    } else {
      alert('Не удалось распознать серверы. Убедитесь, что формат ссылки правильный (VLESS, HY2, VMess, Trojan, SOCKS5).');
    }

    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-lg double-bezel-shell bg-[#0a0a12] border border-white/10 shadow-2xl overflow-hidden">
        <div className="double-bezel-core p-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Link className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 font-sans">Импорт подписки / Прокси-ссылок</h3>
                <p className="text-xs text-slate-400 font-mono flex items-center space-x-1">
                  <span>Поддержка</span>
                  <a
                    href="https://github.com/blackalex1/Spectre-panel"
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-purple-300 hover:text-purple-100"
                  >
                    Spectre-panel
                  </a>
                  <span>, VLESS, HY2, SOCKS5</span>
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

          <form onSubmit={handleImport} className="space-y-4 my-3">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Вставьте URL подписки или vless:// / hy2:// / socks5:// ссылки:
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={5}
                placeholder={`vless://uuid@host:443?security=reality#Server\nhy2://pass@host:443#Hysteria2\nsocks5://user:pass@host:10808#Hotspot`}
                className="w-full p-3 text-xs font-mono bg-surface-elevated/80 border border-surface-border rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500/50 resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-slate-500 font-mono">
                Поддерживаются одиночные ссылки и пакетные строки Base64
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs rounded-xl shadow-glow-violet transition-all active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Импортировать</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
