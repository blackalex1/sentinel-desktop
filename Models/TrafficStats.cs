using System.Text.Json.Serialization;

namespace SentinelDesktop.Models;

public class TrafficStats
{
    [JsonPropertyName("downloadSpeed")]
    public double DownloadSpeed { get; set; }

    [JsonPropertyName("uploadSpeed")]
    public double UploadSpeed { get; set; }

    [JsonPropertyName("totalDownload")]
    public long TotalDownload { get; set; }

    [JsonPropertyName("totalUpload")]
    public long TotalUpload { get; set; }

    [JsonIgnore]
    public double DownSpeedBytes { get => DownloadSpeed; set => DownloadSpeed = value; }

    [JsonIgnore]
    public double UpSpeedBytes { get => UploadSpeed; set => UploadSpeed = value; }

    [JsonIgnore]
    public long TotalDownBytes { get => TotalDownload; set => TotalDownload = value; }

    [JsonIgnore]
    public long TotalUpBytes { get => TotalUpload; set => TotalUpload = value; }

    [JsonIgnore]
    public bool IsConnected { get; set; }

    [JsonIgnore]
    public string DownloadSpeedDisplay => FormatSpeed(DownloadSpeed);

    [JsonIgnore]
    public string UploadSpeedDisplay => FormatSpeed(UploadSpeed);

    [JsonIgnore]
    public string TotalDownloadDisplay => FormatTotal(TotalDownload);

    [JsonIgnore]
    public string TotalUploadDisplay => FormatTotal(TotalUpload);

    [JsonIgnore]
    public string DownSpeedFormatted => DownloadSpeedDisplay;

    [JsonIgnore]
    public string UpSpeedFormatted => UploadSpeedDisplay;

    [JsonIgnore]
    public string TotalDownFormatted => TotalDownloadDisplay;

    [JsonIgnore]
    public string TotalUpFormatted => TotalUploadDisplay;

    public static string FormatSpeed(double bytesPerSec)
    {
        if (bytesPerSec <= 0) return "0.0 KB/s";
        if (bytesPerSec < 1024 * 1024)
            return $"{bytesPerSec / 1024:F1} KB/s";
        return $"{bytesPerSec / (1024 * 1024):F2} MB/s";
    }

    public static string FormatTotal(long bytes)
    {
        if (bytes <= 0) return "0 MB";
        if (bytes < 1024 * 1024 * 1024)
            return $"{bytes / (1024.0 * 1024.0):F1} MB";
        return $"{bytes / (1024.0 * 1024.0 * 1024.0):F2} GB";
    }
}
