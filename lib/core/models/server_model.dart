import 'dart:convert';
import 'package:flutter/foundation.dart';

class ServerModel {
  final String id;
  String name;
  String address;
  int port;
  String protocol;
  String? uuid;
  String? username;
  String? password;
  String? encryption;
  String? flow;
  String? security;
  String? sni;
  String? fingerprint;
  String? publicKey;
  String? shortId;
  String? spiderX;
  String? transport;
  String? path;
  String? host;
  String? obfsPassword;
  String? countryCode;
  int? pingMs;
  DateTime? lastUsed;

  ServerModel({
    required this.id,
    required this.name,
    required this.address,
    required this.port,
    required this.protocol,
    this.uuid,
    this.username,
    this.password,
    this.encryption,
    this.flow,
    this.security,
    this.sni,
    this.fingerprint,
    this.publicKey,
    this.shortId,
    this.spiderX,
    this.transport,
    this.path,
    this.host,
    this.obfsPassword,
    this.countryCode = 'UN',
    this.pingMs,
    this.lastUsed,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'address': address,
      'port': port,
      'protocol': protocol,
      'uuid': uuid,
      'username': username,
      'password': password,
      'encryption': encryption,
      'flow': flow,
      'security': security,
      'sni': sni,
      'fingerprint': fingerprint,
      'publicKey': publicKey,
      'shortId': shortId,
      'spiderX': spiderX,
      'transport': transport,
      'path': path,
      'host': host,
      'obfsPassword': obfsPassword,
      'countryCode': countryCode,
      'pingMs': pingMs,
      'lastUsed': lastUsed?.toIso8601String(),
    };
  }

  factory ServerModel.fromJson(Map<String, dynamic> json) {
    return ServerModel(
      id: json['id'] as String? ?? DateTime.now().millisecondsSinceEpoch.toString(),
      name: json['name'] as String? ?? 'Unnamed Server',
      address: json['address'] as String? ?? '127.0.0.1',
      port: json['port'] as int? ?? 443,
      protocol: (json['protocol'] as String? ?? 'vless').toLowerCase(),
      uuid: json['uuid'] as String?,
      username: json['username'] as String?,
      password: json['password'] as String?,
      encryption: json['encryption'] as String?,
      flow: json['flow'] as String?,
      security: json['security'] as String?,
      sni: json['sni'] as String?,
      fingerprint: json['fingerprint'] as String?,
      publicKey: json['publicKey'] as String?,
      shortId: json['shortId'] as String?,
      spiderX: json['spiderX'] as String?,
      transport: json['transport'] as String?,
      path: json['path'] as String?,
      host: json['host'] as String?,
      obfsPassword: json['obfsPassword'] as String?,
      countryCode: json['countryCode'] as String? ?? 'UN',
      pingMs: json['pingMs'] as int?,
      lastUsed: json['lastUsed'] != null ? DateTime.tryParse(json['lastUsed'] as String) : null,
    );
  }

  String toShareLink() {
    // Generate standard URI scheme based on protocol
    final proto = protocol.toLowerCase();
    if (proto == 'vless') {
      final query = <String, String>{};
      if (security != null && security!.isNotEmpty) query['security'] = security!;
      if (sni != null && sni!.isNotEmpty) query['sni'] = sni!;
      if (flow != null && flow!.isNotEmpty) query['flow'] = flow!;
      if (publicKey != null && publicKey!.isNotEmpty) query['pbk'] = publicKey!;
      if (fingerprint != null && fingerprint!.isNotEmpty) query['fp'] = fingerprint!;
      if (shortId != null && shortId!.isNotEmpty) query['sid'] = shortId!;
      if (spiderX != null && spiderX!.isNotEmpty) query['spx'] = spiderX!;
      if (transport != null && transport!.isNotEmpty) query['type'] = transport!;
      final queryString = query.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&');
      return 'vless://${uuid ?? ""}@$address:$port?$queryString#${Uri.encodeComponent(name)}';
    } else if (proto == 'hysteria2' || proto == 'hy2') {
      final query = <String, String>{};
      if (sni != null && sni!.isNotEmpty) query['sni'] = sni!;
      if (obfsPassword != null && obfsPassword!.isNotEmpty) query['obfs-password'] = obfsPassword!;
      final queryString = query.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&');
      return 'hy2://${password ?? ""}@$address:$port?$queryString#${Uri.encodeComponent(name)}';
    } else if (proto == 'ss' || proto == 'shadowsocks') {
      final userinfo = base64Url.encode(utf8.encode('${encryption ?? "aes-128-gcm"}:${password ?? ""}'));
      return 'ss://$userinfo@$address:$port#${Uri.encodeComponent(name)}';
    }
    return '$proto://$address:$port#${Uri.encodeComponent(name)}';
  }

  static ServerModel? fromUri(String rawUri) {
    try {
      var trimmed = rawUri.trim();
      if (trimmed.isEmpty) return null;

      String name = '';
      if (trimmed.contains('#')) {
        final hashIdx = trimmed.indexOf('#');
        name = Uri.decodeComponent(trimmed.substring(hashIdx + 1));
        trimmed = trimmed.substring(0, hashIdx);
      }

      final uri = Uri.parse(trimmed);
      final scheme = uri.scheme.toLowerCase();
      final host = uri.host;
      final port = uri.hasPort ? uri.port : 443;
      final q = uri.queryParameters;

      if (scheme == 'vless') {
        final uuid = uri.userInfo;
        return ServerModel(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          name: name.isNotEmpty ? name : 'VLESS $host:$port',
          address: host,
          port: port,
          protocol: 'vless',
          uuid: uuid,
          transport: q['type'] ?? 'tcp',
          security: q['security'] ?? 'reality',
          flow: q['flow'],
          sni: q['sni'],
          fingerprint: q['fp'],
          publicKey: q['pbk'],
          shortId: q['sid'],
          spiderX: q['spx'] != null ? Uri.decodeComponent(q['spx']!) : null,
          path: q['path'],
          host: q['host'],
        );
      } else if (scheme == 'hy2' || scheme == 'hysteria2') {
        return ServerModel(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          name: name.isNotEmpty ? name : 'Hysteria2 $host:$port',
          address: host,
          port: port,
          protocol: 'hysteria2',
          password: uri.userInfo,
          sni: q['sni'],
          obfsPassword: q['obfs-password'] ?? q['obfs'],
        );
      } else if (scheme == 'trojan') {
        return ServerModel(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          name: name.isNotEmpty ? name : 'Trojan $host:$port',
          address: host,
          port: port,
          protocol: 'trojan',
          password: uri.userInfo,
          sni: q['sni'],
        );
      } else if (scheme == 'ss') {
        String pass = uri.userInfo;
        String enc = 'aes-128-gcm';
        if (pass.isNotEmpty) {
          try {
            final decoded = utf8.decode(base64Url.decode(base64.normalize(pass)));
            if (decoded.contains(':')) {
              final parts = decoded.split(':');
              enc = parts[0];
              pass = parts[1];
            }
          } catch (_) {}
        }
        return ServerModel(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          name: name.isNotEmpty ? name : 'Shadowsocks $host:$port',
          address: host,
          port: port,
          protocol: 'shadowsocks',
          password: pass,
          encryption: enc,
        );
      }
    } catch (e) {
      debugPrint('[ServerModel] fromUri error: $e');
    }
    return null;
  }
}
