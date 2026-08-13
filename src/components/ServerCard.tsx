import React from 'react';
import { Star, Wifi, Smartphone, Check, Trash2, Pencil, Copy, Share2 } from 'lucide-react';
import { VpnServer } from '../types/vpn';

interface ServerCardProps {
  server: VpnServer;
  isSelected: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onExportLink: () => void;
}

export const ServerCard: React.FC<ServerCardProps> = ({
  server,
  isSelected,
  onSelect,
  onToggleFavorite,
  onDelete,
  onEdit,
  onDuplicate,
  onExportLink,
}) => {
  const getCountryEmoji = (code?: string) => {
    switch (code) {
      case 'RU': return '🇷🇺';
      case 'US': return '🇺🇸';
      case 'DE': return '🇩🇪';
      case 'NL': return '🇳🇱';
      case 'FI': return '🇫🇮';
      case 'FR': return '🇫🇷';
      case 'GB': return '🇬🇧';
      case 'TR': return '🇹🇷';
      case 'SG': return '🇸🇬';
      case 'JP': return '🇯🇵';
      case 'LAN': return '📱';
      default: return '🌐';
    }
  };

  const getPingColor = (pingMs?: number) => {
    if (!pingMs) return 'text-slate-500';
    if (pingMs < 60) return 'text-emerald-400';
    if (pingMs < 130) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div
      onClick={onSelect}
      className={`double-bezel-shell cursor-pointer group spring-transition ${
        isSelected
          ? 'bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-purple-500/10 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
          : ''
      }`}
    >
      <div className={`double-bezel-core p-3.5 flex items-center justify-between transition-all ${
        isSelected
          ? 'bg-gradient-to-r from-[#0d1826] via-[#0e1424] to-[#0a0d1a] border border-emerald-500/40 shadow-[inset_0_0_12px_rgba(16,185,129,0.15)]'
          : 'hover:bg-[#11111a]'
      }`}>
        {/* Left Info Group */}
        <div className="flex items-center space-x-3 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 text-lg flex-shrink-0 shadow-inner">
            {getCountryEmoji(server.countryCode)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h4 className="text-xs font-bold text-slate-100 truncate font-sans group-hover:text-purple-300 transition-colors">
                {server.name}
              </h4>
              {server.isHotspot && (
                <span className="px-1.5 py-0.2 text-[9px] font-mono bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 flex items-center space-x-1">
                  <Smartphone className="w-2.5 h-2.5 inline mr-0.5" /> Hotspot
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                {server.protocol}
              </span>
              <span className="text-[10px] text-slate-400 truncate font-mono">
                {server.address}:{server.port}
              </span>
            </div>
          </div>
        </div>

        {/* Right Actions & Ping */}
        <div className="flex items-center space-x-1.5 ml-2 flex-shrink-0">
          <div className="flex items-center space-x-1 text-[11px] font-mono mr-1">
            <Wifi className={`w-3 h-3 ${getPingColor(server.pingMs)}`} />
            <span className={getPingColor(server.pingMs)}>
              {server.pingMs ? `${server.pingMs}ms` : '—'}
            </span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              server.isFavorite ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Добавить в избранное"
          >
            <Star className="w-3.5 h-3.5 fill-current" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors opacity-70 group-hover:opacity-100"
            title="Дублировать подключение"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onExportLink();
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-teal-400 hover:bg-teal-500/10 transition-colors opacity-70 group-hover:opacity-100"
            title="Скопировать ссылку подключения (Экспорт)"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors opacity-70 group-hover:opacity-100"
            title="Редактировать подключение"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-70 group-hover:opacity-100"
            title="Удалить подключение"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {isSelected && (
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
