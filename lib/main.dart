import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:window_manager/window_manager.dart';
import 'core/constants/app_colors.dart';
import 'core/providers/app_state_provider.dart';
import 'ui/screens/main_shell_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Windows Window Manager
  await windowManager.ensureInitialized();

  const windowOptions = WindowOptions(
    size: Size(980, 760),
    minimumSize: Size(780, 620),
    center: true,
    backgroundColor: Colors.transparent,
    skipTaskbar: false,
    titleBarStyle: TitleBarStyle.hidden,
  );

  windowManager.waitUntilReadyToShow(windowOptions, () async {
    await windowManager.show();
    await windowManager.focus();
  });

  final appState = AppStateProvider();
  await appState.init();

  runApp(
    ChangeNotifierProvider.value(
      value: appState,
      child: const SentinelDesktopApp(),
    ),
  );
}

class SentinelDesktopApp extends StatelessWidget {
  const SentinelDesktopApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Sentinel Secure Desktop',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: AppColors.bgDark,
        colorScheme: const ColorScheme.dark(
          primary: AppColors.primary,
          secondary: AppColors.primaryHover,
          surface: AppColors.bgSurface,
        ),
        fontFamily: 'Segoe UI',
      ),
      home: const MainShellScreen(),
    );
  }
}
