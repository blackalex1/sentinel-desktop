import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/models/connection_status.dart';

class MascotChassisStaticPainter extends CustomPainter {
  final ConnectionStatus status;
  final bool isHovered;

  const MascotChassisStaticPainter({
    required this.status,
    required this.isHovered,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final isConnected = status == ConnectionStatus.connected;
    final isConnecting = status == ConnectionStatus.connecting;
    final isAwake = isConnected || isConnecting || isHovered;

    double sx(double x) => x * size.width / 100.0;
    double sy(double y) => y * size.height / 100.0;

    final themeColor = isConnected
        ? AppColors.neonCyan
        : (isConnecting ? AppColors.neonAmber : (isHovered ? AppColors.neonPurple : AppColors.neonViolet));

    final cobaltBlue = isConnected
        ? const Color(0xFF2563EB)
        : (isConnecting ? const Color(0xFFD97706) : const Color(0xFF7C3AED));

    // 1. Ambient Radial Power Halo
    final haloPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          themeColor.withValues(alpha: isConnected ? 0.24 : (isAwake ? 0.16 : 0.06)),
          cobaltBlue.withValues(alpha: isConnected ? 0.08 : 0.02),
          themeColor.withValues(alpha: 0.0),
        ],
        stops: const [0.0, 0.6, 1.0],
      ).createShader(Rect.fromCircle(center: Offset(sx(50), sy(52)), radius: sx(48)));
    canvas.drawCircle(Offset(sx(50), sy(52)), sx(48), haloPaint);

    // 2. Liquid Coolant Conduits (СВО Tubes)
    final tubeCasingPaint = Paint()
      ..color = const Color(0xFF0F172A)
      ..style = PaintingStyle.stroke
      ..strokeWidth = sx(4.2)
      ..strokeCap = StrokeCap.round;

    final leftTubePath = Path()
      ..moveTo(sx(20), sy(6))
      ..cubicTo(sx(10), sy(12), sx(34), sy(22), sx(44), sy(18));
    final rightTubePath = Path()
      ..moveTo(sx(80), sy(6))
      ..cubicTo(sx(90), sy(12), sx(66), sy(22), sx(56), sy(18));

    canvas.drawPath(leftTubePath, tubeCasingPaint);
    canvas.drawPath(rightTubePath, tubeCasingPaint);

    final fluidPaint = Paint()
      ..color = themeColor.withValues(alpha: isConnected ? 0.95 : 0.6)
      ..style = PaintingStyle.stroke
      ..strokeWidth = sx(2.0)
      ..strokeCap = StrokeCap.round;
    canvas.drawPath(leftTubePath, fluidPaint);
    canvas.drawPath(rightTubePath, fluidPaint);

    // 3. Mecha Crown Intake Horns with Radiator Fin Tips
    final hornPaint = Paint()
      ..color = const Color(0xFF1E293B)
      ..style = PaintingStyle.fill;
    final hornStroke = Paint()
      ..color = themeColor.withValues(alpha: isAwake ? 0.6 : 0.25)
      ..style = PaintingStyle.stroke
      ..strokeWidth = sx(1.2);

    final leftHorn = Path()
      ..moveTo(sx(24), sy(24))
      ..lineTo(sx(20), sy(6))
      ..lineTo(sx(32), sy(14))
      ..close();
    canvas.drawPath(leftHorn, hornPaint);
    canvas.drawPath(leftHorn, hornStroke);

    final rightHorn = Path()
      ..moveTo(sx(76), sy(24))
      ..lineTo(sx(80), sy(6))
      ..lineTo(sx(68), sy(14))
      ..close();
    canvas.drawPath(rightHorn, hornPaint);
    canvas.drawPath(rightHorn, hornStroke);

    // Crown Radiator Fin Tips
    final tipGlow = Paint()
      ..color = themeColor
      ..style = PaintingStyle.fill;
    final tipWhite = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;

    canvas.drawCircle(Offset(sx(20), sy(6)), sx(3.0), tipGlow);
    canvas.drawCircle(Offset(sx(20), sy(6)), sx(1.6), tipWhite);
    canvas.drawCircle(Offset(sx(80), sy(6)), sx(3.0), tipGlow);
    canvas.drawCircle(Offset(sx(80), sy(6)), sx(1.6), tipWhite);

    // 4. Sharp Angular Titanium PC Mecha Armor Silhouette (Windows Mascot Shield)
    final mechaPath = Path()
      ..moveTo(sx(50), sy(12))
      ..lineTo(sx(74), sy(16))
      ..lineTo(sx(88), sy(34))
      ..lineTo(sx(80), sy(68))
      ..lineTo(sx(50), sy(94))
      ..lineTo(sx(20), sy(68))
      ..lineTo(sx(12), sy(34))
      ..lineTo(sx(26), sy(16))
      ..close();

    final mechaShader = const LinearGradient(
      colors: [Color(0xFF111827), Color(0xFF081426), Color(0xFF030814)],
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
    ).createShader(Rect.fromLTWH(sx(12), sy(12), sx(76), sy(82)));

    final mechaFill = Paint()
      ..shader = mechaShader
      ..style = PaintingStyle.fill;
    canvas.drawPath(mechaPath, mechaFill);

    final mechaBorder = Paint()
      ..color = themeColor.withValues(alpha: isAwake ? 0.9 : 0.45)
      ..style = PaintingStyle.stroke
      ..strokeWidth = sx(3.6)
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(mechaPath, mechaBorder);

    // 5. Mecha Cheek Cowlings (Cobalt & Ice Blue)
    final cheekFill = Paint()
      ..color = cobaltBlue.withValues(alpha: isConnected ? 0.45 : 0.18)
      ..style = PaintingStyle.fill;

    final leftCheek = Path()
      ..moveTo(sx(12), sy(34))
      ..lineTo(sx(32), sy(48))
      ..lineTo(sx(30), sy(76))
      ..lineTo(sx(20), sy(68))
      ..close();
    canvas.drawPath(leftCheek, cheekFill);

    final rightCheek = Path()
      ..moveTo(sx(88), sy(34))
      ..lineTo(sx(68), sy(48))
      ..lineTo(sx(70), sy(76))
      ..lineTo(sx(80), sy(68))
      ..close();
    canvas.drawPath(rightCheek, cheekFill);

    // 6. Cheek Telemetry Glyphs (3 Slanted Chevrons on each cheek)
    for (int i = 0; i < 3; i++) {
      final glyphPaint = Paint()
        ..color = (isConnected ? themeColor : Colors.white.withValues(alpha: 0.25))
        ..style = PaintingStyle.fill;

      final lg = Path()
        ..moveTo(sx(19 + i * 1.5), sy(35 + i * 5.2))
        ..lineTo(sx(23.5 + i * 1.5), sy(35 + i * 5.2))
        ..lineTo(sx(22 + i * 1.5), sy(37.2 + i * 5.2))
        ..lineTo(sx(17.5 + i * 1.5), sy(37.2 + i * 5.2))
        ..close();
      canvas.drawPath(lg, glyphPaint);

      final rg = Path()
        ..moveTo(sx(81 - i * 1.5), sy(35 + i * 5.2))
        ..lineTo(sx(76.5 - i * 1.5), sy(35 + i * 5.2))
        ..lineTo(sx(78 - i * 1.5), sy(37.2 + i * 5.2))
        ..lineTo(sx(82.5 - i * 1.5), sy(37.2 + i * 5.2))
        ..close();
      canvas.drawPath(rg, glyphPaint);
    }

    // 7. Armor Seam Lines & Hex Bolts
    final seamPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.12)
      ..style = PaintingStyle.stroke
      ..strokeWidth = sx(0.9);
    final seam = Path()
      ..moveTo(sx(32), sy(22))
      ..lineTo(sx(50), sy(25))
      ..lineTo(sx(68), sy(22));
    canvas.drawPath(seam, seamPaint);

    // 8. Visor Screen Glass Inset
    final visorPath = Path()
      ..moveTo(sx(26), sy(29))
      ..lineTo(sx(74), sy(29))
      ..lineTo(sx(74), sy(47))
      ..lineTo(sx(50), sy(53))
      ..lineTo(sx(26), sy(47))
      ..close();

    final visorBgPaint = Paint()
      ..color = const Color(0xFF020617)
      ..style = PaintingStyle.fill;
    canvas.drawPath(visorPath, visorBgPaint);

    final visorBorder = Paint()
      ..color = themeColor.withValues(alpha: isAwake ? 0.35 : 0.15)
      ..style = PaintingStyle.stroke
      ..strokeWidth = sx(1.2);
    canvas.drawPath(visorPath, visorBorder);

    // 9. Overclock Quantum Diamond Arc Reactor in Chest
    // Titanium Magnetic Clamps
    final clampPaint = Paint()
      ..color = const Color(0xFF1E293B)
      ..style = PaintingStyle.fill;
    final clampBorder = Paint()
      ..color = Colors.white.withValues(alpha: 0.2)
      ..style = PaintingStyle.stroke
      ..strokeWidth = sx(0.8);

    canvas.drawRect(Rect.fromLTWH(sx(46), sy(41), sx(8), sy(3.5)), clampPaint);
    canvas.drawRect(Rect.fromLTWH(sx(46), sy(41), sx(8), sy(3.5)), clampBorder);
    canvas.drawRect(Rect.fromLTWH(sx(46), sy(80), sx(8), sy(3.5)), clampPaint);
    canvas.drawRect(Rect.fromLTWH(sx(46), sy(80), sx(8), sy(3.5)), clampBorder);

    // Solid Outer Diamond
    final outerDiamond = Path()
      ..moveTo(sx(50), sy(44))
      ..lineTo(sx(64), sy(58))
      ..lineTo(sx(50), sy(80))
      ..lineTo(sx(36), sy(58))
      ..close();

    final diamondFill = Paint()
      ..color = cobaltBlue.withValues(alpha: isConnected ? 0.95 : 0.6)
      ..style = PaintingStyle.fill;
    canvas.drawPath(outerDiamond, diamondFill);

    // Inner Overclock Spark (Amber / Gold)
    final sparkPath = Path()
      ..moveTo(sx(50), sy(50))
      ..lineTo(sx(58), sy(58))
      ..lineTo(sx(50), sy(73))
      ..lineTo(sx(42), sy(58))
      ..close();

    final sparkFill = Paint()
      ..color = (isConnected ? const Color(0xFFF59E0B) : const Color(0xFFA78BFA))
      ..style = PaintingStyle.fill;
    canvas.drawPath(sparkPath, sparkFill);

    // White Singularity Heart
    final heartPath = Path()
      ..moveTo(sx(50), sy(54))
      ..lineTo(sx(54), sy(58))
      ..lineTo(sx(50), sy(64))
      ..lineTo(sx(46), sy(58))
      ..close();

    final heartFill = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;
    canvas.drawPath(heartPath, heartFill);
  }

  @override
  bool shouldRepaint(covariant MascotChassisStaticPainter oldDelegate) {
    return oldDelegate.status != status || oldDelegate.isHovered != isHovered;
  }
}

class MascotEyesStaticPainter extends CustomPainter {
  final ConnectionStatus status;
  final bool isHovered;
  final Offset gazeOffset;
  final double eyeOpenness;

  const MascotEyesStaticPainter({
    required this.status,
    required this.isHovered,
    this.gazeOffset = Offset.zero,
    this.eyeOpenness = 1.0,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final isConnected = status == ConnectionStatus.connected;
    final isConnecting = status == ConnectionStatus.connecting;
    final isAwake = isConnected || isConnecting || isHovered;

    double sx(double x) => x * size.width / 100.0;
    double sy(double y) => y * size.height / 100.0;

    final themeColor = isConnected
        ? AppColors.neonCyan
        : (isConnecting ? AppColors.neonAmber : (isHovered ? AppColors.neonPurple : AppColors.neonViolet));

    final dx = gazeOffset.dx * 3.5;
    final dy = gazeOffset.dy * 2.5;
    if (dx != 0 || dy != 0) {
      canvas.save();
      canvas.translate(dx, dy);
    }

    if (isAwake && eyeOpenness > 0.2) {
      final eyePaint = Paint()
        ..color = themeColor
        ..style = PaintingStyle.fill;

      final h = 3.5 * eyeOpenness;
      final yOffset = (3.5 - h) / 2.0;

      // 4-Quadrant Windows Cyber Visor Eyes (Windows Quad Logo)
      // Left Quad-Segment
      canvas.drawRect(Rect.fromLTWH(sx(28), sy(33) + yOffset, sx(6.5), sy(h)), eyePaint);
      canvas.drawRect(Rect.fromLTWH(sx(36), sy(33) + yOffset, sx(6.5), sy(h)), eyePaint);
      canvas.drawRect(Rect.fromLTWH(sx(28), sy(38) + yOffset, sx(6.5), sy(h)), eyePaint);
      canvas.drawRect(Rect.fromLTWH(sx(36), sy(38) + yOffset, sx(6.5), sy(h)), eyePaint);

      // Right Quad-Segment
      canvas.drawRect(Rect.fromLTWH(sx(57), sy(33) + yOffset, sx(6.5), sy(h)), eyePaint);
      canvas.drawRect(Rect.fromLTWH(sx(65), sy(33) + yOffset, sx(6.5), sy(h)), eyePaint);
      canvas.drawRect(Rect.fromLTWH(sx(57), sy(38) + yOffset, sx(6.5), sy(h)), eyePaint);
      canvas.drawRect(Rect.fromLTWH(sx(65), sy(38) + yOffset, sx(6.5), sy(h)), eyePaint);
    } else {
      // Sleek Sleep Slits
      final slitPaint = Paint()
        ..color = themeColor.withValues(alpha: 0.75)
        ..style = PaintingStyle.stroke
        ..strokeWidth = sx(2.2)
        ..strokeCap = StrokeCap.round;

      canvas.drawLine(Offset(sx(28), sy(37)), Offset(sx(43), sy(37)), slitPaint);
      canvas.drawLine(Offset(sx(57), sy(37)), Offset(sx(72), sy(37)), slitPaint);
    }

    if (dx != 0 || dy != 0) {
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant MascotEyesStaticPainter oldDelegate) {
    return oldDelegate.status != status ||
        oldDelegate.isHovered != isHovered ||
        oldDelegate.gazeOffset != gazeOffset ||
        oldDelegate.eyeOpenness != eyeOpenness;
  }
}

class MascotOrbitalRingStaticPainter extends CustomPainter {
  final Color themeColor;

  const MascotOrbitalRingStaticPainter({required this.themeColor});

  @override
  void paint(Canvas canvas, Size size) {
    double sx(double x) => x * size.width / 100.0;
    double sy(double y) => y * size.height / 100.0;

    final ringPaint = Paint()
      ..color = themeColor.withValues(alpha: 0.4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = sx(1.6);
    canvas.drawCircle(Offset(sx(50), sy(50)), sx(47), ringPaint);

    final arcPaint = Paint()
      ..color = themeColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = sx(2.8)
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(center: Offset(sx(50), sy(50)), radius: sx(47)),
      0.0,
      math.pi * 0.7,
      false,
      arcPaint,
    );

    canvas.drawArc(
      Rect.fromCircle(center: Offset(sx(50), sy(50)), radius: sx(47)),
      math.pi,
      math.pi * 0.35,
      false,
      arcPaint,
    );
  }

  @override
  bool shouldRepaint(covariant MascotOrbitalRingStaticPainter oldDelegate) {
    return oldDelegate.themeColor != themeColor;
  }
}


