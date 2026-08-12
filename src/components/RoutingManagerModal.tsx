import React, { useState, useRef } from 'react';
import { X, SlidersHorizontal, Plus, ArrowUp, ArrowDown, Trash2, Edit3, ShieldAlert, Check, Sparkles, GripVertical } from 'lucide-react';
import { AppSettings, QuickSecurityRule, CustomRouteRule, RouteAction } from '../types/vpn';

interface RoutingManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const RoutingManagerModal: React.FC<RoutingManagerModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [quickRules, setQuickRules] = useState<QuickSecurityRule[]>(
    settings.quickSecurityRules || [
      { id: 'bt', name: 'BitTorrent трафик', description: 'Торрент-трафик и P2P трекеры', enabled: true, action: 'BLOCKED' },
      { id: 'ads', name: 'Реклама и трекеры', description: 'AdBlock geosite категории', enabled: false, action: 'BLOCKED' },
      { id: 'cn', name: 'Сайты Китая (CN)', description: 'Все IP и домены Китая', enabled: false, action: 'BLOCKED' },
      { id: 'ru', name: 'Сайты России (RU)', description: 'Все IP и домены России', enabled: true, action: 'DIRECT' },
      { id: 'us', name: 'Сайты США (US)', description: 'Все IP и домены США', enabled: false, action: 'BLOCKED' },
      { id: 'ip_service', name: 'Сервисы определения IP', description: 'ipify, 2ip, ifconfig и др.', enabled: true, action: 'DIRECT' },
    ]
  );

  const [customRules, setCustomRules] = useState<CustomRouteRule[]>(
    settings.customRouteRules || [
      { id: 'rule_1', name: 'Block BitTorrent', domains: ['torrent', 'tracker'], ips: [], action: 'BLOCKED', enabled: true },
      { id: 'rule_2', name: 'Сервисы определения IP', domains: ['2ip.ru', 'ipify.org', 'ifconfig.me'], ips: [], action: 'DIRECT', enabled: true },
      { id: 'rule_3', name: 'RU Sites', domains: ['geosite:ru'], ips: ['geoip:ru'], action: 'DIRECT', enabled: true },
      { id: 'rule_4', name: 'Local Private IPs', domains: [], ips: ['geoip:private'], action: 'DIRECT', enabled: true },
    ]
  );

  // Drag & Drop State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLTableRowElement | null>(null);

  // Edit / Add Custom Rule State
  const [editingRule, setEditingRule] = useState<CustomRouteRule | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleDomains, setRuleDomains] = useState('');
  const [ruleIps, setRuleIps] = useState('');
  const [ruleAction, setRuleAction] = useState<RouteAction>('DIRECT');
  const [isRuleFormOpen, setIsRuleFormOpen] = useState(false);

  if (!isOpen) return null;

  const handleToggleQuickRule = (id: string) => {
    const updated = quickRules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
    setQuickRules(updated);
    onUpdateSettings({ quickSecurityRules: updated });
  };

  const handleChangeQuickRuleAction = (id: string, action: RouteAction) => {
    const updated = quickRules.map(r => r.id === id ? { ...r, action } : r);
    setQuickRules(updated);
    onUpdateSettings({ quickSecurityRules: updated });
  };

  const handleToggleCustomRule = (id: string) => {
    const updated = customRules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
    setCustomRules(updated);
    onUpdateSettings({ customRouteRules: updated });
  };

  const handleMoveRule = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= customRules.length) return;

    const newRules = [...customRules];
    const temp = newRules[index];
    newRules[index] = newRules[targetIndex];
    newRules[targetIndex] = temp;

    setCustomRules(newRules);
    onUpdateSettings({ customRouteRules: newRules });
  };

  // --- Robust Drag & Drop Handlers ---
  const onDragStartHandler = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    setDraggedIndex(index);
    dragNodeRef.current = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const onDragOverHandler = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const onDropHandler = (e: React.DragEvent<HTMLTableRowElement>, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...customRules];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(dropIndex, 0, movedItem);

    setCustomRules(updated);
    onUpdateSettings({ customRouteRules: updated });

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const onDragEndHandler = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDeleteRule = (id: string) => {
    const updated = customRules.filter(r => r.id !== id);
    setCustomRules(updated);
    onUpdateSettings({ customRouteRules: updated });
  };

  const handleOpenAddRule = () => {
    setEditingRule(null);
    setRuleName('');
    setRuleDomains('');
    setRuleIps('');
    setRuleAction('DIRECT');
    setIsRuleFormOpen(true);
  };

  const handleOpenEditRule = (rule: CustomRouteRule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    setRuleDomains((rule.domains || []).join(', '));
    setRuleIps((rule.ips || []).join(', '));
    setRuleAction(rule.action);
    setIsRuleFormOpen(true);
  };

  const handleSaveRuleForm = (e: React.FormEvent) => {
    e.preventDefault();
    const domainsArr = ruleDomains.split(/[\n,]/).map(d => d.trim()).filter(Boolean);
    const ipsArr = ruleIps.split(/[\n,]/).map(i => i.trim()).filter(Boolean);

    if (editingRule) {
      const updated = customRules.map(r => r.id === editingRule.id ? {
        ...r,
        name: ruleName || 'Пользовательское правило',
        domains: domainsArr,
        ips: ipsArr,
        action: ruleAction,
      } : r);
      setCustomRules(updated);
      onUpdateSettings({ customRouteRules: updated });
    } else {
      const newRule: CustomRouteRule = {
        id: `rule_${Date.now()}`,
        name: ruleName || 'Новое правило',
        domains: domainsArr,
        ips: ipsArr,
        action: ruleAction,
        enabled: true,
      };
      const updated = [...customRules, newRule];
      setCustomRules(updated);
      onUpdateSettings({ customRouteRules: updated });
    }

    setIsRuleFormOpen(false);
  };

  const getActionBadgeClass = (action: RouteAction) => {
    switch (action) {
      case 'BLOCKED': return 'bg-rose-500/15 text-rose-300 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.15)]';
      case 'DIRECT': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]';
      case 'VPN': return 'bg-purple-500/15 text-purple-300 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.15)]';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      {/* Outer Double-Bezel Shell */}
      <div className="relative w-full max-w-4xl double-bezel-shell bg-[#080914] border border-white/10 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="double-bezel-core p-5 flex flex-col flex-1 overflow-hidden">
          
          {/* Cosmic Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500/20 via-purple-500/15 to-transparent border border-amber-500/30 text-amber-300 shadow-glow-violet">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-extrabold text-slate-100 font-sans tracking-wide">
                    Правила маршрутизации и безопасности
                  </h3>
                  <span className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest font-bold rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300">
                    Sentinel Policy
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Быстрые правила безопасности и Drag-and-Drop перетаскивание приоритетов
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1.5 my-4 space-y-5">
            
            {/* Section 1: Quick Security Rules Grid */}
            <div className="p-4 rounded-2xl bg-[#0e1324] border border-white/10 shadow-lg space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-100 tracking-wide">Быстрые правила безопасности</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  Перенаправление и мгновенная блокировка категорий трафика
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {quickRules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`p-3.5 rounded-xl border spring-transition flex flex-col justify-between space-y-2.5 ${
                      rule.enabled
                        ? 'bg-gradient-to-b from-[#12182e] to-[#0e1324] border-purple-500/30 shadow-inner'
                        : 'bg-[#060812] border-white/5 opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="pr-2">
                        <span className="text-xs font-bold text-slate-100 block">{rule.name}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{rule.description}</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => handleToggleQuickRule(rule.id)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Назначение:</span>
                      <select
                        value={rule.action}
                        onChange={(e) => handleChangeQuickRuleAction(rule.id, e.target.value as RouteAction)}
                        className={`px-2.5 py-1 text-[10px] font-bold font-mono rounded-lg border focus:outline-none cursor-pointer transition-colors ${
                          rule.action === 'BLOCKED'
                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                            : rule.action === 'DIRECT'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                        }`}
                      >
                        <option value="BLOCKED" className="bg-[#0e1324] text-rose-300">BLOCKED</option>
                        <option value="DIRECT" className="bg-[#0e1324] text-emerald-300">DIRECT</option>
                        <option value="VPN" className="bg-[#0e1324] text-purple-300">VPN</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Custom Routing Rules Table with Rock-Solid Drag & Drop */}
            <div className="p-4 rounded-2xl bg-[#0e1324] border border-white/10 shadow-lg space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-slate-100 tracking-wide">Правила маршрутизации (Зажмите и тяните грип ⠿)</span>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddRule}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-medium shadow-glow-violet transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить правило</span>
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#060812]">
                <table className="w-full text-left text-xs font-sans border-collapse">
                  <thead className="bg-white/[0.03] text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="py-2.5 px-2.5 w-8"></th>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3.5">Описание</th>
                      <th className="py-2.5 px-3.5">Условия</th>
                      <th className="py-2.5 px-3.5">Назначение</th>
                      <th className="py-2.5 px-3.5">Статус</th>
                      <th className="py-2.5 px-3.5 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {customRules.map((rule, index) => {
                      const isDragging = draggedIndex === index;
                      const isDragOver = dragOverIndex === index;

                      return (
                        <tr
                          key={rule.id}
                          draggable={true}
                          onDragStart={(e) => onDragStartHandler(e, index)}
                          onDragOver={(e) => onDragOverHandler(e, index)}
                          onDrop={(e) => onDropHandler(e, index)}
                          onDragEnd={onDragEndHandler}
                          className={`transition-all duration-150 ${
                            isDragging
                              ? 'opacity-40 bg-purple-900/30 border-dashed border-purple-500'
                              : isDragOver
                              ? 'bg-purple-600/25 border-t-2 border-b-2 border-purple-400'
                              : 'hover:bg-white/[0.04]'
                          }`}
                        >
                          {/* Grip Handle Cell */}
                          <td className="py-3 px-2.5 text-purple-400 hover:text-purple-300 cursor-grab active:cursor-grabbing">
                            <div className="p-1 rounded bg-purple-500/10 border border-purple-500/20 inline-block">
                              <GripVertical className="w-4 h-4" />
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-400 font-bold">{index + 1}</td>
                          <td className="py-3 px-3.5 font-semibold text-slate-100">{rule.name}</td>
                          <td className="py-3 px-3.5 font-mono text-[11px]">
                            {rule.domains && rule.domains.length > 0 && (
                              <span className="mr-2.5 text-slate-300">
                                <span className="text-slate-500">Domains:</span> {rule.domains.join(', ')}
                              </span>
                            )}
                            {rule.ips && rule.ips.length > 0 && (
                              <span className="text-amber-300">
                                <span className="text-slate-500">IPs:</span> {rule.ips.join(', ')}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5">
                            <span className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg border ${getActionBadgeClass(rule.action)}`}>
                              {rule.action}
                            </span>
                          </td>
                          <td className="py-3 px-3.5">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={rule.enabled}
                                onChange={() => handleToggleCustomRule(rule.id)}
                                className="sr-only peer"
                              />
                              <div className="w-7 h-3.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
                          </td>
                          <td className="py-3 px-3.5 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={() => handleMoveRule(index, 'up')}
                                disabled={index === 0}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-colors cursor-pointer"
                                title="Поднять приоритет"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleMoveRule(index, 'down')}
                                disabled={index === customRules.length - 1}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-colors cursor-pointer"
                                title="Опустить приоритет"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEditRule(rule)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                                title="Редактировать"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRule(rule.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Удалить"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-white/10 flex-shrink-0">
            <button
              onClick={onClose}
              className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-glow-violet transition-all active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Сохранить правила</span>
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Rule Modal Dialog */}
      {isRuleFormOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md p-5 rounded-2xl bg-[#0e1324] border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h4 className="text-xs font-bold text-slate-100 font-sans">
                {editingRule ? 'Редактировать правило' : 'Добавить новое правило'}
              </h4>
              <button onClick={() => setIsRuleFormOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRuleForm} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-slate-300 mb-1">Описание правила</label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="Например: Обход Yandex / Block Ads"
                  required
                  className="w-full px-3 py-1.5 text-xs bg-black/40 border border-white/10 rounded-xl text-slate-100 focus:outline-none focus:border-purple-500/50 font-sans"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-300 mb-1">Домены (через запятую)</label>
                <input
                  type="text"
                  value={ruleDomains}
                  onChange={(e) => setRuleDomains(e.target.value)}
                  placeholder="yandex.ru, geosite:ru, torrent"
                  className="w-full px-3 py-1.5 text-xs font-mono bg-black/40 border border-white/10 rounded-xl text-slate-100 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-300 mb-1">IP-адреса / GeoIP (через запятую)</label>
                <input
                  type="text"
                  value={ruleIps}
                  onChange={(e) => setRuleIps(e.target.value)}
                  placeholder="geoip:ru, geoip:private, 1.1.1.1"
                  className="w-full px-3 py-1.5 text-xs font-mono bg-black/40 border border-white/10 rounded-xl text-slate-100 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-300 mb-1">Назначение (Действие)</label>
                <select
                  value={ruleAction}
                  onChange={(e) => setRuleAction(e.target.value as RouteAction)}
                  className="w-full px-3 py-1.5 text-xs bg-black/40 border border-white/10 rounded-xl text-slate-100 focus:outline-none focus:border-purple-500/50 font-mono font-bold cursor-pointer"
                >
                  <option value="DIRECT" className="bg-[#0e1324] text-emerald-300">DIRECT (Напрямую мимо VPN)</option>
                  <option value="VPN" className="bg-[#0e1324] text-purple-300">VPN (В туннель)</option>
                  <option value="BLOCKED" className="bg-[#0e1324] text-rose-300">BLOCKED (Заблокировать)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRuleFormOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs rounded-xl shadow-glow-violet cursor-pointer"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
