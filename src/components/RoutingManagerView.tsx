import React, { useState, useEffect } from 'react';
import { Route, Shield, Plus, Edit2, Trash2, GripVertical, Check, Sparkles } from 'lucide-react';
import { AppSettings, CustomRouteRule, QuickSecurityRule, RouteAction } from '../types/vpn';
import { GlassSelectDropdown, SelectOption } from './GlassSelectDropdown';
import { useI18n } from '../i18n/i18nContext';

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
import { IP_CHECK_DOMAINS } from '../constants/routingDomains';

const QUICK_PRESET_MAP: Record<string, { name: string; domains: string[]; ips: string[] }> = {
  local_ip: { name: 'Локальные IP адреса (LAN)', domains: [], ips: ['geoip:private', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8', '169.254.0.0/16'] },
  local_domains: { name: 'Локальные сайты (.local, .lan, роутеры)', domains: ['domain:.local', 'domain:.lan', 'domain:.home', 'domain:.internal', 'domain:.corp', 'domain:.localdomain', 'domain:router.asus.com', 'domain:tplinkwifi.net', 'domain:keenetic.io', 'domain:miwifi.com', 'keyword:localhost'], ips: [] },
  bt: { name: 'Block BitTorrent', domains: ['domain:torrent', 'domain:tracker', 'domain:peerexchange', 'keyword:torrent'], ips: [] },
  ads: { name: 'Реклама и трекеры', domains: ['geosite:category-ads-all'], ips: [] },
  cn: { name: 'Сайты Китая (CN)', domains: ['geosite:cn', 'regexp:.*\\.cn$'], ips: ['geoip:cn'] },
  ru: { name: 'Сайты России (RU)', domains: ['regexp:.*\\.ru$', 'regexp:.*\\.su$', 'regexp:.*\\.рф$', 'geosite:yandex', 'geosite:vk'], ips: ['geoip:ru'] },
  us: { name: 'Сайты США (US)', domains: ['regexp:.*\\.us$'], ips: ['geoip:us'] },
  ip_service: { name: 'Сервисы определения IP', domains: IP_CHECK_DOMAINS, ips: [] },
};

const DEFAULT_QUICK_RULES: QuickSecurityRule[] = [
  { id: 'local_ip', name: 'Локальные IP адреса (LAN)', description: 'Прямой доступ к домашней сети (192.168.x, 10.x, 172.16.x, 127.0.0.1, geoip:private)', enabled: true, action: 'DIRECT' },
  { id: 'local_domains', name: 'Локальные сайты и домены', description: 'Роутеры, .local, .lan, .home, .internal, веб-интерфейсы NAS/IoT', enabled: true, action: 'DIRECT' },
  { id: 'bt', name: 'BitTorrent трафик', description: 'Торрент-трафик и трекеры', enabled: false, action: 'BLOCKED' },
  { id: 'ads', name: 'Реклама и трекеры', description: 'AdBlock geosite категории', enabled: false, action: 'BLOCKED' },
  { id: 'cn', name: 'Сайты Китая (CN)', description: 'Все IP и сайты Китая', enabled: false, action: 'BLOCKED' },
  { id: 'ru', name: 'Сайты России (RU)', description: 'Все IP и сайты России', enabled: false, action: 'DIRECT' },
  { id: 'us', name: 'Сайты США (US)', description: 'Все IP и сайты США', enabled: false, action: 'BLOCKED' },
  { id: 'ip_service', name: 'Сервисы определения IP', description: '2ip, ipify, ifconfig, ipinfo, whoer, browserleaks и др. (47 сервисов)', enabled: false, action: 'DIRECT' },
];

const DEFAULT_CUSTOM_RULES: CustomRouteRule[] = [
  { id: 'rule_local_ip', name: 'Local Private IPs', domains: [], ips: ['geoip:private', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8'], action: 'DIRECT', enabled: true },
  { id: 'rule_local_domains', name: 'Local Domains & Routers', domains: ['domain:.local', 'domain:.lan', 'domain:.home', 'domain:.internal', 'domain:router.asus.com', 'domain:tplinkwifi.net', 'domain:keenetic.io', 'domain:miwifi.com'], ips: [], action: 'DIRECT', enabled: true },
  { id: 'rule_bt', name: 'Block BitTorrent', domains: ['domain:torrent', 'domain:tracker', 'keyword:torrent'], ips: [], action: 'BLOCKED', enabled: false },
  { id: 'rule_ip_service', name: 'Сервисы определения IP', domains: IP_CHECK_DOMAINS, ips: [], action: 'DIRECT', enabled: false },
  { id: 'rule_ru', name: 'RU Sites', domains: ['geosite:ru'], ips: ['geoip:ru'], action: 'DIRECT', enabled: false },
];

export const RoutingManagerView: React.FC<RoutingManagerViewProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const { t } = useI18n();
  const [rules, setRules] = useState<CustomRouteRule[]>(() => {
    const raw = settings.customRouteRules && settings.customRouteRules.length > 0
      ? settings.customRouteRules
      : DEFAULT_CUSTOM_RULES;

    return raw.map((r) => {
      if (r.id === 'rule_ip_service' || r.name.toLowerCase().includes('сервисы определения ip')) {
        if (!r.domains || r.domains.length < IP_CHECK_DOMAINS.length) {
          return { ...r, domains: IP_CHECK_DOMAINS };
        }
      }
      return r;
    });
  });

  const [quickRules, setQuickRules] = useState<QuickSecurityRule[]>(() => {
    return settings.quickSecurityRules && settings.quickSecurityRules.length > 0
      ? settings.quickSecurityRules
      : DEFAULT_QUICK_RULES;
  });

  const [draggedRuleId, setDraggedRuleId] = useState<string | null>(null);

  // Sync with parent settings when they change (e.g., after async load)
  useEffect(() => {
    if (settings.customRouteRules && settings.customRouteRules.length > 0) {
      setRules(prev => {
        // Only update if rules actually differ (avoid infinite loops)
        const same = JSON.stringify(prev) === JSON.stringify(settings.customRouteRules);
        return same ? prev : settings.customRouteRules;
      });
    }
  }, [settings.customRouteRules]);

  useEffect(() => {
    if (settings.quickSecurityRules && settings.quickSecurityRules.length > 0) {
      setQuickRules(prev => {
        const same = JSON.stringify(prev) === JSON.stringify(settings.quickSecurityRules);
        return same ? prev : settings.quickSecurityRules;
      });
    }
  }, [settings.quickSecurityRules]);

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

    const targetRule = updated.find(r => r.id === id);
    const matchingQuickId = targetRule
      ? Object.keys(QUICK_PRESET_MAP).find(
          (k) => `rule_${k}` === id || QUICK_PRESET_MAP[k].name.toLowerCase() === targetRule.name.toLowerCase()
        )
      : undefined;

    if (matchingQuickId) {
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
        id: crypto.randomUUID(),
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

  const getPresetName = (id: string, defaultName: string) => {
    switch (id) {
      case 'bt': return t('preset_bittorrent_name');
      case 'ads': return t('preset_ads_name');
      case 'cn': return t('preset_cn_name');
      case 'ru': return t('preset_ru_name');
      case 'us': return t('preset_us_name');
      case 'ip_service': return t('preset_ip_service_name');
      default: return defaultName;
    }
  };

  const getPresetDesc = (id: string, defaultDesc: string) => {
    switch (id) {
      case 'bt': return t('preset_bittorrent_desc');
      case 'ads': return t('preset_ads_desc');
      case 'cn': return t('preset_cn_desc');
      case 'ru': return t('preset_ru_desc');
      case 'us': return t('preset_us_desc');
      case 'ip_service': return t('preset_ip_service_desc');
      default: return defaultDesc;
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden bg-[#060812] select-none space-y-6 w-full min-w-0 pb-16">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-white/10 gap-3 min-w-0">
        <div className="flex items-center space-x-3.5 min-w-0 flex-1">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-600/25 to-indigo-700/15 border border-purple-500/30 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.15)] flex-shrink-0">
            <Route className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
              <h1 className="text-base sm:text-lg font-bold text-slate-100 font-sans tracking-wide truncate">
                {t('route_title')}
              </h1>
              <span className="px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-widest font-semibold rounded-full bg-purple-500/10 border border-purple-500/25 text-purple-300 whitespace-nowrap">
                Spectre Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
              {t('route_subtitle')}
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all active:scale-95 cursor-pointer whitespace-nowrap flex-shrink-0 border border-purple-400/30 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t('route_add_rule')}</span>
        </button>
      </div>

      {/* Quick Security Presets Grid */}
      <div className="space-y-3 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="flex items-center space-x-2 text-xs font-mono font-bold text-slate-300 tracking-wider">
            <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <span>{t('route_quick_presets')}</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
            {t('route_quick_hint')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 min-w-0">
          {quickRules.map((q) => (
            <div
              key={q.id}
              className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between space-y-4 shadow-lg ${
                q.enabled
                  ? 'bg-gradient-to-b from-[#101426] to-[#080b18] border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                  : 'bg-[#080b18]/80 border-white/10 opacity-75 hover:opacity-100 hover:border-white/20'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-100 font-sans truncate">{getPresetName(q.id, q.name)}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono line-clamp-2">{getPresetDesc(q.id, q.description)}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleQuickRuleEnabled(q.id)}
                  className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 flex items-center flex-shrink-0 cursor-pointer ${
                    q.enabled ? 'bg-purple-600 justify-end' : 'bg-slate-800 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono text-slate-500 uppercase">{t('route_col_action')}:</span>
                <div className="w-28">
                  <GlassSelectDropdown
                    value={q.action}
                    options={ACTION_OPTIONS}
                    onChange={(newAction) => handleChangeQuickRuleAction(q.id, newAction)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Routing Rules Table Card */}
      <div className="space-y-3 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-mono font-bold text-slate-300 tracking-wider">
            <Shield className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <span>{t('route_table_title')}</span>
          </div>
        </div>

        {/* Clean Table */}
        <div className="rounded-xl border border-white/10 bg-[#04060f] overflow-hidden">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-[#080b18] text-[10px] text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-1.5 w-7 text-center"></th>
                <th className="py-2.5 px-1.5 w-8 text-center">{t('route_col_num')}</th>
                <th className="py-2.5 px-3">{t('route_col_name')}</th>
                <th className="py-2.5 px-3">{t('route_col_conditions')}</th>
                <th className="py-2.5 px-2 w-24 text-center">{t('route_col_action')}</th>
                <th className="py-2.5 px-2 w-16 text-center">{t('route_col_status')}</th>
                <th className="py-2.5 px-3 w-16 text-right">{t('route_col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-mono">
                    Нет добавленных правил маршрутизации. Включите быструю категорию или нажмите «Добавить правило».
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
                      onDragEnd={() => setDraggedRuleId(null)}
                      className={`transition-colors hover:bg-white/[0.04] ${
                        draggedRuleId === rule.id ? 'opacity-40 bg-purple-500/10' : ''
                      } ${!rule.enabled ? 'opacity-50' : ''}`}
                    >
                      {/* Drag Grip Handle */}
                      <td className="py-2.5 px-1.5 text-center cursor-grab active:cursor-grabbing text-slate-500 hover:text-purple-400 transition-colors">
                        <GripVertical className="w-3.5 h-3.5 mx-auto" />
                      </td>

                      {/* Priority Index */}
                      <td className="py-2.5 px-1.5 text-center">
                        <span className="w-5 h-5 inline-flex items-center justify-center rounded bg-white/5 text-[10px] font-bold text-slate-400 border border-white/10 font-mono">
                          {idx + 1}
                        </span>
                      </td>

                      {/* Rule Name */}
                      <td className="py-2.5 px-3 font-bold text-slate-100 font-sans text-xs">
                        {rule.name}
                      </td>

                      {/* Conditions Tags / Chips */}
                      <td className="py-2.5 px-3 text-[11px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {domainsList.length > 0 && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-[10px] font-medium">
                              <span className="text-purple-400 font-bold">Domains:</span>
                              <span>{domainsList.length}</span>
                            </span>
                          )}
                          {ipsList.length > 0 && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-medium truncate max-w-[180px]" title={ipsList.join(', ')}>
                              <span className="text-amber-400 font-bold">IPs:</span>
                              <span>{ipsList.join(', ')}</span>
                            </span>
                          )}
                          {domainsList.length === 0 && ipsList.length === 0 && (
                            <span className="text-slate-500 italic text-[10px]">Без условий</span>
                          )}
                        </div>
                      </td>

                      {/* Action Badge */}
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-[9px] font-mono font-extrabold rounded-full border shadow-sm ${
                            rule.action === 'BLOCKED'
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.2)]'
                              : rule.action === 'DIRECT'
                              ? 'bg-sky-500/15 text-sky-300 border-sky-500/30 shadow-[0_0_8px_rgba(14,165,233,0.2)]'
                              : 'bg-purple-500/15 text-purple-300 border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.2)]'
                          }`}
                        >
                          {rule.action}
                        </span>
                      </td>

                      {/* Clean Custom Toggle (Status) */}
                      <td className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleRuleEnabled(rule.id)}
                          className={`w-9 h-4.5 rounded-full p-0.5 transition-colors duration-200 flex items-center mx-auto cursor-pointer ${
                            rule.enabled ? 'bg-purple-600 justify-end shadow-[0_0_8px_rgba(168,85,247,0.4)]' : 'bg-slate-800 justify-start'
                          }`}
                        >
                          <div className="w-3.5 h-3.5 rounded-full bg-white shadow-md" />
                        </button>
                      </td>

                      {/* Actions (Edit / Delete) */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleOpenEditModal(rule)}
                            className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                            title="Редактировать правило"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 animate-fadeIn">
          <div className="relative w-full max-w-md bg-[#080b18] border border-white/15 rounded-3xl shadow-2xl p-6 space-y-5 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-slate-100 font-sans">
                {editingRule ? 'Редактировать правило' : 'Добавить новое правило'}
              </h3>
              <span className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                Spectre Rule
              </span>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1.5 font-medium">Название правила:</label>
                <input
                  type="text"
                  required
                  placeholder="например, Torrent Block или RU Sites"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#04060f] border border-white/15 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1.5 font-medium">Домены (через запятую):</label>
                <input
                  type="text"
                  placeholder="например, geosite:ru, torrent, tracker"
                  value={ruleDomains}
                  onChange={(e) => setRuleDomains(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#04060f] border border-white/15 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1.5 font-medium">IP-адреса / Подсети (через запятую):</label>
                <input
                  type="text"
                  placeholder="например, geoip:ru, 192.168.1.0/24"
                  value={ruleIps}
                  onChange={(e) => setRuleIps(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#04060f] border border-white/15 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1.5 font-medium">Действие маршрута:</label>
                <select
                  value={ruleAction}
                  onChange={(e) => setRuleAction(e.target.value as RouteAction)}
                  className="w-full px-3.5 py-2.5 bg-[#04060f] border border-white/15 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer font-bold"
                >
                  <option value="VPN" className="bg-[#0e1324] text-purple-300">VPN (Направлять в туннель)</option>
                  <option value="DIRECT" className="bg-[#0e1324] text-sky-300">DIRECT (Направлять напрямую)</option>
                  <option value="BLOCKED" className="bg-[#0e1324] text-rose-300">BLOCKED (Заблокировать трафик)</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 px-4 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl font-semibold cursor-pointer transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-semibold shadow-[0_0_15px_rgba(168,85,247,0.3)] cursor-pointer transition-all active:scale-95"
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
