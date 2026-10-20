using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace SentinelDesktop.Models;

public class GithubAsset
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("size")]
    public long Size { get; set; }

    [JsonPropertyName("browser_download_url")]
    public string DownloadUrl { get; set; } = string.Empty;

    public string SizeFormatted
    {
        get
        {
            if (Size < 1024 * 1024)
                return $"{Size / 1024.0:F1} KB";
            return $"{Size / (1024.0 * 1024.0):F1} MB";
        }
    }
}

public class GithubReleaseInfo
{
    [JsonPropertyName("tag_name")]
    public string TagName { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("body")]
    public string Body { get; set; } = string.Empty;

    [JsonPropertyName("prerelease")]
    public bool IsPrerelease { get; set; }

    [JsonPropertyName("published_at")]
    public DateTime? PublishedAt { get; set; }

    [JsonPropertyName("html_url")]
    public string HtmlUrl { get; set; } = string.Empty;

    [JsonPropertyName("assets")]
    public List<GithubAsset> Assets { get; set; } = new();

    public string Title => string.IsNullOrWhiteSpace(Name) ? TagName : Name;

    public string PublishedDateFormatted => PublishedAt?.ToString("dd.MM.yyyy HH:mm") ?? "—";

    public string ReleaseTypeBadge => IsPrerelease ? "PRE-RELEASE" : "STABLE";

    public string ReleaseTypeBg => IsPrerelease ? "#451A03" : "#064E3B";

    public string ReleaseTypeColor => IsPrerelease ? "#FBBF24" : "#34D399";
}
