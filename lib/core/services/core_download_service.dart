import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:archive/archive.dart';
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;
import '../models/github_release_model.dart';
import 'core_supervisor.dart';

class CoreDownloadService {
  static final CoreDownloadService instance = CoreDownloadService._();
  CoreDownloadService._();

  static const Map<String, String> coreRepositories = {
    'sentinel_core': 'blackalex1/sentinel-core',
    'singbox': 'SagerNet/sing-box',
    'xray': 'XTLS/Xray-core',
    'hysteria': 'apernet/hysteria',
  };

  /// Returns the target directory where downloaded binaries are placed
  Directory getBinariesDir() {
    final exeDir = p.dirname(Platform.resolvedExecutable);
    final candidates = [
      Directory(p.join(exeDir, 'binaries')),
      Directory(p.join(Directory.current.path, 'binaries')),
      Directory(p.join(Directory.current.path, 'dist_native', 'binaries')),
    ];

    for (final dir in candidates) {
      if (dir.existsSync()) return dir;
    }

    // Default to appdata binaries if local not writable
    final appData = Platform.environment['APPDATA'] ?? Directory.current.path;
    final dir = Directory(p.join(appData, 'SentinelSecure', 'binaries'));
    if (!dir.existsSync()) {
      dir.createSync(recursive: true);
    }
    return dir;
  }

  /// Fetches releases for a given repository from GitHub API
  Future<List<GithubReleaseInfo>> fetchReleases({
    required String repo,
    bool includePrereleases = false,
  }) async {
    final url = Uri.parse('https://api.github.com/repos/$repo/releases?per_page=30');
    final response = await http.get(
      url,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'SentinelDesktop-CoreManager',
      },
    );

    if (response.statusCode != 200) {
      throw Exception('Ошибка GitHub API (${response.statusCode}): ${response.body}');
    }

    final List<dynamic> data = jsonDecode(response.body);
    final allReleases = data.map((e) => GithubReleaseInfo.fromJson(e as Map<String, dynamic>)).toList();

    if (!includePrereleases) {
      return allReleases.where((r) => !r.isPrerelease).toList();
    }
    return allReleases;
  }

  /// Finds the best matching Windows asset for the specified core
  GithubAsset? findMatchingAsset(List<GithubAsset> assets, String coreType) {
    final normalized = coreType.toLowerCase();

    if (normalized == 'sentinel_core') {
      // Look for sentinel-core.dll or sentinel-core-windows-amd64.dll or zip
      for (final a in assets) {
        final n = a.name.toLowerCase();
        if ((n.contains('sentinel') || n.contains('core')) && (n.endsWith('.dll') || n.endsWith('.zip'))) {
          return a;
        }
      }
      if (assets.isNotEmpty) return assets.first;
      return null;
    }

    if (normalized == 'singbox' || normalized.contains('sing')) {
      // Look for sing-box-*-windows-amd64.zip
      for (final a in assets) {
        final n = a.name.toLowerCase();
        if (n.contains('windows') && (n.contains('amd64') || n.contains('x86_64') || n.contains('64')) && n.endsWith('.zip')) {
          return a;
        }
      }
      for (final a in assets) {
        final n = a.name.toLowerCase();
        if (n.contains('windows') && n.endsWith('.zip')) return a;
      }
    }

    if (normalized == 'xray') {
      // Look for Xray-windows-64.zip
      for (final a in assets) {
        final n = a.name.toLowerCase();
        if (n.contains('windows') && (n.contains('64') || n.contains('amd64')) && n.endsWith('.zip')) {
          return a;
        }
      }
      for (final a in assets) {
        final n = a.name.toLowerCase();
        if (n.contains('windows') && n.endsWith('.zip')) return a;
      }
    }

    if (normalized == 'hysteria') {
      // Look for hysteria-windows-amd64.exe or .zip
      for (final a in assets) {
        final n = a.name.toLowerCase();
        if (n.contains('windows') && (n.contains('amd64') || n.contains('x86_64') || n.contains('64'))) {
          return a;
        }
      }
      for (final a in assets) {
        final n = a.name.toLowerCase();
        if (n.contains('windows')) return a;
      }
    }

    if (assets.isNotEmpty) return assets.first;
    return null;
  }

  /// Downloads and extracts the asset to binaries directory
  Future<String> downloadAndInstallCore({
    required GithubAsset asset,
    required String coreType,
    required void Function(double progress, String status) onProgress,
  }) async {
    onProgress(0.05, 'Подключение к GitHub...');

    // Stop supervisor if the updating core is currently running
    final isRunningThisCore = CoreSupervisor.instance.isRunning &&
        CoreSupervisor.instance.activeCoreType.toLowerCase().contains(coreType.toLowerCase());
    if (isRunningThisCore) {
      onProgress(0.08, 'Остановка активного ядра...');
      await CoreSupervisor.instance.stopCore();
    }

    final client = http.Client();
    final request = http.Request('GET', Uri.parse(asset.downloadUrl));
    request.headers['User-Agent'] = 'SentinelDesktop-CoreManager';

    final response = await client.send(request);
    if (response.statusCode != 200) {
      throw Exception('Ошибка загрузки файла с сервера (${response.statusCode})');
    }

    final contentLength = response.contentLength ?? asset.size;
    int receivedBytes = 0;
    final bytesBuilder = BytesBuilder(copy: false);

    onProgress(0.1, 'Загрузка архива (${(contentLength / (1024 * 1024)).toStringAsFixed(1)} МБ)...');

    await for (final chunk in response.stream) {
      bytesBuilder.add(chunk);
      receivedBytes += chunk.length;
      if (contentLength > 0) {
        final prog = 0.1 + 0.7 * (receivedBytes / contentLength);
        final mb = (receivedBytes / (1024 * 1024)).toStringAsFixed(1);
        final totalMb = (contentLength / (1024 * 1024)).toStringAsFixed(1);
        onProgress(prog.clamp(0.0, 0.8), 'Загрузка: $mb / $totalMb МБ');
      }
    }

    final downloadedBytes = bytesBuilder.takeBytes();
    onProgress(0.85, 'Распаковка и установка компонентов...');

    final binDir = getBinariesDir();
    if (!binDir.existsSync()) {
      binDir.createSync(recursive: true);
    }

    final fileName = asset.name.toLowerCase();
    String targetBinaryPath = '';

    if (fileName.endsWith('.zip')) {
      final archive = ZipDecoder().decodeBytes(downloadedBytes);

      String expectedExeName = 'sing-box.exe';
      if (coreType == 'xray') expectedExeName = 'xray.exe';
      if (coreType == 'hysteria') expectedExeName = 'hysteria.exe';
      if (coreType == 'sentinel_core') expectedExeName = 'sentinel-core.dll';

      ArchiveFile? mainBinaryFile;
      for (final file in archive) {
        if (file.isFile) {
          final bName = p.basename(file.name).toLowerCase();
          if (bName == expectedExeName || bName.endsWith('.exe') || bName.endsWith('.dll')) {
            mainBinaryFile = file;
            break;
          }
        }
      }

      if (mainBinaryFile == null) {
        throw Exception('В скачанном архиве не найден исполняемый файл ($expectedExeName)');
      }

      final outFile = File(p.join(binDir.path, expectedExeName));
      await outFile.writeAsBytes(mainBinaryFile.content);
      targetBinaryPath = outFile.path;

      // Also extract any geoip/geosite files if present in the zip
      for (final file in archive) {
        if (file.isFile) {
          final bName = p.basename(file.name).toLowerCase();
          if (bName.endsWith('.dat') || bName.endsWith('.db')) {
            final datFile = File(p.join(binDir.path, bName));
            await datFile.writeAsBytes(file.content);
          }
        }
      }
    } else {
      // Direct executable or dll download
      String targetName = asset.name;
      if (coreType == 'sentinel_core') targetName = 'sentinel-core.dll';
      if (coreType == 'singbox' && !targetName.endsWith('.exe')) targetName = 'sing-box.exe';
      if (coreType == 'xray' && !targetName.endsWith('.exe')) targetName = 'xray.exe';
      if (coreType == 'hysteria' && !targetName.endsWith('.exe')) targetName = 'hysteria.exe';

      final outFile = File(p.join(binDir.path, targetName));
      await outFile.writeAsBytes(downloadedBytes);
      targetBinaryPath = outFile.path;
    }

    onProgress(1.0, 'Успешно установлено!');
    return targetBinaryPath;
  }
}
