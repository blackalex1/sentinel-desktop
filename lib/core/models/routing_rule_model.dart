class RoutingRuleModel {
  final String id;
  String name;
  String action; // 'proxy' | 'direct' | 'block'
  List<String> domains;
  List<String> ips;
  List<String> ports;
  List<String> protocols;
  bool isEnabled;

  RoutingRuleModel({
    required this.id,
    required this.name,
    this.action = 'direct',
    List<String>? domains,
    List<String>? ips,
    List<String>? ports,
    List<String>? protocols,
    this.isEnabled = true,
  })  : domains = domains ?? [],
        ips = ips ?? [],
        ports = ports ?? [],
        protocols = protocols ?? [];

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'action': action,
      'domains': domains,
      'ips': ips,
      'ports': ports,
      'protocols': protocols,
      'isEnabled': isEnabled,
    };
  }

  factory RoutingRuleModel.fromJson(Map<String, dynamic> json) {
    return RoutingRuleModel(
      id: json['id'] as String? ?? DateTime.now().millisecondsSinceEpoch.toString(),
      name: json['name'] as String? ?? 'Rule',
      action: json['action'] as String? ?? 'direct',
      domains: (json['domains'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      ips: (json['ips'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      ports: (json['ports'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      protocols: (json['protocols'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      isEnabled: json['isEnabled'] as bool? ?? true,
    );
  }
}
