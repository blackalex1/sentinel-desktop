import 'package:flutter/material.dart';

class AppColors {
  // Backgrounds - Deep Space Stealth Cyberpunk v2 (Sentinel Panel)
  static const Color bgDark = Color(0xFF060812);
  static const Color bgSurface = Color(0xFF0A0D1A);
  static const Color bgCard = Color(0xFF0F1426);
  static const Color bgCardHover = Color(0xFF161D36);
  static const Color bgInput = Color(0xFF12182E);
  static const Color bgGlass = Color(0xDD0F1426);

  // Borders & Dividers
  static const Color borderSubtle = Color(0xFF1E293B);
  static const Color borderColor = Color(0x1AFFFFFF); // rgba(255, 255, 255, 0.1)
  static const Color borderGlow = Color(0x408B5CF6);
  static const Color borderActive = Color(0xFF8B5CF6);
  static const Color borderCyan = Color(0x4006B6D4);
  static const Color borderEmerald = Color(0x4010B981);

  // Primary Brand Colors (Electric Violet / Purple)
  static const Color primary = Color(0xFF8B5CF6);
  static const Color primaryHover = Color(0xFFA78BFA);
  static const Color primaryActive = Color(0xFF7C3AED);
  static const Color primaryGlow = Color(0x598B5CF6);

  // Neon Accents
  static const Color neonViolet = Color(0xFF8B5CF6);
  static const Color neonPurple = Color(0xFFA78BFA);
  static const Color neonCyan = Color(0xFF06B6D4);
  static const Color neonGreen = Color(0xFF10B981);
  static const Color neonAmber = Color(0xFFF59E0B);
  static const Color neonRed = Color(0xFFF43F5E);

  // Text Colors
  static const Color textPrimary = Color(0xFFF8FAFC);
  static const Color textSecondary = Color(0xFFCBD5E1);
  static const Color textMuted = Color(0xFF64748B);
  static const Color textDisabled = Color(0xFF475569);

  // Gradients
  static const LinearGradient brandGradient = LinearGradient(
    colors: [Color(0xFF8B5CF6), Color(0xFF6366F1)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient brandGradientHover = LinearGradient(
    colors: [Color(0xFFA78BFA), Color(0xFF818CF8)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient cardGradient = LinearGradient(
    colors: [Color(0xFF0F1426), Color(0xFF080C1A)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );
}
