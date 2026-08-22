import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';

/// Internal mascot status — maps from ConnectionStatus in the widget layer.
enum MascotStatus {
  disconnected,
  connecting,
  connected,
  alert,
}

class SparkParticle {
  double x, y, vx, vy, life, size;
  Color color;
  SparkParticle({
    required this.x, required this.y,
    required this.vx, required this.vy,
    required this.life, required this.size,
    required this.color,
  });
}

class ElectricArc {
  double fromX, fromY, toX, toY, life, midX, midY;
  Color color;
  ElectricArc({
    required this.fromX, required this.fromY,
    required this.toX, required this.toY,
    required this.life, required this.color,
    required this.midX, required this.midY,
  });
}

class MascotStateMachine extends ChangeNotifier {
  MascotStatus _status = MascotStatus.disconnected;

  double _cpuUsage = 0.0;

  // Sleep
  double _sleepProgress = 1.0;
  double _targetSleepProgress = 1.0;

  // Eye
  double _eyeOpenness = 0.0;
  double _eyeTargetOpenness = 0.0;
  double _blinkTimer = 0.0;
  double _nextBlinkTime = 4000.0;

  // Gaze
  Offset _gaze = Offset.zero;
  Offset _targetGaze = Offset.zero;
  bool _isHovered = false;

  // Shock
  bool _isShocking = false;
  double _shockTimer = 0.0;
  final double _shockDuration = 0.65;
  final List<SparkParticle> _sparks = [];
  final List<ElectricArc> _arcs = [];

  // Color
  Color _currentColor = AppColors.neonViolet;
  Color _targetColor = AppColors.neonViolet;

  // Animation time (drives arc rotation, breath, bob, scan — no DateTime.now() in paint)
  double _animTime = 0.0;

  // State
  bool _needsAnimation = false;
  bool _isIdleSleeping = true;

  // Getters
  MascotStatus get status => _status;
  double get cpuUsage => _cpuUsage;
  double get sleepProgress => _sleepProgress;
  double get eyeOpenness => _eyeOpenness;
  Offset get gaze => _gaze;
  bool get isHovered => _isHovered;
  bool get isShocking => _isShocking;
  double get shockProgress => _shockDuration > 0 ? (_shockTimer / _shockDuration).clamp(0.0, 1.0) : 0.0;
  List<SparkParticle> get sparks => _sparks;
  List<ElectricArc> get arcs => _arcs;
  Color get currentColor => _currentColor;
  bool get needsAnimation => _needsAnimation;
  bool get isIdleSleeping => _isIdleSleeping;

  double get animTime => _animTime;
  double get breathPhase => _animTime * math.pi * 0.6;
  double get bobPhase => _animTime * 0.5;
  double get scanPhase => (_animTime * 0.7) % 1.0;

  void setLastFrameTime(double ms) { /* lightweight no-op for perf tracking */ }

  void wakeUp() {
    _needsAnimation = true;
    _isIdleSleeping = false;
    notifyListeners();
  }

  void setStatus(MascotStatus status) {
    _status = status;
    switch (status) {
      case MascotStatus.connected:
        _targetSleepProgress = 0.0;
        _eyeTargetOpenness = 1.0;
        _targetColor = _cpuUsage > 80 ? AppColors.neonRed : AppColors.neonCyan;
        triggerMicroSparks(6);
        break;
      case MascotStatus.connecting:
        _targetSleepProgress = 0.0;
        _eyeTargetOpenness = 1.0;
        _targetColor = AppColors.neonAmber;
        break;
      case MascotStatus.alert:
        _targetSleepProgress = 0.0;
        _eyeTargetOpenness = 1.0;
        _targetColor = AppColors.neonRed;
        triggerMicroSparks(8);
        break;
      case MascotStatus.disconnected:
        _targetSleepProgress = 1.0;
        _eyeTargetOpenness = 0.0;
        _targetColor = AppColors.neonViolet;
        _targetGaze = Offset.zero;
        break;
    }
    wakeUp();
  }

  void setCpuUsage(double cpu) {
    _cpuUsage = cpu.clamp(0.0, 100.0);
    if (_status == MascotStatus.connected) {
      _targetColor = _cpuUsage > 80 ? AppColors.neonRed : AppColors.neonCyan;
    }
    wakeUp();
  }

  void updateMouseGaze(Offset normalizedGaze) {
    _isHovered = true;
    _targetGaze = Offset(
      normalizedGaze.dx.clamp(-1.0, 1.0),
      normalizedGaze.dy.clamp(-1.0, 1.0),
    );
    wakeUp();
  }

  void onMouseLeave() {
    _isHovered = false;
    _targetGaze = Offset.zero;
    wakeUp();
  }

  void triggerShock() {
    _isShocking = true;
    _shockTimer = 0.0;
    _sparks.clear();
    final rand = math.Random();
    for (int i = 0; i < 12; i++) {
      final angle = (i / 12.0) * math.pi * 2 + (rand.nextDouble() - 0.5) * 0.3;
      final speed = 35.0 + rand.nextDouble() * 45.0;
      _sparks.add(SparkParticle(
        x: 50, y: 56,
        vx: math.cos(angle) * speed, vy: math.sin(angle) * speed,
        life: 0.8, size: 1.6 + rand.nextDouble() * 2.0,
        color: i % 2 == 0 ? AppColors.neonCyan : AppColors.neonGreen,
      ));
    }
    _arcs.clear();
    _arcs.add(ElectricArc(fromX: 20, fromY: 6, toX: 50, toY: 58, life: 0.35,
        color: AppColors.neonCyan,
        midX: 35 + (rand.nextDouble() - 0.5) * 6,
        midY: 32 + (rand.nextDouble() - 0.5) * 6));
    _arcs.add(ElectricArc(fromX: 80, fromY: 6, toX: 50, toY: 58, life: 0.35,
        color: AppColors.neonGreen,
        midX: 65 + (rand.nextDouble() - 0.5) * 6,
        midY: 32 + (rand.nextDouble() - 0.5) * 6));
    wakeUp();
  }

  void triggerMicroSparks(int count) {
    final rand = math.Random();
    for (int i = 0; i < count; i++) {
      final angle = rand.nextDouble() * math.pi * 2;
      final speed = 18.0 + rand.nextDouble() * 30.0;
      _sparks.add(SparkParticle(
        x: 50 + (rand.nextDouble() - 0.5) * 20,
        y: 56 + (rand.nextDouble() - 0.5) * 20,
        vx: math.cos(angle) * speed, vy: math.sin(angle) * speed,
        life: 0.5 + rand.nextDouble() * 0.3,
        size: 1.2 + rand.nextDouble() * 1.5,
        color: rand.nextBool() ? AppColors.neonCyan : AppColors.neonGreen,
      ));
    }
    wakeUp();
  }

  /// Returns true while animation is still active, false when system can sleep.
  bool updatePhysics(double dt) {
    bool hasMotion = false;

    final isConnected = _status == MascotStatus.connected;
    final isConnecting = _status == MascotStatus.connecting;
    final isAlert = _status == MascotStatus.alert;
    final isAwake = isConnected || isConnecting || isAlert || _isHovered;

    if (isAwake) {
      _animTime += dt;
      hasMotion = true;
    }

    // Gaze
    final gazeDelta = (_targetGaze - _gaze).distance;
    if (gazeDelta > 0.002) {
      hasMotion = true;
      _gaze = Offset(
        _gaze.dx + (_targetGaze.dx - _gaze.dx) * (10.0 * dt),
        _gaze.dy + (_targetGaze.dy - _gaze.dy) * (10.0 * dt),
      );
    } else {
      _gaze = _targetGaze;
    }

    // Sleep
    final sleepDelta = (_targetSleepProgress - _sleepProgress).abs();
    if (sleepDelta > 0.002) {
      hasMotion = true;
      _sleepProgress += (_targetSleepProgress - _sleepProgress) * (4.5 * dt);
    } else {
      _sleepProgress = _targetSleepProgress;
    }

    // Eye blink
    if (_isHovered && _status != MascotStatus.disconnected) {
      _blinkTimer += dt * 1000;
      if (_blinkTimer > _nextBlinkTime) {
        _eyeTargetOpenness = 0.05;
        hasMotion = true;
        if (_blinkTimer > _nextBlinkTime + 120) {
          _eyeTargetOpenness = 1.0;
          _blinkTimer = 0.0;
          _nextBlinkTime = 3000 + math.Random().nextDouble() * 4000;
        }
      }
    }
    final eyeDelta = (_eyeTargetOpenness - _eyeOpenness).abs();
    if (eyeDelta > 0.005) {
      hasMotion = true;
      _eyeOpenness += (_eyeTargetOpenness - _eyeOpenness) * (6.0 * dt);
    } else {
      _eyeOpenness = _eyeTargetOpenness;
    }

    // Color lerp
    if (_currentColor != _targetColor) {
      hasMotion = true;
      _currentColor = Color.lerp(_currentColor, _targetColor, (6.0 * dt).clamp(0.0, 1.0)) ?? _targetColor;
    }

    // Shock
    if (_isShocking) {
      hasMotion = true;
      _shockTimer += dt;
      if (_shockTimer >= _shockDuration) _isShocking = false;
    }

    // Sparks
    if (_sparks.isNotEmpty) {
      hasMotion = true;
      for (int i = _sparks.length - 1; i >= 0; i--) {
        final p = _sparks[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 2.0 * dt;
        if (p.life <= 0) _sparks.removeAt(i);
      }
    }

    // Arcs
    if (_arcs.isNotEmpty) {
      hasMotion = true;
      for (int i = _arcs.length - 1; i >= 0; i--) {
        _arcs[i].life -= 3.5 * dt;
        if (_arcs[i].life <= 0) _arcs.removeAt(i);
      }
    }

    _needsAnimation = hasMotion;
    _isIdleSleeping = !hasMotion;

    if (hasMotion) notifyListeners();
    return hasMotion;
  }
}
