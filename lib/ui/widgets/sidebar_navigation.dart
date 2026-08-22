import 'dart:io';
import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';

class SidebarNavigation extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;

  const SidebarNavigation({
    super.key,
    required this.selectedIndex,
    required this.onDestinationSelected,
  });

  static const _items = [
    _NavItem(icon: Icons.dashboard_rounded, label: 'Главная'),
    _NavItem(icon: Icons.dns_rounded, label: 'Серверы'),
    _NavItem(icon: Icons.alt_route_rounded, label: 'Маршрутизация'),
    _NavItem(icon: Icons.memory_rounded, label: 'Ядра'),
    _NavItem(icon: Icons.shield_rounded, label: 'Угрозы'),
    _NavItem(icon: Icons.wifi_tethering_rounded, label: 'Раздача'),
    _NavItem(icon: Icons.terminal_rounded, label: 'Логи'),
    _NavItem(icon: Icons.settings_rounded, label: 'Настройки'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 210,
      decoration: const BoxDecoration(
        color: AppColors.bgSurface,
        border: Border(
          right: BorderSide(color: AppColors.borderSubtle, width: 1),
        ),
      ),
      child: Column(
        children: [
          const SizedBox(height: 16),
          // App Brand Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    gradient: AppColors.brandGradient,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.3),
                        blurRadius: 10,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.shield_rounded, size: 18, color: Colors.white),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'SENTINEL',
                        style: TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1.2,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        'Desktop Client',
                        style: TextStyle(
                          color: AppColors.neonPurple,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Divider(color: AppColors.borderSubtle, height: 1),
          const SizedBox(height: 8),

          // Nav Items List
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              itemCount: _items.length,
              separatorBuilder: (_, _) => const SizedBox(height: 4),
              itemBuilder: (context, index) {
                final item = _items[index];
                final isSelected = selectedIndex == index;

                return _SidebarButton(
                  icon: item.icon,
                  label: item.label,
                  isSelected: isSelected,
                  onTap: () => onDestinationSelected(index),
                );
              },
            ),
          ),

          // Footer GitHub link
          InkWell(
            onTap: () {
              try {
                if (Platform.isWindows) {
                  Process.run('cmd', ['/c', 'start', '', 'https://github.com/blackalex1/sentinel-desktop']);
                } else if (Platform.isMacOS) {
                  Process.run('open', ['https://github.com/blackalex1/sentinel-desktop']);
                } else if (Platform.isLinux) {
                  Process.run('xdg-open', ['https://github.com/blackalex1/sentinel-desktop']);
                }
              } catch (_) {}
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: AppColors.borderSubtle, width: 1)),
              ),
              child: const Row(
                children: [
                  Expanded(
                    child: Text(
                      'Sentinel Desktop',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        decoration: TextDecoration.underline,
                        decorationColor: AppColors.neonPurple,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  SizedBox(width: 6),
                  Icon(Icons.open_in_new_rounded, size: 13, color: AppColors.neonPurple),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NavItem {
  final IconData icon;
  final String label;
  const _NavItem({required this.icon, required this.label});
}

class _SidebarButton extends StatefulWidget {
  final IconData icon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _SidebarButton({
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  State<_SidebarButton> createState() => _SidebarButtonState();
}

class _SidebarButtonState extends State<_SidebarButton> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
          decoration: BoxDecoration(
            color: widget.isSelected
                ? AppColors.primary.withValues(alpha: 0.15)
                : (_isHovered ? AppColors.borderSubtle.withValues(alpha: 0.5) : Colors.transparent),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: widget.isSelected ? AppColors.primary.withValues(alpha: 0.35) : Colors.transparent,
              width: 1,
            ),
          ),
          child: Row(
            children: [
              Icon(
                widget.icon,
                size: 17,
                color: widget.isSelected
                    ? AppColors.neonPurple
                    : (_isHovered ? AppColors.textPrimary : AppColors.textSecondary),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  widget.label,
                  style: TextStyle(
                    color: widget.isSelected
                        ? AppColors.textPrimary
                        : (_isHovered ? AppColors.textPrimary : AppColors.textSecondary),
                    fontSize: 12.5,
                    fontWeight: widget.isSelected ? FontWeight.w600 : FontWeight.normal,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
