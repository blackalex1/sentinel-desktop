class GithubAsset {
  final String name;
  final String downloadUrl;
  final int size;

  GithubAsset({
    required this.name,
    required this.downloadUrl,
    required this.size,
  });

  factory GithubAsset.fromJson(Map<String, dynamic> json) {
    return GithubAsset(
      name: json['name']?.toString() ?? '',
      downloadUrl: json['browser_download_url']?.toString() ?? '',
      size: (json['size'] as num?)?.toInt() ?? 0,
    );
  }
}

class GithubReleaseInfo {
  final String tagName;
  final String name;
  final String body;
  final bool isPrerelease;
  final DateTime? publishedAt;
  final List<GithubAsset> assets;

  GithubReleaseInfo({
    required this.tagName,
    required this.name,
    required this.body,
    required this.isPrerelease,
    this.publishedAt,
    required this.assets,
  });

  factory GithubReleaseInfo.fromJson(Map<String, dynamic> json) {
    final aList = json['assets'] as List<dynamic>? ?? [];
    DateTime? pubDate;
    if (json['published_at'] != null) {
      pubDate = DateTime.tryParse(json['published_at'].toString());
    }

    return GithubReleaseInfo(
      tagName: json['tag_name']?.toString() ?? '',
      name: (json['name'] != null && json['name'].toString().isNotEmpty)
          ? json['name'].toString()
          : (json['tag_name']?.toString() ?? ''),
      body: json['body']?.toString() ?? '',
      isPrerelease: json['prerelease'] == true,
      publishedAt: pubDate,
      assets: aList.map((e) => GithubAsset.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}
