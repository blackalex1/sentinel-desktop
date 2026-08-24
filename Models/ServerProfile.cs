using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
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

    [JsonPropertyName("transport")]
    public string Transport { get; set; } = "tcp";

    [JsonPropertyName("path")]
    public string? Path { get; set; }

    [JsonPropertyName("host")]
    public string? Host { get; set; }

    [JsonPropertyName("serviceName")]
    public string? ServiceName { get; set; }

    [JsonPropertyName("insecure")]
    public bool Insecure { get; set; } = false;

    [JsonExtensionData]
    public Dictionary<string, JsonElement> ExtensionData { get; set; } = new();

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(PingDisplay))]
    [NotifyPropertyChangedFor(nameof(PingColor))]
    [NotifyPropertyChangedFor(nameof(PingBg))]
    [property: JsonPropertyName("ping")]
    private int _ping = 0;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(CountryCode))]
    [NotifyPropertyChangedFor(nameof(IsHotspotNode))]
    [NotifyPropertyChangedFor(nameof(IsLanNode))]
    [NotifyPropertyChangedFor(nameof(HasKnownCountryCode))]
    [NotifyPropertyChangedFor(nameof(IsTextBadge))]
    [NotifyPropertyChangedFor(nameof(IsIconBadge))]
    [NotifyPropertyChangedFor(nameof(BadgeText))]
    [NotifyPropertyChangedFor(nameof(BadgeIcon))]
    [NotifyPropertyChangedFor(nameof(BadgeBg))]
    [NotifyPropertyChangedFor(nameof(BadgeBorder))]
    [NotifyPropertyChangedFor(nameof(BadgeForeground))]
    [NotifyPropertyChangedFor(nameof(BadgeToolTip))]
    [property: JsonPropertyName("country")]
    private string _country = "AUTO";

    [JsonPropertyName("hotspotKey")]
    public string? HotspotKey { get; set; }

    [JsonPropertyName("hotspotToken")]
    public string? HotspotToken { get; set; }

    public ServerProfile Clone()
    {
        var options = new JsonSerializerOptions { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };
        var json = JsonSerializer.Serialize(this, options);
        var clone = JsonSerializer.Deserialize<ServerProfile>(json, options) ?? new ServerProfile();
        clone.Id = this.Id;
        clone.IsSelected = this.IsSelected;
        clone.Ping = this.Ping;
        clone.Country = this.Country;
        clone.HotspotKey = this.HotspotKey;
        clone.HotspotToken = this.HotspotToken;
        return clone;
    }

    public void CopyFrom(ServerProfile other)
    {
        Name = other.Name;
        Protocol = other.Protocol;
        Address = other.Address;
        Port = other.Port;
        Uuid = other.Uuid;
        Username = other.Username;
        Password = other.Password;
        Security = other.Security;
        Sni = other.Sni;
        Pbk = other.Pbk;
        Sid = other.Sid;
        Fp = other.Fp;
        Flow = other.Flow;
        Country = other.Country;
        Transport = other.Transport;
        Path = other.Path;
        Host = other.Host;
        ServiceName = other.ServiceName;
        Insecure = other.Insecure;
        HotspotKey = other.HotspotKey;
        HotspotToken = other.HotspotToken;
        if (other.ExtensionData != null)
        {
            ExtensionData = new Dictionary<string, JsonElement>(other.ExtensionData);
        }
        OnPropertyChanged(string.Empty);
    }

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
    public bool IsHotspotNode =>
        (Country != null && Country.Equals("HOTSPOT", StringComparison.OrdinalIgnoreCase)) ||
        !string.IsNullOrEmpty(HotspotToken) ||
        (Id != null && Id.StartsWith("hotspot-", StringComparison.OrdinalIgnoreCase)) ||
        (Name != null && (Name.Contains("Sentinel Hotspot", StringComparison.OrdinalIgnoreCase) || Name.Contains("Hotspot", StringComparison.OrdinalIgnoreCase)));

    [JsonIgnore]
    public bool IsLanNode =>
        !IsHotspotNode && (
            (Country != null && Country.Equals("LAN", StringComparison.OrdinalIgnoreCase)) ||
            IsPrivateIp(Address)
        );

    [JsonIgnore]
    public bool HasKnownCountryCode =>
        !IsHotspotNode &&
        !string.IsNullOrWhiteSpace(Country) &&
        Country.Length == 2 &&
        !Country.Equals("AU", StringComparison.OrdinalIgnoreCase) &&
        !Country.Equals("LA", StringComparison.OrdinalIgnoreCase) &&
        char.IsLetter(Country[0]) && char.IsLetter(Country[1]);

    [JsonIgnore]
    public bool IsTextBadge => HasKnownCountryCode || (IsLanNode && !IsHotspotNode);

    [JsonIgnore]
    public bool IsIconBadge => !IsTextBadge;

    [JsonIgnore]
    public string BadgeText
    {
        get
        {
            if (HasKnownCountryCode) return Country.ToUpperInvariant();
            if (IsLanNode) return "LAN";
            return string.Empty;
        }
    }

    [JsonIgnore]
    public string BadgeIcon
    {
        get
        {
            if (IsHotspotNode)
            {
                // Smartphone / Mobile Hotspot Icon
                return "M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z";
            }
            // Globe / World Icon
            return "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z";
        }
    }

    [JsonIgnore]
    public string BadgeBg
    {
        get
        {
            if (IsHotspotNode) return "#221338"; // Deep violet glass
            if (IsLanNode) return "#0E241E";     // Deep emerald glass
            return "#141A30";                    // Deep navy slate
        }
    }

    [JsonIgnore]
    public string BadgeBorder
    {
        get
        {
            if (IsHotspotNode) return "#8B5CF6"; // Vibrant purple
            if (IsLanNode) return "#10B981";     // Emerald
            return "#253050";                    // Slate border
        }
    }

    [JsonIgnore]
    public string BadgeForeground
    {
        get
        {
            if (IsHotspotNode) return "#C084FC"; // Light purple
            if (IsLanNode) return "#34D399";     // Emerald green
            return "#38BDF8";                    // Sky cyan
        }
    }

    [JsonIgnore]
    public string BadgeToolTip
    {
        get
        {
            if (IsHotspotNode) return "Точка доступа (Sentinel Mobile Hotspot)";
            if (IsLanNode) return "Локальная сеть (LAN / Домашний узел)";
            if (HasKnownCountryCode) return GetCountryName(Country);
            return "Удаленный узел (Авто-определение)";
        }
    }

    [JsonIgnore]
    public string Subtitle => $"{Address}:{Port}{(string.IsNullOrEmpty(Sni) ? "" : $"  •  SNI: {Sni}")}";

    public static bool IsPrivateIp(string? address)
    {
        if (string.IsNullOrWhiteSpace(address)) return false;
        var addr = address.Trim().ToLowerInvariant();
        if (addr == "localhost" || addr == "127.0.0.1" || addr == "::1") return true;
        if (addr.StartsWith("192.168.") || addr.StartsWith("10.")) return true;
        if (addr.StartsWith("172."))
        {
            var parts = addr.Split('.');
            if (parts.Length >= 2 && int.TryParse(parts[1], out var secondOctet))
            {
                if (secondOctet >= 16 && secondOctet <= 31) return true;
            }
        }
        return false;
    }

    public static string GetCountryName(string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return "Авто-определение";
        var c = code.Trim().ToUpperInvariant();
        return c switch
        {
            "RU" => "Россия (RU)",
            "DE" => "Германия (DE)",
            "NL" => "Нидерланды (NL)",
            "US" => "США (US)",
            "FI" => "Финляндия (FI)",
            "FR" => "Франция (FR)",
            "GB" => "Великобритания (GB)",
            "TR" => "Турция (TR)",
            "KZ" => "Казахстан (KZ)",
            "PL" => "Польша (PL)",
            "SE" => "Швеция (SE)",
            "SG" => "Сингапур (SG)",
            "JP" => "Япония (JP)",
            "BY" => "Беларусь (BY)",
            "UA" => "Украина (UA)",
            "CH" => "Швейцария (CH)",
            "AT" => "Австрия (AT)",
            "IT" => "Италия (IT)",
            "ES" => "Испания (ES)",
            "CA" => "Канада (CA)",
            "HK" => "Гонконг (HK)",
            "CZ" => "Чехия (CZ)",
            "LV" => "Латвия (LV)",
            "LT" => "Литва (LT)",
            "EE" => "Эстония (EE)",
            "GE" => "Грузия (GE)",
            "AM" => "Армения (AM)",
            "AE" => "ОАЭ (AE)",
            "LAN" => "Локальная сеть (LAN)",
            "HOTSPOT" => "Точка доступа (Hotspot)",
            _ => $"Сервер ({c})"
        };
    }

    public static string InferCountry(string name, string address, string? sni = null, string? host = null)
    {
        var combined = $"{name} {address} {sni} {host}".ToUpperInvariant();

        if (combined.Contains("HOTSPOT")) return "HOTSPOT";

        // Heuristics based on name, host, sni and address
        if (combined.Contains("GERMAN") || combined.Contains("DEUTSCH") || combined.Contains("FRANKFURT") || combined.Contains(".DE") || Regex.IsMatch(combined, @"\bDE\b")) return "DE";
        if (combined.Contains("NETHERLAND") || combined.Contains("AMSTERDAM") || combined.Contains("HOLLAND") || combined.Contains(".NL") || Regex.IsMatch(combined, @"\bNL\b")) return "NL";
        if (combined.Contains("UNITED STATES") || combined.Contains("AMERICA") || combined.Contains("NEW YORK") || combined.Contains("LOS ANGELES") || combined.Contains("MIAMI") || combined.Contains(".US") || Regex.IsMatch(combined, @"\b(US|USA)\b")) return "US";
        if (combined.Contains("RUSS") || combined.Contains("РОССИ") || combined.Contains("МОСКВА") || combined.Contains("MOSCOW") || combined.Contains("SPB") || combined.Contains("САНКТ") || combined.Contains("ASTRALINUX") || combined.Contains(".RU") || combined.Contains(".SU") || Regex.IsMatch(combined, @"\bRU\b")) return "RU";
        if (combined.Contains("FINLAND") || combined.Contains("HELSINKI") || combined.Contains(".FI") || Regex.IsMatch(combined, @"\bFI\b")) return "FI";
        if (combined.Contains("FRANCE") || combined.Contains("PARIS") || combined.Contains(".FR") || Regex.IsMatch(combined, @"\bFR\b")) return "FR";
        if (combined.Contains("ENGLAND") || combined.Contains("BRITAIN") || combined.Contains("LONDON") || combined.Contains(".UK") || combined.Contains(".CO.UK") || Regex.IsMatch(combined, @"\b(GB|UK)\b")) return "GB";
        if (combined.Contains("KAZAKH") || combined.Contains("ALMATY") || combined.Contains("ASTANA") || combined.Contains(".KZ") || Regex.IsMatch(combined, @"\bKZ\b")) return "KZ";
        if (combined.Contains("TURKEY") || combined.Contains("TURK") || combined.Contains("ISTANBUL") || combined.Contains(".TR") || Regex.IsMatch(combined, @"\bTR\b")) return "TR";
        if (combined.Contains("POLAND") || combined.Contains("WARSAW") || combined.Contains(".PL") || Regex.IsMatch(combined, @"\bPL\b")) return "PL";
        if (combined.Contains("SWEDEN") || combined.Contains("STOCKHOLM") || combined.Contains(".SE") || Regex.IsMatch(combined, @"\bSE\b")) return "SE";
        if (combined.Contains("SINGAPORE") || combined.Contains(".SG") || Regex.IsMatch(combined, @"\bSG\b")) return "SG";
        if (combined.Contains("JAPAN") || combined.Contains("TOKYO") || combined.Contains(".JP") || Regex.IsMatch(combined, @"\bJP\b")) return "JP";
        if (combined.Contains("BELARUS") || combined.Contains("MINSK") || combined.Contains(".BY") || Regex.IsMatch(combined, @"\bBY\b")) return "BY";
        if (combined.Contains("UKRAIN") || combined.Contains("KYIV") || combined.Contains("KIEV") || combined.Contains(".UA") || Regex.IsMatch(combined, @"\bUA\b")) return "UA";
        if (combined.Contains("SWITZERLAND") || combined.Contains("SWISS") || combined.Contains("ZURICH") || combined.Contains(".CH") || Regex.IsMatch(combined, @"\bCH\b")) return "CH";
        if (combined.Contains("AUSTRIA") || combined.Contains("VIENNA") || combined.Contains(".AT") || Regex.IsMatch(combined, @"\bAT\b")) return "AT";
        if (combined.Contains("ITALY") || combined.Contains("ITALIA") || combined.Contains("ROME") || combined.Contains("MILAN") || combined.Contains(".IT") || Regex.IsMatch(combined, @"\bIT\b")) return "IT";
        if (combined.Contains("SPAIN") || combined.Contains("ESPANA") || combined.Contains("MADRID") || combined.Contains(".ES") || Regex.IsMatch(combined, @"\bES\b")) return "ES";
        if (combined.Contains("CANADA") || combined.Contains("TORONTO") || combined.Contains(".CA") || Regex.IsMatch(combined, @"\bCA\b")) return "CA";
        if (combined.Contains("HONG KONG") || combined.Contains("HONGKONG") || combined.Contains(".HK") || Regex.IsMatch(combined, @"\bHK\b")) return "HK";
        if (combined.Contains("CZECH") || combined.Contains("PRAGUE") || combined.Contains(".CZ") || Regex.IsMatch(combined, @"\bCZ\b")) return "CZ";
        if (combined.Contains("LATVIA") || combined.Contains("RIGA") || combined.Contains(".LV") || Regex.IsMatch(combined, @"\bLV\b")) return "LV";
        if (combined.Contains("LITHUANIA") || combined.Contains("VILNIUS") || combined.Contains(".LT") || Regex.IsMatch(combined, @"\bLT\b")) return "LT";
        if (combined.Contains("ESTONIA") || combined.Contains("TALLINN") || combined.Contains(".EE") || Regex.IsMatch(combined, @"\bEE\b")) return "EE";
        if (combined.Contains("GEORGIA") || combined.Contains("TBILISI") || combined.Contains(".GE") || Regex.IsMatch(combined, @"\bGE\b")) return "GE";
        if (combined.Contains("ARMENIA") || combined.Contains("YEREVAN") || combined.Contains(".AM") || Regex.IsMatch(combined, @"\bAM\b")) return "AM";
        if (combined.Contains("DUBAI") || combined.Contains("UAE") || combined.Contains(".AE") || Regex.IsMatch(combined, @"\bAE\b")) return "AE";

        if (IsPrivateIp(address)) return "LAN";

        return "AUTO";
    }
}
