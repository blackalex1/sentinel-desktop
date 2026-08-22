import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:window_manager/window_manager.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/models/connection_status.dart';
import 'mascot_state_machine.dart';
import 'optimized_mascot_painter.dart';

/// Maps the app's ConnectionStatus to the mascot's internal MascotStatus.
MascotStatus _toMascotStatus(ConnectionStatus cs) {
  switch (cs) {
    case ConnectionStatus.connected:
      return MascotStatus.connected;
    case ConnectionStatus.connecting:
    case ConnectionStatus.disconnecting:
      return MascotStatus.connecting;
    case ConnectionStatus.error:
      return MascotStatus.alert;
    case ConnectionStatus.disconnected:
      return MascotStatus.disconnected;
  }
}

/// Optimized mecha mascot widget.
///
/// Performance profile:
///   • window minimized / hidden / background tab → 0 FPS / 0% CPU (loop stopped)
///   • disconnected, no hover                     → 0 FPS / 0% CPU (true zero idle)
///   • connected ambient (breath + bob + scan)    → 30 FPS event-driven (~0.3-0.5% CPU)
///   • hover & shock                              → 30 FPS smooth physics
class MechaMascotWidget extends StatefulWidget {
  final ConnectionStatus status;
  final VoidCallback onTap;
  final double cpuUsage;
  final double size;
  final bool isVisible;

  const MechaMascotWidget({
    super.key,
    required this.status,
    required this.onTap,
    this.cpuUsage = 0.0,
    this.size = 156.0,
    this.isVisible = true,
  });

  @override
  State<MechaMascotWidget> createState() => _MechaMascotWidgetState();
}

class _MechaMascotWidgetState extends State<MechaMascotWidget>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver, WindowListener {
  late final MascotStateMachine _sm;
  Ticker? _ticker;
  Duration _lastElapsed = Duration.zero;
  bool _isLoopRunning = false;

  bool _isWindowMinimized = false;
  bool _isWindowFocused = true;
  bool _isAppResumed = true;

  bool get _canAnimate =>
      widget.isVisible &&
      !_isWindowMinimized &&
      _isWindowFocused &&
      _isAppResumed;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    windowManager.addListener(this);

    _sm = MascotStateMachine();
    _sm.addListener(_onStateChange);

    // Apply initial status
    _sm.setStatus(_toMascotStatus(widget.status));
    _sm.setCpuUsage(widget.cpuUsage);

    _checkLoopState();
  }

  @override
  void didUpdateWidget(MechaMascotWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.status != widget.status) {
      _sm.setStatus(_toMascotStatus(widget.status));
    }
    if (oldWidget.cpuUsage != widget.cpuUsage) {
      _sm.setCpuUsage(widget.cpuUsage);
    }
    if (oldWidget.isVisible != widget.isVisible) {
      _checkLoopState();
    }
  }

  // --- Window and App Lifecycle Observers ---

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _isAppResumed = state == AppLifecycleState.resumed;
    _checkLoopState();
  }

  @override
  void onWindowMinimize() {
    _isWindowMinimized = true;
    _checkLoopState();
  }

  @override
  void onWindowRestore() {
    _isWindowMinimized = false;
    _checkLoopState();
  }

  @override
  void onWindowFocus() {
    _isWindowFocused = true;
    _checkLoopState();
  }

  @override
  void onWindowBlur() {
    _isWindowFocused = false;
    _checkLoopState();
  }

  // --- Loop Control ---

  void _onStateChange() {
    _checkLoopState();
  }

  void _checkLoopState() {
    if (_canAnimate && _sm.needsAnimation) {
      if (!_isLoopRunning) {
        _startLoop();
      }
    } else {
      if (_isLoopRunning) {
        _stopLoop();
      }
    }
  }

  void _startLoop() {
    if (!_canAnimate) return;
    if (_isLoopRunning && _ticker != null && _ticker!.isActive) return;

    _isLoopRunning = true;
    _lastElapsed = Duration.zero;

    _ticker?.dispose();
    _ticker = createTicker((elapsed) {
      if (!mounted || !_canAnimate) {
        _stopLoop();
        return;
      }
      final dt = _lastElapsed == Duration.zero
          ? 0.016
          : ((elapsed - _lastElapsed).inMicroseconds / 1000000.0).clamp(0.001, 0.1);
      _lastElapsed = elapsed;

      final stillActive = _sm.updatePhysics(dt);
      if (!stillActive) {
        _stopLoop();
      }
    });

    _ticker!.start();
  }

  void _stopLoop() {
    _ticker?.stop();
    _ticker?.dispose();
    _ticker = null;
    _isLoopRunning = false;
    _lastElapsed = Duration.zero;
  }

  @override
  void dispose() {
    _stopLoop();
    _ticker?.dispose();
    _ticker = null;
    windowManager.removeListener(this);
    WidgetsBinding.instance.removeObserver(this);
    _sm.removeListener(_onStateChange);
    _sm.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isConnected = widget.status == ConnectionStatus.connected;
    final isConnecting = widget.status == ConnectionStatus.connecting ||
        widget.status == ConnectionStatus.disconnecting;
    final isError = widget.status == ConnectionStatus.error;

    final borderColor = isConnected
        ? AppColors.neonCyan.withValues(alpha: 0.6)
        : (isConnecting
            ? AppColors.neonAmber.withValues(alpha: 0.6)
            : (isError
                ? AppColors.neonRed.withValues(alpha: 0.6)
                : AppColors.borderSubtle));

    return RepaintBoundary(
      child: MouseRegion(
        onHover: (e) {
          final box = context.findRenderObject() as RenderBox?;
          if (box != null) {
            final local = box.globalToLocal(e.position);
            final center = Offset(box.size.width / 2, box.size.height / 2);
            final dx = (local.dx - center.dx) / (box.size.width / 2);
            final dy = (local.dy - center.dy) / (box.size.height / 2);
            _sm.updateMouseGaze(Offset(dx.clamp(-1.0, 1.0), dy.clamp(-1.0, 1.0)));
          }
        },
        onExit: (_) => _sm.onMouseLeave(),
        cursor: SystemMouseCursors.click,
        child: GestureDetector(
          onTap: () {
            _sm.triggerShock();
            widget.onTap();
          },
          child: Container(
            width: widget.size,
            height: widget.size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.bgSurface.withValues(alpha: 0.9),
              border: Border.all(color: borderColor, width: 1.5),
            ),
            child: RepaintBoundary(
              child: CustomPaint(
                size: Size(widget.size, widget.size),
                painter: OptimizedMascotPainter(sm: _sm),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
