class TrafficStats {
  final int uploadSpeedBytes;
  final int downloadSpeedBytes;
  final int totalUploadBytes;
  final int totalDownloadBytes;
  final int? pingMs;
  final String? publicIp;
  final String? publicGeo;
  final String? countryCode;

  const TrafficStats({
    this.uploadSpeedBytes = 0,
    this.downloadSpeedBytes = 0,
    this.totalUploadBytes = 0,
    this.totalDownloadBytes = 0,
    this.pingMs,
    this.publicIp,
    this.publicGeo,
    this.countryCode,
  });

  TrafficStats copyWith({
    int? uploadSpeedBytes,
    int? downloadSpeedBytes,
    int? totalUploadBytes,
    int? totalDownloadBytes,
    int? pingMs,
    String? publicIp,
    String? publicGeo,
    String? countryCode,
  }) {
    return TrafficStats(
      uploadSpeedBytes: uploadSpeedBytes ?? this.uploadSpeedBytes,
      downloadSpeedBytes: downloadSpeedBytes ?? this.downloadSpeedBytes,
      totalUploadBytes: totalUploadBytes ?? this.totalUploadBytes,
      totalDownloadBytes: totalDownloadBytes ?? this.totalDownloadBytes,
      pingMs: pingMs ?? this.pingMs,
      publicIp: publicIp ?? this.publicIp,
      publicGeo: publicGeo ?? this.publicGeo,
      countryCode: countryCode ?? this.countryCode,
    );
  }

  static String formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1024 * 1024 * 1024) return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(2)} GB';
  }

  static String formatSpeed(int bytesPerSec) {
    return '${formatBytes(bytesPerSec)}/s';
  }
}
