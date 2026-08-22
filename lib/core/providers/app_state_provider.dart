import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import '../ffi/sentinel_core_bindings.dart';
import '../models/connection_status.dart';
import '../models/routing_rule_model.dart';
import '../models/server_model.dart';
import '../models/traffic_stats.dart';
import '../services/core_supervisor.dart';
import '../services/storage_service.dart';
import '../services/windows_net_manager.dart';

class AppStateProvider extends ChangeNotifier {
  ConnectionStatus _status = ConnectionStatus.disconnected;
  List<ServerModel> _servers = [];
  String? _selectedServerId;
  TrafficStats _stats = const TrafficStats();
  List<RoutingRuleModel> _routingRules = [];
  bool _isRefreshingIp = false;
  bool _isMeasuringPing = false;

  bool get isRefreshingIp => _isRefreshingIp;
  bool get isMeasuringPing => _isMeasuringPing;

  String _activeCore = 'singbox';
  bool _isTunMode = true;
  bool _isSystemProxy = false;
  int _socksPort = 10808;
  int _httpPort = 10809;
  int _clashPort = 9090;
  String _activePreset = 'bypass_ru';
  bool _autoStart = false;
  bool _killswitch = true;
  bool _hardwareAcceleration = true;

  final Map<String, bool> _quickRules = {
    'ru': true,
    'ads': true,
    'quic': true,
    'bittorrent': true,
    'lan': true,
    'ip_checkers': false,
  };

  final Map<String, String> _quickRuleTargets = {
    'ru': 'direct',
    'ads': 'block',
    'quic': 'block',
    'bittorrent': 'direct',
    'lan': 'direct',
    'ip_checkers': 'proxy',
  };

  List<Map<String, dynamic>> _corePresets = [];
  Set<String> _usedPresetIds = {'ru', 'ads', 'quic', 'lan'};
  List<String> _tableRuleOrder = [];

  String _shieldMode = 'threshold_block'; // 'threshold_block', 'strict_block', 'alert_only'
  int _blockThreshold = 3;
  int _pcapThreshold = 3;
  int _portScanThreshold = 5;
  bool _autoPcapCapture = true;

  String get shieldMode => _shieldMode;
  int get blockThreshold => _blockThreshold;
  int get pcapThreshold => _pcapThreshold;
  int get portScanThreshold => _portScanThreshold;
  bool get autoPcapCapture => _autoPcapCapture;

  List<Map<String, dynamic>> _portRules = [
    {
      'port': 445,
      'protocol': 'TCP',
      'name': 'SMB / Windows File Sharing',
      'threatRisk': 'Вектор распространения вирусов-вымогателей (Ransomware, WannaCry) и EternalBlue.',
      'isProtected': false,
    },
    {
      'port': 135,
      'protocol': 'TCP',
      'name': 'RPC Endpoint Mapper',
      'threatRisk': 'Удаленное выполнение кода и перечисление сетевых сервисов через DCOM RPC.',
      'isProtected': false,
    },
    {
      'port': 139,
      'protocol': 'TCP',
      'name': 'NetBIOS Session Service',
      'threatRisk': 'Утечка NTLM-хэшей и несанкционированный доступ к локальным ресурсам.',
      'isProtected': false,
    },
    {
      'port': 3389,
      'protocol': 'TCP/UDP',
      'name': 'Remote Desktop (RDP)',
      'threatRisk': 'Уязвимость к брутфорсу паролей и несанкционированному удаленному доступу.',
      'isProtected': false,
    },
    {
      'port': 22,
      'protocol': 'TCP',
      'name': 'SSH Remote Console',
      'threatRisk': 'Несанкционированный доступ и брутфорс учетных записей сервера (SSH).',
      'isProtected': false,
    },
    {
      'port': 23,
      'protocol': 'TCP',
      'name': 'Telnet Remote Console',
      'threatRisk': 'Незащищенный текстовый протокол управления (высокий риск перехвата учетных данных).',
      'isProtected': false,
    },
    {
      'port': 5353,
      'protocol': 'UDP',
      'name': 'mDNS / Multicast Name Resolution',
      'threatRisk': 'Уязвимость к атакам подмены сетевых имен (Responder/Poisoning) в локальной сети.',
      'isProtected': false,
    },
  ];

  ConnectionStatus get status => _status;
  List<ServerModel> get servers => _servers;
  String? get selectedServerId => _selectedServerId;
  TrafficStats get stats => _stats;
  List<RoutingRuleModel> get routingRules => _routingRules;
  List<String> get tableRuleOrder => _tableRuleOrder;
  String get activeCore => _activeCore;
  bool get isTunMode => _isTunMode;
  bool get isSystemProxy => _isSystemProxy;
  int get socksPort => _socksPort;
  int get httpPort => _httpPort;
  int get clashPort => _clashPort;
  String get activePreset => _activePreset;
  bool get autoStart => _autoStart;
  bool get killswitch => _killswitch;
  bool get hardwareAcceleration => _hardwareAcceleration;
  Map<String, bool> get quickRules => _quickRules;
  Map<String, String> get quickRuleTargets => _quickRuleTargets;
  List<Map<String, dynamic>> get corePresets => _corePresets;
  Set<String> get usedPresetIds => _usedPresetIds;
  List<Map<String, dynamic>> get portRules => _portRules;

  List<String> get blockedPortStrings {
    return _portRules
        .where((r) => r['isProtected'] == true)
        .map((r) => r['port'].toString())
        .toList();
  }

  void togglePortProtection(int index, bool isProtected) {
    if (index >= 0 && index < _portRules.length) {
      _portRules[index]['isProtected'] = isProtected;
      notifyListeners();
      save();
      if (_status == ConnectionStatus.connected) {
        connect();
      }
    }
  }

  void addPortRule(Map<String, dynamic> rule) {
    _portRules.add(rule);
    notifyListeners();
    save();
    if (_status == ConnectionStatus.connected) {
      connect();
    }
  }

  void removePortRule(int index) {
    if (index >= 0 && index < _portRules.length) {
      _portRules.removeAt(index);
      notifyListeners();
      save();
      if (_status == ConnectionStatus.connected) {
        connect();
      }
    }
  }

  ServerModel? get selectedServer {
    if (_selectedServerId == null || _servers.isEmpty) return null;
    return _servers.firstWhere((s) => s.id == _selectedServerId, orElse: () => _servers.first);
  }

  Future<void> init() async {
    // 1. Initialize FFI to sentinel-core.dll
    SentinelCoreBindings.instance.init();

    // 2. Load presets dynamically from sentinel-core.dll with full rule details
    try {
      final presetsJson = SentinelCoreBindings.instance.listPresets();
      if (presetsJson.isNotEmpty && presetsJson != '[]') {
        final parsed = jsonDecode(presetsJson);
        if (parsed is List) {
          final list = <Map<String, dynamic>>[];
          for (final item in parsed) {
            if (item is Map && item.containsKey('id')) {
              final pid = item['id'].toString();
              final detailJson = SentinelCoreBindings.instance.getPreset(pid);
              if (detailJson.isNotEmpty && detailJson != '{}' && !detailJson.startsWith('{"error":')) {
                try {
                  final detail = jsonDecode(detailJson) as Map<String, dynamic>;
                  list.add(detail);
                  continue;
                } catch (_) {}
              }
              list.add(Map<String, dynamic>.from(item));
            }
          }
          _corePresets = list;
        }
      }
    } catch (e) {
      CoreSupervisor.instance.addAppLog('Ошибка загрузки пресетов ядра: $e');
    }

    // 3. Load saved state from AppData
    final data = await StorageService.instance.loadData();
    if (data.containsKey('servers')) {
      final sList = data['servers'] as List<dynamic>? ?? [];
      _servers = sList.map((e) => ServerModel.fromJson(e as Map<String, dynamic>)).toList();
    }
    _selectedServerId = data['selectedServerId'] as String?;
    if (_selectedServerId == null && _servers.isNotEmpty) {
      _selectedServerId = _servers.first.id;
    }

    const corePresetIds = {'ads', 'bittorrent', 'cn', 'ip_checkers', 'lan', 'quic', 'ru', 'us', 'bypass_ru', 'block_ads'};
    if (data.containsKey('routingRules')) {
      final rList = data['routingRules'] as List<dynamic>? ?? [];
      _routingRules = rList
          .map((e) => RoutingRuleModel.fromJson(e as Map<String, dynamic>))
          .where((r) => !corePresetIds.contains(r.id.toLowerCase()))
          .toList();
    }

    if (data.containsKey('settings')) {
      final set = data['settings'] as Map<String, dynamic>? ?? {};
      _activeCore = set['activeCore'] as String? ?? 'singbox';
      _isTunMode = set['isTunMode'] as bool? ?? true;
      _isSystemProxy = set['isSystemProxy'] as bool? ?? false;
      _socksPort = set['socksPort'] as int? ?? 10808;
      _httpPort = set['httpPort'] as int? ?? 10809;
      _clashPort = set['clashPort'] as int? ?? 9090;
      _activePreset = set['activePreset'] as String? ?? 'bypass_ru';
      _autoStart = set['autoStart'] as bool? ?? false;
      _killswitch = set['killswitch'] as bool? ?? true;
      _hardwareAcceleration = set['hardwareAcceleration'] as bool? ?? true;

      if (set.containsKey('quickRules')) {
        final q = set['quickRules'] as Map<String, dynamic>? ?? {};
        q.forEach((k, v) => _quickRules[k] = v == true);
      }
      if (set.containsKey('quickRuleTargets')) {
        final qt = set['quickRuleTargets'] as Map<String, dynamic>? ?? {};
        qt.forEach((k, v) => _quickRuleTargets[k] = v.toString());
      }
      if (set.containsKey('portRules')) {
        final pList = set['portRules'] as List<dynamic>? ?? [];
        if (pList.isNotEmpty) {
          _portRules = pList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        }
      } else {
        final catalog = SentinelCoreBindings.instance.getPortShieldCatalog('ru');
        if (catalog.isNotEmpty) {
          _portRules = catalog.map((c) => {
            'port': c['port'] ?? 0,
            'protocol': c['protocol'] ?? 'TCP',
            'name': c['name'] ?? '',
            'threatRisk': c['threat_risk'] ?? '',
            'isProtected': c['default_on'] == true,
          }).toList();
        }
      }
      if (set.containsKey('usedPresetIds')) {
        final uList = set['usedPresetIds'] as List<dynamic>? ?? [];
        _usedPresetIds = uList.map((e) => e.toString()).toSet();
      } else {
        _usedPresetIds = {'ru', 'ads', 'quic', 'lan'};
      }
      if (set.containsKey('tableRuleOrder')) {
        final oList = set['tableRuleOrder'] as List<dynamic>? ?? [];
        _tableRuleOrder = oList.map((e) => e.toString()).toList();
      }
      if (set.containsKey('shieldMode')) {
        _shieldMode = set['shieldMode']?.toString() ?? 'threshold_block';
      }
      if (set.containsKey('blockThreshold')) {
        _blockThreshold = int.tryParse(set['blockThreshold'].toString()) ?? 3;
      }
      if (set.containsKey('pcapThreshold')) {
        _pcapThreshold = int.tryParse(set['pcapThreshold'].toString()) ?? 3;
      }
      if (set.containsKey('portScanThreshold')) {
        _portScanThreshold = int.tryParse(set['portScanThreshold'].toString()) ?? 5;
      }
      if (set.containsKey('autoPcapCapture')) {
        _autoPcapCapture = set['autoPcapCapture'] != false;
      }
      syncSecurityPolicyWithCore();
    }

    // 3. Listen to telemetry stream
    CoreSupervisor.instance.statsStream.listen((newStats) {
      if (newStats.uploadSpeedBytes == _stats.uploadSpeedBytes &&
          newStats.downloadSpeedBytes == _stats.downloadSpeedBytes &&
          newStats.totalUploadBytes == _stats.totalUploadBytes &&
          newStats.totalDownloadBytes == _stats.totalDownloadBytes) {
        return; // Avoid unnecessary rebuilds when numbers haven't changed!
      }
      _stats = _stats.copyWith(
        uploadSpeedBytes: newStats.uploadSpeedBytes,
        downloadSpeedBytes: newStats.downloadSpeedBytes,
        totalUploadBytes: newStats.totalUploadBytes > 0
            ? newStats.totalUploadBytes
            : _stats.totalUploadBytes + newStats.uploadSpeedBytes,
        totalDownloadBytes: newStats.totalDownloadBytes > 0
            ? newStats.totalDownloadBytes
            : _stats.totalDownloadBytes + newStats.downloadSpeedBytes,
      );
      notifyListeners();
    });

    notifyListeners();
    refreshPublicIP();
  }

  Future<void> toggleConnect() async {
    if (_status == ConnectionStatus.connected) {
      await disconnect();
    } else if (_status == ConnectionStatus.disconnected || _status == ConnectionStatus.error) {
      if (_selectedServerId == null && _servers.isNotEmpty) {
        _selectedServerId = _servers.first.id;
        notifyListeners();
      }
      await connect();
    }
  }

  Future<void> connect() async {
    if (_selectedServerId == null && _servers.isNotEmpty) {
      _selectedServerId = _servers.first.id;
      notifyListeners();
    }

    final server = selectedServer;
    if (server == null) {
      CoreSupervisor.instance.addAppLog('Ошибка подключения: сервер не выбран.');
      _status = ConnectionStatus.disconnected;
      notifyListeners();
      return;
    }

    _status = ConnectionStatus.connecting;
    notifyListeners();

    // Yield to the event loop so the mascot shockwave & UI transition render smoothly
    await Future.delayed(const Duration(milliseconds: 100));

    try {
      String? finalConfigJson;

      // 1. Try sentinel-core.dll AST Config Builder
      try {
        final spec = {
          'targetCore': _activeCore,
          'coreVersion': '1.13',
          'logLevel': 'info',
          'serverNode': server.toJson(),
          'clashApiAddress': '127.0.0.1:$_clashPort',
          'clientInbound': {
            'mode': _isTunMode ? 'desktop_tun' : 'system_proxy',
            'socksPort': _socksPort,
            'httpPort': _httpPort,
            'tunInterfaceName': 'Sentinel-TUN',
            'autoRoute': true,
            'strictRoute': false,
          },
          'routing': {
            'mode': _activePreset == 'proxy_all'
                ? 'proxy_all'
                : (_activePreset == 'custom_only' ? 'custom_only' : 'smart_rule'),
            'enabledPresets': _quickRules.entries.where((e) => e.value).map((e) => e.key).toList(),
            'presetTargetOverrides': _quickRuleTargets,
            'blockedPorts': blockedPortStrings,
            'customRules': _routingRules.where((r) => r.isEnabled).map((r) => {
              'name': r.name,
              'enabled': true,
              'target': r.action == 'block' ? 'block' : (r.action == 'direct' ? 'direct' : 'proxy'),
              'domains': r.domains,
              'ips': r.ips,
            }).toList(),
          },
        };

        final specJson = jsonEncode(spec);
        final dllRes = await SentinelCoreBindings.instance.buildConfigAsync(specJson);
        if (dllRes.isNotEmpty && dllRes != '{}') {
          final res = jsonDecode(dllRes);
          if (res is Map && res.containsKey('configJson') && res['configJson'] != null && res['configJson'].toString().isNotEmpty) {
            if (res['error'] != null && res['error'].toString().isNotEmpty) {
              CoreSupervisor.instance.addAppLog('FFI генератор конфига: ${res['error']}');
            }
            finalConfigJson = res['configJson'].toString();
          } else if (dllRes.trim().startsWith('{')) {
            finalConfigJson = dllRes;
          }
        }
      } catch (e) {
        CoreSupervisor.instance.addAppLog('Ошибка генерации конфигурации FFI: $e');
      }

      if (finalConfigJson == null || finalConfigJson.isEmpty) {
        throw Exception('Sentinel Core FFI не вернул сгенерированный конфиг маршрутизации.');
      }

      // 2. Launch core via Supervisor
      await CoreSupervisor.instance.startCore(
        coreType: _activeCore,
        configJson: finalConfigJson,
        socksPort: _socksPort,
        httpPort: _httpPort,
        clashPort: _clashPort,
        isTunMode: _isTunMode,
        isSystemProxy: _isSystemProxy,
      );

      // 3. If System Proxy is enabled, set Windows registry in background
      if (_isSystemProxy) {
        WindowsNetManager.enableSystemProxy(
          socksPort: _socksPort,
          httpPort: _httpPort,
        ).ignore();
      }

      _status = ConnectionStatus.connected;
      notifyListeners();

      Future.delayed(const Duration(milliseconds: 600), () {
        refreshPublicIP();
        measureActiveLatency();
      });
    } catch (e) {
      CoreSupervisor.instance.addAppLog('Ошибка подключения: $e');
      _status = ConnectionStatus.error;
      notifyListeners();
    }
  }

  Future<void> disconnect() async {
    _status = ConnectionStatus.disconnecting;
    notifyListeners();

    // Yield to the event loop for silky smooth mascot transition
    await Future.delayed(const Duration(milliseconds: 100));

    try {
      await CoreSupervisor.instance.stopCore(isProxyEnabled: _isSystemProxy);
    } catch (_) {}

    _status = ConnectionStatus.disconnected;
    _stats = _stats.copyWith(uploadSpeedBytes: 0, downloadSpeedBytes: 0, pingMs: null);
    notifyListeners();

    Future.delayed(const Duration(milliseconds: 500), () {
      refreshPublicIP();
    });
  }

  void setSelectedServer(String serverId) {
    _selectedServerId = serverId;
    save();
    notifyListeners();
  }

  void addServer(ServerModel server) {
    _servers.add(server);
    _selectedServerId ??= server.id;
    save();
    notifyListeners();
  }

  void deleteServer(String serverId) {
    _servers.removeWhere((s) => s.id == serverId);
    if (_selectedServerId == serverId) {
      _selectedServerId = _servers.isNotEmpty ? _servers.first.id : null;
    }
    save();
    notifyListeners();
  }

  Future<bool> importFromUri(String rawUri) async {
    final trimmed = rawUri.trim();
    if (trimmed.isEmpty) return false;

    final lines = trimmed.split(RegExp(r'[\r\n]+')).map((l) => l.trim()).where((l) => l.isNotEmpty).toList();
    bool anyImported = false;

    for (final line in lines) {
      ServerModel? server;

      // 1. Try sentinel-core.dll FFI parser
      try {
        final parsedJson = SentinelCoreBindings.instance.parseURI(line);
        if (parsedJson.isNotEmpty && parsedJson != '{}') {
          final data = jsonDecode(parsedJson);
          server = ServerModel.fromJson(data);
        }
      } catch (e) {
        CoreSupervisor.instance.addAppLog('Ошибка разбора URI через DLL: $e');
      }

      // 2. Fallback to native Dart URL parser
      if (server == null) {
        try {
          server = ServerModel.fromUri(line);
        } catch (e) {
          CoreSupervisor.instance.addAppLog('Ошибка парсинга URI в Dart: $e');
        }
      }

      if (server != null) {
        addServer(server);
        setSelectedServer(server.id);
        anyImported = true;
      }
    }

    return anyImported;
  }

  void updateSettings({
    String? activeCore,
    bool? isTunMode,
    bool? isSystemProxy,
    String? activePreset,
  }) {
    if (activeCore != null) _activeCore = activeCore;
    if (isTunMode != null) _isTunMode = isTunMode;
    if (isSystemProxy != null) _isSystemProxy = isSystemProxy;
    if (activePreset != null) _activePreset = activePreset;
    save();
    notifyListeners();
  }

  void setQuickRuleEnabled(String id, bool enabled) {
    _quickRules[id] = enabled;
    if (enabled) {
      _usedPresetIds.add(id);
    }
    save();
    notifyListeners();
  }

  void removePresetFromTable(String id) {
    _usedPresetIds.remove(id);
    _quickRules[id] = false;
    save();
    notifyListeners();
  }

  void setQuickRuleTarget(String id, String target) {
    _quickRuleTargets[id] = target;
    save();
    notifyListeners();
  }

  void addRoutingRule(RoutingRuleModel rule) {
    _routingRules.add(rule);
    save();
    notifyListeners();
  }

  void deleteRoutingRule(String ruleId) {
    _routingRules.removeWhere((r) => r.id == ruleId);
    save();
    notifyListeners();
  }

  void updateRoutingRule(RoutingRuleModel updated) {
    final idx = _routingRules.indexWhere((r) => r.id == updated.id);
    if (idx != -1) {
      _routingRules[idx] = updated;
      save();
      notifyListeners();
    }
  }

  void reorderTableRules(int oldIndex, int newIndex) {
    if (oldIndex < newIndex) {
      newIndex -= 1;
    }
    final allIds = getOrderedTableRuleIds();
    if (oldIndex < 0 || oldIndex >= allIds.length || newIndex < 0 || newIndex >= allIds.length) return;
    final item = allIds.removeAt(oldIndex);
    allIds.insert(newIndex, item);
    _tableRuleOrder = allIds;

    // Synchronize _routingRules order
    final customOrder = allIds.where((id) => !_corePresets.any((p) => p['id']?.toString() == id)).toList();
    _routingRules.sort((a, b) {
      final idxA = customOrder.indexOf(a.id);
      final idxB = customOrder.indexOf(b.id);
      if (idxA == -1) return 1;
      if (idxB == -1) return -1;
      return idxA.compareTo(idxB);
    });

    save();
    notifyListeners();
  }

  List<String> getOrderedTableRuleIds() {
    final availableIds = <String>[];
    for (final p in _corePresets) {
      final pid = p['id']?.toString() ?? '';
      if (_usedPresetIds.contains(pid) || (_quickRules[pid] == true)) {
        availableIds.add(pid);
      }
    }
    for (final r in _routingRules) {
      availableIds.add(r.id);
    }

    if (_tableRuleOrder.isEmpty) {
      _tableRuleOrder = List.from(availableIds);
      return availableIds;
    }

    final ordered = <String>[];
    for (final id in _tableRuleOrder) {
      if (availableIds.contains(id)) {
        ordered.add(id);
      }
    }
    for (final id in availableIds) {
      if (!ordered.contains(id)) {
        ordered.add(id);
      }
    }
    _tableRuleOrder = ordered;
    return ordered;
  }

  void moveRoutingRule(int oldIndex, int newIndex) {
    if (oldIndex < 0 || oldIndex >= _routingRules.length || newIndex < 0 || newIndex >= _routingRules.length) return;
    final item = _routingRules.removeAt(oldIndex);
    _routingRules.insert(newIndex, item);
    save();
    notifyListeners();
  }

  void toggleRoutingRule(String ruleId, bool isEnabled) {
    final idx = _routingRules.indexWhere((r) => r.id == ruleId);
    if (idx != -1) {
      _routingRules[idx].isEnabled = isEnabled;
      save();
      notifyListeners();
    }
  }

  Future<void> measureActiveLatency() async {
    if (_isMeasuringPing) return;
    final cur = selectedServer;
    if (cur == null) return;
    _isMeasuringPing = true;
    notifyListeners();

    try {
      if (_status == ConnectionStatus.connected) {
        final res = await SentinelCoreBindings.instance.proxyPingAsync(
          _socksPort,
          'https://cp.cloudflare.com/generate_204',
          1800,
        );
        if (res.isNotEmpty && res != '{}') {
          final data = jsonDecode(res);
          final ms = (data['latency_ms'] as num?)?.round() ?? (data['latencyMs'] as num?)?.round();
          if (ms != null && ms > 0) {
            _stats = _stats.copyWith(pingMs: ms);
            cur.pingMs = ms;
            notifyListeners();
            return;
          }
        }
      }

      // Direct TCP ping to server address:port via Sentinel Core FFI
      final res = await SentinelCoreBindings.instance.pingAsync(cur.address, cur.port, 1800);
      if (res.isNotEmpty && res != '{}') {
        final data = jsonDecode(res);
        final ms = (data['latencyMs'] as num?)?.round() ?? (data['latency_ms'] as num?)?.round();
        if (ms != null && ms > 0) {
          _stats = _stats.copyWith(pingMs: ms);
          cur.pingMs = ms;
          notifyListeners();
        }
      }
    } catch (_) {
    } finally {
      _isMeasuringPing = false;
      notifyListeners();
    }
  }

  Future<void> refreshPublicIP() async {
    if (_isRefreshingIp) return;
    _isRefreshingIp = true;
    notifyListeners();

    try {
      final port = _status == ConnectionStatus.connected ? _socksPort : 0;
      final res = await SentinelCoreBindings.instance.getPublicIPAsync(port, 3000);
      if (res.isNotEmpty && res != '{}') {
        final data = jsonDecode(res);
        if (data is Map && data['ip'] != null && data['ip'].toString().isNotEmpty) {
          final city = data['city']?.toString() ?? '';
          final country = data['country']?.toString() ?? '';
          final geoParts = [city, country].where((s) => s.isNotEmpty).toList();
          final geo = geoParts.isNotEmpty ? geoParts.join(', ') : 'Локация определена';
          _stats = _stats.copyWith(
            publicIp: data['ip'].toString(),
            publicGeo: geo,
            countryCode: (data['countryCode'] ?? data['country_code'])?.toString(),
          );
        }
      }
    } catch (_) {} finally {
      _isRefreshingIp = false;
      notifyListeners();
    }
  }

  void setAutoStart(bool val) {
    _autoStart = val;
    notifyListeners();
    save();
    try {
      if (Platform.isWindows) {
        final exePath = Platform.resolvedExecutable;
        if (val) {
          Process.run('reg', [
            'add',
            r'HKCU\Software\Microsoft\Windows\CurrentVersion\Run',
            '/v',
            'SentinelDesktop',
            '/t',
            'REG_SZ',
            '/d',
            '"$exePath" --minimized',
            '/f',
          ]);
        } else {
          Process.run('reg', [
            'delete',
            r'HKCU\Software\Microsoft\Windows\CurrentVersion\Run',
            '/v',
            'SentinelDesktop',
            '/f',
          ]);
        }
      }
    } catch (_) {}
  }

  void setKillswitch(bool val) {
    _killswitch = val;
    notifyListeners();
    save();
  }

  void setHardwareAcceleration(bool val) {
    _hardwareAcceleration = val;
    notifyListeners();
    save();
  }

  void setSocksPort(int port) {
    if (_socksPort == port) return;
    _socksPort = port;
    notifyListeners();
    save();
    if (_status == ConnectionStatus.connected) {
      connect();
    }
  }

  void setHttpPort(int port) {
    if (_httpPort == port) return;
    _httpPort = port;
    notifyListeners();
    save();
    if (_status == ConnectionStatus.connected) {
      connect();
    }
  }

  void setClashPort(int port) {
    if (_clashPort == port) return;
    _clashPort = port;
    notifyListeners();
    save();
    if (_status == ConnectionStatus.connected) {
      connect();
    }
  }

  void syncSecurityPolicyWithCore() {
    try {
      final protectedPorts = _portRules
          .where((r) => r['isProtected'] == true)
          .map((r) => int.tryParse(r['port'].toString()) ?? 0)
          .where((p) => p > 0)
          .toList();

      final policy = {
        'mode': _shieldMode,
        'block_threshold': _blockThreshold,
        'pcap_threshold': _pcapThreshold,
        'port_scan_threshold': _portScanThreshold,
        'window_seconds': 30,
        'auto_pcap_capture': _autoPcapCapture,
        'protected_ports': protectedPorts,
      };

      SentinelCoreBindings.instance.configureSecurityPolicy(policy);
    } catch (e) {
      debugPrint('[AppState] Failed to sync security policy: $e');
    }
  }

  void updateSecurityPolicy({
    String? shieldMode,
    int? blockThreshold,
    int? pcapThreshold,
    int? portScanThreshold,
    bool? autoPcapCapture,
  }) {
    if (shieldMode != null) _shieldMode = shieldMode;
    if (blockThreshold != null) _blockThreshold = blockThreshold;
    if (pcapThreshold != null) _pcapThreshold = pcapThreshold;
    if (portScanThreshold != null) _portScanThreshold = portScanThreshold;
    if (autoPcapCapture != null) _autoPcapCapture = autoPcapCapture;

    syncSecurityPolicyWithCore();
    save();
    notifyListeners();
  }

  void save() {
    StorageService.instance.saveData(
      servers: _servers,
      selectedServerId: _selectedServerId,
      routingRules: _routingRules,
      settings: {
        'activeCore': _activeCore,
        'isTunMode': _isTunMode,
        'isSystemProxy': _isSystemProxy,
        'socksPort': _socksPort,
        'httpPort': _httpPort,
        'clashPort': _clashPort,
        'activePreset': _activePreset,
        'autoStart': _autoStart,
        'killswitch': _killswitch,
        'hardwareAcceleration': _hardwareAcceleration,
        'quickRules': _quickRules,
        'quickRuleTargets': _quickRuleTargets,
        'portRules': _portRules,
        'usedPresetIds': _usedPresetIds.toList(),
        'tableRuleOrder': _tableRuleOrder,
        'shieldMode': _shieldMode,
        'blockThreshold': _blockThreshold,
        'pcapThreshold': _pcapThreshold,
        'portScanThreshold': _portScanThreshold,
        'autoPcapCapture': _autoPcapCapture,
      },
    );
  }
}
