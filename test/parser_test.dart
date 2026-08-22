import 'package:flutter_test/flutter_test.dart';
import 'package:sentinel_desktop/core/models/server_model.dart';

void main() {
  test('Parses VLESS Reality link accurately', () {
    const raw = 'vless://2d66dae1-f3f9-413d-90ac-2c17b7051fa3@192.168.1.65:48423?type=tcp&security=reality&flow=xtls-rprx-vision&fp=randomized&pbk=RCz839ahUnxVh7cfuE9rc9K8iVlujFdxjbMgT2CosVg&sni=dl.astralinux.ru&sid=3b68c58f&spx=%2F#double_v2-phone';
    final server = ServerModel.fromUri(raw);

    expect(server, isNotNull);
    expect(server!.protocol, 'vless');
    expect(server.address, '192.168.1.65');
    expect(server.port, 48423);
    expect(server.uuid, '2d66dae1-f3f9-413d-90ac-2c17b7051fa3');
    expect(server.security, 'reality');
    expect(server.flow, 'xtls-rprx-vision');
    expect(server.sni, 'dl.astralinux.ru');
    expect(server.publicKey, 'RCz839ahUnxVh7cfuE9rc9K8iVlujFdxjbMgT2CosVg');
    expect(server.name, 'double_v2-phone');
  });

  group('Process Name Recognition Tests', () {
    String extractProcessName(String line) {
      String processName = 'Системный процесс';
      final procMatch = RegExp(
        r'(?:from process|by process|process[:=\s]+|user[:=\s]+)([^\s,\]\)]+)',
        caseSensitive: false,
      ).firstMatch(line);

      if (procMatch != null) {
        final rawProc = procMatch.group(1)!.trim().replaceAll(RegExp(r'^[("\]]+|[)"\]]+$'), '');
        final lastSlash = rawProc.lastIndexOf(RegExp(r'[\\/]'));
        final cleaned = lastSlash != -1 ? rawProc.substring(lastSlash + 1) : rawProc;
        if (cleaned.isNotEmpty && !cleaned.contains(':')) {
          processName = cleaned;
        }
      }
      return processName;
    }

    test('Recognizes powershell.exe from sing-box log', () {
      const line = 'INFO [12345678] inbound/tun[tun-in]: inbound connection to 198.51.100.22:22 from process powershell.exe';
      expect(extractProcessName(line), equals('powershell.exe'));
    });

    test('Extracts base name from Windows full path', () {
      const line = r'INFO [12345678] inbound/tun[tun-in]: inbound connection to 198.51.100.22:22 from process C:\Windows\System32\OpenSSH\ssh.exe';
      expect(extractProcessName(line), equals('ssh.exe'));
    });

    test('Extracts base name from Unix path', () {
      const line = 'INFO [12345678] inbound connection to 198.51.100.22:22 from process /usr/bin/curl';
      expect(extractProcessName(line), equals('curl'));
    });

    test('Recognizes by process syntax', () {
      const line = 'INFO router: match[0] action=block for 198.51.100.22:3389 by process putty.exe';
      expect(extractProcessName(line), equals('putty.exe'));
    });

    test('Recognizes xray format with process key', () {
      const line = '[Info] app/dispatcher: default route for 198.51.100.22:22 (process: cmd.exe)';
      expect(extractProcessName(line), equals('cmd.exe'));
    });

    test('Recognizes Android app package name from user key', () {
      const line = 'INFO inbound connection to 198.51.100.22:445 from user com.termux';
      expect(extractProcessName(line), equals('com.termux'));
    });

    test('Falls back to system process when no process is present', () {
      const line = 'INFO inbound connection to 198.51.100.22:80 from 192.168.1.50:52341';
      expect(extractProcessName(line), equals('Системный процесс'));
    });
  });
}
