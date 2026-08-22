import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import '../ffi/sentinel_core_bindings.dart';
import '../models/routing_rule_model.dart';
import '../models/server_model.dart';

class StorageService {
  static final StorageService instance = StorageService._();
  StorageService._();

  File? _vaultFile;
  File? _backupVaultFile;

  static const String _coreMasterSecret = 'sentinel-core-native-desktop-vault-secret-key-v1';

  File _getVaultFile() {
    if (_vaultFile != null) return _vaultFile!;
    final appData = Platform.environment['APPDATA'] ?? Directory.current.path;
    final dir = Directory(p.join(appData, 'SentinelSecure'));
    if (!dir.existsSync()) {
      dir.createSync(recursive: true);
    }
    _vaultFile = File(p.join(dir.path, 'sentinel.vault'));
    _backupVaultFile = File(p.join(dir.path, 'sentinel.vault.bak'));
    return _vaultFile!;
  }

  Future<Map<String, dynamic>> loadData() async {
    try {
      final file = _getVaultFile();

      Map<String, dynamic>? parseVaultContent(String decrypted) {
        if (decrypted.isEmpty || decrypted.startsWith('{"error":')) return null;
        try {
          var parsed = jsonDecode(decrypted);
          if (parsed is Map && parsed.containsKey('plaintext')) {
            try {
              parsed = jsonDecode(parsed['plaintext'].toString());
            } catch (_) {}
          }
          if (parsed is Map<String, dynamic> && parsed.containsKey('servers')) {
            return parsed;
          }
        } catch (_) {}
        return null;
      }

      // 1. Read encrypted vault from sentinel-core
      if (await file.exists()) {
        final bytes = await file.readAsBytes();
        if (bytes.isNotEmpty) {
          final rawContent = utf8.decode(bytes, allowMalformed: true).trim();
          final decrypted = SentinelCoreBindings.instance.decryptPayload(rawContent, _coreMasterSecret);
          final data = parseVaultContent(decrypted);
          if (data != null && (data['servers'] as List).isNotEmpty) {
            try {
              await _backupVaultFile?.writeAsBytes(bytes);
            } catch (_) {}
            return data;
          }
        }
      }

      // 2. Read backup vault if primary is unavailable
      if (_backupVaultFile != null && await _backupVaultFile!.exists()) {
        final bBytes = await _backupVaultFile!.readAsBytes();
        if (bBytes.isNotEmpty) {
          final bContent = utf8.decode(bBytes, allowMalformed: true).trim();
          final bDecrypted = SentinelCoreBindings.instance.decryptPayload(bContent, _coreMasterSecret);
          final data = parseVaultContent(bDecrypted);
          if (data != null && (data['servers'] as List).isNotEmpty) {
            return data;
          }
        }
      }

    } catch (e) {
      debugPrint('[StorageService] Error loading vault: $e');
    }
    return {};
  }

  Future<void> saveData({
    required List<ServerModel> servers,
    required String? selectedServerId,
    required List<RoutingRuleModel> routingRules,
    required Map<String, dynamic> settings,
  }) async {
    try {
      final file = _getVaultFile();
      final data = {
        'servers': servers.map((s) => s.toJson()).toList(),
        'selectedServerId': selectedServerId,
        'routingRules': routingRules.map((r) => r.toJson()).toList(),
        'settings': settings,
        'updatedAt': DateTime.now().toIso8601String(),
      };

      final rawData = jsonEncode(data);
      // Strictly encrypt with Sentinel Core AEAD Vault
      final encryptedVault = SentinelCoreBindings.instance.encryptPayload(rawData, _coreMasterSecret);
      if (encryptedVault.isEmpty || encryptedVault == rawData) {
        throw Exception('Core encryption failed: Plaintext storage is strictly prohibited');
      }

      final bytes = utf8.encode(encryptedVault);

      await file.writeAsBytes(bytes);

      if (servers.isNotEmpty && _backupVaultFile != null) {
        await _backupVaultFile!.writeAsBytes(bytes);
      }
    } catch (e) {
      debugPrint('[StorageService] Error saving to core vault: $e');
    }
  }
}
