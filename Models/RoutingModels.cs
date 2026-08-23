using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Text.Json.Serialization;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace SentinelDesktop.Models;

public class TargetOption
{
    public string Value { get; set; } = "DIRECT";
    public string Color { get; set; } = "#34D399";
    public string BgColor { get; set; } = "#064E3B";

    public override bool Equals(object? obj) => obj is TargetOption other && other.Value == Value;
    public override int GetHashCode() => Value.GetHashCode();
    public override string ToString() => Value;
}

public partial class CorePreset : ObservableObject
{
    public static readonly TargetOption[] TargetOptions = new[]
    {
        new TargetOption { Value = "DIRECT", Color = "#34D399", BgColor = "#064E3B" },
        new TargetOption { Value = "VPN", Color = "#C084FC", BgColor = "#2E1065" },
        new TargetOption { Value = "BLOCK", Color = "#F87171", BgColor = "#450A0A" }
    };

    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("defaultTarget")]
    public string DefaultTarget { get; set; } = "direct"; // direct, block, proxy

    [JsonPropertyName("rulesCount")]
    public int RulesCount { get; set; } = 1;

    [JsonPropertyName("type")]
    public string Type { get; set; } = "quick_rule";

    [JsonPropertyName("domains")]
    public List<string> Domains { get; set; } = new();

    [JsonPropertyName("ips")]
    public List<string> IPs { get; set; } = new();

    [JsonPropertyName("protocols")]
    public List<string> Protocols { get; set; } = new();

    [JsonPropertyName("ports")]
    public List<string> Ports { get; set; } = new();

    [ObservableProperty]
    private bool _isEnabled = true;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(TargetColor))]
    [NotifyPropertyChangedFor(nameof(TargetBg))]
    [NotifyPropertyChangedFor(nameof(TargetDisplayName))]
    [NotifyPropertyChangedFor(nameof(SelectedTargetOption))]
    private string _selectedTarget = "direct"; // direct, proxy, block

    [JsonIgnore]
    public TargetOption SelectedTargetOption
    {
        get
        {
            var norm = SelectedTarget?.ToUpperInvariant() switch
            {
                "BLOCK" or "BLOCKED" or "REJECT" => "BLOCK",
                "PROXY" or "VPN" => "VPN",
                _ => "DIRECT"
            };
            return TargetOptions.FirstOrDefault(o => o.Value == norm) ?? TargetOptions[0];
        }
        set
        {
            if (value != null)
            {
                var norm = value.Value?.ToUpperInvariant() switch
                {
                    "BLOCKED" or "BLOCK" => "block",
                    "VPN" or "PROXY" => "proxy",
                    _ => "direct"
                };
                if (SelectedTarget != norm)
                {
                    SelectedTarget = norm;
                }
            }
        }
    }

    [RelayCommand]
    public void SetTarget(string target)
    {
        if (!string.IsNullOrEmpty(target))
        {
            SelectedTarget = target.ToLowerInvariant();
        }
    }

    [JsonIgnore]
    public string TargetDisplayName => SelectedTargetOption.Value;

    [JsonIgnore]
    public string TargetColor => SelectedTargetOption.Color;

    [JsonIgnore]
    public string TargetBg => SelectedTargetOption.BgColor;

    [JsonIgnore]
    public string ConditionsSummary
    {
        get
        {
            var list = new List<string>();
            if (Domains != null && Domains.Count > 0) list.Add($"Domains: {Domains.Count} шт.");
            if (IPs != null && IPs.Count > 0) list.Add($"IP: {string.Join(", ", IPs.Take(2))}");
            if (Protocols != null && Protocols.Count > 0) list.Add($"Proto: {string.Join(", ", Protocols)}");
            if (Ports != null && Ports.Count > 0) list.Add($"Ports: {string.Join(", ", Ports)}");
            return list.Count > 0 ? string.Join(" • ", list) : "all traffic";
        }
    }
}

public partial class CustomRoutingRule : ObservableObject
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [ObservableProperty]
    [property: JsonPropertyName("name")]
    private string _name = "Новое правило";

    [ObservableProperty]
    [property: JsonPropertyName("action")]
    [NotifyPropertyChangedFor(nameof(ActionColor))]
    [NotifyPropertyChangedFor(nameof(ActionBg))]
    [NotifyPropertyChangedFor(nameof(ActionDisplayName))]
    private string _action = "direct"; // direct, proxy, block

    [JsonPropertyName("domains")]
    public List<string> Domains { get; set; } = new();

    [JsonPropertyName("ips")]
    public List<string> IPs { get; set; } = new();

    [JsonPropertyName("ports")]
    public List<string> Ports { get; set; } = new();

    [JsonPropertyName("protocols")]
    public List<string> Protocols { get; set; } = new();

    [ObservableProperty]
    [property: JsonPropertyName("isEnabled")]
    private bool _isEnabled = true;

    [JsonIgnore]
    public string ActionDisplayName => Action?.ToUpperInvariant() switch
    {
        "BLOCK" or "BLOCKED" => "BLOCKED",
        "PROXY" or "VPN" => "VPN",
        _ => "DIRECT"
    };

    [JsonIgnore]
    public string ActionColor => Action?.ToUpperInvariant() switch
    {
        "BLOCK" or "BLOCKED" => "#F87171",
        "PROXY" or "VPN" => "#C084FC",
        _ => "#34D399"
    };

    [JsonIgnore]
    public string ActionBg => Action?.ToUpperInvariant() switch
    {
        "BLOCK" or "BLOCKED" => "#450A0A",
        "PROXY" or "VPN" => "#2E1065",
        _ => "#064E3B"
    };

    [JsonIgnore]
    public string SummaryText
    {
        get
        {
            var parts = new List<string>();
            if (Domains.Count > 0) parts.Add($"Domains: {Domains.Count} шт.");
            if (IPs.Count > 0) parts.Add($"IP: {string.Join(", ", IPs.Take(2))}");
            if (Ports.Count > 0) parts.Add($"Ports: {string.Join(", ", Ports)}");
            if (Protocols.Count > 0) parts.Add($"Proto: {string.Join(", ", Protocols)}");
            return parts.Count > 0 ? string.Join(" • ", parts) : "all traffic";
        }
    }

    public void RefreshSummary()
    {
        OnPropertyChanged(nameof(SummaryText));
    }
}

public partial class RoutingTableItem : ObservableObject
{
    public string Id { get; set; } = string.Empty;
    public bool IsPreset { get; set; }
    public CorePreset? PresetRef { get; set; }
    public CustomRoutingRule? CustomRuleRef { get; set; }

    [ObservableProperty]
    private int _order;

    [ObservableProperty]
    private string _name = string.Empty;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(TargetColor))]
    [NotifyPropertyChangedFor(nameof(TargetBg))]
    [NotifyPropertyChangedFor(nameof(TargetDisplayName))]
    private string _action = "direct"; // direct, block, proxy

    [ObservableProperty]
    private string _conditionsText = string.Empty;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(RowOpacity))]
    [NotifyPropertyChangedFor(nameof(RowTextColor))]
    [NotifyPropertyChangedFor(nameof(ConditionsColor))]
    private bool _isEnabled = true;

    [ObservableProperty]
    private bool _isDragOver;

    [ObservableProperty]
    private bool _isDragging;

    public double RowOpacity => IsEnabled ? 1.0 : 0.45;
    public string RowTextColor => IsEnabled ? "White" : "#64748B";
    public string ConditionsColor => IsEnabled ? "#38BDF8" : "#475569";

    public string TargetDisplayName => Action?.ToUpperInvariant() switch
    {
        "BLOCK" or "BLOCKED" => "BLOCKED",
        "PROXY" or "VPN" => "VPN",
        _ => "DIRECT"
    };

    public string TargetColor => Action?.ToUpperInvariant() switch
    {
        "BLOCK" or "BLOCKED" => "#F87171",
        "PROXY" or "VPN" => "#C084FC",
        _ => "#34D399"
    };

    public string TargetBg => Action?.ToUpperInvariant() switch
    {
        "BLOCK" or "BLOCKED" => "#450A0A",
        "PROXY" or "VPN" => "#2E1065",
        _ => "#064E3B"
    };
}
