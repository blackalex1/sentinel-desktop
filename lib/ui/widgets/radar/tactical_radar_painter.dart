import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';

class RadarGridStaticPainter extends CustomPainter {
  final bool isConnected;

  const RadarGridStaticPainter({required this.isConnected});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) / 2 - 8;

    final gridPaint = Paint()
      ..color = AppColors.neonCyan.withValues(alpha: 0.08)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;

    final activeGridPaint = Paint()
      ..color = isConnected ? AppColors.neonCyan.withValues(alpha: 0.2) : AppColors.borderSubtle
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;

    // Concentric range circles
    for (int i = 1; i <= 4; i++) {
      final r = radius * (i / 4.0);
      canvas.drawCircle(center, r, i == 4 ? activeGridPaint : gridPaint);
    }

    // Crosshairs
    canvas.drawLine(Offset(center.dx - radius, center.dy), Offset(center.dx + radius, center.dy), gridPaint);
    canvas.drawLine(Offset(center.dx, center.dy - radius), Offset(center.dx, center.dy + radius), gridPaint);
  }

  @override
  bool shouldRepaint(covariant RadarGridStaticPainter oldDelegate) {
    return oldDelegate.isConnected != isConnected;
  }
}

class RadarBeamStaticPainter extends CustomPainter {
  final double glowAlpha;

  const RadarBeamStaticPainter({required this.glowAlpha});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) / 2 - 8;

    // Static Sweeping radar beam gradient sector (pointing at 0 rad)
    final sweepPaint = Paint()
      ..shader = SweepGradient(
        center: Alignment.center,
        startAngle: 0.0,
        endAngle: math.pi * 2,
        colors: [
          Colors.transparent,
          AppColors.neonCyan.withValues(alpha: 0.0),
          AppColors.neonCyan.withValues(alpha: 0.18 * glowAlpha),
        ],
        stops: const [0.0, 0.75, 1.0],
      ).createShader(Rect.fromCircle(center: center, radius: radius));

    canvas.drawCircle(center, radius, sweepPaint);

    // Static Sweep lead line
    final lineEnd = Offset(center.dx + radius, center.dy);
    final linePaint = Paint()
      ..color = AppColors.neonCyan.withValues(alpha: 0.6 * glowAlpha)
      ..strokeWidth = 1.5;
    canvas.drawLine(center, lineEnd, linePaint);
  }

  @override
  bool shouldRepaint(covariant RadarBeamStaticPainter oldDelegate) {
    return oldDelegate.glowAlpha != glowAlpha;
  }
}


