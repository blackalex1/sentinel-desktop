import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/constants/app_colors.dart';
import '../../core/services/core_supervisor.dart';

class LogsScreen extends StatefulWidget {
  const LogsScreen({super.key});

  @override
  State<LogsScreen> createState() => _LogsScreenState();
}

class _LogsScreenState extends State<LogsScreen> {
  final _scrollController = ScrollController();
  final _searchController = TextEditingController();
  String _filter = '';
  bool _autoScroll = true;
  int _activeTab = 0; // 0: Core Logs, 1: App Logs

  dynamic _coreSub;
  dynamic _appSub;

  @override
  void initState() {
    super.initState();
    _coreSub = CoreSupervisor.instance.coreLogStream.listen((_) {
      if (mounted) setState(() {});
    });
    _appSub = CoreSupervisor.instance.appLogStream.listen((_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _coreSub?.cancel();
    _appSub?.cancel();
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final coreLogsCount = CoreSupervisor.instance.coreLogs.length;
    final appLogsCount = CoreSupervisor.instance.appLogs.length;

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top Navigation: Tabs Switcher + Actions
          Row(
            children: [
              // Tab Switchers
              _LogTabButton(
                icon: Icons.bolt_rounded,
                label: 'Логи ядра (Core)',
                count: coreLogsCount,
                isSelected: _activeTab == 0,
                activeColor: AppColors.neonCyan,
                onTap: () => setState(() => _activeTab = 0),
              ),
              const SizedBox(width: 8),
              _LogTabButton(
                icon: Icons.terminal_rounded,
                label: 'Логи приложения (App)',
                count: appLogsCount,
                isSelected: _activeTab == 1,
                activeColor: AppColors.neonPurple,
                onTap: () => setState(() => _activeTab = 1),
              ),

              const Spacer(),

              // Search Filter
              SizedBox(
                width: 240,
                height: 36,
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.bgSurface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.borderSubtle),
                  ),
                  child: TextField(
                    controller: _searchController,
                    onChanged: (v) => setState(() => _filter = v),
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 12),
                    decoration: const InputDecoration(
                      hintText: 'Фильтр по логам...',
                      hintStyle: TextStyle(color: AppColors.textMuted, fontSize: 12),
                      prefixIcon: Icon(Icons.search, size: 16, color: AppColors.textSecondary),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(vertical: 8),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),

              // Auto-Scroll Toggle
              IconButton(
                tooltip: _autoScroll ? 'Автопрокрутка включена' : 'Автопрокрутка выключена',
                icon: Icon(
                  Icons.arrow_downward_rounded,
                  color: _autoScroll ? AppColors.neonCyan : AppColors.textMuted,
                  size: 18,
                ),
                onPressed: () => setState(() => _autoScroll = !_autoScroll),
              ),

              // Copy All Logs of Current Tab
              IconButton(
                tooltip: 'Скопировать логи активной вкладки',
                icon: const Icon(Icons.copy_rounded, color: AppColors.textSecondary, size: 18),
                onPressed: () {
                  final list = _activeTab == 0
                      ? CoreSupervisor.instance.coreLogs
                      : CoreSupervisor.instance.appLogs;
                  final text = list.join('\n');
                  Clipboard.setData(ClipboardData(text: text));
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(_activeTab == 0
                          ? 'Логи ядра скопированы в буфер обмена'
                          : 'Логи приложения скопированы в буфер обмена'),
                      backgroundColor: AppColors.neonCyan,
                    ),
                  );
                },
              ),
            ],
          ),

          const SizedBox(height: 14),

          // Terminal Console Area
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF030712),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.borderSubtle),
              ),
              child: StreamBuilder<String>(
                stream: _activeTab == 0
                    ? CoreSupervisor.instance.coreLogStream
                    : CoreSupervisor.instance.appLogStream,
                builder: (context, snapshot) {
                  final activeLogs = _activeTab == 0
                      ? CoreSupervisor.instance.coreLogs
                      : CoreSupervisor.instance.appLogs;

                  final filtered = _filter.isEmpty
                      ? activeLogs
                      : activeLogs
                          .where((l) => l.toLowerCase().contains(_filter.toLowerCase()))
                          .toList();

                  if (_autoScroll && _scrollController.hasClients) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (_scrollController.hasClients) {
                        _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
                      }
                    });
                  }

                  if (filtered.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            _activeTab == 0 ? Icons.bolt_outlined : Icons.terminal_outlined,
                            size: 40,
                            color: AppColors.textMuted,
                          ),
                          const SizedBox(height: 10),
                          Text(
                            _activeTab == 0
                                ? 'Логи ядра отсутствуют (подключитесь к серверу для генерации логов)'
                                : 'Логи приложения отсутствуют',
                            style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                          ),
                        ],
                      ),
                    );
                  }

                  return ListView.builder(
                    controller: _scrollController,
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final line = filtered[index];
                      final isError = line.contains('ERR') ||
                          line.contains('FATAL') ||
                          line.contains('error') ||
                          line.contains('Exception') ||
                          line.contains('⚠️');
                      final isWarn = line.contains('WARN');
                      final isApp = line.contains('[App]');

                      Color textColor = const Color(0xFF94A3B8);
                      if (isError) {
                        textColor = AppColors.neonRed;
                      } else if (isWarn) {
                        textColor = AppColors.neonAmber;
                      } else if (isApp) {
                        textColor = AppColors.neonCyan;
                      }

                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2.0),
                        child: SelectableText(
                          line,
                          style: TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 11.5,
                            color: textColor,
                            height: 1.4,
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LogTabButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final int count;
  final bool isSelected;
  final Color activeColor;
  final VoidCallback onTap;

  const _LogTabButton({
    required this.icon,
    required this.label,
    required this.count,
    required this.isSelected,
    required this.activeColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? activeColor.withValues(alpha: 0.12) : AppColors.bgSurface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? activeColor.withValues(alpha: 0.4) : AppColors.borderSubtle,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 15,
              color: isSelected ? activeColor : AppColors.textSecondary,
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? AppColors.textPrimary : AppColors.textSecondary,
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              decoration: BoxDecoration(
                color: isSelected
                    ? activeColor.withValues(alpha: 0.2)
                    : AppColors.borderSubtle,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  color: isSelected ? activeColor : AppColors.textMuted,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
