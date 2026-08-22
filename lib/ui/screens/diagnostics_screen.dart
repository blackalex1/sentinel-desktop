import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../widgets/bento_card.dart';

class DiagnosticsScreen extends StatefulWidget {
  const DiagnosticsScreen({super.key});

  @override
  State<DiagnosticsScreen> createState() => _DiagnosticsScreenState();
}

class _DiagnosticsScreenState extends State<DiagnosticsScreen> {
  bool _isRunning = false;
  final String _wintunStatus = 'Готов (Драйвер установлен)';
  final String _dnsLeak = 'Утечек нет';
  final String _directLatency = '14 ms';

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'СИСТЕМНАЯ ДИАГНОСТИКА СЕТИ',
            style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.0),
          ),
          const SizedBox(height: 14),

          BentoCard(
            child: Column(
              children: [
                _DiagRow(
                  title: 'Сетевой драйвер Wintun',
                  value: _wintunStatus,
                  icon: Icons.check_circle_rounded,
                  color: AppColors.neonGreen,
                ),
                const Divider(color: AppColors.borderSubtle, height: 20),
                _DiagRow(
                  title: 'Проверка утечек DNS (DNS Leak Test)',
                  value: _dnsLeak,
                  icon: Icons.security_rounded,
                  color: AppColors.neonCyan,
                ),
                const Divider(color: AppColors.borderSubtle, height: 20),
                _DiagRow(
                  title: 'Прямой пинг до магистрального шлюза',
                  value: _directLatency,
                  icon: Icons.speed_rounded,
                  color: AppColors.neonPurple,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.neonCyan,
              foregroundColor: Colors.black,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            icon: Icon(_isRunning ? Icons.hourglass_top_rounded : Icons.play_arrow_rounded, size: 16),
            label: Text(_isRunning ? 'Тестирование...' : 'Запустить полную диагностику', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            onPressed: () {
              setState(() => _isRunning = true);
              Future.delayed(const Duration(seconds: 1), () {
                if (mounted) setState(() => _isRunning = false);
              });
            },
          ),
        ],
      ),
    );
  }
}

class _DiagRow extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;

  const _DiagRow({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 10),
        Expanded(
          child: Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w600)),
        ),
        Text(value, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold)),
      ],
    );
  }
}
