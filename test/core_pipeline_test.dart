// ignore_for_file: avoid_print
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:sentinel_desktop/core/ffi/sentinel_core_bindings.dart';
import 'package:sentinel_desktop/core/models/server_model.dart';

void main() {
  late String dllPath;

  setUpAll(() {
    dllPath = '${Directory.current.path}/dist_native/sentinel-core.dll';
    if (!File(dllPath).existsSync()) {
      dllPath = '${Directory.current.path}/sentinel-core.dll';
    }
    expect(File(dllPath).existsSync(), isTrue, reason: 'sentinel-core.dll must exist');
    SentinelCoreBindings.instance.init(customPath: dllPath);
  });

  group('1. Sentinel Core FFI Loading & Versioning', () {
    test('Library initializes and returns non-empty engine version', () {
      expect(SentinelCoreBindings.instance.isLoaded, isTrue);
      final version = SentinelCoreBindings.instance.getEngineVersion();
      expect(version, isNotEmpty);
      print('✅ Sentinel Core Version: $version');
    });
  });

  group('2. Config Compilation Pipeline (Dart -> Core -> JSON)', () {
    test('Compiles valid Sing-box client config from VLESS Reality spec', () {
      const vlessUri =
          'vless://2d66dae1-f3f9-413d-90ac-2c17b7051fa3@192.168.1.65:48423?type=tcp&security=reality&flow=xtls-rprx-vision&fp=randomized&pbk=RCz839ahUnxVh7cfuE9rc9K8iVlujFdxjbMgT2CosVg&sni=dl.astralinux.ru&sid=3b68c58f#test-vless';
      final server = ServerModel.fromUri(vlessUri);
      expect(server, isNotNull);

      final spec = {
        'targetCore': 'singbox',
        'coreVersion': '1.13',
        'logLevel': 'info',
        'serverNode': server!.toJson(),
        'clashApiAddress': '127.0.0.1:9090',
        'clientInbound': {
          'mode': 'system_proxy',
          'socksPort': 10808,
          'httpPort': 10809,
          'tunInterfaceName': 'Sentinel-TUN',
          'autoRoute': true,
          'strictRoute': false,
        },
        'routing': {
          'mode': 'smart_rule',
          'enabledPresets': ['ru_services', 'adblock'],
          'customRules': [
            {
              'name': 'Direct Local LAN',
              'enabled': true,
              'target': 'direct',
              'domains': [],
              'ips': ['192.168.0.0/16', '10.0.0.0/8'],
            },
          ],
        },
      };

      final specJson = jsonEncode(spec);
      final rawResult = SentinelCoreBindings.instance.buildConfig(specJson);
      expect(rawResult, isNotEmpty);

      final result = jsonDecode(rawResult) as Map<String, dynamic>;
      expect(result.containsKey('configJson'), isTrue, reason: 'Must contain configJson key');
      
      final configJsonStr = result['configJson'] as String;
      expect(configJsonStr, isNotEmpty);

      final config = jsonDecode(configJsonStr) as Map<String, dynamic>;
      expect(config.containsKey('inbounds'), isTrue);
      expect(config.containsKey('outbounds'), isTrue);
      expect(config.containsKey('route'), isTrue);

      final inbounds = config['inbounds'] as List;
      expect(inbounds.any((i) => i['type'] == 'socks' && i['listen_port'] == 10808), isTrue);
      expect(inbounds.any((i) => i['type'] == 'http' && i['listen_port'] == 10809), isTrue);

      final outbounds = config['outbounds'] as List;
      expect(outbounds.any((o) => o['type'] == 'vless' && o['server'] == '192.168.1.65'), isTrue);
      print('✅ Sing-box config successfully generated & validated');
    });

    test('Compiles valid Xray client config from spec', () {
      const vlessUri =
          'vless://2d66dae1-f3f9-413d-90ac-2c17b7051fa3@192.168.1.65:48423?type=tcp&security=reality&flow=xtls-rprx-vision&fp=randomized&pbk=RCz839ahUnxVh7cfuE9rc9K8iVlujFdxjbMgT2CosVg&sni=dl.astralinux.ru&sid=3b68c58f#test-xray';
      final server = ServerModel.fromUri(vlessUri);
      expect(server, isNotNull);

      final spec = {
        'targetCore': 'xray',
        'logLevel': 'info',
        'serverNode': server!.toJson(),
        'clientInbound': {
          'mode': 'system_proxy',
          'socksPort': 10808,
          'httpPort': 10809,
        },
      };

      final specJson = jsonEncode(spec);
      final rawResult = SentinelCoreBindings.instance.buildConfig(specJson);
      expect(rawResult, isNotEmpty);

      final result = jsonDecode(rawResult) as Map<String, dynamic>;
      expect(result.containsKey('configJson'), isTrue);
      
      final config = jsonDecode(result['configJson'] as String) as Map<String, dynamic>;
      expect(config.containsKey('inbounds'), isTrue);
      expect(config.containsKey('outbounds'), isTrue);
      print('✅ Xray config successfully generated');
    });
  });

  group('3. URI Parsing & Link Generation Pipeline', () {
    test('Parses VLESS Reality URI via Core FFI', () {
      const uri =
          'vless://2d66dae1-f3f9-413d-90ac-2c17b7051fa3@192.168.1.65:48423?type=tcp&security=reality&flow=xtls-rprx-vision&fp=randomized&pbk=RCz839ahUnxVh7cfuE9rc9K8iVlujFdxjbMgT2CosVg&sni=dl.astralinux.ru&sid=3b68c58f#phone-reality';
      final parsedJson = SentinelCoreBindings.instance.parseURI(uri);
      expect(parsedJson, isNotEmpty);

      final data = jsonDecode(parsedJson) as Map<String, dynamic>;
      expect(data['protocol'], 'vless');
      expect(data['address'], '192.168.1.65');
      expect(data['port'], 48423);
      expect(data['uuid'], '2d66dae1-f3f9-413d-90ac-2c17b7051fa3');
      print('✅ ParseURI correctly parsed VLESS parameters');
    });

    test('Generates shareable URI from profile via Core FFI', () {
      final profile = {
        'protocol': 'vless',
        'name': 'My Node',
        'address': 'vpn.example.com',
        'port': 443,
        'uuid': '2d66dae1-f3f9-413d-90ac-2c17b7051fa3',
        'security': 'reality',
        'flow': 'xtls-rprx-vision',
        'sni': 'example.com',
        'publicKey': 'RCz839ahUnxVh7cfuE9rc9K8iVlujFdxjbMgT2CosVg',
      };

      final res = SentinelCoreBindings.instance.generateURI(jsonEncode(profile));
      expect(res, isNotEmpty);
      final data = jsonDecode(res) as Map<String, dynamic>;
      expect(data.containsKey('uri'), isTrue);
      expect(data['uri'].toString().startsWith('vless://'), isTrue);
      print('✅ GenerateURI produced: ${data['uri']}');
    });
  });

  group('4. Cryptography & Vault Pipeline (AES-GCM & X25519)', () {
    test('Generates X25519 keypair', () {
      final res = SentinelCoreBindings.instance.generateX25519();
      expect(res, isNotEmpty);
      final data = jsonDecode(res) as Map<String, dynamic>;
      expect(data.containsKey('privateKey') || data.containsKey('private_key'), isTrue);
      expect(data.containsKey('publicKey') || data.containsKey('public_key'), isTrue);
      print('✅ X25519 keypair successfully generated via Core');
    });

    test('Encrypts and Decrypts payload with Vault secret', () {
      const plaintext = 'Secret Sentinel Config Payload 12345';
      const secretKey = 'VeryStrongMasterPassword987!';

      final cipherPayload = SentinelCoreBindings.instance.encrypt(plaintext, secretKey);
      expect(cipherPayload, isNotEmpty);
      expect(cipherPayload, isNot(plaintext));
      expect(cipherPayload.startsWith('enc:v1:'), isTrue);

      final decrypted = SentinelCoreBindings.instance.decrypt(cipherPayload, secretKey);
      expect(decrypted, plaintext);
      print('✅ Vault AES-GCM Encrypt/Decrypt cycle verified');
    });
  });

  group('5. Presets & Routing Rules Pipeline', () {
    test('Lists built-in routing presets from core', () {
      final presetsJson = SentinelCoreBindings.instance.listPresets();
      expect(presetsJson, isNotEmpty);
      final presets = jsonDecode(presetsJson) as List;
      expect(presets, isNotEmpty);
      print('✅ Total built-in presets loaded: ${presets.length}');
    });
  });

  group('6. Realtime Telemetry & Supervisor Bindings', () {
    test('Queries realtime traffic statistics without crashing', () {
      final trafficJson = SentinelCoreBindings.instance.getRealtimeTraffic('127.0.0.1:9090');
      expect(trafficJson, isNotEmpty);
      final stats = jsonDecode(trafficJson) as Map<String, dynamic>;
      expect(stats.containsKey('uploadSpeed') || stats.containsKey('upload_speed'), isTrue);
      expect(stats.containsKey('downloadSpeed') || stats.containsKey('download_speed'), isTrue);
      print('✅ Telemetry pipeline verified');
    });
  });
}
