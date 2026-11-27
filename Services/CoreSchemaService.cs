using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using SentinelDesktop.Models;

namespace SentinelDesktop.Services;

public sealed class ProfileEditorOptions
{
    public List<SchemaSelectOption> Protocols { get; init; } = new();
    public List<SchemaSelectOption> Transports { get; init; } = new();
    public List<SchemaSelectOption> Securities { get; init; } = new();
    public List<SchemaSelectOption> Fingerprints { get; init; } = new();
    public List<SchemaSelectOption> Flows { get; init; } = new();
    public List<SchemaSelectOption> XhttpModes { get; init; } = new();
    public List<SchemaSelectOption> HeaderTypes { get; init; } = new();
    public string? DefaultTransport { get; init; }
    public string? DefaultSecurity { get; init; }
    public string? DefaultFingerprint { get; init; }
    public string? DefaultFlow { get; init; }
    public string? DefaultXhttpMode { get; init; }
    public string? DefaultHeaderType { get; init; }
    public bool ShowFlow { get; init; }
    public bool ShowXhttpMode { get; init; }
    public bool ShowHeaderType { get; init; }
    public bool ShowFingerprint { get; init; } = true;
}

/// <summary>
/// Resolves proxy profile dropdown options directly from sentinel_core's configuration schema
/// filtered by active core engine (xray-core / sing-box / hysteria2) and cross-field rules.
/// </summary>
public static class CoreSchemaService
{
    private static readonly string[] ExcludedOutboundProtocols =
    {
        "freedom", "direct", "blackhole", "block", "ss", "wg", "socks5"
    };

    private static readonly string[] PreferredProtocolOrder =
    {
        "vless", "trojan", "hysteria2", "shadowsocks", "vmess", "tuic", "shadowtls", "wireguard", "socks", "http", "warp"
    };

    public static string NormalizeEngineId(string? engine)
    {
        var raw = (engine ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(raw) || raw == "auto") return string.Empty;
        return raw switch
        {
            "xray" or "xray-core" => "xray-core",
            "singbox" or "sing-box" => "sing-box",
            "hysteria" or "hysteria2" or "hy2" => "hysteria2",
            _ => raw
        };
    }

    public static string ResolveConfiguredEngine(string? explicitEngine = null)
    {
        if (!string.IsNullOrWhiteSpace(explicitEngine))
            return NormalizeEngineId(explicitEngine);
        try
        {
            var settings = StorageService.Load().Settings;
            return NormalizeEngineId(settings?.CoreType);
        }
        catch
        {
            return string.Empty;
        }
    }

    public static bool SupportsEngine(List<string>? supportedEngines, string activeEngine)
    {
        if (string.IsNullOrEmpty(activeEngine) || supportedEngines == null || supportedEngines.Count == 0)
            return true;
        return supportedEngines.Any(e => NormalizeEngineId(e).Equals(activeEngine, StringComparison.OrdinalIgnoreCase));
    }

    public static bool MatchesShowIf(Dictionary<string, JsonElement>? showIf, IReadOnlyDictionary<string, string> formValues)
    {
        if (showIf == null || showIf.Count == 0) return true;
        foreach (var (key, expected) in showIf)
        {
            formValues.TryGetValue(key, out var actual);
            actual ??= string.Empty;

            bool matched;
            if (expected.ValueKind == JsonValueKind.Array)
            {
                matched = expected.EnumerateArray().Any(item =>
                    (item.ValueKind == JsonValueKind.String ? item.GetString() : item.ToString())
                    ?.Equals(actual, StringComparison.OrdinalIgnoreCase) == true);
            }
            else if (expected.ValueKind == JsonValueKind.String)
            {
                matched = string.Equals(expected.GetString(), actual, StringComparison.OrdinalIgnoreCase);
            }
            else
            {
                matched = string.Equals(expected.ToString(), actual, StringComparison.OrdinalIgnoreCase);
            }
            if (!matched) return false;
        }
        return true;
    }

    public static ProfileEditorOptions GetProfileEditorOptions(
        string? protocol,
        string? currentTransport = null,
        string? currentSecurity = null,
        string? currentFingerprint = null,
        string? currentFlow = null,
        string? currentXhttpMode = null,
        string? currentHeaderType = null,
        string? activeEngine = null,
        string lang = "ru")
    {
        var normEngine = ResolveConfiguredEngine(activeEngine);
        var schema = SentinelCoreNative.GetConfigurationSchema(lang);
        if (schema == null || ((schema.OutboundProtocols == null || schema.OutboundProtocols.Count == 0) &&
                               (schema.Protocols == null || schema.Protocols.Count == 0)))
        {
            return BuildFallbackOptions(protocol, currentTransport, currentSecurity, currentFingerprint, currentFlow, currentXhttpMode, currentHeaderType, normEngine);
        }

        var normalizedProto = NormalizeProtocol(protocol);
        var protocols = BuildProtocolOptions(schema, normalizedProto, normEngine);
        var cap = ResolveCapability(schema, normalizedProto);

        var effTransport = string.IsNullOrWhiteSpace(currentTransport) ? (cap?.DefaultTransport ?? "tcp") : currentTransport.Trim().ToLowerInvariant();
        var effSecurity = string.IsNullOrWhiteSpace(currentSecurity) ? (cap?.DefaultSecurity ?? "none") : currentSecurity.Trim().ToLowerInvariant();
        var formValues = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["network"] = effTransport,
            ["security"] = effSecurity
        };

        var (transports, defaultTransport, _) = ResolveFieldOptions(
            schema, cap, "ob-network", "network", currentTransport, normEngine, formValues, includeEmptyOption: false);
        var (securities, defaultSecurity, _) = ResolveFieldOptions(
            schema, cap, "ob-security", "security", currentSecurity, normEngine, formValues, includeEmptyOption: false);
        var (fingerprints, defaultFingerprint, showFpField) = ResolveFieldOptions(
            schema, cap, "ob-fp", "fingerprint", currentFingerprint, normEngine, formValues, includeEmptyOption: false, allowAggregateWhenFieldMissing: true);
        var (flows, defaultFlow, showFlow) = ResolveFieldOptions(
            schema, cap, "ob-flow", "flow", currentFlow, normEngine, formValues, includeEmptyOption: true, allowAggregateWhenFieldMissing: false);
        var (xhttpModes, defaultXhttpMode, showXhttpMode) = ResolveFieldOptions(
            schema, cap, "ob-xhttp-mode", "xhttpMode", currentXhttpMode, normEngine, formValues, includeEmptyOption: false, allowAggregateWhenFieldMissing: false);
        var (headerTypes, defaultHeaderType, showHeaderType) = ResolveFieldOptions(
            schema, cap, "ob-header-type", "headerType", currentHeaderType, normEngine, formValues, includeEmptyOption: true, allowAggregateWhenFieldMissing: false);

        return new ProfileEditorOptions
        {
            Protocols = protocols,
            Transports = transports,
            Securities = securities,
            Fingerprints = fingerprints,
            Flows = flows,
            XhttpModes = xhttpModes,
            HeaderTypes = headerTypes,
            DefaultTransport = cap?.DefaultTransport ?? defaultTransport ?? transports.FirstOrDefault()?.Value,
            DefaultSecurity = cap?.DefaultSecurity ?? defaultSecurity ?? securities.FirstOrDefault()?.Value,
            DefaultFingerprint = defaultFingerprint ?? fingerprints.FirstOrDefault()?.Value,
            DefaultFlow = defaultFlow ?? string.Empty,
            DefaultXhttpMode = defaultXhttpMode ?? "auto",
            DefaultHeaderType = defaultHeaderType ?? string.Empty,
            ShowFlow = showFlow && flows.Count > 0,
            ShowXhttpMode = showXhttpMode && xhttpModes.Count > 0,
            ShowHeaderType = showHeaderType && headerTypes.Count > 0,
            ShowFingerprint = showFpField || (!normalizedProto.Equals("hysteria2", StringComparison.OrdinalIgnoreCase) && fingerprints.Count > 0)
        };
    }

    private static string NormalizeProtocol(string? protocol)
    {
        var lower = (protocol ?? "vless").Trim().ToLowerInvariant();
        return lower switch
        {
            "ss" => "shadowsocks",
            "hy2" or "hysteria" => "hysteria2",
            "wg" => "wireguard",
            "socks5" => "socks",
            _ => lower
        };
    }

    private static List<SchemaSelectOption> BuildProtocolOptions(SentinelConfigurationSchema schema, string? currentProto, string activeEngine)
    {
        var byKey = new Dictionary<string, SchemaSelectOption>(StringComparer.OrdinalIgnoreCase);

        void Collect(Dictionary<string, SchemaProtocolCapability>? source, bool checkExcluded)
        {
            if (source == null) return;
            foreach (var (key, cap) in source)
            {
                if (checkExcluded && ExcludedOutboundProtocols.Contains(key, StringComparer.OrdinalIgnoreCase))
                    continue;
                if (!SupportsEngine(cap.SupportedEngines, activeEngine) && !key.Equals(currentProto, StringComparison.OrdinalIgnoreCase))
                    continue;
                if (!byKey.ContainsKey(key))
                {
                    byKey[key] = new SchemaSelectOption
                    {
                        Value = key,
                        Label = string.IsNullOrWhiteSpace(cap.DisplayName) ? key.ToUpperInvariant() : cap.DisplayName
                    };
                }
            }
        }

        Collect(schema.OutboundProtocols, checkExcluded: true);
        Collect(schema.Protocols, checkExcluded: false);

        var ordered = new List<SchemaSelectOption>();
        foreach (var pref in PreferredProtocolOrder)
        {
            if (byKey.Remove(pref, out var opt))
            {
                ordered.Add(opt);
            }
        }
        ordered.AddRange(byKey.Values);

        if (!string.IsNullOrWhiteSpace(currentProto) &&
            !ordered.Any(o => o.Value.Equals(currentProto, StringComparison.OrdinalIgnoreCase)))
        {
            ordered.Add(new SchemaSelectOption { Value = currentProto, Label = currentProto.ToUpperInvariant() });
        }

        return ordered;
    }

    private static SchemaProtocolCapability? ResolveCapability(SentinelConfigurationSchema schema, string protocol)
    {
        if (schema.OutboundProtocols != null && schema.OutboundProtocols.TryGetValue(protocol, out var outCap))
        {
            return outCap;
        }
        if (schema.Protocols != null && schema.Protocols.TryGetValue(protocol, out var protoCap))
        {
            return protoCap;
        }
        return null;
    }

    private static (List<SchemaSelectOption> Options, string? DefaultVal, bool IsVisible) ResolveFieldOptions(
        SentinelConfigurationSchema schema,
        SchemaProtocolCapability? activeCap,
        string fieldId,
        string targetField,
        string? currentValue,
        string activeEngine,
        IReadOnlyDictionary<string, string> formValues,
        bool includeEmptyOption,
        bool allowAggregateWhenFieldMissing = true)
    {
        var match = FindFieldContext(activeCap, fieldId, targetField);
        var matchedField = match.Field;
        string? defaultVal = ExtractDefaultString(matchedField);
        bool isVisible = matchedField != null &&
                         SupportsEngine(match.Tab?.SupportedEngines, activeEngine) &&
                         SupportsEngine(match.Group?.SupportedEngines, activeEngine) &&
                         SupportsEngine(matchedField.SupportedEngines, activeEngine) &&
                         MatchesShowIf(match.Tab?.ShowIf, formValues) &&
                         MatchesShowIf(match.Group?.ShowIf, formValues) &&
                         MatchesShowIf(matchedField.ShowIf, formValues);

        HashSet<string>? allowedByCap = ResolveEngineAllowedSet(activeCap, targetField, activeEngine);

        List<SchemaSelectOption> options;
        if (matchedField?.Options != null && matchedField.Options.Count > 0)
        {
            options = CloneOptions(matchedField.Options, activeEngine, formValues, allowedByCap, includeEmptyOption);
        }
        else if (allowAggregateWhenFieldMissing)
        {
            options = AggregateFieldOptionsAcrossSchema(schema, fieldId, targetField, activeEngine, formValues, allowedByCap, includeEmptyOption);
            if (defaultVal == null)
            {
                var fallbackCap = ResolveCapability(schema, "vless");
                defaultVal = ExtractDefaultString(FindFieldContext(fallbackCap, fieldId, targetField).Field);
            }
        }
        else
        {
            options = new List<SchemaSelectOption>();
        }

        if (!string.IsNullOrWhiteSpace(currentValue) &&
            isVisible &&
            !options.Any(o => o.Value.Equals(currentValue, StringComparison.OrdinalIgnoreCase)))
        {
            options.Add(new SchemaSelectOption
            {
                Value = currentValue,
                Label = currentValue
            });
        }

        return (options, defaultVal, isVisible);
    }

    private static HashSet<string>? ResolveEngineAllowedSet(SchemaProtocolCapability? cap, string targetField, string activeEngine)
    {
        if (cap == null) return null;
        if (targetField.Equals("network", StringComparison.OrdinalIgnoreCase))
        {
            if (!string.IsNullOrEmpty(activeEngine) && cap.EngineTransports != null &&
                cap.EngineTransports.TryGetValue(activeEngine, out var list) && list.Count > 0)
            {
                return new HashSet<string>(list, StringComparer.OrdinalIgnoreCase);
            }
            if (cap.SupportedTransports != null && cap.SupportedTransports.Count > 0)
            {
                return new HashSet<string>(cap.SupportedTransports, StringComparer.OrdinalIgnoreCase);
            }
        }
        else if (targetField.Equals("security", StringComparison.OrdinalIgnoreCase))
        {
            if (!string.IsNullOrEmpty(activeEngine) && cap.EngineSecurity != null &&
                cap.EngineSecurity.TryGetValue(activeEngine, out var list) && list.Count > 0)
            {
                return new HashSet<string>(list, StringComparer.OrdinalIgnoreCase);
            }
            if (cap.SupportedSecurity != null && cap.SupportedSecurity.Count > 0)
            {
                return new HashSet<string>(cap.SupportedSecurity, StringComparer.OrdinalIgnoreCase);
            }
        }
        else if (targetField.Equals("fingerprint", StringComparison.OrdinalIgnoreCase))
        {
            if (!string.IsNullOrEmpty(activeEngine) && cap.EngineFingerprints != null &&
                cap.EngineFingerprints.TryGetValue(activeEngine, out var list) && list.Count > 0)
            {
                return new HashSet<string>(list, StringComparer.OrdinalIgnoreCase);
            }
        }
        return null;
    }

    private static (SchemaTabDefinition? Tab, SchemaFieldGroup? Group, SchemaFormField? Field) FindFieldContext(
        SchemaProtocolCapability? cap, string fieldId, string targetField)
    {
        if (cap?.TabDefinitions == null) return (null, null, null);
        foreach (var tab in cap.TabDefinitions)
        {
            if (tab.Groups == null) continue;
            foreach (var group in tab.Groups)
            {
                if (group.Fields == null) continue;
                foreach (var field in group.Fields)
                {
                    if (field.Id.Equals(fieldId, StringComparison.OrdinalIgnoreCase) ||
                        field.TargetField.Equals(targetField, StringComparison.OrdinalIgnoreCase))
                    {
                        return (tab, group, field);
                    }
                }
            }
        }
        return (null, null, null);
    }

    private static List<SchemaSelectOption> AggregateFieldOptionsAcrossSchema(
        SentinelConfigurationSchema schema,
        string fieldId,
        string targetField,
        string activeEngine,
        IReadOnlyDictionary<string, string> formValues,
        HashSet<string>? allowedByCap,
        bool includeEmptyOption)
    {
        var result = new List<SchemaSelectOption>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void CollectFrom(Dictionary<string, SchemaProtocolCapability>? dict)
        {
            if (dict == null) return;
            foreach (var key in PreferredProtocolOrder.Concat(dict.Keys))
            {
                if (!dict.TryGetValue(key, out var cap)) continue;
                var f = FindFieldContext(cap, fieldId, targetField).Field;
                if (f?.Options == null) continue;
                foreach (var opt in f.Options)
                {
                    if (!SupportsEngine(opt.SupportedEngines, activeEngine)) continue;
                    if (!MatchesShowIf(opt.ShowIf, formValues)) continue;
                    if (allowedByCap != null && !allowedByCap.Contains(opt.Value)) continue;
                    if (!includeEmptyOption && string.IsNullOrEmpty(opt.Value)) continue;
                    if (seen.Add(opt.Value))
                    {
                        result.Add(new SchemaSelectOption
                        {
                            Value = opt.Value,
                            Label = string.IsNullOrWhiteSpace(opt.Label) ? opt.Value : opt.Label
                        });
                    }
                }
            }
        }

        CollectFrom(schema.OutboundProtocols);
        CollectFrom(schema.Protocols);
        return result;
    }

    private static List<SchemaSelectOption> CloneOptions(
        IEnumerable<SchemaSelectOption> source,
        string activeEngine,
        IReadOnlyDictionary<string, string> formValues,
        HashSet<string>? allowedByCap,
        bool includeEmptyOption)
    {
        var list = new List<SchemaSelectOption>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var opt in source)
        {
            var val = opt.Value ?? string.Empty;
            if (!SupportsEngine(opt.SupportedEngines, activeEngine)) continue;
            if (!MatchesShowIf(opt.ShowIf, formValues)) continue;
            if (allowedByCap != null && !allowedByCap.Contains(val)) continue;
            if (!includeEmptyOption && string.IsNullOrEmpty(val)) continue;
            if (seen.Add(val))
            {
                list.Add(new SchemaSelectOption
                {
                    Value = val,
                    Label = string.IsNullOrWhiteSpace(opt.Label) ? val : opt.Label
                });
            }
        }
        return list;
    }

    private static string? ExtractDefaultString(SchemaFormField? field)
    {
        if (field?.DefaultValue is { } el)
        {
            return el.ValueKind == JsonValueKind.String ? el.GetString() : el.ToString();
        }
        return null;
    }

    private static ProfileEditorOptions BuildFallbackOptions(
        string? protocol,
        string? currentTransport,
        string? currentSecurity,
        string? currentFingerprint,
        string? currentFlow,
        string? currentXhttpMode,
        string? currentHeaderType,
        string activeEngine)
    {
        static List<SchemaSelectOption> ToOpts(IEnumerable<string> vals, string? current)
        {
            var list = vals.Select(v => new SchemaSelectOption { Value = v, Label = v }).ToList();
            if (!string.IsNullOrWhiteSpace(current) && !list.Any(o => o.Value.Equals(current, StringComparison.OrdinalIgnoreCase)))
            {
                list.Add(new SchemaSelectOption { Value = current, Label = current });
            }
            return list;
        }

        var isSingBox = activeEngine.Equals("sing-box", StringComparison.OrdinalIgnoreCase);
        var transports = isSingBox
            ? new[] { "tcp", "ws", "grpc", "httpupgrade", "h2" }
            : new[] { "tcp", "ws", "grpc", "httpupgrade", "xhttp", "h2" };

        return new ProfileEditorOptions
        {
            Protocols = ToOpts(new[] { "vless", "trojan", "hysteria2", "shadowsocks", "vmess", "tuic", "shadowtls" }, protocol),
            Transports = ToOpts(transports, currentTransport),
            Securities = ToOpts(new[] { "reality", "tls", "none" }, currentSecurity),
            Fingerprints = ToOpts(new[] { "chrome", "firefox", "safari", "ios", "android", "edge", "360", "qq", "random", "randomized" }, currentFingerprint),
            Flows = ToOpts(new[] { "", "xtls-rprx-vision" }, currentFlow),
            XhttpModes = ToOpts(new[] { "auto", "packet-up", "stream-up", "stream-one" }, currentXhttpMode),
            HeaderTypes = ToOpts(new[] { "", "http" }, currentHeaderType),
            DefaultTransport = "tcp",
            DefaultSecurity = "reality",
            DefaultFingerprint = "chrome",
            DefaultFlow = string.Empty,
            DefaultXhttpMode = "auto",
            DefaultHeaderType = string.Empty,
            ShowFlow = string.Equals(protocol, "vless", StringComparison.OrdinalIgnoreCase),
            ShowXhttpMode = !isSingBox && string.Equals(currentTransport, "xhttp", StringComparison.OrdinalIgnoreCase),
            ShowHeaderType = !isSingBox && string.Equals(currentTransport, "tcp", StringComparison.OrdinalIgnoreCase),
            ShowFingerprint = !string.Equals(protocol, "hysteria2", StringComparison.OrdinalIgnoreCase)
        };
    }
}
