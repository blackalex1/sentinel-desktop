import 'dart:ffi';
import 'dart:io';
import 'dart:isolate';
import 'package:flutter/foundation.dart';

typedef InternetSetOptionWNative = Int32 Function(
  IntPtr hInternet,
  Uint32 dwOption,
  Pointer<Void> lpBuffer,
  Uint32 dwBufferLength,
);
typedef InternetSetOptionWDart = int Function(
  int hInternet,
  int dwOption,
  Pointer<Void> lpBuffer,
  int dwBufferLength,
);

class WindowsNetManager {
  static void refreshWinINet() {
    Isolate.run(() {
      try {
        final lib = DynamicLibrary.open('wininet.dll');
        final fn = lib.lookupFunction<InternetSetOptionWNative, InternetSetOptionWDart>('InternetSetOptionW');
        // 39 = INTERNET_OPTION_SETTINGS_CHANGED, 37 = INTERNET_OPTION_REFRESH
        fn(0, 39, nullptr, 0);
        fn(0, 37, nullptr, 0);
      } catch (_) {}
    }).ignore();
  }

  static Future<bool> isPortAvailable(int port) async {
    try {
      final server = await ServerSocket.bind(InternetAddress.loopbackIPv4, port);
      await server.close();
      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<int> findAvailablePort(int preferredPort, {int maxAttempts = 50}) async {
    for (int i = 0; i < maxAttempts; i++) {
      final port = preferredPort + i;
      if (await isPortAvailable(port)) {
        return port;
      }
    }
    return preferredPort;
  }

  static Future<void> enableSystemProxy({
    required int httpPort,
    int? socksPort,
    String bypass = '<local>;localhost;127.*;10.*;192.168.*;172.16.*;172.17.*;172.18.*;172.19.*;172.20.*;172.21.*;172.22.*;172.23.*;172.24.*;172.25.*;172.26.*;172.27.*;172.28.*;172.29.*;172.30.*;172.31.*',
  }) async {
    await Isolate.run(() async {
      try {
        final proxyServer = 'http=127.0.0.1:$httpPort;https=127.0.0.1:$httpPort';

        await Process.run('reg', [
          'add',
          r'HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings',
          '/v',
          'ProxyEnable',
          '/t',
          'REG_DWORD',
          '/d',
          '1',
          '/f',
        ]);

        await Process.run('reg', [
          'add',
          r'HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings',
          '/v',
          'ProxyServer',
          '/t',
          'REG_SZ',
          '/d',
          proxyServer,
          '/f',
        ]);

        await Process.run('reg', [
          'add',
          r'HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings',
          '/v',
          'ProxyOverride',
          '/t',
          'REG_SZ',
          '/d',
          bypass,
          '/f',
        ]);

        refreshWinINet();
        debugPrint('[WindowsNet] System proxy enabled in background: $proxyServer');
      } catch (e) {
        debugPrint('[WindowsNet] Error enabling system proxy: $e');
      }
    });
  }

  static Future<void> disableSystemProxy() async {
    await Isolate.run(() async {
      try {
        await Process.run('reg', [
          'add',
          r'HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings',
          '/v',
          'ProxyEnable',
          '/t',
          'REG_DWORD',
          '/d',
          '0',
          '/f',
        ]);

        refreshWinINet();
        debugPrint('[WindowsNet] System proxy disabled in background.');
      } catch (e) {
        debugPrint('[WindowsNet] Error disabling system proxy: $e');
      }
    });
  }

  static Future<void> killExistingCores() async {
    await Isolate.run(() async {
      for (final name in ['sing-box.exe', 'xray.exe', 'wxray.exe', 'hysteria.exe', 'mihomo.exe']) {
        try {
          await Process.run('taskkill', ['/F', '/T', '/IM', name]);
        } catch (_) {}
      }
    });
  }
}
