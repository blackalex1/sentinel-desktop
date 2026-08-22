import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../widgets/custom_titlebar.dart';
import '../widgets/sidebar_navigation.dart';
import 'cores_screen.dart';
import 'dashboard_screen.dart';
import 'hotspot_screen.dart';
import 'logs_screen.dart';
import 'routing_screen.dart';
import 'servers_screen.dart';
import 'settings_screen.dart';
import 'threats_screen.dart';

class MainShellScreen extends StatefulWidget {
  const MainShellScreen({super.key});

  @override
  State<MainShellScreen> createState() => _MainShellScreenState();
}

class _MainShellScreenState extends State<MainShellScreen> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final screens = [
      DashboardScreen(isVisible: _selectedIndex == 0),
      const ServersScreen(),
      const RoutingScreen(),
      const CoresScreen(),
      const ThreatsScreen(),
      const HotspotScreen(),
      const LogsScreen(),
      const SettingsScreen(),
    ];

    return Scaffold(
      backgroundColor: AppColors.bgDark,
      body: Column(
        children: [
          // Windows Frameless Titlebar
          const CustomTitlebar(),

          // Main App Workspace (Sidebar + Screen View)
          Expanded(
            child: Row(
              children: [
                SidebarNavigation(
                  selectedIndex: _selectedIndex,
                  onDestinationSelected: (index) => setState(() => _selectedIndex = index),
                ),
                Expanded(
                  child: Container(
                    color: AppColors.bgDark,
                    child: IndexedStack(
                      index: _selectedIndex,
                      children: screens,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
