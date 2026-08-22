import 'dart:io';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/providers/app_state_provider.dart';
import '../../core/services/hotspot_service.dart';

class HotspotScreen extends StatefulWidget {
  const HotspotScreen({super.key});

  @override
  State<HotspotScreen> createState() => _HotspotScreenState();
}

class _HotspotScreenState extends State<HotspotScreen> {
  final _ipController = TextEditingController();
  List<String> _candidateGateways = [];
  bool _isScanning = false;
  bool _isPairing = false;
  HotspotDiscoveryResult? _discoveryResult;
  String _currentPin = '8167';

  static const String sentinelMobileGithubUrl = 'https://github.com/blackalex1/sentinel-mobile';

  @override
  void initState() {
    super.initState();
    _loadGateways();
  }

  @override
  void dispose() {
    _ipController.dispose();
    super.dispose();
  }

  void _generatePin() {
    final rand = Random();
    setState(() {
      _currentPin = (1000 + rand.nextInt(9000)).toString();
    });
  }

  Future<void> _loadGateways() async {
    final gws = await HotspotService.instance.getCandidateGateways();
    if (mounted) {
      setState(() {
        _candidateGateways = gws;
        if (gws.isNotEmpty && _ipController.text.isEmpty) {
          _ipController.text = gws.first;
        }
      });
    }
  }

  void _openUrl(String url) {
    try {
      if (Platform.isWindows) {
        Process.run('cmd', ['/c', 'start', '', url]);
      } else if (Platform.isMacOS) {
        Process.run('open', [url]);
      } else if (Platform.isLinux) {
        Process.run('xdg-open', [url]);
      }
    } catch (_) {}
  }

  Future<void> _probePhone() async {
    final targetIp = _ipController.text.trim();
    if (targetIp.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFF0F172A),
          content: Text('⚠️ Укажите IP-адрес телефона или подключитесь к Wi-Fi точке доступа',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        ),
      );
      return;
    }

    if (_isScanning) return;
    setState(() {
      _isScanning = true;
      _discoveryResult = null;
    });

    final res = await HotspotService.instance.probePairingServer(targetIp);

    if (mounted) {
      setState(() {
        _isScanning = false;
        _discoveryResult = res;
      });

      if (res.found) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF0F172A),
            content: Row(
              children: [
                const Icon(Icons.check_circle_rounded, color: AppColors.neonGreen, size: 18),
                const SizedBox(width: 10),
                Text('🟢 Телефон обнаружен на ${res.gatewayIP}:${res.pairingPort}',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF0F172A),
            content: Row(
              children: [
                const Icon(Icons.error_outline_rounded, color: AppColors.neonRed, size: 18),
                const SizedBox(width: 10),
                Text(res.errorMessage ?? 'Телефон не найден на этом IP',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        );
      }
    }
  }

  Future<void> _requestPairingAndConnect() async {
    final targetIp = _ipController.text.trim();
    if (targetIp.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFF0F172A),
          content: Text('⚠️ Укажите IP-адрес телефона или подключитесь к Wi-Fi точке доступа',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        ),
      );
      return;
    }

    if (_isPairing) return;
    final res = _discoveryResult;

    final ip = (res != null && res.found) ? res.gatewayIP : targetIp;
    final port = (res != null && res.found) ? res.pairingPort : 18080;

    _generatePin();

    setState(() {
      _isPairing = true;
    });

    final pairRes = await HotspotService.instance.requestPairingWithPIN(
      gatewayIP: ip,
      pairingPort: port,
      pinCode: _currentPin,
    );

    if (mounted) {
      setState(() {
        _isPairing = false;
      });

      if (pairRes['success'] == true) {
        final socksPort = (pairRes['socksPort'] as int?) ?? (pairRes['port'] as int?) ?? 10808;
        final proto = (pairRes['proxyType'] as String?) ?? 'socks';
        final user = pairRes['username'] as String?;
        final pass = pairRes['password'] as String?;

        final server = HotspotService.instance.createHotspotServer(
          gatewayIP: ip,
          port: socksPort,
          protocol: proto,
          username: user,
          password: pass,
        );

        final appState = context.read<AppStateProvider>();
        appState.addServer(server);
        appState.setSelectedServer(server.id);

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF0F172A),
            content: Row(
              children: [
                const Icon(Icons.verified_rounded, color: AppColors.neonGreen, size: 20),
                const SizedBox(width: 10),
                Text('✅ Сопряжение успешно! Сервер "${server.name}" активирован.',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
        );

        // Auto connect
        await appState.connect();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF0F172A),
            content: Row(
              children: [
                const Icon(Icons.cancel_rounded, color: AppColors.neonRed, size: 20),
                const SizedBox(width: 10),
                Text(pairRes['error']?.toString() ?? 'Сопряжение отклонено на телефоне',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // =========================================================================
          // TOP HEADER BAR (Panel Style)
          // =========================================================================
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Раздача с мобильного телефона',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.3,
                    ),
                  ),
                  SizedBox(height: 3),
                  Text(
                    'Безопасное сопряжение с точкой доступа Wi-Fi (Sentinel Phone Tethering)',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),

              // Right Status Badges
              Row(
                children: [
                  _buildStatusPill(
                    label: _isPairing
                        ? 'Ожидание PIN на телефоне'
                        : (_discoveryResult?.found == true ? 'Телефон найден' : 'Ожидание сети'),
                    color: _isPairing
                        ? AppColors.neonViolet
                        : (_discoveryResult?.found == true ? AppColors.neonGreen : AppColors.primary),
                    icon: _isPairing
                        ? Icons.hourglass_top_rounded
                        : (_discoveryResult?.found == true ? Icons.wifi_tethering_rounded : Icons.wifi_find_rounded),
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 22),

          // =========================================================================
          // TWO-COLUMN BENTO GRID
          // =========================================================================
          LayoutBuilder(
            builder: (context, constraints) {
              final isWide = constraints.maxWidth > 860;

              if (isWide) {
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Left Column: Main Pairing Control Card
                    Expanded(
                      flex: 6,
                      child: _buildMainPairingCard(),
                    ),
                    const SizedBox(width: 20),

                    // Right Column: Guide Card
                    Expanded(
                      flex: 5,
                      child: _buildInstructionsCard(),
                    ),
                  ],
                );
              } else {
                return Column(
                  children: [
                    _buildMainPairingCard(),
                    const SizedBox(height: 20),
                    _buildInstructionsCard(),
                  ],
                );
              }
            },
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // SECTION: MAIN PAIRING CONTROL CARD
  // ===========================================================================
  Widget _buildMainPairingCard() {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderColor),
        boxShadow: const [
          BoxShadow(
            color: Color(0x60000000),
            blurRadius: 20,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Card Header with Icon & Subtitle
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                ),
                child: const Icon(Icons.phone_android_rounded, color: AppColors.primary, size: 22),
              ),
              const SizedBox(width: 14),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Режим Wi-Fi Hotspot Сопряжения',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Маршрутизирует весь трафик ПК через VPN-туннель вашего смартфона без блокировок оператора',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 11.5,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),
          const Divider(color: Color(0x1AFFFFFF), height: 1),
          const SizedBox(height: 20),

          // IP Address Input Field & Scan Button
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'IP-адрес телефона (Шлюз сети):',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.bgInput,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.borderColor),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Row(
                        children: [
                          const Icon(Icons.router_rounded, color: AppColors.primary, size: 18),
                          const SizedBox(width: 10),
                          Expanded(
                            child: TextField(
                              controller: _ipController,
                              style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 13,
                                fontFamily: 'monospace',
                                fontWeight: FontWeight.w600,
                              ),
                              decoration: const InputDecoration(
                                border: InputBorder.none,
                                isDense: true,
                                hintText: 'Введите IP шлюза или выберите из списка',
                                hintStyle: TextStyle(color: AppColors.textMuted, fontSize: 12),
                              ),
                            ),
                          ),
                          if (_candidateGateways.isNotEmpty)
                            PopupMenuButton<String>(
                              icon: const Icon(Icons.arrow_drop_down_rounded, color: AppColors.primary, size: 22),
                              color: const Color(0xFF0F1426),
                              tooltip: 'Выбрать из обнаруженных шлюзов',
                              onSelected: (val) {
                                setState(() {
                                  _ipController.text = val;
                                });
                              },
                              itemBuilder: (ctx) => _candidateGateways
                                  .map(
                                    (gw) => PopupMenuItem(
                                      value: gw,
                                      child: Text(gw, style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontFamily: 'monospace')),
                                    ),
                                  )
                                  .toList(),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),

              // Probe Button
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.bgSurface,
                  foregroundColor: AppColors.primary,
                  elevation: 0,
                  side: const BorderSide(color: AppColors.primary, width: 1.2),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                icon: _isScanning
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
                    : const Icon(Icons.radar_rounded, size: 16),
                label: Text(
                  _isScanning ? 'Поиск...' : 'Проверить',
                  style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold),
                ),
                onPressed: _isScanning ? null : _probePhone,
              ),
            ],
          ),

          const SizedBox(height: 20),

          // =========================================================================
          // DYNAMIC PIN CODE CARD (APPEARS ONLY DURING PAIRING REQUEST)
          // =========================================================================
          if (_isPairing) ...[
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFF080C1A),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.primary, width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.25),
                    blurRadius: 20,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.lock_outline_rounded, color: AppColors.primary, size: 16),
                          SizedBox(width: 8),
                          Text(
                            'КОД СОПРЯЖЕНИЯ (PIN):',
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ],
                      ),

                      // Copy PIN Button
                      IconButton(
                        icon: const Icon(Icons.copy_rounded, color: AppColors.textSecondary, size: 16),
                        tooltip: 'Скопировать PIN',
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: _currentPin));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('📋 PIN скопирован в буфер обмена'),
                              duration: Duration(seconds: 1),
                              backgroundColor: Color(0xFF0F172A),
                            ),
                          );
                        },
                      ),
                    ],
                  ),

                  const SizedBox(height: 14),

                  // Glowing Digit Boxes
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: _currentPin.split('').map((digit) {
                      return Container(
                        width: 54,
                        height: 60,
                        margin: const EdgeInsets.symmetric(horizontal: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF12182E),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.primary, width: 2.0),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.35),
                              blurRadius: 14,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          digit,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 30,
                            fontWeight: FontWeight.w900,
                            fontFamily: 'monospace',
                            letterSpacing: -0.5,
                          ),
                        ),
                      );
                    }).toList(),
                  ),

                  const SizedBox(height: 12),
                  const Text(
                    '📲 Введите этот код в появившемся окне приложения Sentinel на телефоне',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.neonPurple, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
          ],

          // Discovery Status Card (if checked)
          if (_discoveryResult != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: _discoveryResult!.found
                    ? AppColors.neonGreen.withValues(alpha: 0.08)
                    : AppColors.neonRed.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: _discoveryResult!.found
                      ? AppColors.neonGreen.withValues(alpha: 0.35)
                      : AppColors.neonRed.withValues(alpha: 0.35),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    _discoveryResult!.found ? Icons.check_circle_rounded : Icons.info_outline_rounded,
                    color: _discoveryResult!.found ? AppColors.neonGreen : AppColors.neonRed,
                    size: 20,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _discoveryResult!.found
                          ? '✅ Sentinel Phone обнаружен (${_discoveryResult!.gatewayIP}:${_discoveryResult!.pairingPort}) — SOCKS5 порт: ${_discoveryResult!.socksPort}'
                          : '⚠️ ${_discoveryResult!.errorMessage}',
                      style: TextStyle(
                        color: _discoveryResult!.found ? AppColors.neonGreen : AppColors.neonRed,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
          ],

          // Action Button: Request Pairing and Connect
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                shadowColor: AppColors.primaryGlow,
              ),
              icon: _isPairing
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.bolt_rounded, size: 20),
              label: Text(
                _isPairing
                    ? 'Ожидание подтверждения на смартфоне (PIN: $_currentPin)...'
                    : 'Запросить сопряжение и подключиться',
                style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold),
              ),
              onPressed: _isPairing ? null : _requestPairingAndConnect,
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // SECTION: INSTRUCTIONS CARD WITH INLINE CLICKABLE LINK
  // ===========================================================================
  Widget _buildInstructionsCard() {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderColor),
        boxShadow: const [
          BoxShadow(
            color: Color(0x60000000),
            blurRadius: 20,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.auto_awesome_rounded, color: AppColors.primary, size: 18),
              SizedBox(width: 10),
              Text(
                'Инструкция по подключению',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          _buildInstructionStep(
            stepNumber: '1',
            title: 'Включите точку доступа (Wi-Fi Hotspot)',
            description: 'Включите раздачу Wi-Fi на смартфоне и подключите компьютер к этой сети.',
          ),
          const SizedBox(height: 16),

          _buildInstructionStepWithInlineLink(
            stepNumber: '2',
            titlePrefix: 'Активируйте раздачу в ',
            clickableWord: 'Sentinel',
            titleSuffix: ' на телефоне',
            descriptionPrefix: 'Откройте приложение ',
            descriptionClickable: 'Sentinel',
            descriptionSuffix: ' на смартфоне и включите тумблер «Раздача VPN по Wi-Fi».',
            onLinkTap: () => _openUrl(sentinelMobileGithubUrl),
          ),
          const SizedBox(height: 16),

          _buildInstructionStep(
            stepNumber: '3',
            title: 'Подтвердите сопряжение',
            description: 'Нажмите «Запросить сопряжение» и введите сгенерированный PIN-код на телефоне.',
          ),
        ],
      ),
    );
  }

  Widget _buildInstructionStep({
    required String stepNumber,
    required String title,
    required String description,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.15),
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.primary, width: 1.2),
          ),
          alignment: Alignment.center,
          child: Text(
            stepNumber,
            style: const TextStyle(color: AppColors.primary, fontSize: 11.5, fontWeight: FontWeight.bold),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(color: AppColors.textPrimary, fontSize: 12.5, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 2),
              Text(
                description,
                style: const TextStyle(color: AppColors.textMuted, fontSize: 11.5, height: 1.3),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildInstructionStepWithInlineLink({
    required String stepNumber,
    required String titlePrefix,
    required String clickableWord,
    required String titleSuffix,
    required String descriptionPrefix,
    required String descriptionClickable,
    required String descriptionSuffix,
    required VoidCallback onLinkTap,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.15),
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.primary, width: 1.2),
          ),
          alignment: Alignment.center,
          child: Text(
            stepNumber,
            style: const TextStyle(color: AppColors.primary, fontSize: 11.5, fontWeight: FontWeight.bold),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    titlePrefix,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 12.5, fontWeight: FontWeight.w600),
                  ),
                  MouseRegion(
                    cursor: SystemMouseCursors.click,
                    child: GestureDetector(
                      onTap: onLinkTap,
                      child: Text(
                        clickableWord,
                        style: const TextStyle(
                          color: AppColors.neonPurple,
                          fontSize: 12.5,
                          fontWeight: FontWeight.bold,
                          decoration: TextDecoration.underline,
                          decorationColor: AppColors.neonPurple,
                        ),
                      ),
                    ),
                  ),
                  Text(
                    titleSuffix,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 12.5, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    descriptionPrefix,
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 11.5, height: 1.3),
                  ),
                  MouseRegion(
                    cursor: SystemMouseCursors.click,
                    child: GestureDetector(
                      onTap: onLinkTap,
                      child: Text(
                        descriptionClickable,
                        style: const TextStyle(
                          color: AppColors.neonPurple,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          decoration: TextDecoration.underline,
                          decorationColor: AppColors.neonPurple,
                          height: 1.3,
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      descriptionSuffix,
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 11.5, height: 1.3),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStatusPill({
    required String label,
    required Color color,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4.5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
