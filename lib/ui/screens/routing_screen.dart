import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/models/routing_rule_model.dart';
import '../../core/providers/app_state_provider.dart';

class RoutingScreen extends StatefulWidget {
  const RoutingScreen({super.key});

  @override
  State<RoutingScreen> createState() => _RoutingScreenState();
}

class _RoutingScreenState extends State<RoutingScreen> {
  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppStateProvider>();
    final quickPresets = state.corePresets;
    final allRules = _computeAllRules(state);

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // =========================================================================
          // TOP HEADER BAR (Panel Style)
          // =========================================================================
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Text(
                'Настройка маршрутизации и правил',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.3,
                ),
              ),

              // Right Status Badges (Matching Panel: Xray, Hysteria, sing-box)
              Row(
                children: [
                  _buildCoreStatusBadge('Xray', true),
                  const SizedBox(width: 8),
                  _buildCoreStatusBadge('Hysteria', true),
                  const SizedBox(width: 8),
                  _buildCoreStatusBadge('sing-box', true),
                ],
              ),
            ],
          ),

          const SizedBox(height: 22),

          // =========================================================================
          // SECTION 1: QUICK SECURITY RULES (Быстрые правила безопасности)
          // =========================================================================
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: AppColors.bgCard,
              borderRadius: BorderRadius.circular(16),
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
                const Row(
                  children: [
                    Icon(Icons.tune_rounded, color: AppColors.primary, size: 20),
                    SizedBox(width: 10),
                    Text(
                      'Быстрые правила безопасности',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'Включение этих правил позволяет перенаправлять или блокировать соответствующие категории сайтов и трафика в выбранные выходящие подключения (BLOCKED, DIRECT, WARP или VPN).',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12.5,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 18),

                // Responsive Grid of Quick Rules
                _buildQuickRulesGrid(context, state, quickPresets),

                const SizedBox(height: 18),

                // Bottom Right Save Button
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        shadowColor: AppColors.primaryGlow,
                      ),
                      icon: const Icon(Icons.save_rounded, size: 16),
                      label: const Text(
                        'Сохранить правила',
                        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold),
                      ),
                      onPressed: () {
                        state.save();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('✅ Правила маршрутизации успешно сохранены в ядро'),
                            duration: Duration(seconds: 2),
                            backgroundColor: Color(0xFF0F172A),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // =========================================================================
          // SECTION 2: ROUTING RULES TABLE (Правила маршрутизации)
          // =========================================================================
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: AppColors.bgCard,
              borderRadius: BorderRadius.circular(16),
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
                // Header with Action Buttons
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.alt_route_rounded, color: AppColors.primary, size: 20),
                        SizedBox(width: 10),
                        Text(
                          'Правила маршрутизации',
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),

                    // Top Right Action Buttons: Export, Import, Add
                    Row(
                      children: [
                        _buildSecondaryActionButton(
                          icon: Icons.download_rounded,
                          label: 'Экспорт пресета',
                          onTap: () => _exportRulesToClipboard(context, state),
                        ),
                        const SizedBox(width: 8),
                        _buildSecondaryActionButton(
                          icon: Icons.file_upload_outlined,
                          label: 'Импорт пресета',
                          onTap: () => _showImportPresetDialog(context, state),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                          icon: const Icon(Icons.add_rounded, size: 16),
                          label: const Text(
                            'Добавить правило',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                          onPressed: () => _showRuleEditorDialog(context, state),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'Правила проверяются сверху вниз. Вы можете менять приоритет перетаскиванием (Drag & Drop) за иконку слева или с помощью стрелок.',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12.5,
                  ),
                ),
                const SizedBox(height: 16),

                // Table Container with Drag & Drop Reordering
                _buildGlassTable(context, state, allRules),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // TOP STATUS BADGES
  // ===========================================================================
  Widget _buildCoreStatusBadge(String name, bool isActive) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4.5),
      decoration: BoxDecoration(
        color: AppColors.neonGreen.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.neonGreen.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: const BoxDecoration(
              color: AppColors.neonGreen,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            '$name: ${isActive ? "Активен" : "Отключен"}',
            style: const TextStyle(
              color: AppColors.neonGreen,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSecondaryActionButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return OutlinedButton.icon(
      style: OutlinedButton.styleFrom(
        backgroundColor: AppColors.bgSurface,
        foregroundColor: AppColors.textSecondary,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        side: const BorderSide(color: AppColors.borderSubtle),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
      ),
      icon: Icon(icon, size: 14, color: AppColors.textSecondary),
      label: Text(label, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w500)),
      onPressed: onTap,
    );
  }

  // ===========================================================================
  // SECTION 1: QUICK SECURITY RULES GRID
  // ===========================================================================
  Widget _buildQuickRulesGrid(BuildContext context, AppStateProvider state, List<Map<String, dynamic>> presets) {
    if (presets.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.bgSurface,
          borderRadius: BorderRadius.circular(10),
        ),
        child: const Center(
          child: Text(
            'Загрузка правил ядра из sentinel-core.dll...',
            style: TextStyle(color: AppColors.textMuted, fontSize: 12),
          ),
        ),
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = constraints.maxWidth > 920 ? 3 : (constraints.maxWidth > 600 ? 2 : 1);

        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            mainAxisSpacing: 14,
            crossAxisSpacing: 14,
            mainAxisExtent: 128,
          ),
          itemCount: presets.length,
          itemBuilder: (context, index) {
            final item = presets[index];
            final id = (item['id'] ?? '').toString();
            final name = (item['name'] ?? id).toString();
            final desc = (item['description'] ?? '').toString();
            final defaultTarget = (item['defaultTarget'] ?? 'direct').toString();
            final isEnabled = state.quickRules[id] ?? (id != 'ip_checkers' && id != 'cn' && id != 'us');
            final currentTarget = state.quickRuleTargets[id] ?? defaultTarget;

            return Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isEnabled
                      ? AppColors.primary.withValues(alpha: 0.35)
                      : AppColors.borderSubtle,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Top Title + Switch
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          name,
                          style: TextStyle(
                            color: isEnabled ? AppColors.textPrimary : AppColors.textMuted,
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Switch(
                        value: isEnabled,
                        activeThumbColor: AppColors.primary,
                        activeTrackColor: AppColors.primary.withValues(alpha: 0.35),
                        inactiveThumbColor: AppColors.textMuted,
                        inactiveTrackColor: AppColors.bgCard,
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        onChanged: (val) => state.setQuickRuleEnabled(id, val),
                      ),
                    ],
                  ),

                  // Middle Subtitle
                  Text(
                    desc,
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 10.5,
                      height: 1.2,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),

                  const Divider(color: Color(0x14FFFFFF), height: 1),

                  // Bottom Route Selector
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Выходной маршрут',
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
                      ),

                      // Pill Dropdown Selector
                      _buildRouteDropdownPill(
                        value: currentTarget,
                        onChanged: (val) {
                          if (val != null) {
                            state.setQuickRuleTarget(id, val);
                          }
                        },
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildRouteDropdownPill({
    required String value,
    required ValueChanged<String?> onChanged,
  }) {
    final isBlocked = value == 'block';
    final isDirect = value == 'direct';

    Color textColor = isBlocked
        ? AppColors.neonRed
        : (isDirect ? AppColors.neonGreen : AppColors.neonPurple);
    Color bgColor = isBlocked
        ? AppColors.neonRed.withValues(alpha: 0.15)
        : (isDirect ? AppColors.neonGreen.withValues(alpha: 0.15) : AppColors.primary.withValues(alpha: 0.18));

    return Container(
      height: 24,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(6),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          dropdownColor: const Color(0xFF0F1426),
          icon: Icon(Icons.keyboard_arrow_down_rounded, size: 14, color: textColor),
          style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: textColor),
          items: const [
            DropdownMenuItem(
              value: 'block',
              child: Text('BLOCKED', style: TextStyle(color: AppColors.neonRed)),
            ),
            DropdownMenuItem(
              value: 'direct',
              child: Text('DIRECT', style: TextStyle(color: AppColors.neonGreen)),
            ),
            DropdownMenuItem(
              value: 'proxy',
              child: Text('PROXY', style: TextStyle(color: AppColors.neonPurple)),
            ),
          ],
          onChanged: onChanged,
        ),
      ),
    );
  }

  // ===========================================================================
  // SECTION 2: GLASS TABLE WITH DRAG & DROP REORDERING
  // ===========================================================================
  Widget _buildGlassTable(BuildContext context, AppStateProvider state, List<_TableRuleItem> rules) {
    if (rules.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(30),
        decoration: BoxDecoration(
          color: AppColors.bgSurface,
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Center(
          child: Text(
            'Нет активных правил. Нажмите «+ Добавить правило» или включите быстрое правило.',
            style: TextStyle(color: AppColors.textMuted, fontSize: 12),
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF080C1A),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderColor),
      ),
      child: Column(
        children: [
          // Table Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(
              color: Color(0xFF040710),
              borderRadius: BorderRadius.vertical(top: Radius.circular(11)),
              border: Border(bottom: BorderSide(color: Color(0x1AFFFFFF))),
            ),
            child: const Row(
              children: [
                SizedBox(
                  width: 55,
                  child: Text(
                    'ПОРЯДОК',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 10.5, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                  ),
                ),
                Expanded(
                  flex: 3,
                  child: Text(
                    'ОПИСАНИЕ',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 10.5, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                  ),
                ),
                Expanded(
                  flex: 3,
                  child: Text(
                    'УСЛОВИЯ',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 10.5, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                  ),
                ),
                SizedBox(
                  width: 110,
                  child: Text(
                    'НАЗНАЧЕНИЕ',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 10.5, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                  ),
                ),
                SizedBox(
                  width: 65,
                  child: Text(
                    'СТАТУС',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 10.5, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                  ),
                ),
                SizedBox(
                  width: 110,
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: Text(
                      'ДЕЙСТВИЯ',
                      style: TextStyle(color: AppColors.textMuted, fontSize: 10.5, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Reorderable Drag-and-Drop Table Rows
          ReorderableListView.builder(
            shrinkWrap: true,
            primary: false,
            physics: const NeverScrollableScrollPhysics(),
            buildDefaultDragHandles: false,
            itemCount: rules.length,
            // ignore: deprecated_member_use
            onReorder: (oldIndex, newIndex) {
              state.reorderTableRules(oldIndex, newIndex);
            },
            proxyDecorator: (child, index, animation) {
              return Material(
                color: const Color(0xFF161D36),
                elevation: 8,
                shadowColor: AppColors.primaryGlow,
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFF161D36),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.primary, width: 1.5),
                  ),
                  child: child,
                ),
              );
            },
            itemBuilder: (context, index) {
              final item = rules[index];
              final isBlock = item.action.toLowerCase() == 'block';
              final isDirect = item.action.toLowerCase() == 'direct';

              // Format conditions text
              final conditionsList = <String>[];
              if (item.domains.isNotEmpty) conditionsList.add('Domains: ${item.domains.length} шт.');
              if (item.ips.isNotEmpty) conditionsList.add('IP: ${item.ips.join(", ")}');
              if (item.protocols.isNotEmpty) conditionsList.add('Proto: ${item.protocols.join(", ")}');
              if (item.ports.isNotEmpty) conditionsList.add('Ports: ${item.ports.join(", ")}');
              if (conditionsList.isEmpty) conditionsList.add('all');

              return Container(
                key: ValueKey(item.id),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: index % 2 == 0 ? Colors.transparent : const Color(0x05FFFFFF),
                  border: const Border(bottom: BorderSide(color: Color(0x10FFFFFF))),
                ),
                child: Row(
                  children: [
                    // Порядок (Drag Handle & Index)
                    SizedBox(
                      width: 55,
                      child: ReorderableDragStartListener(
                        index: index,
                        child: MouseRegion(
                          cursor: SystemMouseCursors.grab,
                          child: Row(
                            children: [
                              const Icon(Icons.drag_indicator_rounded, size: 16, color: AppColors.primary),
                              const SizedBox(width: 4),
                              Text(
                                '${index + 1}',
                                style: const TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  fontFamily: 'monospace',
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),

                    // Описание
                    Expanded(
                      flex: 3,
                      child: Text(
                        item.name,
                        style: TextStyle(
                          color: item.isEnabled ? AppColors.textPrimary : AppColors.textMuted,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),

                    // Условия
                    Expanded(
                      flex: 3,
                      child: Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: conditionsList.map((c) {
                          return Text(
                            c,
                            style: TextStyle(
                              color: c.startsWith('Proto:')
                                  ? AppColors.neonGreen
                                  : (c.startsWith('IP:') ? AppColors.neonCyan : AppColors.textSecondary),
                              fontSize: 11,
                              fontFamily: 'monospace',
                            ),
                          );
                        }).toList(),
                      ),
                    ),

                    // Назначение (Badge)
                    SizedBox(
                      width: 110,
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: isBlock
                                ? AppColors.neonRed.withValues(alpha: 0.15)
                                : (isDirect ? AppColors.neonGreen.withValues(alpha: 0.15) : AppColors.primary.withValues(alpha: 0.18)),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            isBlock ? 'BLOCKED' : (isDirect ? 'DIRECT' : 'PROXY'),
                            style: TextStyle(
                              color: isBlock
                                  ? AppColors.neonRed
                                  : (isDirect ? AppColors.neonGreen : AppColors.neonPurple),
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ),

                    // Статус (Switch)
                    SizedBox(
                      width: 65,
                      child: Switch(
                        value: item.isEnabled,
                        activeThumbColor: AppColors.primary,
                        activeTrackColor: AppColors.primary.withValues(alpha: 0.35),
                        inactiveThumbColor: AppColors.textMuted,
                        inactiveTrackColor: AppColors.bgCard,
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        onChanged: (val) {
                          if (item.isCorePreset) {
                            state.setQuickRuleEnabled(item.id, val);
                          } else if (item.customModel != null) {
                            state.toggleRoutingRule(item.id, val);
                          }
                        },
                      ),
                    ),

                    // Действия (Reorder Up/Down, Edit, Delete)
                    SizedBox(
                      width: 110,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          // Up Arrow
                          IconButton(
                            icon: const Icon(Icons.arrow_upward_rounded, size: 14, color: AppColors.textSecondary),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                            onPressed: index > 0
                                ? () => state.reorderTableRules(index, index - 1)
                                : null,
                            tooltip: 'Повысить приоритет',
                          ),

                          // Down Arrow
                          IconButton(
                            icon: const Icon(Icons.arrow_downward_rounded, size: 14, color: AppColors.textSecondary),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                            onPressed: index < rules.length - 1
                                ? () => state.reorderTableRules(index, index + 2)
                                : null,
                            tooltip: 'Понизить приоритет',
                          ),

                          // Edit Pencil
                          if (!item.isCorePreset && item.customModel != null) ...[
                            IconButton(
                              icon: const Icon(Icons.edit_outlined, size: 14, color: AppColors.textSecondary),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                              onPressed: () => _showRuleEditorDialog(context, state, rule: item.customModel),
                              tooltip: 'Редактировать',
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline_rounded, size: 14, color: AppColors.neonRed),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                              onPressed: () => state.deleteRoutingRule(item.id),
                              tooltip: 'Удалить',
                            ),
                          ] else if (item.isCorePreset) ...[
                            IconButton(
                              icon: const Icon(Icons.close_rounded, size: 14, color: AppColors.textMuted),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                              onPressed: () => state.removePresetFromTable(item.id),
                              tooltip: 'Скрыть из таблицы',
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // DATA COMPUTATION
  // ===========================================================================
  List<_TableRuleItem> _computeAllRules(AppStateProvider state) {
    final map = <String, _TableRuleItem>{};

    // 1. Used Core Quick Rules
    for (final p in state.corePresets) {
      final pid = p['id']?.toString() ?? '';
      final isUsed = state.usedPresetIds.contains(pid) || (state.quickRules[pid] == true);
      if (!isUsed) continue;

      final isEnabled = state.quickRules[pid] ?? false;
      final name = p['name']?.toString() ?? pid;
      final defaultTarget = p['defaultTarget']?.toString() ?? 'direct';
      final action = state.quickRuleTargets[pid] ?? defaultTarget;
      final domains = (p['domains'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [];
      final ips = (p['ips'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [];
      final protocols = (p['protocols'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [];
      final ports = (p['ports'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [];

      map[pid] = _TableRuleItem(
        id: pid,
        name: name,
        action: action,
        domains: domains,
        ips: ips,
        protocols: protocols,
        ports: ports,
        isCorePreset: true,
        isEnabled: isEnabled,
      );
    }

    // 2. User Custom Rules
    for (final r in state.routingRules) {
      map[r.id] = _TableRuleItem(
        id: r.id,
        name: r.name,
        action: r.action,
        domains: r.domains,
        ips: r.ips,
        protocols: r.protocols,
        ports: r.ports,
        isCorePreset: false,
        isEnabled: r.isEnabled,
        customModel: r,
      );
    }

    final orderedIds = state.getOrderedTableRuleIds();
    final list = <_TableRuleItem>[];
    for (final id in orderedIds) {
      if (map.containsKey(id)) {
        list.add(map[id]!);
      }
    }
    for (final entry in map.entries) {
      if (!orderedIds.contains(entry.key)) {
        list.add(entry.value);
      }
    }

    return list;
  }

  // ===========================================================================
  // DIALOGS: EDITOR, EXPORT, IMPORT
  // ===========================================================================
  void _exportRulesToClipboard(BuildContext context, AppStateProvider state) {
    final data = {
      'quickRules': state.quickRules,
      'quickRuleTargets': state.quickRuleTargets,
      'customRules': state.routingRules.map((r) => r.toJson()).toList(),
      'tableRuleOrder': state.tableRuleOrder,
    };
    final jsonStr = jsonEncode(data);
    Clipboard.setData(ClipboardData(text: jsonStr));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('📋 Пресет маршрутизации скопирован в буфер обмена'),
        backgroundColor: Color(0xFF0F172A),
      ),
    );
  }

  void _showImportPresetDialog(BuildContext context, AppStateProvider state) {
    final textCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgCard,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: AppColors.borderColor),
        ),
        title: const Text(
          'Импорт пресета маршрутизации',
          style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold),
        ),
        content: SizedBox(
          width: 440,
          child: TextField(
            controller: textCtrl,
            maxLines: 6,
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontFamily: 'monospace'),
            decoration: const InputDecoration(
              hintText: 'Вставьте JSON пресета...',
              hintStyle: TextStyle(color: AppColors.textMuted, fontSize: 11),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Отмена', style: TextStyle(color: AppColors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
            onPressed: () {
              final raw = textCtrl.text.trim();
              if (raw.isNotEmpty) {
                try {
                  final decoded = jsonDecode(raw);
                  if (decoded is Map && decoded.containsKey('customRules')) {
                    final rules = (decoded['customRules'] as List)
                        .map((r) => RoutingRuleModel.fromJson(r as Map<String, dynamic>))
                        .toList();
                    for (final r in rules) {
                      state.addRoutingRule(r);
                    }
                  }
                } catch (_) {}
              }
              Navigator.pop(ctx);
            },
            child: const Text('Импортировать', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _showRuleEditorDialog(BuildContext context, AppStateProvider state, {RoutingRuleModel? rule}) {
    final isEditing = rule != null;
    final nameCtrl = TextEditingController(text: rule?.name ?? '');
    final domainsCtrl = TextEditingController(text: rule?.domains.join('\n') ?? '');
    final ipsCtrl = TextEditingController(text: rule?.ips.join('\n') ?? '');
    final protoCtrl = TextEditingController(text: rule?.protocols.join(', ') ?? '');
    final portsCtrl = TextEditingController(text: rule?.ports.join(', ') ?? '');
    String action = rule?.action ?? 'direct';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: AppColors.bgCard,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: const BorderSide(color: AppColors.borderColor),
          ),
          title: Text(
            isEditing ? 'Редактирование правила' : 'Новое правило маршрутизации',
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold),
          ),
          content: SizedBox(
            width: 460,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: nameCtrl,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 12),
                    decoration: const InputDecoration(
                      labelText: 'Название правила',
                      labelStyle: TextStyle(color: AppColors.textMuted, fontSize: 12),
                      hintText: 'Например: Онлайн-игры, Блокировка трекеров',
                    ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: action,
                    dropdownColor: AppColors.bgSurface,
                    style: const TextStyle(color: AppColors.neonPurple, fontSize: 12, fontWeight: FontWeight.bold),
                    decoration: const InputDecoration(
                      labelText: 'Выходное назначение (Action)',
                      labelStyle: TextStyle(color: AppColors.textMuted, fontSize: 12),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'direct', child: Text('DIRECT (Прямое подключение в обход VPN)', style: TextStyle(color: AppColors.neonGreen))),
                      DropdownMenuItem(value: 'proxy', child: Text('PROXY (Направлять через VPN-туннель)', style: TextStyle(color: AppColors.neonPurple))),
                      DropdownMenuItem(value: 'block', child: Text('BLOCKED (Блокировать соединения)', style: TextStyle(color: AppColors.neonRed))),
                    ],
                    onChanged: (val) => setDialogState(() => action = val ?? 'direct'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: domainsCtrl,
                    maxLines: 3,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 12),
                    decoration: const InputDecoration(
                      labelText: 'Домены (по одному на строку или через запятую)',
                      labelStyle: TextStyle(color: AppColors.textMuted, fontSize: 12),
                      hintText: 'domain:google.com\ngeosite:category-ads-all\n.ru',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: ipsCtrl,
                    maxLines: 2,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 12),
                    decoration: const InputDecoration(
                      labelText: 'IP / CIDR (по одному на строку или через запятую)',
                      labelStyle: TextStyle(color: AppColors.textMuted, fontSize: 12),
                      hintText: 'geoip:ru\n192.168.1.0/24\n1.1.1.1',
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: protoCtrl,
                          style: const TextStyle(color: AppColors.textPrimary, fontSize: 12),
                          decoration: const InputDecoration(
                            labelText: 'Протоколы',
                            labelStyle: TextStyle(color: AppColors.textMuted, fontSize: 12),
                            hintText: 'quic, bittorrent',
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: portsCtrl,
                          style: const TextStyle(color: AppColors.textPrimary, fontSize: 12),
                          decoration: const InputDecoration(
                            labelText: 'Порты',
                            labelStyle: TextStyle(color: AppColors.textMuted, fontSize: 12),
                            hintText: '443, 80, 8080',
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Отмена', style: TextStyle(color: AppColors.textMuted)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: () {
                if (nameCtrl.text.trim().isEmpty) return;
                final domains = domainsCtrl.text.split(RegExp(r'[\r\n,; ]+')).map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
                final ips = ipsCtrl.text.split(RegExp(r'[\r\n,; ]+')).map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
                final protocols = protoCtrl.text.split(RegExp(r'[\r\n,; ]+')).map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
                final ports = portsCtrl.text.split(RegExp(r'[\r\n,; ]+')).map((e) => e.trim()).where((e) => e.isNotEmpty).toList();

                if (isEditing) {
                  rule.name = nameCtrl.text.trim();
                  rule.action = action;
                  rule.domains = domains;
                  rule.ips = ips;
                  rule.protocols = protocols;
                  rule.ports = ports;
                  state.updateRoutingRule(rule);
                } else {
                  final newRule = RoutingRuleModel(
                    id: DateTime.now().millisecondsSinceEpoch.toString(),
                    name: nameCtrl.text.trim(),
                    action: action,
                    domains: domains,
                    ips: ips,
                    protocols: protocols,
                    ports: ports,
                    isEnabled: true,
                  );
                  state.addRoutingRule(newRule);
                }
                Navigator.pop(ctx);
              },
              child: Text(isEditing ? 'Сохранить' : 'Создать', style: const TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}

class _TableRuleItem {
  final String id;
  final String name;
  final String action;
  final List<String> domains;
  final List<String> ips;
  final List<String> protocols;
  final List<String> ports;
  final bool isCorePreset;
  final bool isEnabled;
  final RoutingRuleModel? customModel;

  _TableRuleItem({
    required this.id,
    required this.name,
    required this.action,
    required this.domains,
    required this.ips,
    required this.protocols,
    required this.ports,
    required this.isCorePreset,
    required this.isEnabled,
    this.customModel,
  });
}
