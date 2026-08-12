import React, { useState, useEffect } from 'react';
import { X, Save, Server, Shield, Globe, Lock, KeyRound, Cpu, Sliders, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { VpnServer, ProtocolType } from '../types/vpn';

interface EditServerModalProps {
  isOpen: boolean;
  server: VpnServer | null;
  onClose: () => void;
  onSave: (updatedServer: VpnServer) => void;
}

const PROTOCOLS: ProtocolType[] = [
  'VLESS',
  'HYSTERIA2',
  'VMESS',
  'TROJAN',
  'SHADOWSOCKS',
  'SOCKS5',
  'HTTP',
  'TUIC',
  'WIREGUARD',
];

const COUNTRIES = [
  { code: 'AUTO', label: '🌐 Авто (Глобальный)', emoji: '🌐' },
  { code: 'RU', label: '🇷🇺 Россия', emoji: '🇷🇺' },
  { code: 'US', label: '🇺🇸 США', emoji: '🇺🇸' },
  { code: 'DE', label: '🇩🇪 Германия', emoji: '🇩🇪' },
  { code: 'NL', label: '🇳🇱 Нидерланды', emoji: '🇳🇱' },
  { code: 'FI', label: '🇫🇮 Финляндия', emoji: '🇫🇮' },
  { code: 'FR', label: '🇫🇷 Франция', emoji: '🇫🇷' },
  { code: 'GB', label: '🇬🇧 Великобритания', emoji: '🇬🇧' },
  { code: 'TR', label: '🇹🇷 Турция', emoji: '🇹🇷' },
  { code: 'SG', label: '🇸🇬 Сингапур', emoji: '🇸🇬' },
  { code: 'JP', label: '🇯🇵 Япония', emoji: '🇯🇵' },
  { code: 'LAN', label: '📱 Локальная сеть / Hotspot', emoji: '📱' },
];

export const EditServerModal: React.FC<EditServerModalProps> = ({
  isOpen,
  server,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<VpnServer>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'main' | 'tls' | 'transport'>('main');

  useEffect(() => {
    if (server) {
      setFormData({ ...server });
    }
  }, [server]);

  if (!isOpen || !server) return null;

  const handleChange = (field: keyof VpnServer, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerateUuid = () => {
    const newUuid = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    handleChange('uuid', newUuid);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.address || !formData.port) return;

    const updated: VpnServer = {
      ...server,
      ...formData,
      name: (formData.name || server.name).trim(),
      protocol: formData.protocol || server.protocol,
      address: (formData.address || server.address).trim(),
      port: Number(formData.port) || server.port,
      uuid: formData.uuid?.trim(),
      password: formData.password?.trim(),
      security: formData.security || 'none',
      sni: formData.sni?.trim(),
      pbk: formData.pbk?.trim(),
      sid: formData.sid?.trim(),
      fp: formData.fp?.trim(),
      alpn: formData.alpn?.trim(),
      network: formData.network?.trim(),
      path: formData.path?.trim(),
      obfs: formData.obfs?.trim(),
      countryCode: formData.countryCode === 'AUTO' ? undefined : formData.countryCode,
    };

    onSave(updated);
    onClose();
  };

  const currentProtocol = formData.protocol || 'VLESS';
  const isVlessOrVmess = currentProtocol === 'VLESS' || currentProtocol === 'VMESS';
  const isAuthPasswordOnly = currentProtocol === 'TROJAN' || currentProtocol === 'HYSTERIA2' || currentProtocol === 'SHADOWSOCKS';
  const isSocksOrHttp = currentProtocol === 'SOCKS5' || currentProtocol === 'HTTP';
  const supportsTls = ['VLESS', 'VMESS', 'TROJAN', 'HYSTERIA2', 'TUIC'].includes(currentProtocol);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-xl bg-[#090d18] border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-100 font-sans">Редактирование подключения</h3>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {currentProtocol}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {formData.address}:{formData.port}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-6 pt-3 border-b border-white/10 space-x-2 bg-black/30">
          <button
            type="button"
            onClick={() => setActiveTab('main')}
            className={`flex items-center space-x-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'main'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Основные</span>
          </button>

          {supportsTls && (
            <button
              type="button"
              onClick={() => setActiveTab('tls')}
              className={`flex items-center space-x-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'tls'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>TLS & Reality</span>
            </button>
          )}

          {isVlessOrVmess && (
            <button
              type="button"
              onClick={() => setActiveTab('transport')}
              className={`flex items-center space-x-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'transport'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Транспорт</span>
            </button>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'main' && (
            <div className="space-y-4">
              {/* Server Name */}
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                  Название узла / сервера:
                </label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Например: 🇩🇪 My Fast Node"
                  className="w-full px-3.5 py-2.5 text-xs bg-[#050811] border border-white/10 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 font-sans"
                />
              </div>

              {/* Protocol & Country */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                    Протокол:
                  </label>
                  <select
                    value={formData.protocol || 'VLESS'}
                    onChange={(e) => handleChange('protocol', e.target.value as ProtocolType)}
                    className="w-full px-3 py-2.5 text-xs bg-[#050811] border border-white/10 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500/60 font-mono"
                  >
                    {PROTOCOLS.map((proto) => (
                      <option key={proto} value={proto} className="bg-[#090d18] text-slate-100">
                        {proto}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                    Локация / Флаг:
                  </label>
                  <select
                    value={formData.countryCode || 'AUTO'}
                    onChange={(e) => handleChange('countryCode', e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-[#050811] border border-white/10 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500/60 font-mono"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code} className="bg-[#090d18] text-slate-100">
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Host & Port */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                    Адрес хоста (IP или Domain):
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.address || ''}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="example.com или 1.2.3.4"
                    className="w-full px-3.5 py-2.5 text-xs bg-[#050811] border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500/60"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                    Порт:
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={65535}
                    value={formData.port || ''}
                    onChange={(e) => handleChange('port', Number(e.target.value))}
                    placeholder="443"
                    className="w-full px-3.5 py-2.5 text-xs bg-[#050811] border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500/60"
                  />
                </div>
              </div>

              {/* Auth Credentials */}
              {(isVlessOrVmess || currentProtocol === 'TUIC' || currentProtocol === 'WIREGUARD') && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-mono text-slate-400">
                      UUID / User ID:
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateUuid}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center space-x-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Сгенерировать UUID</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formData.uuid || ''}
                    onChange={(e) => handleChange('uuid', e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full px-3.5 py-2.5 text-xs bg-[#050811] border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500/60"
                  />
                </div>
              )}

              {isAuthPasswordOnly && (
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                    Пароль / Токен авторизации:
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password || ''}
                      onChange={(e) => handleChange('password', e.target.value)}
                      placeholder="Секретный ключ / пароль"
                      className="w-full pl-3.5 pr-10 py-2.5 text-xs bg-[#050811] border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {isSocksOrHttp && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                      Логин (Username):
                    </label>
                    <input
                      type="text"
                      value={formData.uuid || ''}
                      onChange={(e) => handleChange('uuid', e.target.value)}
                      placeholder="Опционально"
                      className="w-full px-3.5 py-2.5 text-xs bg-[#050811] border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500/60"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                      Пароль (Password):
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password || ''}
                        onChange={(e) => handleChange('password', e.target.value)}
                        placeholder="Опционально"
                        className="w-full pl-3.5 pr-10 py-2.5 text-xs bg-[#050811] border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500/60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tls' && supportsTls && (
            <div className="space-y-4">
              {/* Security Type */}
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                  Тип безопасности (Security):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['none', 'tls', 'reality'].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => handleChange('security', sec)}
                      className={`py-2 px-3 rounded-xl text-xs font-mono font-bold uppercase transition-all cursor-pointer ${
                        (formData.security || 'none') === sec
                          ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300 shadow-glow-cyan'
                          : 'bg-[#050811] border border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sec}
                    </button>
                  ))}
                </div>
              </div>

              {/* SNI */}
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                  SNI / ServerName:
                </label>
                <input
                  type="text"
                  value={formData.sni || ''}
                  onChange={(e) => handleChange('sni', e.target.value)}
                  placeholder="e.g., dl.google.com, apple.com"
                  className="w-full px-3.5 py-2.5 text-xs bg-[#050811] border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500/60"
                />
              </div>

              {/* Reality Specifics */}
              {formData.security === 'reality' && (
                <div className="space-y-3 p-3.5 bg-cyan-500/[0.04] border border-cyan-500/20 rounded-2xl">
                  <div>
                    <label className="block text-[11px] font-mono text-cyan-300 mb-1">
                      Reality Public Key (pbk):
                    </label>
                    <input
                      type="text"
                      value={formData.pbk || ''}
                      onChange={(e) => handleChange('pbk', e.target.value)}
                      placeholder="Public Key (Base64 URL)"
                      className="w-full px-3 py-2 text-xs bg-[#050811] border border-cyan-500/30 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono text-cyan-300 mb-1">
                        Short ID (sid):
                      </label>
                      <input
                        type="text"
                        value={formData.sid || ''}
                        onChange={(e) => handleChange('sid', e.target.value)}
                        placeholder="e.g. 16 hex chars"
                        className="w-full px-3 py-2 text-xs bg-[#050811] border border-cyan-500/30 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-cyan-300 mb-1">
                        Fingerprint (fp):
                      </label>
                      <select
                        value={formData.fp || 'chrome'}
                        onChange={(e) => handleChange('fp', e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#050811] border border-cyan-500/30 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
                      >
                        {['chrome', 'firefox', 'safari', 'ios', 'android', 'randomized'].map((fp) => (
                          <option key={fp} value={fp} className="bg-[#090d18]">
                            {fp}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ALPN */}
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                  ALPN:
                </label>
                <input
                  type="text"
                  value={formData.alpn || ''}
                  onChange={(e) => handleChange('alpn', e.target.value)}
                  placeholder="h3,h2,http/1.1"
                  className="w-full px-3.5 py-2.5 text-xs bg-[#050811] border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500/60"
                />
              </div>

              {/* Hysteria 2 Obfs */}
              {currentProtocol === 'HYSTERIA2' && (
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                    Hysteria 2 Obfuscation Password (obfs):
                  </label>
                  <input
                    type="text"
                    value={formData.obfs || ''}
                    onChange={(e) => handleChange('obfs', e.target.value)}
                    placeholder="Опционально (пароль обфускации)"
                    className="w-full px-3.5 py-2.5 text-xs bg-[#050811] border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500/60"
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'transport' && isVlessOrVmess && (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                  Тип сети (Network Transport):
                </label>
                <select
                  value={formData.network || 'tcp'}
                  onChange={(e) => handleChange('network', e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-[#050811] border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500/60"
                >
                  <option value="tcp" className="bg-[#090d18]">TCP (Стандартный)</option>
                  <option value="ws" className="bg-[#090d18]">WebSocket (ws)</option>
                  <option value="grpc" className="bg-[#090d18]">gRPC</option>
                  <option value="httpupgrade" className="bg-[#090d18]">HTTPUpgrade</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                  Path / ServiceName:
                </label>
                <input
                  type="text"
                  value={formData.path || ''}
                  onChange={(e) => handleChange('path', e.target.value)}
                  placeholder="Например: /vless-ws или grpc-service"
                  className="w-full px-3.5 py-2.5 text-xs bg-[#050811] border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500/60"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            >
              Отмена
            </button>

            <button
              type="submit"
              className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-glow-cyan transition-all active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Сохранить изменения</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
