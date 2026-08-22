import 'package:flutter/material.dart';
import '../../../core/models/connection_status.dart';
import 'tactical_radar_painter.dart';

class TacticalRadarWidget extends StatefulWidget {
  final ConnectionStatus status;

  const TacticalRadarWidget({super.key, required this.status});

  @override
  State<TacticalRadarWidget> createState() => _TacticalRadarWidgetState();
}

class _TacticalRadarWidgetState extends State<TacticalRadarWidget> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    );

    _updateAnimationState();
  }

  @override
  void didUpdateWidget(covariant TacticalRadarWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.status != widget.status) {
      _updateAnimationState();
    }
  }

  void _updateAnimationState() {
    if (widget.status == ConnectionStatus.connected || widget.status == ConnectionStatus.connecting) {
      if (!_controller.isAnimating) {
        _controller.repeat();
      }
    } else {
      if (_controller.isAnimating) {
        _controller.stop();
        _controller.value = 0.0;
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isConnected = widget.status == ConnectionStatus.connected;
    final isConnecting = widget.status == ConnectionStatus.connecting;
    final isAwake = isConnected || isConnecting;

    return SizedBox(
      width: 260,
      height: 260,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // 1. Static Radar Grid (0 Repaints)
          RepaintBoundary(
            child: CustomPaint(
              size: const Size(260, 260),
              painter: RadarGridStaticPainter(isConnected: isConnected),
            ),
          ),

          // 2. Hardware Matrix-Rotated Radar Beam Texture (0 Repaints)
          if (isAwake)
            RepaintBoundary(
              child: RotationTransition(
                turns: _controller,
                child: CustomPaint(
                  size: const Size(260, 260),
                  painter: RadarBeamStaticPainter(
                    glowAlpha: isConnected ? 1.0 : 0.6,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

