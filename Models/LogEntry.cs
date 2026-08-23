using System;

namespace SentinelDesktop.Models;

public class LogEntry
{
    public DateTime Timestamp { get; set; } = DateTime.Now;
    public string Source { get; set; } = "APP"; // APP, CORE, FFI, NETWORK
    public string Level { get; set; } = "INFO"; // INFO, WARN, ERROR, DEBUG
    public string Message { get; set; } = string.Empty;

    public string TimeFormatted => Timestamp.ToString("HH:mm:ss.fff");

    public string SourceColor => Source switch
    {
        "CORE" => "#38BDF8",     // Cyan
        "FFI" => "#A78BFA",      // Violet
        "NETWORK" => "#34D399",  // Emerald
        _ => "#94A3B8"           // Slate
    };

    public string SourceBg => Source switch
    {
        "CORE" => "#0C2340",
        "FFI" => "#2E1065",
        "NETWORK" => "#064E3B",
        _ => "#1E2638"
    };

    public string LevelColor => Level switch
    {
        "ERROR" or "FATAL" => "#F87171",
        "WARN" => "#FBBF24",
        "DEBUG" => "#64748B",
        _ => "#E2E8F0"
    };

    public string FormattedLine => $"[{TimeFormatted}] [{Source}] [{Level}] {Message}";
}
