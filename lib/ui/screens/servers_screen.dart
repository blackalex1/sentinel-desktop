import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/models/server_model.dart';
import '../../core/providers/app_state_provider.dart';
import '../widgets/bento_card.dart';

class ServersScreen extends StatefulWidget {
  const ServersScreen({super.key});

  @override
  State<ServersScreen> createState() => _ServersScreenState();
}

class _ServersScreenState extends State<ServersScreen> {
  final _searchController = TextEditingController();
  String _filter = '';

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppStateProvider>();
    final servers = state.servers.where((s) {
      if (_filter.isEmpty) return true;
      final q = _filter.toLowerCase();
      return s.name.toLowerCase().contains(q) || s.protocol.toLowerCase().contains(q) || s.address.toLowerCase().contains(q);
    }).toList();

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Actions (Search + Add + Import)
          Row(
            children: [
              Expanded(
                child: Container(
                  height: 38,
                  decoration: BoxDecoration(
                    color: AppColors.bgSurface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.borderSubtle),
                  ),
                  child: TextField(
                    controller: _searchController,
                    onChanged: (val) => setState(() => _filter = val),
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 12),
                    decoration: const InputDecoration(
                      hintText: 'Поиск по имени, протоколу, IP...',
                      hintStyle: TextStyle(color: AppColors.textMuted, fontSize: 12),
                      prefixIcon: Icon(Icons.search, size: 16, color: AppColors.textSecondary),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(vertical: 9),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              _ActionButton(
                icon: Icons.content_paste_rounded,
                label: 'Импорт из буфера',
                onTap: () async {
                  final messenger = ScaffoldMessenger.of(context);
                  final data = await Clipboard.getData('text/plain');
                  if (data != null && data.text != null) {
                    final ok = await state.importFromUri(data.text!);
                    if (!mounted) return;
                    messenger.showSnackBar(
                      SnackBar(
                        content: Text(ok ? 'Сервер успешно импортирован!' : 'Ошибка разбора ссылки.'),
                        backgroundColor: ok ? AppColors.neonGreen : AppColors.neonRed,
                      ),
                    );
                  }
                },
              ),
              const SizedBox(width: 8),
              _ActionButton(
                icon: Icons.add_rounded,
                label: 'Добавить вручную',
                isPrimary: true,
                onTap: () => _showAddServerDialog(context, state),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Servers List
          Expanded(
            child: servers.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.dns_outlined, size: 48, color: AppColors.textMuted),
                        const SizedBox(height: 12),
                        const Text('Нет добавленных серверов', style: TextStyle(color: AppColors.textSecondary, fontSize: 14)),
                        const SizedBox(height: 4),
                        const Text('Вставьте VLESS, Hysteria 2 или Shadowsocks ссылку из буфера', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                      ],
                    ),
                  )
                : ListView.separated(
                    itemCount: servers.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final s = servers[index];
                      final isSelected = s.id == state.selectedServerId;

                      return BentoCard(
                        isGlow: isSelected,
                        onTap: () => state.setSelectedServer(s.id),
                        child: Row(
                          children: [
                            // Flag icon
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: AppColors.borderSubtle,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Center(
                                child: Text(
                                  s.countryCode == 'RU' ? '🇷🇺' : (s.countryCode == 'US' ? '🇺🇸' : '🌐'),
                                  style: const TextStyle(fontSize: 16),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),

                            // Name & Details
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        s.name,
                                        style: TextStyle(
                                          color: isSelected ? AppColors.neonCyan : AppColors.textPrimary,
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: AppColors.borderSubtle,
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          s.protocol.toUpperCase(),
                                          style: const TextStyle(color: AppColors.neonPurple, fontSize: 9, fontWeight: FontWeight.bold),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${s.address}:${s.port} ${s.flow != null ? "• Flow: ${s.flow}" : ""}',
                                    style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                                  ),
                                ],
                              ),
                            ),

                            // Ping Badge
                            if (s.pingMs != null)
                              Container(
                                margin: const EdgeInsets.only(right: 8),
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppColors.neonGreen.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  '${s.pingMs} ms',
                                  style: const TextStyle(color: AppColors.neonGreen, fontSize: 10, fontWeight: FontWeight.bold),
                                ),
                              ),

                            // Actions
                            IconButton(
                              icon: const Icon(Icons.share_rounded, size: 16, color: AppColors.textSecondary),
                              onPressed: () {
                                Clipboard.setData(ClipboardData(text: s.toShareLink()));
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Ссылка скопирована в буфер')),
                                );
                              },
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline_rounded, size: 16, color: Colors.redAccent),
                              onPressed: () => state.deleteServer(s.id),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  void _showAddServerDialog(BuildContext context, AppStateProvider state) {
    final nameCtrl = TextEditingController();
    final addrCtrl = TextEditingController();
    final portCtrl = TextEditingController(text: '443');
    final uuidCtrl = TextEditingController();
    String protocol = 'vless';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: AppColors.bgCard,
          title: const Text('Добавить сервер', style: TextStyle(color: AppColors.textPrimary, fontSize: 15)),
          content: SizedBox(
            width: 400,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: protocol,
                  dropdownColor: AppColors.bgSurface,
                  style: const TextStyle(color: AppColors.neonCyan),
                  decoration: const InputDecoration(labelText: 'Протокол', labelStyle: TextStyle(color: AppColors.textMuted)),
                  items: const [
                    DropdownMenuItem(value: 'vless', child: Text('VLESS (Reality / Vision)')),
                    DropdownMenuItem(value: 'hysteria2', child: Text('Hysteria 2')),
                    DropdownMenuItem(value: 'shadowsocks', child: Text('Shadowsocks')),
                  ],
                  onChanged: (v) => setDialogState(() => protocol = v!),
                ),
                TextField(
                  controller: nameCtrl,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: const InputDecoration(labelText: 'Имя сервера', labelStyle: TextStyle(color: AppColors.textMuted)),
                ),
                TextField(
                  controller: addrCtrl,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: const InputDecoration(labelText: 'Адрес / Домен', labelStyle: TextStyle(color: AppColors.textMuted)),
                ),
                TextField(
                  controller: portCtrl,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: const InputDecoration(labelText: 'Порт', labelStyle: TextStyle(color: AppColors.textMuted)),
                ),
                TextField(
                  controller: uuidCtrl,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: const InputDecoration(labelText: 'UUID / Пароль', labelStyle: TextStyle(color: AppColors.textMuted)),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Отмена', style: TextStyle(color: AppColors.textSecondary)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
              onPressed: () {
                if (addrCtrl.text.isNotEmpty) {
                  final server = ServerModel(
                    id: DateTime.now().millisecondsSinceEpoch.toString(),
                    name: nameCtrl.text.isEmpty ? addrCtrl.text : nameCtrl.text,
                    address: addrCtrl.text.trim(),
                    port: int.tryParse(portCtrl.text) ?? 443,
                    protocol: protocol,
                    uuid: uuidCtrl.text.trim(),
                    password: uuidCtrl.text.trim(),
                  );
                  state.addServer(server);
                  Navigator.pop(ctx);
                }
              },
              child: const Text('Сохранить', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool isPrimary;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
    this.isPrimary = false,
  });

  @override
  Widget build(BuildContext context) {
    return ElevatedButton.icon(
      style: ElevatedButton.styleFrom(
        backgroundColor: isPrimary ? AppColors.primary : AppColors.bgSurface,
        foregroundColor: isPrimary ? Colors.white : AppColors.textPrimary,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(color: isPrimary ? Colors.transparent : AppColors.borderSubtle),
        ),
      ),
      icon: Icon(icon, size: 15),
      label: Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
      onPressed: onTap,
    );
  }
}
