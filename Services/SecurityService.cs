using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using SentinelDesktop.Models;

namespace SentinelDesktop.Services;

public class SecuritySettingsData
{
    public bool KillSwitchEnabled { get; set; } = true;
    public bool DnsLeakShieldEnabled { get; set; } = true;
    public bool AdBlockShieldEnabled { get; set; } = true;
    public string ShieldMode { get; set; } = "threshold_block"; // threshold_block, strict_block, alert_only
    public int BlockThreshold { get; set; } = 3; // 1, 2, 3, 5, 10
    public int AutoUnblockMinutes { get; set; } = 15; // 0, 5, 15, 60, 1440
    public List<int> BlockedPorts { get; set; } = new() { 445, 3389, 135, 139, 23 };
    public List<PortShieldRule> CustomPortRules { get; set; } = new();
}

public class SecurityService
{
    private static readonly Lazy<SecurityService> _lazy = new(() => new SecurityService());
    public static SecurityService Instance => _lazy.Value;

    private readonly string _securityConfigPath;
    private readonly List<ThreatIncident> _incidents = new();
    private List<PortShieldRule> _portRules = new();

    public SecuritySettingsData Settings { get; private set; } = new();
    public event Action<ThreatIncident>? OnThreatDetected;

    private readonly object _pcapLock = new();
    private readonly System.Timers.Timer _pcapTimer = new(1000);
    public PcapCaptureStatus PcapStatus { get; } = new();
    public event Action<PcapCaptureStatus>? OnPcapStatusChanged;

    private SecurityService()
    {
        var dataDir = CoreEnvironmentService.GetDataDirectory();
        Directory.CreateDirectory(dataDir);
        _securityConfigPath = Path.Combine(dataDir, "security.json");

        LoadSettings();
        InitPortRules();
        ListenToLogs();

        _pcapTimer.Elapsed += (s, e) =>
        {
            RefreshPcapStatusFromCore();
        };
        _pcapTimer.Start();
    }

    public void RefreshPcapStatusFromCore()
    {
        if (!SentinelCoreNative.IsAvailable()) return;
        try
        {
            var json = SentinelCoreNative.GetPcapStatus();
            if (!string.IsNullOrEmpty(json))
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                var isActive = root.TryGetProperty("is_active", out var ia) && ia.GetBoolean();
                var reason = root.TryGetProperty("reason", out var r) ? r.GetString() ?? "" : "";
                var filePath = root.TryGetProperty("file_path", out var fp) ? fp.GetString() ?? "" : "";
                var remSec = root.TryGetProperty("remaining_seconds", out var rs) ? rs.GetInt32() : 0;

                bool justStarted = false;
                lock (_pcapLock)
                {
                    if (!PcapStatus.IsActive && isActive)
                    {
                        justStarted = true;
                    }
                    PcapStatus.IsActive = isActive;
                    PcapStatus.Reason = reason;
                    PcapStatus.FilePath = filePath;
                    PcapStatus.RemainingSeconds = remSec;
                }

                if (justStarted && !string.IsNullOrEmpty(reason))
                {
                    LoggingService.Instance.LogApp($"🔴 ВНИМАНИЕ: Запущен 5-минутный форензик-сбор сетевого дампа PCAP в файл: {Path.GetFileName(filePath)}. Причина: {reason}", "WARN");
                }

                OnPcapStatusChanged?.Invoke(PcapStatus);
            }
        }
        catch { }
    }

    public void StopPcapSession()
    {
        SentinelCoreNative.StopPcapCapture();
        RefreshPcapStatusFromCore();
        LoggingService.Instance.LogApp("Сбор PCAP остановлен.");
    }

    public List<PortShieldRule> GetPortRules() => new(_portRules);

    public List<ThreatIncident> GetIncidents()
    {
        lock (_incidents)
        {
            return new List<ThreatIncident>(_incidents);
        }
    }

    public void ClearIncidents()
    {
        lock (_incidents)
        {
            _incidents.Clear();
        }
    }

    public void UpdatePolicy(string? shieldMode = null, int? threshold = null, int? autoUnblock = null)
    {
        if (shieldMode != null) Settings.ShieldMode = shieldMode;
        if (threshold.HasValue) Settings.BlockThreshold = threshold.Value;
        if (autoUnblock.HasValue) Settings.AutoUnblockMinutes = autoUnblock.Value;

        SaveSettings();
        SyncPolicyWithCore();
    }

    public void TogglePortProtection(int port, bool isProtected)
    {
        var rule = _portRules.FirstOrDefault(r => r.Port == port);
        if (rule != null)
        {
            rule.IsProtected = isProtected;
            if (isProtected && !Settings.BlockedPorts.Contains(port))
            {
                Settings.BlockedPorts.Add(port);
            }
            else if (!isProtected)
            {
                Settings.BlockedPorts.Remove(port);
            }
            SaveSettings();
            SyncPolicyWithCore();
        }
    }

    public bool AddCustomPortRule(int port, string protocol, string name, string threatRisk, string severity = "high")
    {
        if (port < 1 || port > 65535) return false;
        if (_portRules.Any(r => r.Port == port)) return false;

        var rule = new PortShieldRule
        {
            Port = port,
            Protocol = string.IsNullOrWhiteSpace(protocol) ? "TCP" : protocol.ToUpperInvariant(),
            Name = string.IsNullOrWhiteSpace(name) ? $"Пользовательский порт {port}" : name,
            ThreatRisk = string.IsNullOrWhiteSpace(threatRisk) ? "Экранирование уязвимого порта" : threatRisk,
            Severity = string.IsNullOrWhiteSpace(severity) ? "high" : severity.ToLowerInvariant(),
            Category = "custom",
            IsCustom = true,
            IsProtected = true
        };

        _portRules.Add(rule);
        if (!Settings.BlockedPorts.Contains(port))
        {
            Settings.BlockedPorts.Add(port);
        }
        Settings.CustomPortRules.Add(rule);

        SaveSettings();
        SyncPolicyWithCore();
        return true;
    }

    public void RemovePortRule(int port)
    {
        var rule = _portRules.FirstOrDefault(r => r.Port == port);
        if (rule != null && rule.IsCustom)
        {
            _portRules.Remove(rule);
            Settings.BlockedPorts.Remove(port);
            Settings.CustomPortRules.RemoveAll(r => r.Port == port);
            SaveSettings();
            SyncPolicyWithCore();
        }
    }

    public void SaveSettings()
    {
        try
        {
            var json = JsonSerializer.Serialize(Settings, new JsonSerializerOptions { WriteIndented = true });
            var tempPath = _securityConfigPath + ".tmp";
            File.WriteAllText(tempPath, json);
            File.Move(tempPath, _securityConfigPath, overwrite: true);
        }
        catch { }
    }

    private void LoadSettings()
    {
        try
        {
            if (File.Exists(_securityConfigPath))
            {
                var json = File.ReadAllText(_securityConfigPath);
                Settings = JsonSerializer.Deserialize<SecuritySettingsData>(json) ?? new SecuritySettingsData();
            }
        }
        catch
        {
            Settings = new SecuritySettingsData();
        }
    }

    private void InitPortRules()
    {
        _portRules = SentinelCoreNative.GetPortShieldCatalog("ru");
        foreach (var r in _portRules)
        {
            r.IsProtected = Settings.BlockedPorts.Contains(r.Port);
            r.IsCustom = false;
        }

        if (Settings.CustomPortRules != null)
        {
            foreach (var cr in Settings.CustomPortRules)
            {
                if (!_portRules.Any(r => r.Port == cr.Port))
                {
                    cr.IsCustom = true;
                    cr.IsProtected = Settings.BlockedPorts.Contains(cr.Port);
                    _portRules.Add(cr);
                }
            }
        }

        SyncPolicyWithCore();
    }

    public void SyncPolicyWithCore()
    {
        var pcapDir = Path.Combine(CoreEnvironmentService.GetDataDirectory(), "pcaps");
        Directory.CreateDirectory(pcapDir);

        var policy = new
        {
            mode = Settings.ShieldMode,
            block_threshold = Settings.BlockThreshold,
            pcap_threshold = Settings.BlockThreshold,
            port_scan_threshold = 5,
            window_seconds = 30,
            auto_pcap_capture = true,
            pcap_directory = pcapDir,
            protected_ports = Settings.BlockedPorts,
            killswitch_enabled = Settings.KillSwitchEnabled,
            dns_leak_shield = Settings.DnsLeakShieldEnabled,
            adblock_enabled = Settings.AdBlockShieldEnabled,
            shield_mode = Settings.ShieldMode,
            auto_unblock_minutes = Settings.AutoUnblockMinutes,
            blocked_ports = Settings.BlockedPorts
        };
        var json = JsonSerializer.Serialize(policy);
        SentinelCoreNative.ConfigureSecurityPolicy(json);

        // If core is currently running, hot reload routing
        if (VpnCoreService.Instance.IsRunning && !VpnCoreService.Instance.IsStarting && VpnCoreService.Instance.ActiveServer != null && VpnCoreService.Instance.ActiveSettings != null)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    await VpnCoreService.Instance.StartAsync(VpnCoreService.Instance.ActiveServer, VpnCoreService.Instance.ActiveSettings);
                }
                catch { }
            });
        }
    }

    private void ListenToLogs()
    {
        LoggingService.Instance.OnLogAdded += entry =>
        {
            ParseLogForThreats(entry.Message);
        };
    }

    private readonly object _processLock = new();
    private readonly Dictionary<string, DateTime> _recentIncidentTimes = new();

    private void ParseLogForThreats(string line)
    {
        if (string.IsNullOrWhiteSpace(line)) return;

        try
        {
            var verdictJson = SentinelCoreNative.IngestCoreLog(line);
            if (string.IsNullOrWhiteSpace(verdictJson)) return;

            using var doc = JsonDocument.Parse(verdictJson);
            var root = doc.RootElement;

            var threatDetected = root.TryGetProperty("threat_detected", out var td) && td.GetBoolean();
            var shouldBlock = root.TryGetProperty("should_block", out var sb) && sb.GetBoolean();
            var isBlocked = root.TryGetProperty("is_blocked", out var ib) && ib.GetBoolean();

            if (!threatDetected && !isBlocked && !shouldBlock) return;

            var desc = root.TryGetProperty("description", out var d) ? d.GetString() ?? "" : "";
            var threatType = root.TryGetProperty("threat_type", out var tt) ? tt.GetString() ?? "" : "SECURITY_ALERT";
            var action = root.TryGetProperty("action", out var act) ? act.GetString() ?? "" : (shouldBlock || isBlocked ? "BLOCKED" : "ALERT");
            if (action == "BLOCK") action = "BLOCKED";

            var pcapCaptured = root.TryGetProperty("pcap_captured", out var pc) && pc.GetBoolean();
            var pcapPath = root.TryGetProperty("pcap_file_path", out var pp) ? pp.GetString() ?? "" : "";

            RefreshPcapStatusFromCore();

            var procMatch = Regex.Match(line, @"(?i)(?:router:\s+)?found process path:\s+([^\r\n]+)|(?i)(?:from process|by process|process[:=\s]+|user[:=\s]+)\s*([^\s,\]\)]+)");
            var processName = "System";
            if (procMatch.Success)
            {
                var raw = procMatch.Groups[1].Success && !string.IsNullOrWhiteSpace(procMatch.Groups[1].Value)
                    ? procMatch.Groups[1].Value.Trim()
                    : procMatch.Groups[2].Value.Trim();
                processName = Path.GetFileName(raw);
                if (string.IsNullOrWhiteSpace(processName)) processName = raw;
            }

            var connMatch = Regex.Match(line, @"(?:to\s+|connection to\s+|destination\s+|for\s+)([a-zA-Z0-9.-]+)(?::(\d+))?");
            var host = connMatch.Success ? connMatch.Groups[1].Value : "127.0.0.1";
            var port = (connMatch.Success && connMatch.Groups[2].Success && int.TryParse(connMatch.Groups[2].Value, out var p)) ? p : 0;

            var dedupKey = $"{processName}:{host}:{port}:{action}";
            lock (_processLock)
            {
                var now = DateTime.Now;
                if (_recentIncidentTimes.TryGetValue(dedupKey, out var lastTime) && (now - lastTime).TotalSeconds < 2)
                {
                    return; // deduplicate rapid spam
                }
                _recentIncidentTimes[dedupKey] = now;
                if (_recentIncidentTimes.Count > 400)
                {
                    var oldKey = _recentIncidentTimes.Keys.First();
                    _recentIncidentTimes.Remove(oldKey);
                }
            }

            var incident = new ThreatIncident
            {
                Timestamp = DateTime.Now,
                HostOrIp = host,
                Port = port,
                ProcessName = processName,
                Category = threatType,
                ActionTaken = action,
                Severity = (shouldBlock || isBlocked) ? "CRITICAL" : "WARNING",
                Description = desc,
                PcapCaptured = pcapCaptured,
                PcapFilePath = pcapPath
            };

            lock (_incidents)
            {
                _incidents.Insert(0, incident);
                if (_incidents.Count > 500) _incidents.RemoveAt(_incidents.Count - 1);
            }

            OnThreatDetected?.Invoke(incident);

            if (shouldBlock || isBlocked)
            {
                RoutingService.Instance.NotifyQuarantineChanged();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SecurityService] IngestCoreLog error: {ex.Message}");
        }
    }
}
