using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json.Serialization;

namespace SentinelDesktop.Models;

public class CoreEngineOption
{
    public string Id { get; set; } = "sing-box";
    public string DisplayName { get; set; } = "Sing-box";
    public string Description { get; set; } = "Универсальное ядро нового поколения";
    public string ExeName { get; set; } = "sing-box.exe";
    public string TargetCoreAst { get; set; } = "singbox";
    public List<string> SupportedProtocols { get; set; } = new() { "vless", "vmess", "trojan", "shadowsocks", "hysteria2", "tuic", "wireguard" };
    public string Color { get; set; } = "#38BDF8";
    public string BgColor { get; set; } = "#082F49";

    public bool SupportsProtocol(string? protocol)
    {
        if (string.IsNullOrEmpty(protocol)) return true;
        var p = protocol.ToLowerInvariant().Trim();
        if (Id == "auto") return true;
        return SupportedProtocols.Any(sp => sp.Equals(p, StringComparison.OrdinalIgnoreCase));
    }
}

public static class CoreEnginesCatalog
{
    public static readonly List<CoreEngineOption> AvailableEngines = new()
    {
        new CoreEngineOption
        {
            Id = "auto",
            DisplayName = "Авто-выбор",
            Description = "Автоматический выбор наилучшего ядра под протокол сервера",
            TargetCoreAst = "singbox",
            SupportedProtocols = new() { "vless", "vmess", "trojan", "shadowsocks", "hysteria2", "tuic", "wireguard" },
            Color = "#FBBF24",
            BgColor = "#451A03"
        },
        new CoreEngineOption
        {
            Id = "sing-box",
            DisplayName = "Sing-box",
            Description = "Рекомендуемое ядро (VLESS Reality, Trojan, Hysteria 2, WireGuard, Wintun)",
            ExeName = "sing-box.exe",
            TargetCoreAst = "singbox",
            SupportedProtocols = new() { "vless", "vmess", "trojan", "shadowsocks", "hysteria2", "tuic", "wireguard" },
            Color = "#38BDF8",
            BgColor = "#082F49"
        }
    };

    public static CoreEngineOption GetEngine(string? id)
    {
        var match = AvailableEngines.FirstOrDefault(e => e.Id.Equals(id, StringComparison.OrdinalIgnoreCase));
        return match ?? AvailableEngines[1]; // default to sing-box
    }
}

public class LogLevelOption
{
    public string Id { get; set; } = "trace";
    public string DisplayName { get; set; } = "Трассировка (Trace)";
    public string Description { get; set; } = "Все соединения, DNS и маршруты";
    public string SingboxLevel { get; set; } = "trace";
}

public static class LogLevelsCatalog
{
    public static readonly List<LogLevelOption> AvailableLevels = new()
    {
        new LogLevelOption
        {
            Id = "trace",
            DisplayName = "Трассировка (Trace)",
            Description = "Все соединения, DNS и маршруты",
            SingboxLevel = "trace"
        },
        new LogLevelOption
        {
            Id = "debug",
            DisplayName = "Отладка (Debug)",
            Description = "Подробные события ядра",
            SingboxLevel = "debug"
        },
        new LogLevelOption
        {
            Id = "info",
            DisplayName = "Информация (Info)",
            Description = "Стандартные события запуска",
            SingboxLevel = "info"
        },
        new LogLevelOption
        {
            Id = "warn",
            DisplayName = "Предупреждения (Warn)",
            Description = "Только предупреждения и ошибки",
            SingboxLevel = "warn"
        },
        new LogLevelOption
        {
            Id = "error",
            DisplayName = "Ошибки (Error)",
            Description = "Только критические сбои",
            SingboxLevel = "error"
        },
        new LogLevelOption
        {
            Id = "none",
            DisplayName = "Отключено (None)",
            Description = "Без логирования",
            SingboxLevel = "disabled"
        }
    };

    public static LogLevelOption GetLevel(string? id)
    {
        var match = AvailableLevels.FirstOrDefault(l => l.Id.Equals(id, StringComparison.OrdinalIgnoreCase));
        return match ?? AvailableLevels[0];
    }
}

public class AppSettings
{
    [JsonPropertyName("isTunMode")]
    public bool IsTunMode { get; set; } = true;

    [JsonPropertyName("isSystemProxy")]
    public bool IsSystemProxy { get; set; } = false;

    [JsonPropertyName("socksPort")]
    public int SocksPort { get; set; } = 10808;

    [JsonPropertyName("httpPort")]
    public int HttpPort { get; set; } = 10809;

    [JsonPropertyName("coreType")]
    public string CoreType { get; set; } = "sing-box";

    [JsonPropertyName("logLevel")]
    public string LogLevel { get; set; } = "trace";

    [JsonPropertyName("dnsServer")]
    public string DnsServer { get; set; } = "1.1.1.1";

    [JsonPropertyName("autoStart")]
    public bool AutoStart { get; set; } = false;
}
