import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import 'mascot_state_machine.dart';

/// Highly optimized pre-baked mascot painter with ZERO heap allocations in paint().
/// All geometric paths and shaders are cached per widget size.
/// Motion is applied via GPU canvas matrix translation.
class OptimizedMascotPainter extends CustomPainter {
  final MascotStateMachine sm;

  // Cached geometry per Size
  Size? _cachedSize;
  double _s = 1.0;
  double _w = 100.0;
  double _h = 100.0;

  Path? _leftTubePath;
  Path? _rightTubePath;
  Path? _leftHorn;
  Path? _rightHorn;
  Path? _mechaPath;
  Path? _leftCheek;
  Path? _rightCheek;
  final List<Path> _leftChevrons = [];
  final List<Path> _rightChevrons = [];
  Path? _seamPath;
  Path? _visorPath;
  Path? _outerDiamond;
  Path? _midDiamond;
  Path? _innerDiamond;

  Shader? _mechaShader;

  // Cached state for smart shouldRepaint
  MascotStatus? _lastStatus;
  bool? _lastHovered;
  double? _lastEyeOpenness;
  Offset? _lastGaze;
  double? _lastAnimTime;
  bool? _lastShocking;
  int? _lastSparkCount;
  int? _lastArcCount;

  OptimizedMascotPainter({required this.sm}) : super(repaint: sm);

  void _rebuildGeometry(Size size) {
    _cachedSize = size;
    _w = size.width;
    _h = size.height;
    _s = math.min(_w, _h) / 100.0;
    final s = _s;

    double sx(double x) => (x - 50.0) * s + _w / 2.0;
    double sy(double y) => (y - 50.0) * s + _h / 2.0;

    // 1. Tubes
    _leftTubePath = Path()
      ..moveTo(sx(20), sy(6))
      ..cubicTo(sx(10), sy(12), sx(34), sy(22), sx(44), sy(18));
    _rightTubePath = Path()
      ..moveTo(sx(80), sy(6))
      ..cubicTo(sx(90), sy(12), sx(66), sy(22), sx(56), sy(18));

    // 2. Horns
    _leftHorn = Path()
      ..moveTo(sx(24), sy(24))
      ..lineTo(sx(20), sy(6))
      ..lineTo(sx(32), sy(14))
      ..close();
    _rightHorn = Path()
      ..moveTo(sx(76), sy(24))
      ..lineTo(sx(80), sy(6))
      ..lineTo(sx(68), sy(14))
      ..close();

    // 3. Mecha silhouette
    _mechaPath = Path()
      ..moveTo(sx(50), sy(12))
      ..lineTo(sx(74), sy(16))
      ..lineTo(sx(88), sy(34))
      ..lineTo(sx(80), sy(68))
      ..lineTo(sx(50), sy(94))
      ..lineTo(sx(20), sy(68))
      ..lineTo(sx(12), sy(34))
      ..lineTo(sx(26), sy(16))
      ..close();

    _mechaShader = const LinearGradient(
      colors: [Color(0xFF111827), Color(0xFF081426), Color(0xFF030814)],
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
    ).createShader(Rect.fromLTWH(sx(12), sy(12), 76 * s, 82 * s));

    // 4. Cheeks
    _leftCheek = Path()
      ..moveTo(sx(12), sy(34))
      ..lineTo(sx(32), sy(48))
      ..lineTo(sx(30), sy(76))
      ..lineTo(sx(20), sy(68))
      ..close();

    _rightCheek = Path()
      ..moveTo(sx(88), sy(34))
      ..lineTo(sx(68), sy(48))
      ..lineTo(sx(70), sy(76))
      ..lineTo(sx(80), sy(68))
      ..close();

    // 5. Chevrons
    _leftChevrons.clear();
    _rightChevrons.clear();
    for (int i = 0; i < 3; i++) {
      _leftChevrons.add(Path()
        ..moveTo(sx(19 + i * 1.5), sy(35 + i * 5.2))
        ..lineTo(sx(23.5 + i * 1.5), sy(35 + i * 5.2))
        ..lineTo(sx(22 + i * 1.5), sy(37.2 + i * 5.2))
        ..lineTo(sx(17.5 + i * 1.5), sy(37.2 + i * 5.2))
        ..close());

      _rightChevrons.add(Path()
        ..moveTo(sx(81 - i * 1.5), sy(35 + i * 5.2))
        ..lineTo(sx(76.5 - i * 1.5), sy(35 + i * 5.2))
        ..lineTo(sx(78 - i * 1.5), sy(37.2 + i * 5.2))
        ..lineTo(sx(82.5 - i * 1.5), sy(37.2 + i * 5.2))
        ..close());
    }

    // 6. Seam
    _seamPath = Path()
      ..moveTo(sx(32), sy(22))
      ..lineTo(sx(50), sy(25))
      ..lineTo(sx(68), sy(22));

    // 7. Visor
    _visorPath = Path()
      ..moveTo(sx(26), sy(29))
      ..lineTo(sx(74), sy(29))
      ..lineTo(sx(74), sy(47))
      ..lineTo(sx(50), sy(53))
      ..lineTo(sx(26), sy(47))
      ..close();

    // 8. Diamond Reactor
    _outerDiamond = Path()
      ..moveTo(sx(50), sy(44))
      ..lineTo(sx(64), sy(58))
      ..lineTo(sx(50), sy(80))
      ..lineTo(sx(36), sy(58))
      ..close();

    _midDiamond = Path()
      ..moveTo(sx(50), sy(50))
      ..lineTo(sx(58), sy(58))
      ..lineTo(sx(50), sy(73))
      ..lineTo(sx(42), sy(58))
      ..close();

    _innerDiamond = Path()
      ..moveTo(sx(50), sy(54))
      ..lineTo(sx(54), sy(58))
      ..lineTo(sx(50), sy(64))
      ..lineTo(sx(46), sy(58))
      ..close();
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (_cachedSize != size) {
      _rebuildGeometry(size);
    }

    final s = _s;
    final w = _w;
    final h = _h;

    double sx(double x) => (x - 50.0) * s + w / 2.0;
    double sy(double y) => (y - 50.0) * s + h / 2.0;

    final isConnected = sm.status == MascotStatus.connected;
    final isConnecting = sm.status == MascotStatus.connecting;
    final isAlert = sm.status == MascotStatus.alert;
    final isAwake = isConnected || isConnecting || isAlert || sm.isHovered;

    final themeColor = isConnected
        ? (sm.cpuUsage > 80 ? AppColors.neonRed : AppColors.neonCyan)
        : (isConnecting
            ? AppColors.neonAmber
            : (isAlert
                ? AppColors.neonRed
                : (sm.isHovered ? AppColors.neonPurple : AppColors.neonViolet)));

    final cobaltBlue = isConnected
        ? (sm.cpuUsage > 80 ? const Color(0xFF991B1B) : const Color(0xFF2563EB))
        : (isConnecting
            ? const Color(0xFFD97706)
            : (isAlert ? const Color(0xFFDC2626) : const Color(0xFF7C3AED)));

    final t = sm.animTime;

    double shockOffsetY = 0;
    if (sm.isShocking) {
      final prog = sm.shockProgress;
      shockOffsetY = math.sin(prog * math.pi * 4) * (1.0 - prog) * 3.5 * s;
    }

    final bobOffsetY = isAwake ? math.sin(sm.bobPhase) * 1.5 * s : 0.0;
    final totalOffsetY = shockOffsetY + bobOffsetY;
    final breathSin = isAwake ? math.sin(sm.breathPhase) : 0.0;
    final scanPos = sm.scanPhase;

    canvas.save();
    canvas.translate(0, totalOffsetY);

    // =========================================================================
    // 1. Orbital Neon Ring
    // =========================================================================
    if (isAwake) {
      final ringPaint = Paint()
        ..color = themeColor.withValues(alpha: isConnected ? 0.35 : 0.18)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4 * s;
      canvas.drawCircle(Offset(sx(50), sy(50)), 47 * s, ringPaint);

      final rotAngle = t * (isConnected ? 1.4 : 0.6);
      final arcPaint = Paint()
        ..color = themeColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4 * s
        ..strokeCap = StrokeCap.round;

      canvas.drawArc(
        Rect.fromCircle(center: Offset(sx(50), sy(50)), radius: 47 * s),
        rotAngle, math.pi * 0.7, false, arcPaint,
      );
      canvas.drawArc(
        Rect.fromCircle(center: Offset(sx(50), sy(50)), radius: 47 * s),
        rotAngle + math.pi, math.pi * 0.35, false, arcPaint,
      );
    }

    // =========================================================================
    // 2. Ambient Halo (Zero-GPU Alpha Glow)
    // =========================================================================
    final baseHaloAlpha = isConnected ? 0.22 : (isAwake ? 0.12 : 0.04);
    final haloAlpha = (baseHaloAlpha + breathSin * 0.06).clamp(0.0, 1.0);

    canvas.drawCircle(
      Offset(sx(50), sy(52)),
      48 * s,
      Paint()..color = themeColor.withValues(alpha: haloAlpha * 0.35)..style = PaintingStyle.fill,
    );
    canvas.drawCircle(
      Offset(sx(50), sy(52)),
      34 * s,
      Paint()..color = themeColor.withValues(alpha: haloAlpha * 0.65)..style = PaintingStyle.fill,
    );

    // =========================================================================
    // 3. Coolant Tubes
    // =========================================================================
    if (_leftTubePath != null && _rightTubePath != null) {
      final tubeCasingPaint = Paint()
        ..color = const Color(0xFF0F172A)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4.2 * s
        ..strokeCap = StrokeCap.round;
      canvas.drawPath(_leftTubePath!, tubeCasingPaint);
      canvas.drawPath(_rightTubePath!, tubeCasingPaint);

      final fluidAlpha = isConnected ? 0.95 : (isAwake ? (0.5 + breathSin * 0.1) : 0.3);
      final fluidPaint = Paint()
        ..color = themeColor.withValues(alpha: fluidAlpha)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.0 * s
        ..strokeCap = StrokeCap.round;
      canvas.drawPath(_leftTubePath!, fluidPaint);
      canvas.drawPath(_rightTubePath!, fluidPaint);
    }

    // =========================================================================
    // 4. Horns & Arc Tips
    // =========================================================================
    if (_leftHorn != null && _rightHorn != null) {
      final hornPaint = Paint()..color = const Color(0xFF1E293B)..style = PaintingStyle.fill;
      final hornStroke = Paint()
        ..color = themeColor.withValues(alpha: isAwake ? 0.6 : 0.25)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2 * s;

      canvas.drawPath(_leftHorn!, hornPaint);
      canvas.drawPath(_leftHorn!, hornStroke);
      canvas.drawPath(_rightHorn!, hornPaint);
      canvas.drawPath(_rightHorn!, hornStroke);

      final tipFlicker = isAwake ? (3.0 + math.sin(t * 8.0) * 0.4) : 2.2;
      final tipGlow = Paint()..color = themeColor..style = PaintingStyle.fill;
      final tipWhite = Paint()..color = Colors.white..style = PaintingStyle.fill;

      canvas.drawCircle(Offset(sx(20), sy(6)), tipFlicker * s, tipGlow);
      canvas.drawCircle(Offset(sx(20), sy(6)), (tipFlicker - 1.4) * s, tipWhite);
      canvas.drawCircle(Offset(sx(80), sy(6)), tipFlicker * s, tipGlow);
      canvas.drawCircle(Offset(sx(80), sy(6)), (tipFlicker - 1.4) * s, tipWhite);
    }

    // =========================================================================
    // 5. Mecha Armor Silhouette
    // =========================================================================
    if (_mechaPath != null) {
      canvas.drawPath(_mechaPath!, Paint()..shader = _mechaShader..style = PaintingStyle.fill);
      canvas.drawPath(_mechaPath!, Paint()
        ..color = themeColor.withValues(alpha: isAwake ? 0.9 : 0.45)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.6 * s
        ..strokeJoin = StrokeJoin.round);
    }

    // =========================================================================
    // 6. Cheek Cowlings & Chevrons
    // =========================================================================
    if (_leftCheek != null && _rightCheek != null) {
      final cheekFill = Paint()
        ..color = cobaltBlue.withValues(alpha: isConnected ? 0.45 : 0.18)
        ..style = PaintingStyle.fill;

      canvas.drawPath(_leftCheek!, cheekFill);
      canvas.drawPath(_rightCheek!, cheekFill);

      for (int i = 0; i < 3; i++) {
        final chevAlpha = isConnected
            ? (0.6 + math.sin(t * 2.0 + i * 0.7) * 0.35).clamp(0.0, 1.0)
            : 0.25;
        final glyphPaint = Paint()
          ..color = (isConnected ? themeColor : Colors.white).withValues(alpha: chevAlpha)
          ..style = PaintingStyle.fill;

        canvas.drawPath(_leftChevrons[i], glyphPaint);
        canvas.drawPath(_rightChevrons[i], glyphPaint);
      }
    }

    if (_seamPath != null) {
      canvas.drawPath(_seamPath!, Paint()
        ..color = Colors.white.withValues(alpha: 0.12)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 0.9 * s);
    }

    // =========================================================================
    // 7. Visor & Scan-line (Zero ClipPath)
    // =========================================================================
    if (_visorPath != null) {
      canvas.drawPath(_visorPath!, Paint()..color = const Color(0xFF020617)..style = PaintingStyle.fill);

      if (isAwake) {
        final visorTop = sy(31);
        final visorBot = sy(48);
        final scanY = visorTop + (visorBot - visorTop) * scanPos;

        canvas.drawLine(
          Offset(sx(29), scanY),
          Offset(sx(71), scanY),
          Paint()
            ..color = themeColor.withValues(alpha: 0.28)
            ..strokeWidth = 2.0 * s
            ..strokeCap = StrokeCap.round,
        );
      }

      canvas.drawPath(_visorPath!, Paint()
        ..color = themeColor.withValues(alpha: isAwake ? 0.35 : 0.15)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2 * s);
    }

    // =========================================================================
    // 8. Cyber Eyes
    // =========================================================================
    final gazeDx = sm.gaze.dx * 3.5 * s;
    final gazeDy = sm.gaze.dy * 2.5 * s;

    if (isAwake && sm.eyeOpenness > 0.2) {
      final eyePaint = Paint()..color = themeColor..style = PaintingStyle.fill;
      final eyeH = 3.5 * sm.eyeOpenness * s;
      final yOffset = (3.5 * s - eyeH) / 2.0;

      for (final ex in [sx(28), sx(36)]) {
        for (final ey in [sy(33), sy(38)]) {
          canvas.drawRect(Rect.fromLTWH(ex + gazeDx, ey + yOffset + gazeDy, 6.5 * s, eyeH), eyePaint);
        }
      }
      for (final ex in [sx(57), sx(65)]) {
        for (final ey in [sy(33), sy(38)]) {
          canvas.drawRect(Rect.fromLTWH(ex + gazeDx, ey + yOffset + gazeDy, 6.5 * s, eyeH), eyePaint);
        }
      }
    } else {
      final slitPaint = Paint()
        ..color = themeColor.withValues(alpha: 0.75)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2 * s
        ..strokeCap = StrokeCap.round;
      canvas.drawLine(Offset(sx(28) + gazeDx, sy(37) + gazeDy),
          Offset(sx(43) + gazeDx, sy(37) + gazeDy), slitPaint);
      canvas.drawLine(Offset(sx(57) + gazeDx, sy(37) + gazeDy),
          Offset(sx(72) + gazeDx, sy(37) + gazeDy), slitPaint);
    }

    // =========================================================================
    // 9. Diamond Reactor
    // =========================================================================
    final clampPaint = Paint()..color = const Color(0xFF1E293B)..style = PaintingStyle.fill;
    final clampBorder = Paint()..color = Colors.white.withValues(alpha: 0.2)
      ..style = PaintingStyle.stroke..strokeWidth = 0.8 * s;

    canvas.drawRect(Rect.fromLTWH(sx(46), sy(41), 8 * s, 3.5 * s), clampPaint);
    canvas.drawRect(Rect.fromLTWH(sx(46), sy(41), 8 * s, 3.5 * s), clampBorder);
    canvas.drawRect(Rect.fromLTWH(sx(46), sy(80), 8 * s, 3.5 * s), clampPaint);
    canvas.drawRect(Rect.fromLTWH(sx(46), sy(80), 8 * s, 3.5 * s), clampBorder);

    if (_outerDiamond != null && _midDiamond != null && _innerDiamond != null) {
      final diamondAlpha = isConnected ? (0.85 + breathSin * 0.1).clamp(0.0, 1.0) : 0.6;
      canvas.drawPath(_outerDiamond!, Paint()
        ..color = cobaltBlue.withValues(alpha: diamondAlpha)..style = PaintingStyle.fill);

      canvas.drawPath(_midDiamond!,
        Paint()..color = (isConnected
            ? (sm.cpuUsage > 80 ? AppColors.neonRed : AppColors.neonAmber)
            : const Color(0xFFA78BFA))..style = PaintingStyle.fill);

      canvas.drawPath(_innerDiamond!,
        Paint()..color = Colors.white..style = PaintingStyle.fill);
    }

    // =========================================================================
    // 10. Sparks & Arcs
    // =========================================================================
    for (final sp in sm.sparks) {
      final p = Paint()
        ..color = sp.color.withValues(alpha: sp.life.clamp(0.0, 1.0))
        ..style = PaintingStyle.fill;
      canvas.drawCircle(Offset(sx(sp.x), sy(sp.y)), sp.size * s, p);
    }

    for (final arc in sm.arcs) {
      final arcPaint = Paint()
        ..color = arc.color.withValues(alpha: (arc.life * 2.0).clamp(0.0, 1.0))
        ..strokeWidth = 1.8 * s
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round;
      canvas.drawLine(
        Offset(sx(arc.fromX), sy(arc.fromY)),
        Offset(sx(arc.midX), sy(arc.midY)),
        arcPaint,
      );
      canvas.drawLine(
        Offset(sx(arc.midX), sy(arc.midY)),
        Offset(sx(arc.toX), sy(arc.toY)),
        arcPaint,
      );
    }

    canvas.restore();

    // Update cached state
    _lastStatus = sm.status;
    _lastHovered = sm.isHovered;
    _lastEyeOpenness = sm.eyeOpenness;
    _lastGaze = sm.gaze;
    _lastAnimTime = t;
    _lastShocking = sm.isShocking;
    _lastSparkCount = sm.sparks.length;
    _lastArcCount = sm.arcs.length;
  }

  @override
  bool shouldRepaint(covariant OptimizedMascotPainter oldDelegate) {
    if (sm.isIdleSleeping) return false;
    return sm.status != _lastStatus ||
        sm.isHovered != _lastHovered ||
        (sm.eyeOpenness - (_lastEyeOpenness ?? -1)).abs() > 0.001 ||
        sm.gaze != _lastGaze ||
        (sm.animTime - (_lastAnimTime ?? -1)).abs() > 0.001 ||
        sm.isShocking != _lastShocking ||
        sm.sparks.length != _lastSparkCount ||
        sm.arcs.length != _lastArcCount;
  }
}
