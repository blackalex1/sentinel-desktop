import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/ffi/sentinel_core_bindings.dart';
import '../../core/models/github_release_model.dart';
import '../../core/providers/app_state_provider.dart';
import '../../core/services/core_download_service.dart';
import '../widgets/bento_card.dart';

class CoresScreen extends StatefulWidget {
  const CoresScreen({super.key});

  @override
  State<CoresScreen> createState() => _CoresScreenState();
}

class _CoresScreenState extends State<CoresScreen> {
  bool _includePrereleases = false;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppStateProvider>();
    final sentinelVersion = SentinelCoreBindings.instance.version;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with Pre-release toggle & info
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.hub_rounded, color: AppColors.primary, size: 22),
                  const SizedBox(width: 10),
                  const Text(
                    'Управление и загрузка прокси-ядер',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),

              // Pre-releases switch container
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.bgSurface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: _includePrereleases ? AppColors.neonViolet.withValues(alpha: 0.4) : AppColors.borderSubtle,
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.science_outlined, size: 16, color: AppColors.neonViolet),
                    const SizedBox(width: 8),
                    const Text(
                      'Включать пре-релизы (Beta / Pre-release)',
                      style: TextStyle(color: AppColors.textPrimary, fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(width: 8),
                    Switch(
                      value: _includePrereleases,
                      activeThumbColor: AppColors.neonViolet,
                      activeTrackColor: AppColors.neonViolet.withValues(alpha: 0.3),
                      onChanged: (val) {
                        setState(() => _includePrereleases = val);
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),

          // Section 1: Sentinel Core Native Engine
          const Row(
            children: [
              Icon(Icons.shield_outlined, color: AppColors.neonCyan, size: 16),
              SizedBox(width: 8),
              Text(
                'СИСТЕМНОЕ ЯДРО БЕЗОПАСНОСТИ (SENTINEL CORE)',
                style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.0),
              ),
            ],
          ),
          const SizedBox(height: 10),

          _SentinelCoreCard(
            version: sentinelVersion,
            includePrereleases: _includePrereleases,
            onOpenReleases: () => _openReleasesModal(
              context,
              coreType: 'sentinel_core',
              coreTitle: 'Sentinel Core (sentinel-core.dll)',
              repo: CoreDownloadService.coreRepositories['sentinel_core'] ?? 'blackalex1/sentinel-core',
            ),
          ),
          const SizedBox(height: 22),

          // Section 2: Routing & Proxy Engines
          const Row(
            children: [
              Icon(Icons.memory_rounded, color: AppColors.neonViolet, size: 16),
              SizedBox(width: 8),
              Text(
                'ПРОКСИ И СЕТЕВЫЕ ЯДРА МАРШРУТИЗАЦИИ (GITHUB RELEASES)',
                style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.0),
              ),
            ],
          ),
          const SizedBox(height: 10),

          _CoreInfoCard(
            name: 'Sing-box Core',
            version: 'v1.12.0',
            repo: CoreDownloadService.coreRepositories['singbox']!,
            isActive: state.activeCore == 'singbox',
            includePrereleases: _includePrereleases,
            onSelect: () => state.updateSettings(activeCore: 'singbox'),
            onDownload: () => _openReleasesModal(
              context,
              coreType: 'singbox',
              coreTitle: 'Sing-box Core (sing-box.exe)',
              repo: CoreDownloadService.coreRepositories['singbox']!,
            ),
          ),
          const SizedBox(height: 12),

          _CoreInfoCard(
            name: 'Xray-core',
            version: 'v26.0.0',
            repo: CoreDownloadService.coreRepositories['xray']!,
            isActive: state.activeCore == 'xray',
            includePrereleases: _includePrereleases,
            onSelect: () => state.updateSettings(activeCore: 'xray'),
            onDownload: () => _openReleasesModal(
              context,
              coreType: 'xray',
              coreTitle: 'Xray-core (xray.exe)',
              repo: CoreDownloadService.coreRepositories['xray']!,
            ),
          ),
          const SizedBox(height: 12),

          _CoreInfoCard(
            name: 'Hysteria 2 Core',
            version: 'v2.6.0',
            repo: CoreDownloadService.coreRepositories['hysteria']!,
            isActive: state.activeCore == 'hysteria',
            includePrereleases: _includePrereleases,
            onSelect: () => state.updateSettings(activeCore: 'hysteria'),
            onDownload: () => _openReleasesModal(
              context,
              coreType: 'hysteria',
              coreTitle: 'Hysteria 2 Core (hysteria.exe)',
              repo: CoreDownloadService.coreRepositories['hysteria']!,
            ),
          ),
        ],
      ),
    );
  }

  void _openReleasesModal(
    BuildContext context, {
    required String coreType,
    required String coreTitle,
    required String repo,
  }) {
    showDialog(
      context: context,
      builder: (ctx) => _ReleasesDialog(
        coreType: coreType,
        coreTitle: coreTitle,
        repo: repo,
        includePrereleases: _includePrereleases,
      ),
    );
  }
}

class _SentinelCoreCard extends StatelessWidget {
  final String version;
  final bool includePrereleases;
  final VoidCallback onOpenReleases;

  const _SentinelCoreCard({
    required this.version,
    required this.includePrereleases,
    required this.onOpenReleases,
  });

  @override
  Widget build(BuildContext context) {
    return BentoCard(
      isGlow: true,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: AppColors.neonCyan.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.neonCyan.withValues(alpha: 0.3)),
                ),
                child: const Icon(Icons.shield_rounded, color: AppColors.neonCyan, size: 22),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text(
                        'Sentinel Core Engine',
                        style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.borderSubtle,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'Версия: $version',
                          style: const TextStyle(color: AppColors.neonCyan, fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  const Text(
                    'GitHub: blackalex1/sentinel-core (библиотека sentinel-core.dll)',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                  ),
                ],
              ),
            ],
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.neonCyan.withValues(alpha: 0.15),
              foregroundColor: AppColors.neonCyan,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: BorderSide(color: AppColors.neonCyan.withValues(alpha: 0.4)),
              ),
            ),
            icon: const Icon(Icons.download_rounded, size: 16),
            label: const Text('Скачать / Обновить с GitHub', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
            onPressed: onOpenReleases,
          ),
        ],
      ),
    );
  }
}

class _CoreInfoCard extends StatelessWidget {
  final String name;
  final String version;
  final String repo;
  final bool isActive;
  final bool includePrereleases;
  final VoidCallback onSelect;
  final VoidCallback onDownload;

  const _CoreInfoCard({
    required this.name,
    required this.version,
    required this.repo,
    required this.isActive,
    required this.includePrereleases,
    required this.onSelect,
    required this.onDownload,
  });

  @override
  Widget build(BuildContext context) {
    return BentoCard(
      isGlow: isActive,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Icon(Icons.memory_rounded, size: 22, color: isActive ? AppColors.neonCyan : AppColors.textSecondary),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(name, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold)),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: AppColors.borderSubtle, borderRadius: BorderRadius.circular(4)),
                        child: Text(version, style: const TextStyle(color: AppColors.textMuted, fontSize: 9)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text('GitHub: $repo', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                ],
              ),
            ],
          ),

          Row(
            children: [
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.neonCyan,
                  side: BorderSide(color: AppColors.neonCyan.withValues(alpha: 0.35)),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                ),
                icon: const Icon(Icons.cloud_download_outlined, size: 15),
                label: const Text('Релизы на GitHub', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                onPressed: onDownload,
              ),
              const SizedBox(width: 10),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: isActive ? AppColors.neonCyan : AppColors.bgSurface,
                  foregroundColor: isActive ? Colors.black : AppColors.textPrimary,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(6),
                    side: BorderSide(color: isActive ? Colors.transparent : AppColors.borderSubtle),
                  ),
                ),
                onPressed: onSelect,
                child: Text(isActive ? 'АКТИВНО' : 'Выбрать', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ReleasesDialog extends StatefulWidget {
  final String coreType;
  final String coreTitle;
  final String repo;
  final bool includePrereleases;

  const _ReleasesDialog({
    required this.coreType,
    required this.coreTitle,
    required this.repo,
    required this.includePrereleases,
  });

  @override
  State<_ReleasesDialog> createState() => _ReleasesDialogState();
}

class _ReleasesDialogState extends State<_ReleasesDialog> {
  late bool _includePrereleases;
  bool _isLoading = true;
  String? _errorMessage;
  List<GithubReleaseInfo> _releases = [];

  // Download state
  String? _downloadingTag;
  double _downloadProgress = 0.0;
  String _downloadStatus = '';

  @override
  void initState() {
    super.initState();
    _includePrereleases = widget.includePrereleases;
    _fetchReleases();
  }

  Future<void> _fetchReleases() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final list = await CoreDownloadService.instance.fetchReleases(
        repo: widget.repo,
        includePrereleases: _includePrereleases,
      );
      setState(() {
        _releases = list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _startDownload(GithubReleaseInfo release, GithubAsset asset) async {
    setState(() {
      _downloadingTag = release.tagName;
      _downloadProgress = 0.0;
      _downloadStatus = 'Подготовка к загрузке...';
    });

    try {
      await CoreDownloadService.instance.downloadAndInstallCore(
        asset: asset,
        coreType: widget.coreType,
        onProgress: (prog, status) {
          setState(() {
            _downloadProgress = prog;
            _downloadStatus = status;
          });
        },
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.neonGreen.withValues(alpha: 0.9),
            content: Text(
              '${widget.coreTitle} (${release.tagName}) успешно установлено!',
              style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
            ),
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      setState(() {
        _downloadingTag = null;
        _errorMessage = 'Ошибка установки: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd.MM.yyyy');

    return AlertDialog(
      backgroundColor: AppColors.bgCard,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.borderSubtle),
      ),
      titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
      title: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              const Icon(Icons.cloud_download_rounded, color: AppColors.neonCyan, size: 22),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.coreTitle, style: const TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Text('GitHub: https://github.com/${widget.repo}', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                ],
              ),
            ],
          ),
          Row(
            children: [
              // Pre-release toggle inside dialog
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.bgSurface,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: _includePrereleases ? AppColors.neonViolet.withValues(alpha: 0.4) : AppColors.borderSubtle),
                ),
                child: Row(
                  children: [
                    const Text('Пре-релизы', style: TextStyle(color: AppColors.textSecondary, fontSize: 10, fontWeight: FontWeight.bold)),
                    const SizedBox(width: 4),
                    Switch(
                      value: _includePrereleases,
                      activeThumbColor: AppColors.neonViolet,
                      activeTrackColor: AppColors.neonViolet.withValues(alpha: 0.3),
                      onChanged: (val) {
                        setState(() => _includePrereleases = val);
                        _fetchReleases();
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.refresh_rounded, color: AppColors.neonCyan, size: 20),
                onPressed: _fetchReleases,
                tooltip: 'Обновить список релизов',
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, color: AppColors.textMuted, size: 20),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
        ],
      ),
      contentPadding: const EdgeInsets.fromLTRB(20, 10, 20, 20),
      content: SizedBox(
        width: 620,
        height: 480,
        child: _buildDialogContent(dateFormat),
      ),
    );
  }

  Widget _buildDialogContent(DateFormat dateFormat) {
    if (_isLoading) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: AppColors.neonCyan),
            SizedBox(height: 16),
            Text('Получение списка релизов с GitHub API...', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
          ],
        ),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded, color: AppColors.neonRed, size: 36),
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.neonCyan, foregroundColor: Colors.black),
                icon: const Icon(Icons.refresh_rounded, size: 16),
                label: const Text('Попробовать снова'),
                onPressed: _fetchReleases,
              ),
            ],
          ),
        ),
      );
    }

    if (_releases.isEmpty) {
      return const Center(
        child: Text('Релизы не найдены в репозитории.', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
      );
    }

    return ListView.separated(
      itemCount: _releases.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final rel = _releases[index];
        final isDownloadingThis = _downloadingTag == rel.tagName;
        final asset = CoreDownloadService.instance.findMatchingAsset(rel.assets, widget.coreType);
        final dateStr = rel.publishedAt != null ? dateFormat.format(rel.publishedAt!) : '';

        return BentoCard(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Text(
                        rel.tagName,
                        style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(width: 8),
                      if (rel.isPrerelease)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.neonViolet.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: AppColors.neonViolet.withValues(alpha: 0.4)),
                          ),
                          child: const Text(
                            'PRE-RELEASE / BETA',
                            style: TextStyle(color: AppColors.neonViolet, fontSize: 9, fontWeight: FontWeight.bold),
                          ),
                        )
                      else
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.neonGreen.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: AppColors.neonGreen.withValues(alpha: 0.3)),
                          ),
                          child: const Text(
                            'STABLE',
                            style: TextStyle(color: AppColors.neonGreen, fontSize: 9, fontWeight: FontWeight.bold),
                          ),
                        ),
                      if (dateStr.isNotEmpty) ...[
                        const SizedBox(width: 10),
                        Text(dateStr, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                      ],
                    ],
                  ),

                  if (asset != null && !isDownloadingThis)
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.neonCyan,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                      ),
                      icon: const Icon(Icons.download_rounded, size: 15),
                      label: Text(
                        'Скачать (${(asset.size / (1024 * 1024)).toStringAsFixed(1)} МБ)',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                      onPressed: () => _startDownload(rel, asset),
                    )
                  else if (asset == null)
                    const Text('Нет пакета под Windows', style: TextStyle(color: AppColors.textMuted, fontSize: 10)),
                ],
              ),

              if (isDownloadingThis) ...[
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: _downloadProgress,
                    backgroundColor: AppColors.bgSurface,
                    color: AppColors.neonCyan,
                    minHeight: 6,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(_downloadStatus, style: const TextStyle(color: AppColors.neonCyan, fontSize: 11, fontWeight: FontWeight.bold)),
                    Text('${(_downloadProgress * 100).toInt()}%', style: const TextStyle(color: AppColors.textPrimary, fontSize: 11, fontWeight: FontWeight.bold)),
                  ],
                ),
              ],

              if (rel.body.trim().isNotEmpty && !isDownloadingThis) ...[
                const SizedBox(height: 8),
                Text(
                  rel.body.trim(),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 11, height: 1.3),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
