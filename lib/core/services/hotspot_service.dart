import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../models/server_model.dart';

class HotspotDiscoveryResult {
  final bool found;
  final String gatewayIP;
  final int pairingPort;
  final String proxyType;
  final int socksPort;
  final int httpPort;
  final bool authRequired;
  final String? username;
  final String? password;
  final String? errorMessage;

  const HotspotDiscoveryResult({
    required this.found,
    required this.gatewayIP,
    this.pairingPort = 18080,
    this.proxyType = 'SOCKS5',
    this.socksPort = 10808,
    this.httpPort = 10809,
    this.authRequired = false,
    this.username,
    this.password,
    this.errorMessage,
  });
}

class HotspotService {
  static final HotspotService instance = HotspotService._();
  HotspotService._();

  static const List<int> candidatePorts = [18080, 18081, 18082, 19080, 19081];

  /// Discovers active default gateways on Windows
  Future<List<String>> getCandidateGateways() async {
    final Set<String> gateways = {};

    try {
      final res = await Process.run('cmd', ['/c', 'route print 0.0.0.0']);
      if (res.exitCode == 0) {
        final lines = res.stdout.toString().split('\n');
        for (final line in lines) {
          final fields = line.trim().split(RegExp(r'\s+'));
          if (fields.length >= 5 && fields[0] == '0.0.0.0' && fields[1] == '0.0.0.0') {
            final gw = fields[2];
            if (gw != '0.0.0.0' && !gw.startsWith('127.')) {
              gateways.add(gw);
            }
          }
        }
      }
    } catch (_) {}

    // Also inspect local non-loopback network interfaces
    try {
      final ifaces = await NetworkInterface.list(type: InternetAddressType.IPv4);
      for (final iface in ifaces) {
        for (final addr in iface.addresses) {
          final ip = addr.address;
          if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
            // e.g. 192.168.43.50 -> suggest 192.168.43.1
            final lastDot = ip.lastIndexOf('.');
            if (lastDot != -1) {
              final subnetGw = '${ip.substring(0, lastDot)}.1';
              gateways.add(subnetGw);
            }
          }
        }
      }
    } catch (_) {}

    if (gateways.isEmpty) {
      gateways.add('10.60.133.124');
      gateways.add('192.168.43.1');
      gateways.add('192.168.1.1');
    }

    return gateways.toList();
  }

  /// Probes for Sentinel Phone pairing server on target gateway
  Future<HotspotDiscoveryResult> probePairingServer(String targetIP) async {
    final ip = targetIP.trim();
    if (ip.isEmpty) {
      return const HotspotDiscoveryResult(
        found: false,
        gatewayIP: '',
        errorMessage: 'Укажите IP-адрес шлюза',
      );
    }

    for (final port in candidatePorts) {
      try {
        final pingUri = Uri.parse('http://$ip:$port/pair/ping');
        final client = http.Client();
        final resp = await client.get(pingUri).timeout(const Duration(milliseconds: 1500));
        client.close();

        if (resp.statusCode == 200) {
          // Found! Now fetch pairing config
          try {
            final cfgUri = Uri.parse('http://$ip:$port/pair/config');
            final cfgClient = http.Client();
            final cfgResp = await cfgClient.get(cfgUri).timeout(const Duration(milliseconds: 2000));
            cfgClient.close();

            if (cfgResp.statusCode == 200) {
              final data = jsonDecode(cfgResp.body) as Map<String, dynamic>;
              return HotspotDiscoveryResult(
                found: true,
                gatewayIP: ip,
                pairingPort: port,
                proxyType: (data['proxyType'] as String?) ?? 'SOCKS5',
                socksPort: (data['socksPort'] as int?) ?? (data['port'] as int?) ?? 10808,
                httpPort: (data['httpPort'] as int?) ?? 10809,
                authRequired: (data['authRequired'] as bool?) ?? false,
                username: data['username'] as String?,
                password: data['password'] as String?,
              );
            }
          } catch (_) {}

          return HotspotDiscoveryResult(
            found: true,
            gatewayIP: ip,
            pairingPort: port,
            proxyType: 'SOCKS5',
            socksPort: 10808,
            httpPort: 10809,
          );
        }
      } catch (_) {
        // Continue to next candidate port
      }
    }

    return HotspotDiscoveryResult(
      found: false,
      gatewayIP: ip,
      errorMessage: 'Телефон не найден на шлюзе $ip (порты: ${candidatePorts.join(", ")})',
    );
  }

  /// Sends interactive PIN code request to Sentinel Phone and waits for user confirmation
  Future<Map<String, dynamic>> requestPairingWithPIN({
    required String gatewayIP,
    int pairingPort = 18080,
    required String pinCode,
    String clientName = 'Sentinel Windows Desktop',
  }) async {
    final reqUri = Uri.parse('http://$gatewayIP:$pairingPort/pair/request');
    final payload = jsonEncode({
      'clientName': clientName,
      'pinCode': pinCode,
    });

    try {
      final client = http.Client();
      final resp = await client.post(
        reqUri,
        headers: {'Content-Type': 'application/json'},
        body: payload,
      ).timeout(const Duration(seconds: 35));
      client.close();

      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body) as Map<String, dynamic>;
        data['gatewayIP'] = gatewayIP;
        data['pairingPort'] = pairingPort;
        return data;
      } else {
        return {
          'success': false,
          'error': 'Сервер телефона вернул ошибку: HTTP ${resp.statusCode}',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'error': 'Таймаут или ошибка связи с телефоном: $e',
      };
    }
  }

  /// Creates a ServerModel from pairing response
  ServerModel createHotspotServer({
    required String gatewayIP,
    required int port,
    String protocol = 'socks',
    String? username,
    String? password,
  }) {
    return ServerModel(
      id: 'hotspot-phone-${DateTime.now().millisecondsSinceEpoch}',
      name: '📱 Sentinel Phone ($gatewayIP)',
      address: gatewayIP,
      port: port,
      protocol: protocol.toLowerCase().contains('http') ? 'http' : 'socks',
      username: username,
      password: password,
      countryCode: 'LAN',
    );
  }
}
