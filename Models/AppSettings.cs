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
            Description = "Рекомендуемое ядро (VLESS Reality, Trojan, Hysteria 2, WireGuard, Wintun, PortShield)",
            ExeName = "sing-box.exe",
            TargetCoreAst = "singbox",
            SupportedProtocols = new() { "vless", "vmess", "trojan", "shadowsocks", "hysteria2", "tuic", "wireguard" },
            Color = "#38BDF8",
            BgColor = "#082F49"
        },
        new CoreEngineOption
        {
            Id = "xray",
            DisplayName = "Xray-core",
            Description = "Классическое ядро (VLESS Reality, VMess, Trojan, Shadowsocks, SOCKS5, HTTP)",
            ExeName = "xray.exe",
            TargetCoreAst = "xray",
            SupportedProtocols = new() { "vless", "vmess", "trojan", "shadowsocks", "socks", "socks5", "http", "https" },
            Color = "#C084FC",
            BgColor = "#2E1065"
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

public class DnsResolverItem
{
    public string Protocol { get; set; } = "DOH";
    public string Address { get; set; } = string.Empty;
    public string BadgeColor { get; set; } = "#C084FC";
    public string BadgeBg { get; set; } = "#2E1065";
}

public class DnsPresetOption
{
    public string Id { get; set; } = "google";
    public string Title { get; set; } = "Google DNS";
    public string Subtitle { get; set; } = "Надёжный 8.8.8.8";
    public string IconPath { get; set; } = "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z";
    public string RemoteServer { get; set; } = "https://dns.google/dns-query";
    public string DirectServer { get; set; } = "8.8.8.8";
    public List<string> Servers { get; set; } = new() { "https://dns.google/dns-query", "8.8.8.8", "8.8.4.4" };
    public List<string> UdpServers { get; set; } = new() { "8.8.8.8", "8.8.4.4" };
    public bool IsEncryptedDoh { get; set; } = true;
}

public static class DnsPresetsCatalog
{
    public static readonly List<DnsPresetOption> Presets = new()
    {
        new DnsPresetOption
        {
            Id = "cloudflare",
            Title = "Cloudflare",
            Subtitle = "Быстрый 1.1.1.1",
            IconPath = "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z",
            RemoteServer = "https://cloudflare-dns.com/dns-query",
            DirectServer = "1.1.1.1",
            Servers = new() { "https://cloudflare-dns.com/dns-query", "1.1.1.1", "1.0.0.1" },
            UdpServers = new() { "1.1.1.1", "1.0.0.1" }
        },
        new DnsPresetOption
        {
            Id = "google",
            Title = "Google DNS",
            Subtitle = "Надёжный 8.8.8.8",
            IconPath = "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z",
            RemoteServer = "https://dns.google/dns-query",
            DirectServer = "8.8.8.8",
            Servers = new() { "https://dns.google/dns-query", "8.8.8.8", "8.8.4.4" },
            UdpServers = new() { "8.8.8.8", "8.8.4.4" }
        },
        new DnsPresetOption
        {
            Id = "adguard",
            Title = "AdGuard DNS",
            Subtitle = "Блокировка рекламы",
            IconPath = "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z",
            RemoteServer = "https://dns.adguard-dns.com/dns-query",
            DirectServer = "94.140.14.14",
            Servers = new() { "https://dns.adguard-dns.com/dns-query", "94.140.14.14", "94.140.15.15" },
            UdpServers = new() { "94.140.14.14", "94.140.15.15" }
        },
        new DnsPresetOption
        {
            Id = "custom",
            Title = "Свой DNS",
            Subtitle = "Ручная настройка",
            IconPath = "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
            RemoteServer = "",
            DirectServer = "8.8.8.8",
            Servers = new(),
            UdpServers = new() { "8.8.8.8" }
        }
    };

    public static DnsPresetOption GetPreset(string? id)
    {
        return Presets.FirstOrDefault(p => p.Id.Equals(id, StringComparison.OrdinalIgnoreCase)) ?? Presets[1];
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

    [JsonPropertyName("selectedDnsPresetId")]
    public string SelectedDnsPresetId { get; set; } = "google";

    [JsonPropertyName("customDnsServers")]
    public string CustomDnsServers { get; set; } = "https://dns.google/dns-query, 8.8.8.8, 8.8.4.4";

    [JsonPropertyName("autoStart")]
    public bool AutoStart { get; set; } = false;
}
