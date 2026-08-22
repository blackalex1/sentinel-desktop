import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/ffi/sentinel_core_bindings.dart';
import '../../core/models/connection_status.dart';
import '../../core/providers/app_state_provider.dart';
import '../../core/services/core_supervisor.dart';

enum ThreatSeverity { critical, warning, adblock, info }

class ThreatIncident {
  final String id;
  final DateTime timestamp;
  final String hostOrIp;
  final int? port;
  final String processName;
  final String category;
  final String actionTaken;
  final ThreatSeverity severity;
  final String description;

  const ThreatIncident({
    required this.id,
    required this.timestamp,
    required this.hostOrIp,
    this.port,
    required this.processName,
    required this.category,
    required this.actionTaken,
    required this.severity,
    required this.description,
  });
}

class SensitivePortRule {
  final int port;
  final String protocol;
  final String name;
  final String threatRisk;
  final bool isProtected;

  const SensitivePortRule({
    required this.port,
    required this.protocol,
    required this.name,
    required this.threatRisk,
    this.isProtected = true,
  });

  SensitivePortRule copyWith({bool? isProtected}) {
    return SensitivePortRule(
      port: port,
      protocol: protocol,
      name: name,
      threatRisk: threatRisk,
      isProtected: isProtected ?? this.isProtected,
    );
  }
}

class ThreatsScreen extends StatefulWidget {
  const ThreatsScreen({super.key});

  @override
  State<ThreatsScreen> createState() => _ThreatsScreenState();
}

class _ThreatsScreenState extends State<ThreatsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  StreamSubscription<String>? _logSub;
  String _filterCategory = 'all';
  final List<ThreatIncident> _incidents = [];

  int get _blockedCount => _incidents.where((i) => i.actionTaken == 'BLOCKED' || i.actionTaken == 'DROPPED').length;
  int get _alertsCount => _incidents.where((i) => i.actionTaken == 'ALERT' || i.actionTaken == 'MONITOR').length;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _listenToCoreLogs();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _logSub?.cancel();
    super.dispose();
  }

  void _listenToCoreLogs() {
    _logSub = CoreSupervisor.instance.coreLogStream.listen((logLine) {
      if (!mounted) return;
      _parseLogIncident(logLine);
    });
  }

  void _parseLogIncident(String line) async {
    final lower = line.toLowerCase();

    // Extract connection host and port from core log
    final connMatch = RegExp(r'(?:connection to|to\s+)([a-zA-Z0-9.-]+)(?::(\d+))?').firstMatch(line);
    if (connMatch == null) return;

    final host = connMatch.group(1)!;
    final portStr = connMatch.group(2);
    final port = portStr != null ? int.tryParse(portStr) ?? 0 : 0;

    // Extract process name from core logs (e.g. from process ssh.exe, by process powershell.exe, user: cmd.exe)
    String processName = 'Системный процесс';
    final procMatch = RegExp(
      r'(?:from process|by process|process[:=\s]+|user[:=\s]+)([^\s,\]\)]+)',
      caseSensitive: false,
    ).firstMatch(line);
    if (procMatch != null) {
      final rawProc = procMatch.group(1)!.trim().replaceAll(RegExp(r'^[("\]]+|[)"\]]+$'), '');
      final lastSlash = rawProc.lastIndexOf(RegExp(r'[\\/]'));
      final cleaned = lastSlash != -1 ? rawProc.substring(lastSlash + 1) : rawProc;
      if (cleaned.isNotEmpty && !cleaned.contains(':')) {
        processName = cleaned;
      }
    }

    final state = context.read<AppStateProvider>();
    final auditedPorts = state.blockedPortStrings.map((s) => int.tryParse(s) ?? 0).where((p) => p > 0).toList();

    final isExplicitBlock = lower.contains('outbound/block') ||
        lower.contains('action: block') ||
        lower.contains('action: reject') ||
        lower.contains('match rule: block') ||
        lower.contains('match rule[block]') ||
        (lower.contains('block') && !lower.contains('adblock') && !lower.contains('blocking') && !lower.contains('blackhole')) ||
        lower.contains('reject');

    // Run connection audit through unified Sentinel Security Engine
    final auditReq = jsonEncode({
      'caller_id': processName,
      'destination_ip': host,
      'port': port,
      'protocol': lower.contains('udp') ? 'UDP' : 'TCP',
      'audit_ports': auditedPorts,
      'is_explicit_block': isExplicitBlock,
      'platform': 'windows',
    });

    String category = 'Блокировка угрозы (Ядро Sentinel)';
    String description = 'Соединение зафиксировано политикой безопасности';
    String actionTaken = isExplicitBlock ? 'BLOCKED' : 'ALERT';
    bool isThreat = (port > 0 && auditedPorts.contains(port)) || isExplicitBlock;

    try {
      final res = await SentinelCoreBindings.instance.auditConnectionAsync(auditReq);
      if (res.isNotEmpty && res != '{}') {
        final data = jsonDecode(res) as Map<String, dynamic>;
        if (data['threat_detected'] == true || data['is_blocked'] == true || data['should_block'] == true) {
          isThreat = true;
          actionTaken = data['action']?.toString() ?? (data['should_block'] == true ? 'BLOCKED' : 'ALERT');
          final threatType = data['threat_type']?.toString() ?? 'SENSITIVE_PORT_PROBE';
          if (threatType == 'SENSITIVE_PORT_PROBE') {
            final matchingRule = state.portRules.firstWhere(
              (r) => r['port'] == port,
              orElse: () => {'name': 'Порт $port', 'threatRisk': 'Экранирование уязвимого порта'},
            );
            category = 'Защита портов (${matchingRule['name']})';
            final baseRisk = matchingRule['threatRisk']?.toString() ?? 'Экранирование уязвимого порта';
            description = actionTaken == 'ALERT'
                ? '$baseRisk (Аудит: в рамках лимита ${state.blockThreshold})'
                : baseRisk;
          } else {
            category = 'Ядро Sentinel: $threatType';
            if (data['description'] != null && data['description'].toString().isNotEmpty) {
              description = data['description'].toString();
            }
          }
        } else {
          isThreat = false;
        }
      }
    } catch (_) {}

    if (isThreat && mounted) {
      final isBlocked = actionTaken == 'BLOCKED' || actionTaken == 'DROPPED';
      final severity = isBlocked ? ThreatSeverity.critical : ThreatSeverity.warning;

      setState(() {
        _incidents.insert(
          0,
          ThreatIncident(
            id: 'threat-${DateTime.now().millisecondsSinceEpoch}',
            timestamp: DateTime.now(),
            hostOrIp: portStr != null ? '$host:$port' : host,
            processName: processName,
            category: category,
            actionTaken: actionTaken,
            severity: severity,
            description: description,
          ),
        );
        if (_incidents.length > 50) {
          _incidents.removeLast();
        }
      });
    }
  }

  void _clearIncidents() {
    setState(() {
      _incidents.clear();
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('История инцидентов очищена'),
        duration: Duration(seconds: 1),
        backgroundColor: Color(0xFF0F172A),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppStateProvider>();
    final isConnected = state.status == ConnectionStatus.connected;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(28.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // =========================================================================
          // HEADER ROW
          // =========================================================================
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Аудит безопасности и мониторинг угроз',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.5,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Zero Trust контроль сетевых соединений и экранирование уязвимых портов Windows',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),

              // Status Pill
              _buildStatusPill(
                label: isConnected ? 'Zero Trust Щит активен' : 'Сетевой фильтр в ожидании',
                color: isConnected ? AppColors.neonGreen : AppColors.primary,
                icon: isConnected ? Icons.shield_rounded : Icons.shield_outlined,
              ),
            ],
          ),

          const SizedBox(height: 20),

          // =========================================================================
          // TOP BENTO COUNTER CARDS
          // =========================================================================
          Row(
            children: [
              Expanded(
                child: _buildMetricCard(
                  title: 'Заблокированные соединения',
                  value: isConnected ? '$_blockedCount' : '0',
                  subtitle: isConnected ? 'Перехвачено сетевым экраном' : 'Ожидание VPN',
                  icon: Icons.shield_rounded,
                  accentColor: isConnected ? AppColors.neonRed : AppColors.textMuted,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: _buildMetricCard(
                  title: 'Уязвимые порты Windows',
                  value: isConnected ? '${state.portRules.where((r) => r['isProtected'] == true).length} / ${state.portRules.length}' : '0 / ${state.portRules.length}',
                  subtitle: isConnected ? 'Экранировано сетевым экраном' : 'Включите VPN',
                  icon: Icons.lock,
                  accentColor: isConnected ? AppColors.neonPurple : AppColors.textMuted,
                ),
              ),
            ],
          ),

          const SizedBox(height: 22),

          // =========================================================================
          // TAB BAR SELECTOR
          // =========================================================================
          Container(
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.borderSubtle),
            ),
            padding: const EdgeInsets.all(4),
            child: TabBar(
              controller: _tabController,
              indicatorSize: TabBarIndicatorSize.tab,
              splashBorderRadius: BorderRadius.circular(8),
              overlayColor: WidgetStateProperty.resolveWith<Color?>((states) {
                if (states.contains(WidgetState.hovered)) {
                  return const Color(0x18FFFFFF);
                }
                return Colors.transparent;
              }),
              indicator: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(8),
                boxShadow: const [
                  BoxShadow(color: Color(0x408B5CF6), blurRadius: 10, offset: Offset(0, 2)),
                ],
              ),
              dividerColor: Colors.transparent,
              labelColor: Colors.white,
              unselectedLabelColor: AppColors.textSecondary,
              labelStyle: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold),
              tabs: const [
                Tab(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.view_stream_rounded, size: 16),
                      SizedBox(width: 8),
                      Text('Поток инцидентов'),
                    ],
                  ),
                ),
                Tab(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.security_rounded, size: 16),
                      SizedBox(width: 8),
                      Text('Защита портов'),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // =========================================================================
          // TAB VIEWS
          // =========================================================================
          AnimatedBuilder(
            animation: _tabController,
            builder: (context, _) {
              if (_tabController.index == 0) {
                return _buildThreatFeedTab(isConnected);
              } else {
                return _buildSensitivePortsTab(state);
              }
            },
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // TAB 1: THREAT INCIDENT FEED
  // ===========================================================================
  Widget _buildThreatFeedTab(bool isConnected) {
    List<ThreatIncident> filtered;
    if (_filterCategory == 'blocked') {
      filtered = _incidents.where((i) => i.actionTaken == 'BLOCKED' || i.actionTaken == 'DROPPED').toList();
    } else if (_filterCategory == 'alerts') {
      filtered = _incidents.where((i) => i.actionTaken == 'ALERT' || i.actionTaken == 'MONITOR').toList();
    } else {
      filtered = _incidents;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Filter Chips Bar
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                _buildFilterChip('all', 'Все события (${_incidents.length})'),
                const SizedBox(width: 8),
                _buildFilterChip('blocked', '🚨 Заблокировано ($_blockedCount)'),
                const SizedBox(width: 8),
                _buildFilterChip('alerts', '⚠️ Предупреждения ($_alertsCount)'),
              ],
            ),
            IconButton(
              icon: const Icon(Icons.delete_sweep_rounded, color: AppColors.textMuted, size: 18),
              tooltip: 'Очистить историю инцидентов',
              onPressed: _clearIncidents,
            ),
          ],
        ),

        const SizedBox(height: 14),

        if (!isConnected && filtered.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(36),
            decoration: BoxDecoration(
              color: AppColors.bgCard,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.borderColor),
            ),
            alignment: Alignment.center,
            child: const Column(
              children: [
                Icon(Icons.shield_outlined, color: AppColors.primary, size: 40),
                SizedBox(height: 12),
                Text(
                  'Сетевой щит в режиме ожидания',
                  style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold),
                ),
                SizedBox(height: 4),
                Text(
                  'VPN-соединение отключено. Подключитесь к серверу, чтобы включить фильтрацию угроз, блокировку рекламы и мониторинг опасных портов.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textMuted, fontSize: 12, height: 1.4),
                ),
              ],
            ),
          )
        else if (filtered.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(36),
            decoration: BoxDecoration(
              color: AppColors.bgCard,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.borderColor),
            ),
            alignment: Alignment.center,
            child: const Column(
              children: [
                Icon(Icons.verified_rounded, color: AppColors.neonGreen, size: 36),
                SizedBox(height: 10),
                Text('Активных угроз не зафиксировано', style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold)),
                SizedBox(height: 4),
                Text('Все исходящие и входящие соединения соответствуют политикам Zero Trust. Блокировки будут отображаться здесь.', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
              ],
            ),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: filtered.length,
            separatorBuilder: (ctx, idx) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final item = filtered[index];
              return _buildIncidentCard(item);
            },
          ),
      ],
    );
  }

  Widget _buildFilterChip(String key, String label) {
    final isSelected = _filterCategory == key;
    return InkWell(
      onTap: () => setState(() => _filterCategory = key),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary.withValues(alpha: 0.2) : AppColors.bgSurface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.borderSubtle,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : AppColors.textSecondary,
            fontSize: 11.5,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
          ),
        ),
      ),
    );
  }

  Widget _buildIncidentCard(ThreatIncident item) {
    Color badgeColor;
    IconData badgeIcon;

    switch (item.severity) {
      case ThreatSeverity.critical:
        badgeColor = AppColors.neonRed;
        badgeIcon = Icons.warning_rounded;
        break;
      case ThreatSeverity.warning:
        badgeColor = AppColors.neonAmber;
        badgeIcon = Icons.warning_amber_rounded;
        break;
      case ThreatSeverity.adblock:
        badgeColor = AppColors.neonPurple;
        badgeIcon = Icons.block;
        break;
      case ThreatSeverity.info:
        badgeColor = AppColors.neonCyan;
        badgeIcon = Icons.info_outline;
        break;
    }

    final timeStr = '${item.timestamp.hour.toString().padLeft(2, '0')}:${item.timestamp.minute.toString().padLeft(2, '0')}:${item.timestamp.second.toString().padLeft(2, '0')}';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: item.severity == ThreatSeverity.critical ? badgeColor.withValues(alpha: 0.4) : AppColors.borderColor),
        boxShadow: const [
          BoxShadow(
            color: Color(0x40000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Threat Category Icon Badge
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: badgeColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: badgeColor.withValues(alpha: 0.35)),
            ),
            child: Icon(badgeIcon, color: badgeColor, size: 18),
          ),

          const SizedBox(width: 14),

          // Incident Information
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      item.hostOrIp + (item.port != null ? ':${item.port}' : ''),
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'monospace',
                      ),
                    ),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: badgeColor.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: badgeColor.withValues(alpha: 0.3)),
                          ),
                          child: Text(
                            item.actionTaken,
                            style: TextStyle(
                              color: badgeColor,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(timeStr, style: const TextStyle(color: AppColors.textMuted, fontSize: 11, fontFamily: 'monospace')),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(
                      'Процесс: ${item.processName}',
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 11.5, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      '•  ${item.category}',
                      style: TextStyle(color: badgeColor, fontSize: 11.5, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  item.description,
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 11, height: 1.3),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // TAB 2: SENSITIVE PORTS SHIELD
  // ===========================================================================
  Widget _buildSensitivePortsTab(AppStateProvider state) {
    final portRules = state.portRules;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderColor),
        boxShadow: const [
          BoxShadow(
            color: Color(0x60000000),
            blurRadius: 20,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Фильтрация критических портов Windows',
                      style: TextStyle(color: AppColors.textPrimary, fontSize: 14.5, fontWeight: FontWeight.bold),
                      overflow: TextOverflow.ellipsis,
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Изоляция сетевых протоколов от внешних эксплойтов',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 11.5),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.bgSurface,
                      foregroundColor: AppColors.primary,
                      elevation: 0,
                      side: const BorderSide(color: AppColors.primary, width: 1.2),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    icon: const Icon(Icons.add_rounded, size: 14),
                    label: const Text('Добавить', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                    onPressed: () => _showAddPortDialog(context, state),
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 18),
          const Divider(color: Color(0x1AFFFFFF), height: 1),
          const SizedBox(height: 14),

          // Policy Configuration Card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFF0F1424),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.tune_rounded, size: 16, color: AppColors.neonPurple),
                    const SizedBox(width: 8),
                    const Text(
                      'Параметры политики реагирования и защиты',
                      style: TextStyle(color: AppColors.textPrimary, fontSize: 12.5, fontWeight: FontWeight.bold),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.neonGreen.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.neonGreen.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.check_circle_outline_rounded, size: 11, color: AppColors.neonGreen),
                          const SizedBox(width: 4),
                          Text(
                            'Ядро активно (Mode: ${state.shieldMode})',
                            style: const TextStyle(color: AppColors.neonGreen, fontSize: 10, fontFamily: 'monospace', fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Mode selector
                    Expanded(
                      flex: 3,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Режим экранирования портов:', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: [
                              _buildModePill(
                                title: '🛡️ Пороговый (${state.blockThreshold} ${state.blockThreshold == 1 ? 'попытка' : (state.blockThreshold >= 2 && state.blockThreshold <= 4) ? 'попытки' : 'попыток'})',
                                isSelected: state.shieldMode == 'threshold_block',
                                onTap: () => state.updateSecurityPolicy(shieldMode: 'threshold_block'),
                              ),
                              _buildModePill(
                                title: '⚡ Строгий Zero Trust',
                                isSelected: state.shieldMode == 'strict_block',
                                onTap: () => state.updateSecurityPolicy(shieldMode: 'strict_block'),
                              ),
                              _buildModePill(
                                title: '👁️ Только аудит',
                                isSelected: state.shieldMode == 'alert_only',
                                onTap: () => state.updateSecurityPolicy(shieldMode: 'alert_only'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 16),
                    // Dynamic response info / Threshold selector (Only for threshold_block)
                    Expanded(
                      flex: 2,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (state.shieldMode == 'threshold_block') ...[
                            const Text('Порог попыток до блока:', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                            const SizedBox(height: 6),
                            Wrap(
                              spacing: 5,
                              runSpacing: 5,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                ...[1, 2, 3, 5, 10].map((val) {
                                  final isSel = state.blockThreshold == val;
                                  return InkWell(
                                    onTap: () => state.updateSecurityPolicy(blockThreshold: val),
                                    borderRadius: BorderRadius.circular(6),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: isSel ? AppColors.primary : const Color(0xFF141A2E),
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(color: isSel ? AppColors.primary : const Color(0x33FFFFFF)),
                                      ),
                                      child: Text(
                                        '$val',
                                        style: TextStyle(
                                          color: isSel ? Colors.white : AppColors.textMuted,
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  );
                                }),
                                InkWell(
                                  onTap: () => _showCustomThresholdDialog(context, state),
                                  borderRadius: BorderRadius.circular(6),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: (![1, 2, 3, 5, 10].contains(state.blockThreshold))
                                          ? AppColors.primary
                                          : const Color(0xFF141A2E),
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(
                                        color: (![1, 2, 3, 5, 10].contains(state.blockThreshold))
                                            ? AppColors.primary
                                            : const Color(0x33FFFFFF),
                                      ),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        const Icon(Icons.edit_rounded, size: 10, color: AppColors.neonPurple),
                                        const SizedBox(width: 3),
                                        Text(
                                          (![1, 2, 3, 5, 10].contains(state.blockThreshold))
                                              ? '${state.blockThreshold}'
                                              : 'Свой',
                                          style: TextStyle(
                                            color: (![1, 2, 3, 5, 10].contains(state.blockThreshold))
                                                ? Colors.white
                                                : AppColors.textMuted,
                                            fontSize: 10.5,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ] else if (state.shieldMode == 'strict_block') ...[
                            const Text('Режим реагирования:', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                            const SizedBox(height: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                              decoration: BoxDecoration(
                                color: AppColors.neonAmber.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: AppColors.neonAmber.withValues(alpha: 0.3)),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.bolt_rounded, size: 13, color: AppColors.neonAmber),
                                  const SizedBox(width: 4),
                                  Text('Сброс с 1-го запроса',
                                      style: const TextStyle(color: AppColors.neonAmber, fontSize: 10.5, fontWeight: FontWeight.bold)),
                                ],
                              ),
                            ),
                          ] else ...[
                            const Text('Режим реагирования:', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                            const SizedBox(height: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                              decoration: BoxDecoration(
                                color: AppColors.neonPurple.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: AppColors.neonPurple.withValues(alpha: 0.3)),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.visibility_rounded, size: 13, color: AppColors.neonPurple),
                                  SizedBox(width: 4),
                                  Text('Без блокировок (лог)',
                                      style: TextStyle(color: AppColors.neonPurple, fontSize: 10.5, fontWeight: FontWeight.bold)),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                const Divider(color: Color(0x14FFFFFF), height: 1),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.file_download_rounded, size: 14, color: AppColors.neonPurple),
                    const SizedBox(width: 6),
                    const Text(
                      'Автоматический сбор PCAP-дампов при обнаружении угроз / сканирования',
                      style: TextStyle(color: AppColors.textPrimary, fontSize: 11.5),
                    ),
                    const Spacer(),
                    Switch(
                      value: state.autoPcapCapture,
                      onChanged: (val) => state.updateSecurityPolicy(autoPcapCapture: val),
                      activeTrackColor: AppColors.primary,
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 18),
          const Divider(color: Color(0x1AFFFFFF), height: 1),
          const SizedBox(height: 14),

          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: portRules.length,
            separatorBuilder: (ctx, idx) => const Divider(color: Color(0x14FFFFFF), height: 20),
            itemBuilder: (context, index) {
              final rule = portRules[index];
              final port = rule['port'] as int? ?? 0;
              final name = rule['name'] as String? ?? 'Port $port';
              final protocol = rule['protocol'] as String? ?? 'TCP';
              final threatRisk = rule['threatRisk'] as String? ?? '';
              final isProtected = rule['isProtected'] == true;
              final isBuiltIn = index < 7;

              return Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Container(
                    width: 58,
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    decoration: BoxDecoration(
                      color: isProtected ? AppColors.primary.withValues(alpha: 0.15) : const Color(0xFF141A2E),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: isProtected ? AppColors.primary.withValues(alpha: 0.4) : const Color(0x33FFFFFF),
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      '$port',
                      style: TextStyle(
                        color: isProtected ? AppColors.neonPurple : AppColors.textMuted,
                        fontSize: 13,
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(name, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.bold)),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFF0F1424),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(protocol, style: const TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.bold)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(threatRisk, style: const TextStyle(color: AppColors.textMuted, fontSize: 11.5, height: 1.3)),
                      ],
                    ),
                  ),
                  if (!isBuiltIn) ...[
                    IconButton(
                      icon: const Icon(Icons.delete_outline_rounded, color: AppColors.textMuted, size: 18),
                      tooltip: 'Удалить правило',
                      onPressed: () => state.removePortRule(index),
                    ),
                    const SizedBox(width: 4),
                  ],
                  const SizedBox(width: 8),
                  Switch(
                    value: isProtected,
                    activeThumbColor: AppColors.primary,
                    activeTrackColor: AppColors.primary.withValues(alpha: 0.35),
                    inactiveThumbColor: AppColors.textMuted,
                    inactiveTrackColor: AppColors.bgSurface,
                    onChanged: (val) => state.togglePortProtection(index, val),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color accentColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderColor),
        boxShadow: const [
          BoxShadow(
            color: Color(0x60000000),
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 11.5, fontWeight: FontWeight.w600),
              ),
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: accentColor, size: 16),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              color: accentColor,
              fontSize: 22,
              fontWeight: FontWeight.w900,
              fontFamily: 'monospace',
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: const TextStyle(color: AppColors.textMuted, fontSize: 10.5),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  void _showCustomThresholdDialog(BuildContext context, AppStateProvider state) {
    final controller = TextEditingController(text: '${state.blockThreshold}');
    String? errorText;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          final text = controller.text.trim();
          final val = int.tryParse(text);
          final isValid = val != null && val >= 1 && val <= 100;

          return AlertDialog(
            backgroundColor: const Color(0xFF0F1424),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: AppColors.primary, width: 1)),
            title: const Text('Порог попыток до блокировки', style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Укажите количество подозрительных попыток обращения к защищенному порту (от 1 до 100), после которого соединение будет заблокировано.',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: controller,
                  autofocus: true,
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(3),
                  ],
                  onChanged: (v) {
                    setDialogState(() {
                      final n = int.tryParse(v.trim());
                      if (v.trim().isEmpty) {
                        errorText = 'Поле не может быть пустым';
                      } else if (n == null || n < 1 || n > 100) {
                        errorText = 'Допустимо число от 1 до 100';
                      } else {
                        errorText = null;
                      }
                    });
                  },
                  style: const TextStyle(color: Colors.white, fontFamily: 'monospace', fontWeight: FontWeight.bold),
                  decoration: InputDecoration(
                    labelText: 'Количество попыток (1 - 100)',
                    labelStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                    errorText: errorText,
                    errorStyle: const TextStyle(color: AppColors.neonRed, fontSize: 11),
                    filled: true,
                    fillColor: const Color(0xFF141A2E),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0x33FFFFFF))),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.primary)),
                    errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.neonRed)),
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Отмена', style: TextStyle(color: AppColors.textMuted)),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: isValid ? AppColors.primary : const Color(0xFF1E293B),
                  foregroundColor: isValid ? Colors.white : AppColors.textDisabled,
                ),
                onPressed: isValid
                    ? () {
                        state.updateSecurityPolicy(blockThreshold: val);
                        Navigator.pop(ctx);
                      }
                    : null,
                child: const Text('Применить', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showAddPortDialog(BuildContext context, AppStateProvider state) {
    final portCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    final riskCtrl = TextEditingController();
    String protocol = 'TCP';
    String? portError;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          final pText = portCtrl.text.trim();
          final p = int.tryParse(pText);
          final isPortValid = p != null && p >= 1 && p <= 65535;

          return AlertDialog(
            backgroundColor: AppColors.bgCard,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: const BorderSide(color: AppColors.borderColor),
            ),
            title: const Row(
              children: [
                Icon(Icons.add_moderator_rounded, color: AppColors.primary, size: 20),
                SizedBox(width: 10),
                Text(
                  'Добавить чувствительный порт',
                  style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            content: SizedBox(
              width: 380,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Укажите номер сетевого порта для блокировки входящих и подозрительных обращений:',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 12, height: 1.3),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        flex: 4,
                        child: TextField(
                          controller: portCtrl,
                          keyboardType: TextInputType.number,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(5),
                          ],
                          onChanged: (v) {
                            setDialogState(() {
                              final num = int.tryParse(v.trim());
                              if (v.trim().isEmpty) {
                                portError = 'Укажите порт';
                              } else if (num == null || num < 1 || num > 65535) {
                                portError = 'От 1 до 65535';
                              } else if (state.portRules.any((r) => r['port'] == num)) {
                                portError = 'Уже добавлен';
                              } else {
                                portError = null;
                              }
                            });
                          },
                          style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontFamily: 'monospace', fontWeight: FontWeight.bold),
                          decoration: InputDecoration(
                            labelText: 'Номер порта (1-65535)',
                            labelStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                            errorText: portError,
                            errorStyle: const TextStyle(color: AppColors.neonRed, fontSize: 10.5),
                            hintText: 'Например: 8080',
                            hintStyle: const TextStyle(color: Color(0x40FFFFFF), fontSize: 12),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 3,
                        child: DropdownButtonFormField<String>(
                          initialValue: protocol,
                          dropdownColor: const Color(0xFF0F1426),
                          decoration: const InputDecoration(
                            labelText: 'Протокол',
                            labelStyle: TextStyle(color: AppColors.textMuted, fontSize: 12),
                          ),
                          items: ['TCP', 'UDP', 'TCP/UDP']
                              .map((pr) => DropdownMenuItem(value: pr, child: Text(pr, style: const TextStyle(color: Colors.white, fontSize: 12))))
                              .toList(),
                          onChanged: (val) {
                            if (val != null) setDialogState(() => protocol = val);
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: nameCtrl,
                    inputFormatters: [LengthLimitingTextInputFormatter(60)],
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                    decoration: const InputDecoration(
                      labelText: 'Название сервиса (необязательно)',
                      labelStyle: TextStyle(color: AppColors.textMuted, fontSize: 12),
                      hintText: 'Например: Web Server / DB',
                      hintStyle: TextStyle(color: Color(0x40FFFFFF), fontSize: 12),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: riskCtrl,
                    inputFormatters: [LengthLimitingTextInputFormatter(120)],
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                    decoration: const InputDecoration(
                      labelText: 'Описание риска (необязательно)',
                      labelStyle: TextStyle(color: AppColors.textMuted, fontSize: 12),
                      hintText: 'Краткое примечание',
                      hintStyle: TextStyle(color: Color(0x40FFFFFF), fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Отмена', style: TextStyle(color: AppColors.textMuted)),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: (isPortValid && portError == null) ? AppColors.primary : const Color(0xFF1E293B),
                  foregroundColor: (isPortValid && portError == null) ? Colors.white : AppColors.textDisabled,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: (isPortValid && portError == null)
                    ? () {
                        final name = nameCtrl.text.trim().isNotEmpty ? nameCtrl.text.trim() : 'Custom Port $p';
                        final risk = riskCtrl.text.trim().isNotEmpty ? riskCtrl.text.trim() : 'Пользовательское правило экранирования порта $p.';

                        state.addPortRule({
                          'port': p,
                          'protocol': protocol,
                          'name': name,
                          'threatRisk': risk,
                          'isProtected': true,
                        });
                        Navigator.pop(ctx);
                      }
                    : null,
                child: const Text('Добавить', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildStatusPill({
    required String label,
    required Color color,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4.5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildModePill({
    required String title,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5.5),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary.withValues(alpha: 0.25) : const Color(0xFF141A2E),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? AppColors.primary : const Color(0x22FFFFFF),
            width: isSelected ? 1.4 : 1.0,
          ),
        ),
        child: Text(
          title,
          style: TextStyle(
            color: isSelected ? AppColors.neonPurple : AppColors.textMuted,
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }
}
