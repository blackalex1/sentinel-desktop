import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:path/path.dart' as p;
import '../ffi/sentinel_core_bindings.dart';
import '../models/traffic_stats.dart';
import 'windows_net_manager.dart';

class CoreSupervisor {
  static final CoreSupervisor instance = CoreSupervisor._();
  CoreSupervisor._();

  Process? _activeProcess;
  String _activeCoreType = 'singbox';
  int _activeSocksPort = 10808;
  int _activeHttpPort = 10809;
  int _activeClashPort = 9090;
  Timer? _telemetryTimer;
  final List<String> _coreLogs = [];
  final List<String> _appLogs = [];
  final Set<int> _intentionalStopPids = {};

  final _coreLogController = StreamController<String>.broadcast();
  Stream<String> get coreLogStream => _coreLogController.stream;

  final _appLogController = StreamController<String>.broadcast();
  Stream<String> get appLogStream => _appLogController.stream;

  final _statsController = StreamController<TrafficStats>.broadcast();
  Stream<TrafficStats> get statsStream => _statsController.stream;

  bool get isRunning => _activeProcess != null;
  String get activeCoreType => _activeCoreType;
  int get activeSocksPort => _activeSocksPort;
  int get activeHttpPort => _activeHttpPort;
  List<String> get coreLogs => List.unmodifiable(_coreLogs);
  List<String> get appLogs => List.unmodifiable(_appLogs);
  List<String> get logs => List.unmodifiable(_coreLogs.isNotEmpty ? _coreLogs : _appLogs);
  Stream<String> get logStream => _coreLogController.stream;

  String? findCoreBinary(String coreType) {
    final exeName = (coreType.toLowerCase().contains('xray'))
        ? 'xray.exe'
        : (coreType.toLowerCase().contains('hy') ? 'hysteria.exe' : 'sing-box.exe');

    final exeDir = p.dirname(Platform.resolvedExecutable);
    final appData = Platform.environment['APPDATA'] ?? Directory.current.path;
    final candidates = [
      p.join(exeDir, 'binaries', exeName),
      p.join(exeDir, exeName),
      p.join(appData, 'SentinelSecure', 'binaries', exeName),
      p.join(Directory.current.path, 'binaries', exeName),
      p.join(Directory.current.path, exeName),
      p.join(Directory.current.path, 'dist_native', 'binaries', exeName),
    ];

    for (final c in candidates) {
      if (File(c).existsSync()) return c;
    }
    return null;
  }

  Future<void> startCore({
    required String coreType,
    required String configJson,
    required int socksPort,
    required int httpPort,
    required int clashPort,
    required bool isTunMode,
    required bool isSystemProxy,
  }) async {
    await stopCore();

    _activeCoreType = coreType.toLowerCase();

    // Check ports in parallel
    final ports = await Future.wait([
      WindowsNetManager.findAvailablePort(socksPort),
      WindowsNetManager.findAvailablePort(httpPort),
      WindowsNetManager.findAvailablePort(clashPort),
    ]);
    _activeSocksPort = ports[0];
    _activeHttpPort = ports[1];
    _activeClashPort = ports[2];

    final binPath = findCoreBinary(_activeCoreType);
    if (binPath == null) {
      addAppLog('⚠️ Исполняемый файл для ядра $_activeCoreType не найден');
      throw Exception('Core binary not found for $_activeCoreType');
    }

    // Write config to single deterministic active config path
    final tempDir = Directory.systemTemp;
    final configFile = File(p.join(tempDir.path, 'sentinel_active_config.json'));
    await configFile.writeAsString(configJson);

    final args = <String>[];
    if (_activeCoreType.contains('sing')) {
      args.addAll(['run', '-c', configFile.path]);
    } else if (_activeCoreType.contains('xray')) {
      args.addAll(['run', '-c', configFile.path]);
    } else {
      args.addAll(['client', '-c', configFile.path]);
    }

    addAppLog('Запуск ядра $_activeCoreType (SOCKS=$_activeSocksPort, HTTP=$_activeHttpPort, Clash=$_activeClashPort)...');

    // Ensure no orphaned background cores are occupying ports or locking the binary
    await WindowsNetManager.killExistingCores();
    await Future.delayed(const Duration(milliseconds: 150));

    Process? proc;
    Object? lastError;
    for (int attempt = 0; attempt < 3; attempt++) {
      try {
        proc = await Process.start(binPath, args, workingDirectory: p.dirname(binPath));
        break;
      } catch (e) {
        lastError = e;
        await Future.delayed(Duration(milliseconds: 250 * (attempt + 1)));
        await WindowsNetManager.killExistingCores();
      }
    }

    if (proc == null) {
      final errStr = lastError?.toString() ?? 'Unknown process spawn error';
      if (errStr.contains('Отказано в доступе') || errStr.contains('Access is denied')) {
        addAppLog('⚠️ Ошибка запуска: Доступ к файлу ядра заблокирован системой. Если включен TUN-режим (Wintun), запустите Sentinel Desktop от имени Администратора.');
      } else {
        addAppLog('⚠️ Ошибка запуска ядра: $lastError');
      }
      throw Exception('Failed to start core process: $lastError');
    }

    final activeProc = proc;
    _activeProcess = activeProc;
    addAppLog('Ядро $_activeCoreType успешно запущено (PID: ${activeProc.pid})');

    // Stream core logs non-blockingly with robust chunk buffering
    const decoder = Utf8Decoder(allowMalformed: true);
    final ansiRegex = RegExp(r'\x1B\[[0-9;]*[a-zA-Z]');

    void handleLine(String rawLine) {
      final line = rawLine.replaceAll(ansiRegex, '').trim();
      if (line.isEmpty) return;
      final upper = line.toUpperCase();
      final isFatalOrPanic = upper.contains('FATAL') || upper.contains('PANIC');
      final isErr = isFatalOrPanic || upper.contains('ERROR');
      final isWarn = upper.contains('WARN');

      final tag = isFatalOrPanic
          ? '[$_activeCoreType FATAL]'
          : (isErr
              ? '[$_activeCoreType ERR]'
              : (isWarn ? '[$_activeCoreType WARN]' : '[$_activeCoreType]'));

      addCoreLog('$tag $line');

      if (isFatalOrPanic) {
        addAppLog('⚠️ $tag $line');
      }

      if (line.contains('Access is denied') || line.contains('configure tun interface')) {
        addAppLog('⚠️ Для работы TUN-режима (Wintun) требуются права Администратора. Запустите Sentinel Desktop от имени Администратора.');
      }
    }

    final stdoutCompleter = Completer<void>();
    final stderrCompleter = Completer<void>();

    var stdoutBuf = '';
    activeProc.stdout.transform(decoder).listen(
      (chunk) {
        stdoutBuf += chunk;
        while (stdoutBuf.contains('\n')) {
          final idx = stdoutBuf.indexOf('\n');
          final line = stdoutBuf.substring(0, idx);
          stdoutBuf = stdoutBuf.substring(idx + 1);
          handleLine(line);
        }
      },
      onDone: () {
        if (stdoutBuf.trim().isNotEmpty) {
          handleLine(stdoutBuf);
          stdoutBuf = '';
        }
        if (!stdoutCompleter.isCompleted) stdoutCompleter.complete();
      },
      onError: (err) {
        addCoreLog('[$_activeCoreType ERR] $err');
        if (!stdoutCompleter.isCompleted) stdoutCompleter.complete();
      },
    );

    var stderrBuf = '';
    activeProc.stderr.transform(decoder).listen(
      (chunk) {
        stderrBuf += chunk;
        while (stderrBuf.contains('\n')) {
          final idx = stderrBuf.indexOf('\n');
          final line = stderrBuf.substring(0, idx);
          stderrBuf = stderrBuf.substring(idx + 1);
          handleLine(line);
        }
      },
      onDone: () {
        if (stderrBuf.trim().isNotEmpty) {
          handleLine(stderrBuf);
          stderrBuf = '';
        }
        if (!stderrCompleter.isCompleted) stderrCompleter.complete();
      },
      onError: (err) {
        addCoreLog('[$_activeCoreType ERR] $err');
        if (!stderrCompleter.isCompleted) stderrCompleter.complete();
      },
    );

    activeProc.exitCode.then((code) async {
      // Ensure all pending log lines from stdout and stderr are processed first
      await Future.wait([stdoutCompleter.future, stderrCompleter.future]).timeout(
        const Duration(milliseconds: 300),
        onTimeout: () => [],
      );

      final wasIntentional = _intentionalStopPids.remove(activeProc.pid);
      if (wasIntentional || code == 0 || code == -1 || code == 15) {
        // Normal intentional stop or clean termination
      } else {
        addAppLog('❌ Ядро $_activeCoreType завершило работу с ошибкой (код $code).');
      }

      if (_activeProcess?.pid == activeProc.pid) {
        _activeProcess = null;
        stopTelemetry();
      }
    });

    if (isSystemProxy && !isTunMode) {
      await WindowsNetManager.enableSystemProxy(httpPort: _activeHttpPort);
      addAppLog('Системный прокси Windows активирован -> 127.0.0.1:$_activeHttpPort');
    }

    startTelemetry();
  }

  Future<void> stopCore({bool isProxyEnabled = false}) async {
    stopTelemetry();
    if (isProxyEnabled) {
      WindowsNetManager.disableSystemProxy().ignore();
    }

    if (_activeProcess != null) {
      final pid = _activeProcess!.pid;
      _intentionalStopPids.add(pid);
      try {
        _activeProcess!.kill(ProcessSignal.sigkill);
      } catch (_) {}
      _activeProcess = null;
    }

    await WindowsNetManager.killExistingCores();
    addAppLog('Ядро остановлено.');
  }

  void addAppLog(String line) {
    final timestamp = DateTime.now().toIso8601String().substring(11, 19);
    final formatted = '[$timestamp] [App] $line';
    _appLogs.add(formatted);
    if (_appLogs.length > 1000) _appLogs.removeAt(0);
    if (_appLogController.hasListener) {
      _appLogController.add(formatted);
    }
  }

  void addCoreLog(String line) {
    final timestamp = DateTime.now().toIso8601String().substring(11, 19);
    final formatted = '[$timestamp] $line';
    _coreLogs.add(formatted);
    if (_coreLogs.length > 1000) _coreLogs.removeAt(0);
    if (_coreLogController.hasListener) {
      _coreLogController.add(formatted);
    }
  }

  void startTelemetry() {
    stopTelemetry();
    _telemetryTimer = Timer.periodic(const Duration(milliseconds: 1000), (_) => _pollCoreTelemetry());
  }

  void stopTelemetry() {
    _telemetryTimer?.cancel();
    _telemetryTimer = null;
    _statsController.add(const TrafficStats());
  }

  void _pollCoreTelemetry() {
    if (!isRunning) return;
    try {
      final res = SentinelCoreBindings.instance.getRealtimeTraffic('127.0.0.1:$_activeClashPort');
      if (res.isNotEmpty && res != '{}') {
        final data = jsonDecode(res);
        final upSpeed = (data['uploadSpeed'] as num?)?.toInt() ?? 0;
        final downSpeed = (data['downloadSpeed'] as num?)?.toInt() ?? 0;
        final upTotal = (data['uploadTotal'] as num?)?.toInt() ?? 0;
        final downTotal = (data['downloadTotal'] as num?)?.toInt() ?? 0;
        _statsController.add(TrafficStats(
          uploadSpeedBytes: upSpeed,
          downloadSpeedBytes: downSpeed,
          totalUploadBytes: upTotal,
          totalDownloadBytes: downTotal,
        ));
      }
    } catch (_) {}
  }
}
