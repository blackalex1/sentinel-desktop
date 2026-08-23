using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using SentinelDesktop.Models;

namespace SentinelDesktop.Services;

public class RoutingConfigData
{
    public Dictionary<string, bool> EnabledPresets { get; set; } = new();
    public Dictionary<string, string> PresetTargets { get; set; } = new();
    public List<CustomRoutingRule> CustomRules { get; set; } = new();
}

public class RoutingService
{
    private static readonly Lazy<RoutingService> _lazy = new(() => new RoutingService());
    public static RoutingService Instance => _lazy.Value;

    private readonly string _configPath;
    private List<CorePreset> _presets = new();
    private List<CustomRoutingRule> _customRules = new();

    public RoutingConfigData Config { get; private set; } = new();

    private RoutingService()
    {
        var dataDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "data");
        Directory.CreateDirectory(dataDir);
        _configPath = Path.Combine(dataDir, "routing.json");

        LoadConfig();
        LoadPresetsFromCore();
    }

    public List<CorePreset> GetPresets() => new(_presets);

    public List<CustomRoutingRule> GetCustomRules() => new(_customRules);

    public void LoadPresetsFromCore()
    {
        // 100% Dynamic retrieval from sentinel-core Go runtime
        _presets = SentinelCoreNative.ListPresets();

        foreach (var p in _presets)
        {
            var presetJson = SentinelCoreNative.GetPreset(p.Id);
            if (!string.IsNullOrEmpty(presetJson))
            {
                try
                {
                    using var doc = JsonDocument.Parse(presetJson);
                    var root = doc.RootElement;
                    if (root.TryGetProperty("domains", out var dProp) && dProp.ValueKind == JsonValueKind.Array)
                        p.Domains = dProp.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => !string.IsNullOrEmpty(x)).ToList();
                    if (root.TryGetProperty("ips", out var iProp) && iProp.ValueKind == JsonValueKind.Array)
                        p.IPs = iProp.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => !string.IsNullOrEmpty(x)).ToList();
                    if (root.TryGetProperty("protocols", out var prProp) && prProp.ValueKind == JsonValueKind.Array)
                        p.Protocols = prProp.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => !string.IsNullOrEmpty(x)).ToList();
                    if (root.TryGetProperty("ports", out var poProp) && poProp.ValueKind == JsonValueKind.Array)
                        p.Ports = poProp.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => !string.IsNullOrEmpty(x)).ToList();
                }
                catch { }
            }

            if (Config.EnabledPresets.TryGetValue(p.Id, out var enabled))
            {
                p.IsEnabled = enabled;
            }
            else
            {
                p.IsEnabled = p.Id == "ru" || p.Id == "ads" || p.Id == "bittorrent" || p.Id == "lan" || p.Id == "quic";
            }

            if (Config.PresetTargets.TryGetValue(p.Id, out var target))
            {
                p.SelectedTarget = target;
            }
            else
            {
                p.SelectedTarget = p.DefaultTarget;
            }
        }
    }

    public void Save(List<CorePreset> presets, List<CustomRoutingRule> customRules)
    {
        _presets = presets;
        _customRules = customRules;

        Config.EnabledPresets = presets.ToDictionary(p => p.Id, p => p.IsEnabled);
        Config.PresetTargets = presets.ToDictionary(p => p.Id, p => p.SelectedTarget);
        Config.CustomRules = customRules;

        try
        {
            var json = JsonSerializer.Serialize(Config, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(_configPath, json);
            LoggingService.Instance.LogApp("Конфигурация маршрутизации сохранена в data/routing.json");
        }
        catch (Exception ex)
        {
            LoggingService.Instance.LogApp($"Ошибка сохранения маршрутизации: {ex.Message}", "ERROR");
        }
    }

    private readonly Dictionary<string, BlockedAppItem> _quarantinedApps = new(StringComparer.OrdinalIgnoreCase);
    private static readonly HashSet<string> WhitelistedApps = new(StringComparer.OrdinalIgnoreCase)
    {
        "svchost.exe", "explorer.exe"
    };

    public event Action? OnBlockedAppsChanged;

    public IReadOnlyList<BlockedAppItem> GetBlockedApps()
    {
        try
        {
            var json = SentinelCoreNative.GetBlockedApps();
            if (!string.IsNullOrEmpty(json))
            {
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.ValueKind == JsonValueKind.Array)
                {
                    var list = new List<BlockedAppItem>();
                    foreach (var el in doc.RootElement.EnumerateArray())
                    {
                        var caller = el.TryGetProperty("caller_id", out var cid) ? cid.GetString() ?? "" : "";
                        var reason = el.TryGetProperty("reason", out var r) ? r.GetString() ?? "" : "";
                        var risk = el.TryGetProperty("risk_score", out var rs) ? rs.GetInt32() : 100;
                        var blockedAt = el.TryGetProperty("blocked_at", out var ba) && ba.TryGetDateTime(out var dt) ? dt : DateTime.Now;

                        if (!string.IsNullOrEmpty(caller) && caller != "DefaultEntity")
                        {
                            list.Add(new BlockedAppItem
                            {
                                ProcessName = caller,
                                Reason = reason,
                                RiskScore = risk,
                                BlockedAt = blockedAt
                            });
                        }
                    }
                    return list.OrderByDescending(a => a.BlockedAt).ToList();
                }
            }
        }
        catch { }
        return Array.Empty<BlockedAppItem>();
    }

    private readonly HashSet<string> _knownQuarantined = new(StringComparer.OrdinalIgnoreCase);

    public void NotifyQuarantineChanged()
    {
        OnBlockedAppsChanged?.Invoke();

        var currentBlocked = GetBlockedApps().Select(b => b.ProcessName).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (!_knownQuarantined.SetEquals(currentBlocked))
        {
            _knownQuarantined.Clear();
            foreach (var b in currentBlocked) _knownQuarantined.Add(b);

            if (VpnCoreService.Instance.IsRunning && VpnCoreService.Instance.ActiveServer != null && VpnCoreService.Instance.ActiveSettings != null)
            {
                _ = Task.Run(async () =>
                {
                    try { await VpnCoreService.Instance.StartAsync(VpnCoreService.Instance.ActiveServer, VpnCoreService.Instance.ActiveSettings); } catch { }
                });
            }
        }
    }

    public void UnquarantineProcess(string processName)
    {
        SentinelCoreNative.UnblockApp(processName);
        LoggingService.Instance.LogApp($"Процесс '{processName}' разблокирован в ядре.");
        NotifyQuarantineChanged();
    }

    public void UnquarantineAll()
    {
        SentinelCoreNative.UnblockAllApps();
        LoggingService.Instance.LogApp("Все заблокированные приложения разблокированы в ядре.");
        NotifyQuarantineChanged();
    }

    public object BuildRoutingSpecForAst()
    {
        var rules = new List<object>();

        // 0. Quarantined Banned Processes (Highest Zero Trust Priority)
        lock (_quarantinedApps)
        {
            if (_quarantinedApps.Count > 0)
            {
                rules.Add(new
                {
                    action = "block",
                    processNames = _quarantinedApps.Keys.ToList()
                });
            }
        }

        // 1. PortShield Active Blocked Sensitive Ports (Strict Zero-Trust mode only)
        if (SecurityService.Instance.Settings.ShieldMode == "strict_block")
        {
            var blockedPorts = SecurityService.Instance.Settings.BlockedPorts;
            if (blockedPorts != null && blockedPorts.Count > 0)
            {
                rules.Add(new
                {
                    action = "block",
                    ports = blockedPorts.Select(p => p.ToString()).ToList()
                });
            }
        }

        // 1. Captive Portal & Network Probes (Direct to prevent false login popups)
        rules.Add(new
        {
            action = "direct",
            domains = new List<string>
            {
                "detectportal.firefox.com",
                "www.msftconnecttest.com",
                "msftconnecttest.com",
                "ipv6.msftconnecttest.com",
                "connectivitycheck.gstatic.com",
                "connectivitycheck.android.com",
                "captive.apple.com"
            }
        });

        // 2. Custom User Rules
        foreach (var cr in _customRules.Where(r => r.IsEnabled))
        {
            var action = cr.Action.ToLowerInvariant() switch
            {
                "block" => "block",
                "direct" => "direct",
                _ => "proxy"
            };

            rules.Add(new
            {
                action = action,
                domains = cr.Domains,
                ips = cr.IPs,
                ports = cr.Ports,
                protocols = cr.Protocols
            });
        }

        // 2. Active Core Presets
        foreach (var p in _presets.Where(p => p.IsEnabled))
        {
            var action = p.SelectedTarget.ToLowerInvariant() switch
            {
                "block" => "block",
                "direct" => "direct",
                _ => "proxy"
            };

            rules.Add(new
            {
                action = action,
                domains = p.Domains,
                ips = p.IPs,
                ports = p.Ports,
                protocols = p.Protocols
            });
        }

        return new
        {
            defaultAction = "proxy",
            autoDetectInterface = true,
            overrideDns = true,
            rules = rules
        };
    }

    public string ExportToJson()
    {
        return JsonSerializer.Serialize(new
        {
            presets = _presets.Select(p => new { p.Id, p.IsEnabled, Target = p.SelectedTarget }),
            customRules = _customRules
        }, new JsonSerializerOptions { WriteIndented = true });
    }

    public bool ImportFromJson(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("customRules", out var crProp))
            {
                var importedRules = JsonSerializer.Deserialize<List<CustomRoutingRule>>(crProp.GetRawText()) ?? new();
                _customRules = importedRules;
            }

            if (doc.RootElement.TryGetProperty("presets", out var pProp))
            {
                foreach (var el in pProp.EnumerateArray())
                {
                    var id = el.GetProperty("id").GetString();
                    var enabled = el.TryGetProperty("isEnabled", out var en) && en.GetBoolean();
                    var target = el.TryGetProperty("target", out var tg) ? tg.GetString() : "direct";

                    var matched = _presets.FirstOrDefault(p => p.Id.Equals(id, StringComparison.OrdinalIgnoreCase));
                    if (matched != null)
                    {
                        matched.IsEnabled = enabled;
                        if (!string.IsNullOrEmpty(target)) matched.SelectedTarget = target;
                    }
                }
            }

            Save(_presets, _customRules);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private void LoadConfig()
    {
        try
        {
            if (File.Exists(_configPath))
            {
                var json = File.ReadAllText(_configPath);
                Config = JsonSerializer.Deserialize<RoutingConfigData>(json) ?? new RoutingConfigData();
                _customRules = Config.CustomRules ?? new();
            }
        }
        catch
        {
            Config = new RoutingConfigData();
            _customRules = new();
        }
    }
}
