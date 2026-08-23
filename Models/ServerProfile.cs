using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;
using CommunityToolkit.Mvvm.ComponentModel;

namespace SentinelDesktop.Models;

public partial class ServerProfile : ObservableObject
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [JsonPropertyName("name")]
    public string Name { get; set; } = "Узел Sentinel";

    [JsonPropertyName("protocol")]
    public string Protocol { get; set; } = "vless";

    [JsonPropertyName("address")]
    public string Address { get; set; } = string.Empty;

    [JsonPropertyName("port")]
    public int Port { get; set; } = 443;

    [JsonPropertyName("uuid")]
    public string? Uuid { get; set; }

    [JsonPropertyName("username")]
    public string? Username { get; set; }

    [JsonPropertyName("password")]
    public string? Password { get; set; }

    [JsonPropertyName("security")]
    public string Security
    {
        get
        {
            if (!string.IsNullOrWhiteSpace(_security)) return _security;
            if (!string.IsNullOrWhiteSpace(Pbk)) return "reality";
            if (!string.IsNullOrWhiteSpace(Sni) || Flow == "xtls-rprx-vision") return "tls";
            return "none";
        }
        set => _security = value;
    }
    private string? _security;

    [JsonPropertyName("sni")]
    public string? Sni { get; set; }

    private string? _pbk;
    [JsonPropertyName("pbk")]
    public string? Pbk
    {
        get => _pbk ?? (ExtensionData != null && ExtensionData.TryGetValue("publicKey", out var pk) ? pk.GetString() : null);
        set
        {
            _pbk = value;
            if (!string.IsNullOrWhiteSpace(value)) _security = "reality";
        }
    }

    [JsonPropertyName("publicKey")]
    public string? PublicKey
    {
        get => Pbk;
        set => Pbk = value;
    }

    private string? _sid;
    [JsonPropertyName("sid")]
    public string? Sid
    {
        get => _sid ?? (ExtensionData != null && ExtensionData.TryGetValue("shortId", out var s) ? s.GetString() : null);
        set => _sid = value;
    }

    [JsonPropertyName("shortId")]
    public string? ShortId
    {
        get => Sid;
        set => Sid = value;
    }

    private string? _fp = "chrome";
    [JsonPropertyName("fp")]
    public string? Fp
    {
        get => _fp ?? (ExtensionData != null && ExtensionData.TryGetValue("fingerprint", out var f) ? f.GetString() : "chrome");
        set => _fp = value;
    }

    [JsonPropertyName("fingerprint")]
    public string? Fingerprint
    {
        get => Fp;
        set => Fp = value;
    }

    [JsonPropertyName("flow")]
    public string? Flow { get; set; }

    [JsonExtensionData]
    public Dictionary<string, JsonElement> ExtensionData { get; set; } = new();

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(PingDisplay))]
    [NotifyPropertyChangedFor(nameof(PingColor))]
    [NotifyPropertyChangedFor(nameof(PingBg))]
    [property: JsonPropertyName("ping")]
    private int _ping = 0;

    [JsonPropertyName("country")]
    public string Country { get; set; } = "AUTO";

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(CardBorder))]
    [NotifyPropertyChangedFor(nameof(SelectionDotBorder))]
    [NotifyPropertyChangedFor(nameof(SelectionDotFill))]
    [property: JsonIgnore]
    private bool _isSelected = false;

    [JsonIgnore]
    public string CardBorder => IsSelected ? "#8B5CF6" : "#222B42";

    [JsonIgnore]
    public string SelectionDotBorder => IsSelected ? "#38BDF8" : "#475569";

    [JsonIgnore]
    public string SelectionDotFill => IsSelected ? "#38BDF8" : "Transparent";

    [JsonIgnore]
    public string ProtocolDisplay => (Protocol ?? "VLESS").ToUpperInvariant();

    [JsonIgnore]
    public string PingDisplay => Ping > 0 ? $"{Ping} ms" : (Ping < 0 ? "Таймаут" : "— ms");

    [JsonIgnore]
    public string PingColor => Ping <= 0 ? "#94A3B8" : (Ping < 60 ? "#34D399" : (Ping < 150 ? "#FBBF24" : "#F87171"));

    [JsonIgnore]
    public string PingBg => Ping <= 0 ? "#1E2638" : (Ping < 60 ? "#064E3B" : (Ping < 150 ? "#451A03" : "#450A0A"));

    [JsonIgnore]
    public string CountryCode => string.IsNullOrWhiteSpace(Country) ? "AUTO" : Country.ToUpperInvariant();

    [JsonIgnore]
    public string Subtitle => $"{Address}:{Port}{(string.IsNullOrEmpty(Sni) ? "" : $"  •  SNI: {Sni}")}";
}
