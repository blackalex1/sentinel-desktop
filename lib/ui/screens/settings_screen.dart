import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/providers/app_state_provider.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppStateProvider>();

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // =========================================================================
          // TOP HEADER BAR (Panel Style)
          // =========================================================================
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Параметры и конфигурация клиента',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.3,
                    ),
                  ),
                  SizedBox(height: 3),
                  Text(
                    'Управление автозапуском, аварийным отключением сети и системными портами',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 22),

          // =========================================================================
          // SECTION 1: ОБЩИЕ НАСТРОЙКИ (General Settings Switches)
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
                      'Общие параметры безопасности',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                const Divider(color: Color(0x1AFFFFFF), height: 1),
                const SizedBox(height: 14),

                // 1. Windows Auto-start Switch
                _SwitchSettingTile(
                  icon: Icons.power_settings_new,
                  title: 'Автозапуск при старте Windows',
                  subtitle: 'Запускать приложение в фоновом режиме при входе в систему',
                  value: state.autoStart,
                  onChanged: (val) => state.setAutoStart(val),
                ),

                const Divider(color: Color(0x14FFFFFF), height: 24),

                // 2. Killswitch
                _SwitchSettingTile(
                  icon: Icons.shield_rounded,
                  title: 'Аварийный выключатель (Killswitch)',
                  subtitle: 'Блокировать весь незащищенный сетевой трафик в случае разрыва VPN-соединения',
                  value: state.killswitch,
                  onChanged: (val) => state.setKillswitch(val),
                ),

                const Divider(color: Color(0x14FFFFFF), height: 24),

                // 3. Hardware Acceleration
                _SwitchSettingTile(
                  icon: Icons.speed_rounded,
                  title: 'Аппаратное ускорение рендера (DirectX 11)',
                  subtitle: 'Нативный GPU рендеринг Flutter Impeller без накладных расходов Chromium',
                  value: state.hardwareAcceleration,
                  onChanged: (val) => state.setHardwareAcceleration(val),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // =========================================================================
          // SECTION 2: ПАРАМЕТРЫ И ПОРТЫ СЕТИ
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
                    Icon(Icons.router_rounded, color: AppColors.primary, size: 20),
                    SizedBox(width: 10),
                    Text(
                      'Локальные порты сетевых служб',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                const Divider(color: Color(0x1AFFFFFF), height: 1),
                const SizedBox(height: 14),

                _PortSettingTile(
                  icon: Icons.dns_rounded,
                  title: 'Локальный SOCKS5 порт',
                  subtitle: 'Входящий прокси для браузеров, Telegram и программ с прямой поддержкой SOCKS5',
                  portValue: state.socksPort,
                  onEdit: () => _showPortEditDialog(context, 'SOCKS5 порт', state.socksPort, (p) => state.setSocksPort(p)),
                ),

                const Divider(color: Color(0x14FFFFFF), height: 24),

                _PortSettingTile(
                  icon: Icons.language_rounded,
                  title: 'Локальный HTTP прокси порт',
                  subtitle: 'Используется сетевым стеком Windows для системного проксирования',
                  portValue: state.httpPort,
                  onEdit: () => _showPortEditDialog(context, 'HTTP порт', state.httpPort, (p) => state.setHttpPort(p)),
                ),

                const Divider(color: Color(0x14FFFFFF), height: 24),

                _PortSettingTile(
                  icon: Icons.tune_rounded,
                  title: 'Clash REST API порт',
                  subtitle: 'Внутренний порт для мониторинга активных соединений и телеметрии',
                  portValue: state.clashPort,
                  onEdit: () => _showPortEditDialog(context, 'Clash REST API порт', state.clashPort, (p) => state.setClashPort(p)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showPortEditDialog(BuildContext context, String title, int currentPort, ValueChanged<int> onSave) {
    final ctrl = TextEditingController(text: currentPort.toString());
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgCard,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: AppColors.borderColor),
        ),
        title: Text(
          'Изменить $title',
          style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold),
        ),
        content: SizedBox(
          width: 320,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Укажите порт в диапазоне 1024 - 65535:', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
              const SizedBox(height: 10),
              TextField(
                controller: ctrl,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontFamily: 'monospace', fontWeight: FontWeight.bold),
                decoration: const InputDecoration(
                  labelText: 'Номер порта',
                  labelStyle: TextStyle(color: AppColors.textMuted, fontSize: 12),
                  hintText: '10808',
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
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () {
              final val = int.tryParse(ctrl.text.trim());
              if (val != null && val >= 1024 && val <= 65535) {
                onSave(val);
                Navigator.pop(ctx);
              }
            },
            child: const Text('Сохранить', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}

class _SwitchSettingTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _SwitchSettingTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          padding: const EdgeInsets.all(9),
          decoration: BoxDecoration(
            color: value ? AppColors.primary.withValues(alpha: 0.2) : const Color(0xFF141A2E),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: value ? AppColors.primary.withValues(alpha: 0.4) : const Color(0x33FFFFFF),
            ),
          ),
          child: Icon(
            icon,
            color: value ? AppColors.neonPurple : const Color(0xFF94A3B8),
            size: 20,
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 11.5,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Switch(
          value: value,
          activeThumbColor: AppColors.primary,
          activeTrackColor: AppColors.primary.withValues(alpha: 0.35),
          inactiveThumbColor: AppColors.textMuted,
          inactiveTrackColor: AppColors.bgSurface,
          onChanged: onChanged,
        ),
      ],
    );
  }
}

class _PortSettingTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final int portValue;
  final VoidCallback onEdit;

  const _PortSettingTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.portValue,
    required this.onEdit,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          padding: const EdgeInsets.all(9),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
          ),
          child: Icon(icon, color: AppColors.neonPurple, size: 20),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 11.5,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        InkWell(
          onTap: onEdit,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFF080C1A),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.4)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  portValue.toString(),
                  style: const TextStyle(
                    color: AppColors.neonPurple,
                    fontSize: 12.5,
                    fontFamily: 'monospace',
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(width: 6),
                const Icon(Icons.edit_rounded, color: AppColors.primary, size: 13),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
