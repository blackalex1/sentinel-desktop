using System;
using System.Text.Json.Serialization;
using CommunityToolkit.Mvvm.ComponentModel;

namespace SentinelDesktop.Models;

public partial class PortShieldRule : ObservableObject
{
    [JsonPropertyName("port")]
    public int Port { get; set; }

    [JsonPropertyName("protocol")]
    public string Protocol { get; set; } = "TCP";

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("threat_risk")]
    public string ThreatRisk { get; set; } = string.Empty;

    [JsonPropertyName("severity")]
    public string Severity { get; set; } = "high"; // critical, high, medium

    [JsonPropertyName("category")]
    public string Category { get; set; } = "remote_access";

    [JsonPropertyName("is_custom")]
    public bool IsCustom { get; set; }

    [ObservableProperty]
    [property: JsonPropertyName("is_protected")]
    private bool _isProtected = true;

    [JsonIgnore]
    public string SeverityColor => Severity.ToLowerInvariant() switch
    {
        "critical" => "#F87171",
        "high" => "#FBBF24",
        _ => "#38BDF8"
    };

    [JsonIgnore]
    public string SeverityBg => Severity.ToLowerInvariant() switch
    {
        "critical" => "#450A0A",
        "high" => "#451A03",
        _ => "#082F49"
    };

    [JsonIgnore]
    public string PortDisplay => $"{Protocol} : {Port}";
}

public class ThreatIncident
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public DateTime Timestamp { get; set; } = DateTime.Now;
    public string HostOrIp { get; set; } = string.Empty;
    public int Port { get; set; }
    public string ProcessName { get; set; } = "Системный процесс";
    public string Category { get; set; } = "PORT_SHIELD";
    public string ActionTaken { get; set; } = "BLOCKED"; // BLOCKED, ALERT, MONITOR, DROPPED
    public string Severity { get; set; } = "CRITICAL"; // CRITICAL, WARNING, INFO
    public string Description { get; set; } = string.Empty;
    public bool PcapCaptured { get; set; }
    public string PcapFilePath { get; set; } = string.Empty;

    public string TimeFormatted => Timestamp.ToString("HH:mm:ss");

    public string ActionColor => ActionTaken switch
    {
        "BLOCKED" or "DROPPED" => "#F87171",
        "ALERT" => "#FBBF24",
        _ => "#38BDF8"
    };

    public string ActionBg => ActionTaken switch
    {
        "BLOCKED" or "DROPPED" => "#450A0A",
        "ALERT" => "#451A03",
        _ => "#0C2340"
    };

    public string EndpointDisplay => Port > 0 ? $"{HostOrIp}:{Port}" : HostOrIp;
}

public class BlockedAppItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string ProcessName { get; set; } = string.Empty;
    public DateTime BlockedAt { get; set; } = DateTime.Now;
    public string Reason { get; set; } = string.Empty;
    public int RiskScore { get; set; } = 100;

    public string TimeFormatted => BlockedAt.ToString("HH:mm:ss");
}

public class PcapCaptureStatus
{
    public bool IsActive { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public int RemainingSeconds { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public TimeSpan Remaining => RemainingSeconds > 0 ? TimeSpan.FromSeconds(RemainingSeconds) : (IsActive && ExpiresAt > DateTime.Now ? ExpiresAt - DateTime.Now : TimeSpan.Zero);
    public string RemainingFormatted => $"{Remaining.Minutes:D2}:{Remaining.Seconds:D2}";
}
