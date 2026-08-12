import React, { useState } from 'react';
import { Route, Shield, Plus, Edit2, Trash2, GripVertical, Check, Sparkles } from 'lucide-react';
import { AppSettings, CustomRouteRule, QuickSecurityRule, RouteAction } from '../types/vpn';
import { GlassSelectDropdown, SelectOption } from './GlassSelectDropdown';

interface RoutingManagerViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

const ACTION_OPTIONS: SelectOption<RouteAction>[] = [
  { value: 'BLOCKED', label: 'BLOCKED', badge: 'BLOCK', badgeType: 'prerelease' },
  { value: 'DIRECT', label: 'DIRECT', badge: 'DIRECT', badgeType: 'stable' },
  { value: 'VPN', label: 'VPN', badge: 'VPN', badgeType: 'info' },
];

// Exact IP Checkers Specs matched with Spectre Panel backend (backend/database/crud/routing.py)
const IP_CHECK_DOMAINS = [
  "api.ipify.org", "ipify.org", "checkip.amazonaws.com", "ifconfig.me", "ifconfig.co", "ifconfig.io",
  "telega.me", "geosite:2ip", "2ip.ru", "2ip.io", "2ip.ua", "2ip.me",
  "myip.ru", "myip.com", "icanhazip.com", "wtfismyip.com", "ip.sb",
  "ipapi.co", "ip-api.com", "ipapi.com", "db-ip.com", "whoer.net",
  "ipwhois.io", "ipwho.is", "ipaddress.my", "ipaddress.com", "check-host.net",
  "browserleaks.com", "ip2location.com", "ip2location.io", "showmyip.com",
  "whatsmyip.org", "whatismyip.com", "whatsmyipaddress.com", "whatismyipaddress.com",
  "dnsleaktest.com", "ipleak.net", "ip.me", "ip.cn", "ip138.com",
  "ident.me", "curlmyip.org", "eth0.me", "myexternalip.com", "ip.nf",
  "trackip.net", "checkip.dyndns.org"
];

const QUICK_PRESET_MAP: Record<string, { name: string; domains: string[]; ips: string[] }> = {
  bt: { name: 'Block BitTorrent', domains: ['domain:torrent', 'domain:tracker', 'domain:peerexchange', 'keyword:torrent'], ips: [] },
  ads: { name: 'Реклама и трекеры', domains: ['geosite:category-ads-all'], ips: [] },
  cn: { name: 'Сайты Китая (CN)', domains: ['geosite:cn', 'regexp:.*\\.cn$'], ips: ['geoip:cn'] },
  ru: { name: 'Сайты России (RU)', domains: ['regexp:.*\\.ru$', 'regexp:.*\\.su$', 'regexp:.*\\.рф$', 'geosite:yandex', 'geosite:vk'], ips: ['geoip:ru'] },
  us: { name: 'Сайты США (US)', domains: ['regexp:.*\\.us$'], ips: ['geoip:us'] },
  ip_service: { name: 'Сервисы определения IP', domains: IP_CHECK_DOMAINS, ips: [] },
};

const DEFAULT_QUICK_RULES: QuickSecurityRule[] = [
  { id: 'bt', name: 'BitTorrent трафик', description: 'Торрент-трафик и трекеры', enabled: true, action: 'BLOCKED' },
  { id: 'ads', name: 'Реклама и трекеры', description: 'AdBlock geosite категории', enabled: false, action: 'BLOCKED' },
  { id: 'cn', name: 'Сайты Китая (CN)', description: 'Все IP и сайты Китая', enabled: false, action: 'BLOCKED' },
  { id: 'ru', name: 'Сайты России (RU)', description: 'Все IP и сайты России', enabled: true, action: 'DIRECT' },
  { id: 'us', name: 'Сайты США (US)', description: 'Все IP и сайты США', enabled: false, action: 'BLOCKED' },
  { id: 'ip_service', name: 'Сервисы определения IP', description: '2ip, ipify, ifconfig, ipinfo, whoer, browserleaks и др. (45+ сервисов Spectre-panel)', enabled: true, action: 'DIRECT' },
];

const DEFAULT_CUSTOM_RULES: CustomRouteRule[] = [
  { id: 'rule_bt', name: 'Block BitTorrent', domains: ['domain:torrent', 'domain:tracker', 'keyword:torrent'], ips: [], action: 'BLOCKED', enabled: true },
  { id: 'rule_ip_service', name: 'Сервисы определения IP', domains: IP_CHECK_DOMAINS, ips: [], action: 'DIRECT', enabled: true },
  { id: 'rule_ru', name: 'RU Sites', domains: ['geosite:ru'], ips: ['geoip:ru'], action: 'DIRECT', enabled: true },
  { id: 'rule_private', name: 'Local Private IPs', domains: [], ips: ['geoip:private'], action: 'DIRECT', enabled: true },
];

export const RoutingManagerView: React.FC<RoutingManagerViewProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [rules, setRules] = useState<CustomRouteRule[]>(() => {
    return settings.customRouteRules && settings.customRouteRules.length > 0
      ? settings.customRouteRules
      : DEFAULT_CUSTOM_RULES;
  });

  const [quickRules, setQuickRules] = useState<QuickSecurityRule[]>(() => {
    return settings.quickSecurityRules && settings.quickSecurityRules.length > 0
      ? settings.quickSecurityRules
      : DEFAULT_QUICK_RULES;
  });

  const [draggedRuleId, setDraggedRuleId] = useState<string | null>(null);

  // Modal State for Add/Edit Custom Rule
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CustomRouteRule | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleDomains, setRuleDomains] = useState('');
  const [ruleIps, setRuleIps] = useState('');
  const [ruleAction, setRuleAction] = useState<RouteAction>('VPN');

  // Toggle Quick Security Rule ON/OFF & sync with routing table
  const handleToggleQuickRuleEnabled = (id: string) => {
    const target = quickRules.find((q) => q.id === id);
    if (!target) return;

    const newEnabled = !target.enabled;
    const updatedQuick = quickRules.map((q) => (q.id === id ? { ...q, enabled: newEnabled } : q));
    setQuickRules(updatedQuick);

    // Sync with Custom Routing Rules Table
    const presetInfo = QUICK_PRESET_MAP[id] || { name: target.name, domains: [], ips: [] };
    const existingRuleIndex = rules.findIndex(
      (r) => r.id === `rule_${id}` || r.name.toLowerCase() === presetInfo.name.toLowerCase()
    );

    let updatedRules = [...rules];
    if (existingRuleIndex >= 0) {
      updatedRules[existingRuleIndex] = {
        ...updatedRules[existingRuleIndex],
        enabled: newEnabled,
        action: target.action,
      };
    } else if (newEnabled) {
      const newRule: CustomRouteRule = {
        id: `rule_${id}`,
        name: presetInfo.name,
        domains: presetInfo.domains,
        ips: presetInfo.ips,
        action: target.action,
        enabled: true,
      };
      updatedRules = [...updatedRules, newRule];
    }

    setRules(updatedRules);
    onUpdateSettings({ quickSecurityRules: updatedQuick, customRouteRules: updatedRules });
  };

  // Change Quick Security Rule Action (BLOCKED/DIRECT/VPN) & sync with table
  const handleChangeQuickRuleAction = (id: string, action: RouteAction) => {
    const updatedQuick = quickRules.map((q) => (q.id === id ? { ...q, action } : q));
    setQuickRules(updatedQuick);

    const presetInfo = QUICK_PRESET_MAP[id];
    const existingRuleIndex = rules.findIndex(
      (r) => r.id === `rule_${id}` || (presetInfo && r.name.toLowerCase() === presetInfo.name.toLowerCase())
    );

    let updatedRules = [...rules];
    if (existingRuleIndex >= 0) {
      updatedRules[existingRuleIndex] = {
        ...updatedRules[existingRuleIndex],
        action: action,
      };
      setRules(updatedRules);
    }

    onUpdateSettings({ quickSecurityRules: updatedQuick, customRouteRules: updatedRules });
  };

  const handleToggleRuleEnabled = (id: string) => {
    const updated = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    setRules(updated);

    const matchingQuickId = Object.keys(QUICK_PRESET_MAP).find(
      (k) => `rule_${k}` === id || QUICK_PRESET_MAP[k].name.toLowerCase() === rules.find(r => r.id === id)?.name.toLowerCase()
    );
    if (matchingQuickId) {
      const targetRule = updated.find(r => r.id === id);
      if (targetRule) {
        const updatedQuick = quickRules.map(q => q.id === matchingQuickId ? { ...q, enabled: targetRule.enabled } : q);
        setQuickRules(updatedQuick);
        onUpdateSettings({ customRouteRules: updated, quickSecurityRules: updatedQuick });
        return;
      }
    }

    onUpdateSettings({ customRouteRules: updated });
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter((r) => r.id !== id);
    setRules(updated);
    onUpdateSettings({ customRouteRules: updated });
  };

  const handleOpenAddModal = () => {
    setEditingRule(null);
    setRuleName('');
    setRuleDomains('');
    setRuleIps('');
    setRuleAction('VPN');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rule: CustomRouteRule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    setRuleDomains((rule.domains || []).join(', '));
    setRuleIps((rule.ips || []).join(', '));
    setRuleAction(rule.action);
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    const domainsArr = ruleDomains.split(',').map((s) => s.trim()).filter(Boolean);
    const ipsArr = ruleIps.split(',').map((s) => s.trim()).filter(Boolean);

    if (editingRule) {
      const updated = rules.map((r) =>
        r.id === editingRule.id
          ? { ...r, name: ruleName, domains: domainsArr, ips: ipsArr, action: ruleAction }
          : r
      );
      setRules(updated);
      onUpdateSettings({ customRouteRules: updated });
    } else {
      const newRule: CustomRouteRule = {
        id: `rule_${Date.now()}`,
        name: ruleName,
        domains: domainsArr,
        ips: ipsArr,
        action: ruleAction,
        enabled: true,
      };
      const updated = [...rules, newRule];
      setRules(updated);
      onUpdateSettings({ customRouteRules: updated });
    }

    setIsModalOpen(false);
  };

  // Fixed Drag and Drop Handlers for Webview2 (prevents prohibited circle cursor)
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedRuleId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedRuleId;
    if (!sourceId || sourceId === targetId) return;

    const draggedIndex = rules.findIndex((r) => r.id === sourceId);
    const targetIndex = rules.findIndex((r) => r.id === targetId);

    if (draggedIndex < 0 || targetIndex < 0) return;

    const newRules = [...rules];
    const [movedItem] = newRules.splice(draggedIndex, 1);
    newRules.splice(targetIndex, 0, movedItem);

    setRules(newRules);
    setDraggedRuleId(null);
    onUpdateSettings({ customRouteRules: newRules });
  };

  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-[#060812] select-none space-y-6 max-w-6xl mx-auto">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-white/10 gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-600/30 to-indigo-700/20 border border-purple-500/30 text-purple-300 shadow-glow-violet flex-shrink-0">
            <Route className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-base font-extrabold text-slate-100 font-sans tracking-wide">
                Менеджер правил маршрутизации трафика
              </h1>
              <span className="px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-widest font-bold rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 whitespace-nowrap">
                Spectre Routing
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Быстрые правила безопасности и таблица кастомной маршрутизации трафика
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-glow-violet transition-all active:scale-95 cursor-pointer whitespace-nowrap flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Добавить правило</span>
        </button>
      </div>

      {/* Quick Security Presets Grid */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2 text-xs font-mono font-bold text-slate-300">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>БЫСТРЫЕ ПРАВИЛА БЕЗОПАСНОСТИ РЕГИОНОВ И КАТЕГОРИЙ</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickRules.map((q) => (
            <div
              key={q.id}
              className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-3 shadow-md ${
                q.enabled
                  ? 'bg-gradient-to-b from-[#12172b] to-[#0a0d1a] border-purple-500/40 shadow-glow-violet'
                  : 'bg-[#0a0d1a] border-white/10 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-100 font-sans block">{q.name}</span>
                  <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">{q.description}</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleQuickRuleEnabled(q.id)}
                  className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 flex items-center flex-shrink-0 cursor-pointer ${
                    q.enabled ? 'bg-purple-600 justify-end' : 'bg-slate-800 justify-start'
                  }`}
                  title={q.enabled ? 'Деактивировать правило' : 'Включить и добавить в таблицу'}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                  Назначение:
                </span>
                <div className="w-32 flex-shrink-0">
                  <GlassSelectDropdown
                    value={q.action}
                    options={ACTION_OPTIONS}
                    onChange={(newAct) => handleChangeQuickRuleAction(q.id, newAct)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Drag & Drop Custom Rules Table */}
      <div className="p-5 rounded-2xl bg-[#0a0d1a] border border-white/10 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-mono font-bold text-slate-300">
            <Shield className="w-4 h-4 text-purple-400" />
            <span>ТАБЛИЦА МАРШРУТИЗАЦИИ (ПРИОРИТЕТ СВЕРХУ ВНИЗ)</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Перетащите <span className="text-purple-400">⠿</span> для смены приоритета
          </span>
        </div>

        {/* Clean Responsive Table */}
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#060812]">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-[#080b18] text-[10px] text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center"></th>
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-4 min-w-[140px]">Описание</th>
                <th className="py-3 px-4 min-w-[200px]">Условия (Domains / IPs)</th>
                <th className="py-3 px-4 min-w-[110px] text-center">Назначение</th>
                <th className="py-3 px-4 min-w-[90px] text-center">Статус</th>
                <th className="py-3 px-4 w-24 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-mono">
                    Нет добавленных кастомных правил. Включите быструю категорию или нажмите «Добавить правило».
                  </td>
                </tr>
              ) : (
                rules.map((rule, idx) => {
                  const domainsList = rule.domains || [];
                  const ipsList = rule.ips || [];

                  return (
                    <tr
                      key={rule.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, rule.id)}
                      onDragOver={handleDragOver}
                      onDragEnter={handleDragEnter}
                      onDrop={(e) => handleDrop(e, rule.id)}
                      className={`transition-colors hover:bg-white/[0.04] ${
                        draggedRuleId === rule.id ? 'opacity-40 bg-purple-500/10' : ''
                      } ${!rule.enabled ? 'opacity-50' : ''}`}
                    >
                      {/* Drag Grip Handle */}
                      <td className="py-3.5 px-3 text-center cursor-grab active:cursor-grabbing text-slate-500 hover:text-purple-400">
                        <GripVertical className="w-4 h-4 mx-auto" />
                      </td>

                      {/* Priority Index */}
                      <td className="py-3.5 px-3 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Rule Name */}
                      <td className="py-3.5 px-4 font-bold text-slate-100 font-sans">
                        {rule.name}
                      </td>

                      {/* Conditions */}
                      <td className="py-3.5 px-4 text-[11px] text-slate-300">
                        {domainsList.length > 0 && (
                          <div>
                            <span className="text-slate-500 font-medium">Domains: </span>
                            <span className="text-purple-300">{domainsList.length} шт.</span>
                          </div>
                        )}
                        {ipsList.length > 0 && (
                          <div>
                            <span className="text-slate-500 font-medium">IPs: </span>
                            <span className="text-amber-300">{ipsList.join(', ')}</span>
                          </div>
                        )}
                      </td>

                      {/* Action Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-3 py-1 text-[10px] font-mono font-extrabold rounded-full border ${
                            rule.action === 'BLOCKED'
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              : rule.action === 'DIRECT'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                          }`}
                        >
                          {rule.action}
                        </span>
                      </td>

                      {/* Clean Custom Button Toggle (Status) */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleRuleEnabled(rule.id)}
                          className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 flex items-center mx-auto cursor-pointer ${
                            rule.enabled ? 'bg-purple-600 justify-end' : 'bg-slate-800 justify-start'
                          }`}
                        >
                          <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                        </button>
                      </td>

                      {/* Actions (Edit / Delete) */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenEditModal(rule)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                            title="Редактировать правило"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
                            title="Удалить правило"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-[#0a0d1a] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4 font-mono text-xs">
            <h3 className="text-sm font-bold text-slate-100 font-sans">
              {editingRule ? 'Редактировать правило' : 'Добавить новое правило'}
            </h3>

            <form onSubmit={handleSaveModal} className="space-y-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Название правила:</label>
                <input
                  type="text"
                  required
                  placeholder="например, Torrent Block или RU Sites"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#060812] border border-white/15 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Домены (через запятую):</label>
                <input
                  type="text"
                  placeholder="например, geosite:ru, torrent, tracker"
                  value={ruleDomains}
                  onChange={(e) => setRuleDomains(e.target.value)}
                  className="w-full px-3 py-2 bg-[#060812] border border-white/15 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">IP-адреса / Подсети (через запятую):</label>
                <input
                  type="text"
                  placeholder="например, geoip:ru, 192.168.1.0/24"
                  value={ruleIps}
                  onChange={(e) => setRuleIps(e.target.value)}
                  className="w-full px-3 py-2 bg-[#060812] border border-white/15 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Действие маршрута:</label>
                <select
                  value={ruleAction}
                  onChange={(e) => setRuleAction(e.target.value as RouteAction)}
                  className="w-full px-3 py-2 bg-[#060812] border border-white/15 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer font-bold"
                >
                  <option value="VPN" className="bg-[#0e1324] text-purple-300">VPN (Направлять в туннель)</option>
                  <option value="DIRECT" className="bg-[#0e1324] text-emerald-300">DIRECT (Направлять напрямую)</option>
                  <option value="BLOCKED" className="bg-[#0e1324] text-rose-300">BLOCKED (Заблокировать трафик)</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 px-4 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl font-semibold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-semibold shadow-glow-violet cursor-pointer"
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
