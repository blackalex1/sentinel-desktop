using System;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using Avalonia.Threading;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SentinelDesktop.Models;
using SentinelDesktop.Services;

namespace SentinelDesktop.ViewModels;

public partial class SecurityViewModel : ViewModelBase
{
    [ObservableProperty]
    private ObservableCollection<PortShieldRule> _portRules = new();

    [ObservableProperty]
    private ObservableCollection<ThreatIncident> _incidents = new();

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(KillSwitchStatusText))]
    private bool _killSwitchEnabled = true;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(DnsStatusText))]
    private bool _dnsLeakShieldEnabled = true;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(AdBlockStatusText))]
    private bool _adBlockShieldEnabled = true;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsThresholdMode))]
    [NotifyPropertyChangedFor(nameof(IsStrictMode))]
    [NotifyPropertyChangedFor(nameof(IsAlertOnlyMode))]
    [NotifyPropertyChangedFor(nameof(ShieldModeDisplay))]
    private string _shieldMode = "threshold_block"; // threshold_block, strict_block, alert_only

    [ObservableProperty]
    private int _blockThreshold = 3;

    [ObservableProperty]
    private int _autoUnblockMinutes = 15;

    [ObservableProperty]
    private ObservableCollection<BlockedAppItem> _blockedApps = new();

    [ObservableProperty]
    private bool _isPcapCapturing;

    [ObservableProperty]
    private string _pcapRemainingDisplay = "05:00";

    [ObservableProperty]
    private string _pcapReasonDisplay = "Ожидание инцидента";

    [ObservableProperty]
    private string _pcapFilePath = string.Empty;

    [ObservableProperty]
    private string _selectedTab = "SHIELD"; // SHIELD, INCIDENTS, BLOCKED_APPS

    [ObservableProperty]
    private bool _isAddPortDialogOpen;

    [ObservableProperty]
    private string _newPortNumberText = string.Empty;

    [ObservableProperty]
    private string _newPortProtocol = "TCP";

    [ObservableProperty]
    private string _newPortName = string.Empty;

    [ObservableProperty]
    private string _newPortRisk = string.Empty;

    [ObservableProperty]
    private string _newPortSeverity = "high";

    [ObservableProperty]
    private string _addPortErrorMessage = string.Empty;

    public bool IsThresholdMode => ShieldMode == "threshold_block";
    public bool IsStrictMode => ShieldMode == "strict_block";
    public bool IsAlertOnlyMode => ShieldMode == "alert_only";

    public bool IsThreshold1 => BlockThreshold == 1;
    public bool IsThreshold2 => BlockThreshold == 2;
    public bool IsThreshold3 => BlockThreshold == 3;
    public bool IsThreshold5 => BlockThreshold == 5;
    public bool IsThreshold10 => BlockThreshold == 10;

    public bool IsUnblock0 => AutoUnblockMinutes == 0;
    public bool IsUnblock5 => AutoUnblockMinutes == 5;
    public bool IsUnblock15 => AutoUnblockMinutes == 15;
    public bool IsUnblock60 => AutoUnblockMinutes == 60;
    public bool IsUnblock1440 => AutoUnblockMinutes == 1440;

    public string ShieldModeDisplay => ShieldMode switch
    {
        "strict_block" => "Строгий Zero Trust",
        "alert_only" => "Только аудит",
        _ => $"Пороговый ({BlockThreshold} поп.)"
    };

    public int ProtectedPortsCount => PortRules.Count(r => r.IsProtected);
    public int BlockedThreatsCount => Incidents.Count;
    public int BlockedAppsCount => BlockedApps.Count;

    public string ProtectedPortsDisplay => $"{ProtectedPortsCount} Портов";
    public string KillSwitchStatusText => KillSwitchEnabled ? "АКТИВЕН" : "ОТКЛЮЧЕН";
    public string DnsStatusText => DnsLeakShieldEnabled ? "DoH Защищен" : "ОТКЛЮЧЕН";
    public string AdBlockStatusText => AdBlockShieldEnabled ? "DPI Фильтрация" : "ОТКЛЮЧЕН";

    public bool IsShieldTabActive => SelectedTab == "SHIELD";
    public bool IsIncidentsTabActive => SelectedTab == "INCIDENTS";
    public bool IsBlockedAppsTabActive => SelectedTab == "BLOCKED_APPS";

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsSecurityEnabled))]
    [NotifyPropertyChangedFor(nameof(SecurityControlsOpacity))]
    private bool _isXrayActive;

    public bool IsSecurityEnabled => !IsXrayActive;
    public double SecurityControlsOpacity => IsXrayActive ? 0.35 : 1.0;

    public SecurityViewModel()
    {
        LoadData();

        StorageService.CoreTypeChanged += coreType =>
        {
            Dispatcher.UIThread.Post(() =>
            {
                IsXrayActive = coreType.Equals("xray", StringComparison.OrdinalIgnoreCase);
            });
        };

        SecurityService.Instance.OnThreatDetected += incident =>
        {
            Dispatcher.UIThread.Post(() =>
            {
                Incidents.Insert(0, incident);
                if (Incidents.Count > 300) Incidents.RemoveAt(Incidents.Count - 1);
                OnPropertyChanged(nameof(BlockedThreatsCount));
            });
        };

        RoutingService.Instance.OnBlockedAppsChanged += () =>
        {
            Dispatcher.UIThread.Post(() =>
            {
                var list = RoutingService.Instance.GetBlockedApps();
                BlockedApps.Clear();
                foreach (var item in list) BlockedApps.Add(item);
                OnPropertyChanged(nameof(BlockedAppsCount));
            });
        };

        SecurityService.Instance.OnPcapStatusChanged += status =>
        {
            Dispatcher.UIThread.Post(() =>
            {
                IsPcapCapturing = status.IsActive;
                PcapRemainingDisplay = status.RemainingFormatted;
                PcapReasonDisplay = string.IsNullOrEmpty(status.Reason) ? "Активный сбор PCAP всего ПК" : status.Reason;
                PcapFilePath = status.FilePath;
            });
        };
    }

    private void LoadData()
    {
        var vault = StorageService.Load();
        IsXrayActive = vault.Settings.CoreType.Equals("xray", StringComparison.OrdinalIgnoreCase);

        var rules = SecurityService.Instance.GetPortRules();
        PortRules.Clear();
        foreach (var r in rules)
        {
            PortRules.Add(r);
        }

        var list = SecurityService.Instance.GetIncidents();
        Incidents.Clear();
        foreach (var i in list)
        {
            Incidents.Add(i);
        }

        var blocked = RoutingService.Instance.GetBlockedApps();
        BlockedApps.Clear();
        foreach (var b in blocked)
        {
            BlockedApps.Add(b);
        }

        KillSwitchEnabled = SecurityService.Instance.Settings.KillSwitchEnabled;
        DnsLeakShieldEnabled = SecurityService.Instance.Settings.DnsLeakShieldEnabled;
        AdBlockShieldEnabled = SecurityService.Instance.Settings.AdBlockShieldEnabled;
        ShieldMode = SecurityService.Instance.Settings.ShieldMode;
        BlockThreshold = SecurityService.Instance.Settings.BlockThreshold;
        AutoUnblockMinutes = SecurityService.Instance.Settings.AutoUnblockMinutes;

        IsPcapCapturing = SecurityService.Instance.PcapStatus.IsActive;
        PcapRemainingDisplay = SecurityService.Instance.PcapStatus.RemainingFormatted;
        PcapReasonDisplay = string.IsNullOrEmpty(SecurityService.Instance.PcapStatus.Reason) ? "Ожидание инцидента" : SecurityService.Instance.PcapStatus.Reason;
        PcapFilePath = SecurityService.Instance.PcapStatus.FilePath;

        OnPropertyChanged(nameof(ProtectedPortsCount));
        OnPropertyChanged(nameof(ProtectedPortsDisplay));
        OnPropertyChanged(nameof(BlockedThreatsCount));
        OnPropertyChanged(nameof(BlockedAppsCount));
    }

    [RelayCommand]
    public void SelectTab(string tab)
    {
        SelectedTab = tab.ToUpperInvariant();
        OnPropertyChanged(nameof(IsShieldTabActive));
        OnPropertyChanged(nameof(IsIncidentsTabActive));
        OnPropertyChanged(nameof(IsBlockedAppsTabActive));
    }

    [RelayCommand]
    public void SetShieldMode(string mode)
    {
        ShieldMode = mode;
        SecurityService.Instance.UpdatePolicy(shieldMode: mode);
    }

    [RelayCommand]
    public void SetBlockThreshold(object? param)
    {
        if (param != null && int.TryParse(param.ToString(), out var val))
        {
            BlockThreshold = val;
            SecurityService.Instance.UpdatePolicy(threshold: val);
            OnPropertyChanged(nameof(ShieldModeDisplay));
            OnPropertyChanged(nameof(IsThreshold1));
            OnPropertyChanged(nameof(IsThreshold2));
            OnPropertyChanged(nameof(IsThreshold3));
            OnPropertyChanged(nameof(IsThreshold5));
            OnPropertyChanged(nameof(IsThreshold10));
        }
    }

    [RelayCommand]
    public void SetAutoUnblockMinutes(object? param)
    {
        if (param != null && int.TryParse(param.ToString(), out var minutes))
        {
            AutoUnblockMinutes = minutes;
            SecurityService.Instance.UpdatePolicy(autoUnblock: minutes);
            OnPropertyChanged(nameof(IsUnblock0));
            OnPropertyChanged(nameof(IsUnblock5));
            OnPropertyChanged(nameof(IsUnblock15));
            OnPropertyChanged(nameof(IsUnblock60));
            OnPropertyChanged(nameof(IsUnblock1440));
        }
    }

    [RelayCommand]
    public void TogglePortRule(PortShieldRule? rule)
    {
        if (rule == null) return;
        SecurityService.Instance.TogglePortProtection(rule.Port, rule.IsProtected);
        OnPropertyChanged(nameof(ProtectedPortsCount));
        OnPropertyChanged(nameof(ProtectedPortsDisplay));
    }

    [RelayCommand]
    public void OpenAddPortDialog()
    {
        NewPortNumberText = string.Empty;
        NewPortProtocol = "TCP";
        NewPortName = string.Empty;
        NewPortRisk = string.Empty;
        NewPortSeverity = "high";
        AddPortErrorMessage = string.Empty;
        IsAddPortDialogOpen = true;
    }

    [RelayCommand]
    public void CloseAddPortDialog()
    {
        IsAddPortDialogOpen = false;
    }

    [RelayCommand]
    public void SaveNewPort()
    {
        if (!int.TryParse(NewPortNumberText.Trim(), out var port) || port < 1 || port > 65535)
        {
            AddPortErrorMessage = "Укажите корректный номер сетевого порта (1 - 65535)";
            return;
        }

        if (PortRules.Any(r => r.Port == port))
        {
            AddPortErrorMessage = $"Порт {port} уже есть в каталоге правил";
            return;
        }

        var success = SecurityService.Instance.AddCustomPortRule(
            port,
            NewPortProtocol,
            NewPortName,
            NewPortRisk,
            NewPortSeverity
        );

        if (success)
        {
            LoadData();
            IsAddPortDialogOpen = false;
        }
        else
        {
            AddPortErrorMessage = "Не удалось добавить порт";
        }
    }

    [RelayCommand]
    public void DeletePortRule(PortShieldRule rule)
    {
        if (rule.IsCustom)
        {
            SecurityService.Instance.RemovePortRule(rule.Port);
            PortRules.Remove(rule);
            OnPropertyChanged(nameof(ProtectedPortsCount));
            OnPropertyChanged(nameof(ProtectedPortsDisplay));
        }
    }

    [RelayCommand]
    public void ToggleKillSwitch()
    {
        SecurityService.Instance.Settings.KillSwitchEnabled = KillSwitchEnabled;
        SecurityService.Instance.SaveSettings();
        SecurityService.Instance.SyncPolicyWithCore();
        OnPropertyChanged(nameof(KillSwitchStatusText));
    }

    [RelayCommand]
    public void ToggleDnsLeakShield()
    {
        SecurityService.Instance.Settings.DnsLeakShieldEnabled = DnsLeakShieldEnabled;
        SecurityService.Instance.SaveSettings();
        SecurityService.Instance.SyncPolicyWithCore();
        OnPropertyChanged(nameof(DnsStatusText));
    }

    [RelayCommand]
    public void ToggleAdBlockShield()
    {
        SecurityService.Instance.Settings.AdBlockShieldEnabled = AdBlockShieldEnabled;
        SecurityService.Instance.SaveSettings();
        SecurityService.Instance.SyncPolicyWithCore();
        OnPropertyChanged(nameof(AdBlockStatusText));
    }

    [RelayCommand]
    public void ClearAllIncidents()
    {
        SecurityService.Instance.ClearIncidents();
        Incidents.Clear();
        OnPropertyChanged(nameof(BlockedThreatsCount));
    }

    [RelayCommand]
    public void UnblockApp(BlockedAppItem? item)
    {
        if (item == null || string.IsNullOrEmpty(item.ProcessName)) return;
        RoutingService.Instance.UnquarantineProcess(item.ProcessName);
    }

    [RelayCommand]
    public void UnblockAllApps()
    {
        RoutingService.Instance.UnquarantineAll();
    }

    [RelayCommand]
    public void OpenPcapFolder()
    {
        try
        {
            var dir = !string.IsNullOrEmpty(PcapFilePath) && Directory.Exists(Path.GetDirectoryName(PcapFilePath))
                ? Path.GetDirectoryName(PcapFilePath)!
                : Path.Combine(CoreEnvironmentService.GetDataDirectory(), "pcaps");

            Directory.CreateDirectory(dir);
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = dir,
                UseShellExecute = true
            });
        }
        catch { }
    }

    [RelayCommand]
    public void StopPcapCapture()
    {
        SecurityService.Instance.StopPcapSession();
    }
}
