import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';

class BentoCard extends StatefulWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final bool isGlow;
  final Color? glowColor;

  const BentoCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.isGlow = false,
    this.glowColor,
  });

  @override
  State<BentoCard> createState() => _BentoCardState();
}

class _BentoCardState extends State<BentoCard> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final effectiveGlow = widget.glowColor ?? AppColors.primary;

    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      cursor: widget.onTap != null ? SystemMouseCursors.click : SystemMouseCursors.basic,
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: widget.padding,
          decoration: BoxDecoration(
            color: _isHovered ? AppColors.bgCardHover : AppColors.bgCard,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: widget.isGlow
                  ? effectiveGlow.withValues(alpha: 0.5)
                  : (_isHovered ? AppColors.borderGlow : AppColors.borderSubtle),
              width: widget.isGlow ? 1.5 : 1.0,
            ),
            boxShadow: [
              if (widget.isGlow || _isHovered)
                BoxShadow(
                  color: effectiveGlow.withValues(alpha: _isHovered ? 0.12 : 0.06),
                  blurRadius: 16,
                  spreadRadius: 0,
                  offset: const Offset(0, 4),
                ),
            ],
          ),
          child: widget.child,
        ),
      ),
    );
  }
}
