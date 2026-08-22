import 'dart:convert';
import 'dart:ffi' as ffi;
import 'dart:io';
import 'dart:isolate';
import 'package:ffi/ffi.dart';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;

// C function signatures
typedef _SentinelFreeStringC = ffi.Void Function(ffi.Pointer<Utf8> str);
typedef _SentinelFreeStringDart = void Function(ffi.Pointer<Utf8> str);

typedef _SentinelGetVersionC = ffi.Pointer<Utf8> Function();
typedef _SentinelGetVersionDart = ffi.Pointer<Utf8> Function();

typedef _SentinelStringFuncC = ffi.Pointer<Utf8> Function(ffi.Pointer<Utf8> arg);
typedef _SentinelStringFuncDart = ffi.Pointer<Utf8> Function(ffi.Pointer<Utf8> arg);

typedef _SentinelNoArgStringFuncC = ffi.Pointer<Utf8> Function();
typedef _SentinelNoArgStringFuncDart = ffi.Pointer<Utf8> Function();

typedef _SentinelBatchPingC = ffi.Pointer<Utf8> Function(ffi.Pointer<Utf8> targets, ffi.IntPtr timeoutMs);
typedef _SentinelBatchPingDart = ffi.Pointer<Utf8> Function(ffi.Pointer<Utf8> targets, int timeoutMs);

typedef _SentinelProxyPingC = ffi.Pointer<Utf8> Function(
  ffi.IntPtr socksPort,
  ffi.Pointer<Utf8> user,
  ffi.Pointer<Utf8> pass,
  ffi.Pointer<Utf8> url,
  ffi.IntPtr timeoutMs,
);
typedef _SentinelProxyPingDart = ffi.Pointer<Utf8> Function(
  int socksPort,
  ffi.Pointer<Utf8> user,
  ffi.Pointer<Utf8> pass,
  ffi.Pointer<Utf8> url,
  int timeoutMs,
);

typedef _SentinelGetPublicIPC = ffi.Pointer<Utf8> Function(
  ffi.IntPtr socksPort,
  ffi.Pointer<Utf8> user,
  ffi.Pointer<Utf8> pass,
  ffi.IntPtr timeoutMs,
);
typedef _SentinelGetPublicIPDart = ffi.Pointer<Utf8> Function(
  int socksPort,
  ffi.Pointer<Utf8> user,
  ffi.Pointer<Utf8> pass,
  int timeoutMs,
);

typedef _SentinelPushLogLineC = ffi.Void Function(ffi.Pointer<Utf8> coreName, ffi.Pointer<Utf8> line);
typedef _SentinelPushLogLineDart = void Function(ffi.Pointer<Utf8> coreName, ffi.Pointer<Utf8> line);

typedef _SentinelGetLogsC = ffi.Pointer<Utf8> Function(ffi.Pointer<Utf8> coreName, ffi.IntPtr limit);
typedef _SentinelGetLogsDart = ffi.Pointer<Utf8> Function(ffi.Pointer<Utf8> coreName, int limit);

typedef _SentinelPingC = ffi.Pointer<Utf8> Function(ffi.Pointer<Utf8> host, ffi.Int32 port, ffi.Int32 timeoutMs);
typedef _SentinelPingDart = ffi.Pointer<Utf8> Function(ffi.Pointer<Utf8> host, int port, int timeoutMs);

typedef _SentinelHealthCheckC = ffi.Pointer<Utf8> Function(ffi.Int32 socksPort, ffi.Int32 httpPort, ffi.Pointer<Utf8> secret);
typedef _SentinelHealthCheckDart = ffi.Pointer<Utf8> Function(int socksPort, int httpPort, ffi.Pointer<Utf8> secret);

typedef _SentinelTwoStringFuncC = ffi.Pointer<Utf8> Function(ffi.Pointer<Utf8> arg1, ffi.Pointer<Utf8> arg2);
typedef _SentinelTwoStringFuncDart = ffi.Pointer<Utf8> Function(ffi.Pointer<Utf8> arg1, ffi.Pointer<Utf8> arg2);

class SentinelCoreBindings {
  static SentinelCoreBindings? _instance;
  static SentinelCoreBindings get instance => _instance ??= SentinelCoreBindings._();

  ffi.DynamicLibrary? _dll;
  bool _isLoaded = false;
  String _version = 'Not loaded';

  _SentinelFreeStringDart? _freeString;
  _SentinelGetVersionDart? _getVersion;
  _SentinelStringFuncDart? _buildConfig;
  _SentinelStringFuncDart? _parseURI;
  _SentinelStringFuncDart? _generateURI;
  _SentinelBatchPingDart? _batchPing;
  _SentinelPingDart? _ping;
  _SentinelHealthCheckDart? _healthCheck;
  _SentinelTwoStringFuncDart? _encrypt;
  _SentinelTwoStringFuncDart? _decrypt;
  _SentinelProxyPingDart? _proxyPing;
  _SentinelGetPublicIPDart? _getPublicIP;
  _SentinelNoArgStringFuncDart? _listPresets;
  _SentinelStringFuncDart? _getPreset;
  _SentinelNoArgStringFuncDart? _generateX25519;
  _SentinelPushLogLineDart? _pushLogLine;
  _SentinelGetLogsDart? _getLogs;
  _SentinelStringFuncDart? _getRealtimeTraffic;
  _SentinelNoArgStringFuncDart? _getUnifiedTraffic;
  _SentinelStringFuncDart? _auditConnection;
  _SentinelStringFuncDart? _getPortShieldCatalog;
  _SentinelStringFuncDart? _configureSecurityPolicy;
  _SentinelNoArgStringFuncDart? _getSecurityPolicy;
  String? _loadedPath;
  String? get loadedPath => _loadedPath;

  bool get isLoaded => _isLoaded;
  String get version => _version;

  SentinelCoreBindings._();

  static SentinelCoreBindings createForPath(String path) {
    final b = SentinelCoreBindings._();
    b._dll = ffi.DynamicLibrary.open(path);
    b._bindFunctions();
    b._isLoaded = true;
    b._loadedPath = path;
    return b;
  }

  void init({String? customPath}) {
    if (_isLoaded) return;

    final exeDir = p.dirname(Platform.resolvedExecutable);
    final candidates = [
      ...?customPath != null ? [customPath] : null,
      p.join(exeDir, 'sentinel-core.dll'),
      p.join(exeDir, 'binaries', 'sentinel-core.dll'),
      p.join(Directory.current.path, 'sentinel-core.dll'),
      p.join(Directory.current.path, 'binaries', 'sentinel-core.dll'),
      p.join(Directory.current.path, 'dist_native', 'sentinel-core.dll'),
    ];

    for (final path in candidates) {
      if (File(path).existsSync()) {
        try {
          _dll = ffi.DynamicLibrary.open(path);
          _bindFunctions();
          _isLoaded = true;
          _loadedPath = path;
          _version = getEngineVersion();
          debugPrint('[Sentinel FFI] Loaded sentinel-core.dll from $path (Version: $_version)');
          return;
        } catch (e) {
          debugPrint('[Sentinel FFI] Error loading $path: $e');
        }
      }
    }

    debugPrint('[Sentinel FFI] Warning: sentinel-core.dll not found in candidate paths.');
  }

  void _bindFunctions() {
    final d = _dll!;
    try {
      _freeString = d.lookupFunction<_SentinelFreeStringC, _SentinelFreeStringDart>('SentinelFreeString');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelFreeString not found: $e');
    }

    try {
      _getVersion = d.lookupFunction<_SentinelGetVersionC, _SentinelGetVersionDart>('SentinelGetEngineVersion');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelGetEngineVersion not found: $e');
    }

    try {
      _buildConfig = d.lookupFunction<_SentinelStringFuncC, _SentinelStringFuncDart>('SentinelBuildConfig');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelBuildConfig not found: $e');
    }

    try {
      _parseURI = d.lookupFunction<_SentinelStringFuncC, _SentinelStringFuncDart>('SentinelParseURI');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelParseURI not found: $e');
    }

    try {
      _generateURI = d.lookupFunction<_SentinelStringFuncC, _SentinelStringFuncDart>('SentinelGenerateURI');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelGenerateURI not found: $e');
    }

    try {
      _batchPing = d.lookupFunction<_SentinelBatchPingC, _SentinelBatchPingDart>('SentinelBatchPing');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelBatchPing not found: $e');
    }

    try {
      _ping = d.lookupFunction<_SentinelPingC, _SentinelPingDart>('SentinelPing');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelPing not found: $e');
    }

    try {
      _healthCheck = d.lookupFunction<_SentinelHealthCheckC, _SentinelHealthCheckDart>('SentinelRunHealthCheck');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelRunHealthCheck not found: $e');
    }

    try {
      _proxyPing = d.lookupFunction<_SentinelProxyPingC, _SentinelProxyPingDart>('SentinelProxyPing');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelProxyPing not found: $e');
    }

    try {
      _getPublicIP = d.lookupFunction<_SentinelGetPublicIPC, _SentinelGetPublicIPDart>('SentinelGetPublicIP');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelGetPublicIP not found: $e');
    }

    try {
      _listPresets = d.lookupFunction<_SentinelNoArgStringFuncC, _SentinelNoArgStringFuncDart>('SentinelListPresets');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelListPresets not found: $e');
    }

    try {
      _getPreset = d.lookupFunction<_SentinelStringFuncC, _SentinelStringFuncDart>('SentinelGetPreset');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelGetPreset not found: $e');
    }

    try {
      _generateX25519 = d.lookupFunction<_SentinelNoArgStringFuncC, _SentinelNoArgStringFuncDart>('SentinelGenerateX25519Keys');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelGenerateX25519Keys not found: $e');
    }

    try {
      _pushLogLine = d.lookupFunction<_SentinelPushLogLineC, _SentinelPushLogLineDart>('SentinelPushLogLine');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelPushLogLine not found: $e');
    }

    try {
      _getLogs = d.lookupFunction<_SentinelGetLogsC, _SentinelGetLogsDart>('SentinelGetInMemoryLogs');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelGetInMemoryLogs not found: $e');
    }

    try {
      _encrypt = d.lookupFunction<_SentinelTwoStringFuncC, _SentinelTwoStringFuncDart>('SentinelEncrypt');
    } catch (_) {
      try {
        _encrypt = d.lookupFunction<_SentinelTwoStringFuncC, _SentinelTwoStringFuncDart>('SentinelEncryptPayload');
      } catch (e) {
        debugPrint('[Sentinel FFI] SentinelEncrypt not found: $e');
      }
    }

    try {
      _decrypt = d.lookupFunction<_SentinelTwoStringFuncC, _SentinelTwoStringFuncDart>('SentinelDecrypt');
    } catch (_) {
      try {
        _decrypt = d.lookupFunction<_SentinelTwoStringFuncC, _SentinelTwoStringFuncDart>('SentinelDecryptPayload');
      } catch (e) {
        debugPrint('[Sentinel FFI] SentinelDecrypt not found: $e');
      }
    }

    try {
      _getRealtimeTraffic = d.lookupFunction<_SentinelStringFuncC, _SentinelStringFuncDart>('SentinelGetRealtimeTraffic');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelGetRealtimeTraffic not found: $e');
    }

    try {
      _getUnifiedTraffic = d.lookupFunction<_SentinelNoArgStringFuncC, _SentinelNoArgStringFuncDart>('SentinelGetUnifiedTraffic');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelGetUnifiedTraffic not found: $e');
    }

    try {
      _auditConnection = d.lookupFunction<_SentinelStringFuncC, _SentinelStringFuncDart>('SentinelAuditConnection');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelAuditConnection not found: $e');
    }

    try {
      _getPortShieldCatalog = d.lookupFunction<_SentinelStringFuncC, _SentinelStringFuncDart>('SentinelGetPortShieldCatalog');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelGetPortShieldCatalog not found: $e');
    }

    try {
      _configureSecurityPolicy = d.lookupFunction<_SentinelStringFuncC, _SentinelStringFuncDart>('SentinelConfigureSecurityPolicy');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelConfigureSecurityPolicy not found: $e');
    }

    try {
      _getSecurityPolicy = d.lookupFunction<_SentinelNoArgStringFuncC, _SentinelNoArgStringFuncDart>('SentinelGetSecurityPolicy');
    } catch (e) {
      debugPrint('[Sentinel FFI] SentinelGetSecurityPolicy not found: $e');
    }
  }

  String _readAndFree(ffi.Pointer<Utf8> ptr) {
    if (ptr == ffi.nullptr) return '';
    try {
      final res = ptr.toDartString();
      _freeString?.call(ptr);
      return res;
    } catch (_) {
      return '';
    }
  }

  String getEngineVersion() {
    if (!_isLoaded || _getVersion == null) return 'dev';
    return _readAndFree(_getVersion!());
  }

  String buildConfig(String specJson) {
    if (!_isLoaded || _buildConfig == null) return '';
    final pSpec = specJson.toNativeUtf8();
    try {
      return _readAndFree(_buildConfig!(pSpec));
    } finally {
      calloc.free(pSpec);
    }
  }

  String parseURI(String rawUri) {
    if (!_isLoaded || _parseURI == null) return '';
    final pUri = rawUri.toNativeUtf8();
    try {
      return _readAndFree(_parseURI!(pUri));
    } finally {
      calloc.free(pUri);
    }
  }

  String generateURI(String profileJson) {
    if (!_isLoaded || _generateURI == null) return '';
    final pProf = profileJson.toNativeUtf8();
    try {
      return _readAndFree(_generateURI!(pProf));
    } finally {
      calloc.free(pProf);
    }
  }

  String batchPing(String targetsJson, int timeoutMs) {
    if (!_isLoaded || _batchPing == null) return '{}';
    final pTargets = targetsJson.toNativeUtf8();
    try {
      return _readAndFree(_batchPing!(pTargets, timeoutMs));
    } finally {
      calloc.free(pTargets);
    }
  }

  String ping(String host, int port, int timeoutMs) {
    if (!_isLoaded || _ping == null) return '{}';
    final pHost = host.toNativeUtf8();
    try {
      return _readAndFree(_ping!(pHost, port, timeoutMs));
    } finally {
      calloc.free(pHost);
    }
  }

  String runHealthCheck(int socksPort, int httpPort, [String secret = '']) {
    if (!_isLoaded || _healthCheck == null) return '{}';
    final pSecret = secret.toNativeUtf8();
    try {
      return _readAndFree(_healthCheck!(socksPort, httpPort, pSecret));
    } finally {
      calloc.free(pSecret);
    }
  }

  String proxyPing(int socksPort, String targetUrl, int timeoutMs) {
    if (!_isLoaded || _proxyPing == null) return '{}';
    final pUser = ''.toNativeUtf8();
    final pPass = ''.toNativeUtf8();
    final pUrl = targetUrl.toNativeUtf8();
    try {
      return _readAndFree(_proxyPing!(socksPort, pUser, pPass, pUrl, timeoutMs));
    } finally {
      calloc.free(pUser);
      calloc.free(pPass);
      calloc.free(pUrl);
    }
  }

  String getPublicIP(int socksPort, int timeoutMs) {
    if (!_isLoaded || _getPublicIP == null) return '{}';
    final pUser = ''.toNativeUtf8();
    final pPass = ''.toNativeUtf8();
    try {
      return _readAndFree(_getPublicIP!(socksPort, pUser, pPass, timeoutMs));
    } finally {
      calloc.free(pUser);
      calloc.free(pPass);
    }
  }

  String listPresets() {
    if (!_isLoaded || _listPresets == null) return '[]';
    return _readAndFree(_listPresets!());
  }

  String getPreset(String presetId) {
    if (!_isLoaded || _getPreset == null) return '{}';
    final pId = presetId.toNativeUtf8();
    try {
      return _readAndFree(_getPreset!(pId));
    } finally {
      calloc.free(pId);
    }
  }

  String generateX25519() {
    if (!_isLoaded || _generateX25519 == null) return '{}';
    return _readAndFree(_generateX25519!());
  }

  void pushLogLine(String coreName, String line) {
    if (!_isLoaded || _pushLogLine == null) return;
    final pCore = coreName.toNativeUtf8();
    final pLine = line.toNativeUtf8();
    try {
      _pushLogLine!(pCore, pLine);
    } finally {
      calloc.free(pCore);
      calloc.free(pLine);
    }
  }

  List<String> getInMemoryLogs(String coreName, int limit) {
    if (!_isLoaded || _getLogs == null) return [];
    final pCore = coreName.toNativeUtf8();
    try {
      final jsonStr = _readAndFree(_getLogs!(pCore, limit));
      if (jsonStr.isEmpty) return [];
      final parsed = jsonDecode(jsonStr);
      if (parsed is List) {
        return parsed.map((e) => e.toString()).toList();
      }
      return [];
    } catch (_) {
      return [];
    } finally {
      calloc.free(pCore);
    }
  }

  String encryptPayload(String plaintext, String secret) {
    if (!_isLoaded || _encrypt == null) return plaintext;
    final pData = plaintext.toNativeUtf8();
    final pSec = secret.toNativeUtf8();
    try {
      final pRes = _encrypt!(pData, pSec);
      final res = _readAndFree(pRes);
      if (res.startsWith('{') && res.contains('"payload"')) {
        try {
          final parsed = jsonDecode(res);
          if (parsed is Map && parsed.containsKey('payload')) {
            return parsed['payload'].toString();
          }
        } catch (_) {}
      }
      return res;
    } finally {
      calloc.free(pData);
      calloc.free(pSec);
    }
  }

  String encrypt(String plaintext, String secret) => encryptPayload(plaintext, secret);

  String decryptPayload(String ciphertext, String secret) {
    if (!_isLoaded || _decrypt == null) return ciphertext;
    var targetCipher = ciphertext.trim();
    if (targetCipher.startsWith('{') && targetCipher.contains('"payload"')) {
      try {
        final parsed = jsonDecode(targetCipher);
        if (parsed is Map && parsed.containsKey('payload')) {
          targetCipher = parsed['payload'].toString();
        }
      } catch (_) {}
    }

    final pData = targetCipher.toNativeUtf8();
    final pSec = secret.toNativeUtf8();
    try {
      final pRes = _decrypt!(pData, pSec);
      final res = _readAndFree(pRes);
      if (res.startsWith('{') && res.contains('"plaintext"')) {
        try {
          final parsed = jsonDecode(res);
          if (parsed is Map && parsed.containsKey('plaintext')) {
            return parsed['plaintext'].toString();
          }
        } catch (_) {}
      }
      return res;
    } finally {
      calloc.free(pData);
      calloc.free(pSec);
    }
  }

  String decrypt(String ciphertext, String secret) => decryptPayload(ciphertext, secret);

  String getRealtimeTraffic(String clashAddr) {
    if (!_isLoaded || _getRealtimeTraffic == null) return '{}';
    final pAddr = clashAddr.toNativeUtf8();
    try {
      return _readAndFree(_getRealtimeTraffic!(pAddr));
    } finally {
      calloc.free(pAddr);
    }
  }

  String getUnifiedTraffic() {
    if (!_isLoaded || _getUnifiedTraffic == null) return '{}';
    return _readAndFree(_getUnifiedTraffic!());
  }

  Future<String> pingAsync(String host, int port, int timeoutMs) async {
    final path = _loadedPath;
    if (path == null) return ping(host, port, timeoutMs);
    try {
      return await Isolate.run(() {
        final b = SentinelCoreBindings.createForPath(path);
        return b.ping(host, port, timeoutMs);
      });
    } catch (_) {
      return '{}';
    }
  }

  Future<String> proxyPingAsync(int socksPort, String targetUrl, int timeoutMs) async {
    final path = _loadedPath;
    if (path == null) return proxyPing(socksPort, targetUrl, timeoutMs);
    try {
      return await Isolate.run(() {
        final b = SentinelCoreBindings.createForPath(path);
        return b.proxyPing(socksPort, targetUrl, timeoutMs);
      });
    } catch (_) {
      return '{}';
    }
  }

  Future<String> getPublicIPAsync(int socksPort, int timeoutMs) async {
    final path = _loadedPath;
    if (path == null) return getPublicIP(socksPort, timeoutMs);
    try {
      return await Isolate.run(() {
        final b = SentinelCoreBindings.createForPath(path);
        return b.getPublicIP(socksPort, timeoutMs);
      });
    } catch (_) {
      return '{}';
    }
  }

  Future<String> getRealtimeTrafficAsync(String clashAddr) async {
    final path = _loadedPath;
    if (path == null) return getRealtimeTraffic(clashAddr);
    try {
      return await Isolate.run(() {
        final b = SentinelCoreBindings.createForPath(path);
        return b.getRealtimeTraffic(clashAddr);
      });
    } catch (_) {
      return '{}';
    }
  }

  /// Audits a connection with the native Sentinel Core security engine
  String auditConnection(String reqJson) {
    if (!_isLoaded || _auditConnection == null) return '{}';
    final ptr = reqJson.toNativeUtf8();
    try {
      final resPtr = _auditConnection!(ptr);
      return _readAndFree(resPtr);
    } catch (e) {
      debugPrint('[Sentinel FFI] auditConnection error: $e');
      return '{}';
    } finally {
      calloc.free(ptr);
    }
  }

  /// Runs [auditConnection] asynchronously in an isolate
  Future<String> auditConnectionAsync(String reqJson) async {
    final path = _loadedPath;
    if (path == null) return auditConnection(reqJson);
    try {
      return await Isolate.run(() {
        final b = SentinelCoreBindings.createForPath(path);
        return b.auditConnection(reqJson);
      });
    } catch (_) {
      return '{}';
    }
  }

  /// Runs [buildConfig] in a background isolate so it never blocks the UI thread.
  Future<String> buildConfigAsync(String specJson) async {
    final path = _loadedPath;
    if (path == null) return buildConfig(specJson);
    try {
      return await Isolate.run(() {
        final b = SentinelCoreBindings.createForPath(path);
        return b.buildConfig(specJson);
      });
    } catch (_) {
      return '';
    }
  }

  /// Gets the localized port shield catalog from sentinel-core
  String getPortShieldCatalogRaw(String lang) {
    if (!_isLoaded || _getPortShieldCatalog == null) return '[]';
    final ptr = lang.toNativeUtf8();
    try {
      final resPtr = _getPortShieldCatalog!(ptr);
      return _readAndFree(resPtr);
    } catch (e) {
      debugPrint('[Sentinel FFI] getPortShieldCatalog error: $e');
      return '[]';
    } finally {
      calloc.free(ptr);
    }
  }

  /// Parsed port shield catalog
  List<Map<String, dynamic>> getPortShieldCatalog(String lang) {
    try {
      final raw = getPortShieldCatalogRaw(lang);
      if (raw.isNotEmpty && raw != '[]') {
        final decoded = jsonDecode(raw) as List<dynamic>;
        return decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
    } catch (e) {
      debugPrint('[Sentinel FFI] Error parsing port shield catalog: $e');
    }
    return [];
  }

  /// Configures dynamic security policy in sentinel-core
  bool configureSecurityPolicy(Map<String, dynamic> policy) {
    if (!_isLoaded || _configureSecurityPolicy == null) return false;
    final jsonStr = jsonEncode(policy);
    final ptr = jsonStr.toNativeUtf8();
    try {
      final resPtr = _configureSecurityPolicy!(ptr);
      final res = _readAndFree(resPtr);
      return res.contains('"success": true') || res.contains('"success":true');
    } catch (e) {
      debugPrint('[Sentinel FFI] configureSecurityPolicy error: $e');
      return false;
    } finally {
      calloc.free(ptr);
    }
  }

  /// Gets current active security policy from sentinel-core
  Map<String, dynamic> getSecurityPolicy() {
    if (!_isLoaded || _getSecurityPolicy == null) return {};
    try {
      final resPtr = _getSecurityPolicy!();
      final res = _readAndFree(resPtr);
      if (res.isNotEmpty && res != '{}') {
        return Map<String, dynamic>.from(jsonDecode(res) as Map);
      }
    } catch (e) {
      debugPrint('[Sentinel FFI] getSecurityPolicy error: $e');
    }
    return {};
  }
}
