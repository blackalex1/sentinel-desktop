import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/models/connection_status.dart';
import 'mecha_mascot_painter.dart';

class MascotTextureCache {
  static ui.Image? chassisDisconnected;
  static ui.Image? chassisConnected;
  static ui.Image? chassisConnecting;
  static ui.Image? chassisHovered;

  static ui.Image? eyesDisconnected;
  static ui.Image? eyesConnected;
  static ui.Image? eyesConnecting;

  static ui.Image? orbitalRingCyan;
  static ui.Image? orbitalRingViolet;
  static ui.Image? orbitalRingAmber;

  static bool isReady = false;
  static double _bakedPixelRatio = 1.0;

  static void ensureBaked(BuildContext context, double baseSize) {
    final dpr = MediaQuery.maybeOf(context)?.devicePixelRatio ?? 1.0;
    if (isReady && (_bakedPixelRatio - dpr).abs() < 0.01) {
      return;
    }

    _bakedPixelRatio = dpr;
    final pixelSize = (baseSize * dpr).toInt();
    final canvasSize = Size(baseSize * dpr, baseSize * dpr);

    // 1. Bake Chassis variations
    chassisDisconnected = _bakeChassis(canvasSize, ConnectionStatus.disconnected, false, pixelSize);
    chassisConnected = _bakeChassis(canvasSize, ConnectionStatus.connected, false, pixelSize);
    chassisConnecting = _bakeChassis(canvasSize, ConnectionStatus.connecting, false, pixelSize);
    chassisHovered = _bakeChassis(canvasSize, ConnectionStatus.disconnected, true, pixelSize);

    // 2. Bake Eyes variations
    eyesDisconnected = _bakeEyes(canvasSize, ConnectionStatus.disconnected, false, pixelSize);
    eyesConnected = _bakeEyes(canvasSize, ConnectionStatus.connected, false, pixelSize);
    eyesConnecting = _bakeEyes(canvasSize, ConnectionStatus.connecting, false, pixelSize);

    // 3. Bake Orbital Rings
    orbitalRingCyan = _bakeRing(canvasSize, AppColors.neonCyan, pixelSize);
    orbitalRingViolet = _bakeRing(canvasSize, AppColors.neonViolet, pixelSize);
    orbitalRingAmber = _bakeRing(canvasSize, AppColors.neonAmber, pixelSize);

    isReady = true;
  }

  static ui.Image _bakeChassis(Size size, ConnectionStatus status, bool isHovered, int px) {
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder, Rect.fromLTWH(0, 0, size.width, size.height));
    final painter = MascotChassisStaticPainter(status: status, isHovered: isHovered);
    painter.paint(canvas, size);
    final picture = recorder.endRecording();
    final img = picture.toImageSync(px, px);
    picture.dispose();
    return img;
  }

  static ui.Image _bakeEyes(Size size, ConnectionStatus status, bool isHovered, int px) {
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder, Rect.fromLTWH(0, 0, size.width, size.height));
    final painter = MascotEyesStaticPainter(
      status: status,
      isHovered: isHovered,
      gazeOffset: Offset.zero,
      eyeOpenness: 1.0,
    );
    painter.paint(canvas, size);
    final picture = recorder.endRecording();
    final img = picture.toImageSync(px, px);
    picture.dispose();
    return img;
  }

  static ui.Image _bakeRing(Size size, Color themeColor, int px) {
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder, Rect.fromLTWH(0, 0, size.width, size.height));
    final painter = MascotOrbitalRingStaticPainter(themeColor: themeColor);
    painter.paint(canvas, size);
    final picture = recorder.endRecording();
    final img = picture.toImageSync(px, px);
    picture.dispose();
    return img;
  }
}

class GpuTextureSpritePainter extends CustomPainter {
  final ui.Image image;

  const GpuTextureSpritePainter({required this.image});

  @override
  void paint(Canvas canvas, Size size) {
    final src = Rect.fromLTWH(0, 0, image.width.toDouble(), image.height.toDouble());
    final dst = Rect.fromLTWH(0, 0, size.width, size.height);
    canvas.drawImageRect(
      image,
      src,
      dst,
      Paint()
        ..filterQuality = FilterQuality.medium
        ..isAntiAlias = true,
    );
  }

  @override
  bool shouldRepaint(covariant GpuTextureSpritePainter oldDelegate) {
    return oldDelegate.image != image;
  }
}
