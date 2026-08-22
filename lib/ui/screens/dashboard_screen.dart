import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/models/connection_status.dart';
import '../../core/models/server_model.dart';
import '../../core/models/traffic_stats.dart';
import '../../core/providers/app_state_provider.dart';
import '../widgets/bento_card.dart';
import '../widgets/mascot/mecha_mascot_widget.dart';

class DashboardScreen extends StatelessWidget {
  final bool isVisible;

  const DashboardScreen({super.key, this.isVisible = true});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top Mode Bar (TUN / System Proxy & Active Core)
          const _TopModeBar(),

          const SizedBox(height: 20),

          // Central Hero Section: 2D Pre-Baked GPU Mascot Power Button (0.0% GPU)
          _MascotHeroSection(isVisible: isVisible),

          // Status & Connect Action Label
          const _StatusActionLabel(),

          const SizedBox(height: 24),

          // Bento Grid: Server Picker & Public IP (Isolated)
          const _ServerAndIpBentoRow(),

          const SizedBox(height: 12),

          // Speed & Traffic Stats Row (Isolated with Selector for 0% GPU rebuilds)
          const _TrafficSpeedBentoRow(),
        ],
      ),
    );
  }
}

class _TopModeBar extends StatelessWidget {
  const _TopModeBar();

  @override
  Widget build(BuildContext context) {
    final isTunMode = context.select<AppStateProvider, bool>((s) => s.isTunMode);
    final isSystemProxy = context.select<AppStateProvider, bool>((s) => s.isSystemProxy);
    final activeCore = context.select<AppStateProvider, String>((s) => s.activeCore);

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        // Inbound Mode Chips
        Row(
          children: [
            _ModeChip(
              label: 'TUN (Wintun)',
              icon: Icons.vpn_lock_rounded,
              isActive: isTunMode,
              onTap: () => context.read<AppStateProvider>().updateSettings(isTunMode: true, isSystemProxy: false),
            ),
            const SizedBox(width: 8),
            _ModeChip(
              label: 'System Proxy',
              icon: Icons.language_rounded,
              isActive: isSystemProxy,
              onTap: () => context.read<AppStateProvider>().updateSettings(isTunMode: false, isSystemProxy: true),
            ),
          ],
        ),

        // Active Core Selector Pill
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppColors.borderSubtle),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: activeCore,
              dropdownColor: AppColors.bgCard,
              icon: const Icon(Icons.keyboard_arrow_down, color: AppColors.textSecondary, size: 16),
              style: const TextStyle(color: AppColors.neonCyan, fontSize: 12, fontWeight: FontWeight.bold),
              items: const [
                DropdownMenuItem(value: 'singbox', child: Text('SING-BOX CORE')),
                DropdownMenuItem(value: 'xray', child: Text('XRAY-CORE')),
                DropdownMenuItem(value: 'hysteria', child: Text('HYSTERIA 2')),
              ],
              onChanged: (val) {
                if (val != null) {
                  context.read<AppStateProvider>().updateSettings(activeCore: val);
                }
              },
            ),
          ),
        ),
      ],
    );
  }
}

class _MascotHeroSection extends StatelessWidget {
  final bool isVisible;

  const _MascotHeroSection({required this.isVisible});

  @override
  Widget build(BuildContext context) {
    final status = context.select<AppStateProvider, ConnectionStatus>((s) => s.status);

    return RepaintBoundary(
      child: Center(
        child: SizedBox(
          width: 180,
          height: 180,
          child: Center(
            child: MechaMascotWidget(
              status: status,
              isVisible: isVisible,
              onTap: () => context.read<AppStateProvider>().toggleConnect(),
            ),
          ),
        ),
      ),
    );
  }
}

class _StatusActionLabel extends StatelessWidget {
  const _StatusActionLabel();

  @override
  Widget build(BuildContext context) {
    final status = context.select<AppStateProvider, ConnectionStatus>((s) => s.status);
    final isConnected = status == ConnectionStatus.connected;
    final isConnecting = status == ConnectionStatus.connecting;

    return Center(
      child: Column(
        children: [
          Text(
            isConnected
                ? 'ЗАЩИЩЕНО'
                : (isConnecting ? 'ПОДКЛЮЧЕНИЕ...' : 'ОТКЛЮЧЕНО'),
            style: TextStyle(
              color: isConnected
                  ? AppColors.neonCyan
                  : (isConnecting ? AppColors.neonAmber : AppColors.textMuted),
              fontSize: 16,
              fontWeight: FontWeight.w800,
              letterSpacing: 2.0,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            isConnected ? 'Нажмите для отключения' : 'Нажмите для безопасного подключения',
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _ServerAndIpBentoRow extends StatelessWidget {
  const _ServerAndIpBentoRow();

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        // Selected Server Card (Interactive Dropdown)
        Expanded(
          flex: 2,
          child: _SelectedServerBentoCard(),
        ),

        SizedBox(width: 12),

        // Public IP & Geo Card
        Expanded(
          child: _PublicIpBentoCard(),
        ),
      ],
    );
  }
}

class _SelectedServerBentoCard extends StatelessWidget {
  const _SelectedServerBentoCard();

  @override
  Widget build(BuildContext context) {
    final server = context.select<AppStateProvider, ServerModel?>((s) => s.selectedServer);
    final isConnected = context.select<AppStateProvider, bool>((s) => s.status == ConnectionStatus.connected);
    final isMeasuringPing = context.select<AppStateProvider, bool>((s) => s.isMeasuringPing);
    final activePing = isConnected
        ? context.select<AppStateProvider, int?>((s) => s.stats.pingMs ?? s.selectedServer?.pingMs)
        : server?.pingMs;

    return RepaintBoundary(
      child: BentoCard(
        onTap: () {
          final state = context.read<AppStateProvider>();
          _showServerPickerModal(context, state);
        },
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: AppColors.borderSubtle,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: Text(
                  server?.countryCode == 'LAN' || (server?.name.contains('Phone') ?? false)
                      ? '📱'
                      : (server?.countryCode == 'RU' ? '🇷🇺' : (server?.countryCode == 'US' ? '🇺🇸' : '🌐')),
                  style: const TextStyle(fontSize: 20),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          server?.name ?? 'Сервер не выбран',
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const Icon(Icons.arrow_drop_down_rounded, color: AppColors.neonCyan, size: 20),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    server != null
                        ? '${server.protocol.toUpperCase()} • ${server.address}:${server.port}'
                        : 'Нажмите для выбора или добавления сервера',
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (isMeasuringPing) ...[
              const SizedBox(width: 8),
              const SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(strokeWidth: 1.5, color: AppColors.neonCyan),
              ),
            ] else if (activePing != null) ...[
              const SizedBox(width: 8),
              Tooltip(
                message: 'Нажмите для проверки пинга',
                child: InkWell(
                  onTap: () => context.read<AppStateProvider>().measureActiveLatency(),
                  borderRadius: BorderRadius.circular(6),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: (activePing < 100
                              ? AppColors.neonGreen
                              : (activePing < 250 ? AppColors.neonAmber : AppColors.neonRed))
                          .withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: (activePing < 100
                                ? AppColors.neonGreen
                                : (activePing < 250 ? AppColors.neonAmber : AppColors.neonRed))
                            .withValues(alpha: 0.35),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.bolt_rounded,
                          size: 13,
                          color: activePing < 100
                              ? AppColors.neonGreen
                              : (activePing < 250 ? AppColors.neonAmber : AppColors.neonRed),
                        ),
                        const SizedBox(width: 2),
                        Text(
                          '$activePing ms',
                          style: TextStyle(
                            color: activePing < 100
                                ? AppColors.neonGreen
                                : (activePing < 250 ? AppColors.neonAmber : AppColors.neonRed),
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ] else if (server != null) ...[
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.speed_rounded, size: 16, color: AppColors.textMuted),
                tooltip: 'Измерить пинг',
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                onPressed: () => context.read<AppStateProvider>().measureActiveLatency(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PublicIpBentoCard extends StatelessWidget {
  const _PublicIpBentoCard();

  @override
  Widget build(BuildContext context) {
    final publicIp = context.select<AppStateProvider, String?>((s) => s.stats.publicIp);
    final publicGeo = context.select<AppStateProvider, String?>((s) => s.stats.publicGeo);
    final isRefreshingIp = context.select<AppStateProvider, bool>((s) => s.isRefreshingIp);

    return RepaintBoundary(
      child: BentoCard(
        onTap: () => context.read<AppStateProvider>().refreshPublicIP(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('ПУБЛИЧНЫЙ IP', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.bold)),
                isRefreshingIp
                    ? const SizedBox(
                        width: 12,
                        height: 12,
                        child: CircularProgressIndicator(strokeWidth: 1.5, color: AppColors.neonCyan),
                      )
                    : const Icon(Icons.refresh, size: 14, color: AppColors.textSecondary),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              publicIp ?? 'Определение...',
              style: const TextStyle(color: AppColors.neonCyan, fontSize: 13, fontWeight: FontWeight.bold),
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              publicGeo ?? 'Локация',
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 10),
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _TrafficSpeedBentoRow extends StatelessWidget {
  const _TrafficSpeedBentoRow();

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: Selector<AppStateProvider, TrafficStats>(
        selector: (_, s) => s.stats,
        builder: (context, stats, _) {
          return Row(
            children: [
              Expanded(
                child: BentoCard(
                  child: Row(
                    children: [
                      const Icon(Icons.arrow_downward_rounded, color: AppColors.neonCyan, size: 20),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('СКОРОСТЬ ЗАГРУЗКИ', style: TextStyle(color: AppColors.textMuted, fontSize: 9, fontWeight: FontWeight.bold)),
                          Text(TrafficStats.formatSpeed(stats.downloadSpeedBytes), style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: BentoCard(
                  child: Row(
                    children: [
                      const Icon(Icons.arrow_upward_rounded, color: AppColors.neonViolet, size: 20),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('СКОРОСТЬ ОТДАЧИ', style: TextStyle(color: AppColors.textMuted, fontSize: 9, fontWeight: FontWeight.bold)),
                          Text(TrafficStats.formatSpeed(stats.uploadSpeedBytes), style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

void _showServerPickerModal(BuildContext context, AppStateProvider state) {
  showDialog(
    context: context,
    builder: (dialogCtx) {
      return Dialog(
        backgroundColor: AppColors.bgCard,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: AppColors.borderSubtle, width: 1),
        ),
        child: Container(
          width: 480,
          constraints: const BoxConstraints(maxHeight: 520),
          padding: const EdgeInsets.all(18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.dns_rounded, color: AppColors.neonCyan, size: 20),
                      const SizedBox(width: 8),
                      Text(
                        'ВЫБОР ПОДКЛЮЧЕНИЯ (${state.servers.length})',
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: AppColors.textMuted, size: 18),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    onPressed: () => Navigator.pop(dialogCtx),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              const Divider(color: AppColors.borderSubtle, height: 1),
              const SizedBox(height: 12),

              if (state.servers.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 30),
                  child: Center(
                    child: Column(
                      children: [
                        Icon(Icons.cloud_off_rounded, color: AppColors.textMuted, size: 36),
                        SizedBox(height: 10),
                        Text('Нет добавленных серверов', style: TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.bold)),
                        SizedBox(height: 4),
                        Text('Перейдите во вкладку «Серверы» или «Раздача» для импорта', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                      ],
                    ),
                  ),
                )
              else
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: state.servers.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (ctx, idx) {
                      final s = state.servers[idx];
                      final isSelected = s.id == state.selectedServerId;

                      return InkWell(
                        onTap: () async {
                          Navigator.pop(dialogCtx);
                          if (s.id != state.selectedServerId) {
                            state.setSelectedServer(s.id);
                            if (state.status == ConnectionStatus.connected) {
                              await state.connect();
                            }
                          }
                        },
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: isSelected ? AppColors.primary.withValues(alpha: 0.12) : AppColors.bgSurface,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: isSelected ? AppColors.primary : AppColors.borderSubtle,
                              width: isSelected ? 1.2 : 0.8,
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: AppColors.borderSubtle,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Center(
                                  child: Text(
                                    s.countryCode == 'LAN' || s.name.contains('Phone')
                                        ? '📱'
                                        : (s.countryCode == 'RU' ? '🇷🇺' : (s.countryCode == 'US' ? '🇺🇸' : '🌐')),
                                    style: const TextStyle(fontSize: 16),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      s.name,
                                      style: TextStyle(
                                        color: isSelected ? AppColors.primary : AppColors.textPrimary,
                                        fontSize: 12,
                                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '${s.protocol.toUpperCase()} • ${s.address}:${s.port}',
                                      style: const TextStyle(color: AppColors.textMuted, fontSize: 10),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                              if (s.pingMs != null) ...[
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: AppColors.neonGreen.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    '${s.pingMs} ms',
                                    style: const TextStyle(color: AppColors.neonGreen, fontSize: 10, fontWeight: FontWeight.bold),
                                  ),
                                ),
                                const SizedBox(width: 8),
                              ],
                              Icon(
                                isSelected ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                                color: isSelected ? AppColors.primary : AppColors.textMuted,
                                size: 18,
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      );
    },
  );
}

class _ModeChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isActive;
  final VoidCallback onTap;

  const _ModeChip({
    required this.label,
    required this.icon,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isActive ? AppColors.primary.withValues(alpha: 0.18) : AppColors.bgSurface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isActive ? AppColors.primary : AppColors.borderSubtle,
          ),
        ),
        child: Row(
          children: [
            Icon(icon, size: 14, color: isActive ? AppColors.primary : AppColors.textSecondary),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: isActive ? AppColors.primary : AppColors.textSecondary,
                fontSize: 11,
                fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
