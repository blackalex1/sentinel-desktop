using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SentinelDesktop.Models;

public sealed class SchemaSelectOption
{
    [JsonPropertyName("value")]
    public string Value { get; set; } = string.Empty;

    [JsonPropertyName("label")]
    public string Label { get; set; } = string.Empty;

    [JsonPropertyName("supportedEngines")]
    public List<string>? SupportedEngines { get; set; }

    [JsonPropertyName("showIf")]
    public Dictionary<string, JsonElement>? ShowIf { get; set; }

    public override string ToString() => string.IsNullOrWhiteSpace(Label) ? Value : Label;
}

public sealed class SchemaFormField
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("targetField")]
    public string TargetField { get; set; } = string.Empty;

    [JsonPropertyName("type")]
    public string Type { get; set; } = "text";

    [JsonPropertyName("label")]
    public string Label { get; set; } = string.Empty;

    [JsonPropertyName("placeholder")]
    public string? Placeholder { get; set; }

    [JsonPropertyName("default")]
    public JsonElement? DefaultValue { get; set; }

    [JsonPropertyName("options")]
    public List<SchemaSelectOption>? Options { get; set; }

    [JsonPropertyName("supportedEngines")]
    public List<string>? SupportedEngines { get; set; }

    [JsonPropertyName("showIf")]
    public Dictionary<string, JsonElement>? ShowIf { get; set; }
}

public sealed class SchemaFieldGroup
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("supportedEngines")]
    public List<string>? SupportedEngines { get; set; }

    [JsonPropertyName("showIf")]
    public Dictionary<string, JsonElement>? ShowIf { get; set; }

    [JsonPropertyName("fields")]
    public List<SchemaFormField>? Fields { get; set; }
}

public sealed class SchemaTabDefinition
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("icon")]
    public string? Icon { get; set; }

    [JsonPropertyName("supportedEngines")]
    public List<string>? SupportedEngines { get; set; }

    [JsonPropertyName("showIf")]
    public Dictionary<string, JsonElement>? ShowIf { get; set; }

    [JsonPropertyName("groups")]
    public List<SchemaFieldGroup>? Groups { get; set; }
}

public sealed class SchemaProtocolCapability
{
    [JsonPropertyName("protocol")]
    public string Protocol { get; set; } = string.Empty;

    [JsonPropertyName("displayName")]
    public string DisplayName { get; set; } = string.Empty;

    [JsonPropertyName("defaultTransport")]
    public string? DefaultTransport { get; set; }

    [JsonPropertyName("defaultSecurity")]
    public string? DefaultSecurity { get; set; }

    [JsonPropertyName("supportedEngines")]
    public List<string>? SupportedEngines { get; set; }

    [JsonPropertyName("supportedTransports")]
    public List<string>? SupportedTransports { get; set; }

    [JsonPropertyName("engineTransports")]
    public Dictionary<string, List<string>>? EngineTransports { get; set; }

    [JsonPropertyName("supportedSecurity")]
    public List<string>? SupportedSecurity { get; set; }

    [JsonPropertyName("engineSecurity")]
    public Dictionary<string, List<string>>? EngineSecurity { get; set; }

    [JsonPropertyName("engineFingerprints")]
    public Dictionary<string, List<string>>? EngineFingerprints { get; set; }

    [JsonPropertyName("tabDefinitions")]
    public List<SchemaTabDefinition>? TabDefinitions { get; set; }
}

public sealed class SentinelConfigurationSchema
{
    [JsonPropertyName("language")]
    public string Language { get; set; } = "ru";

    [JsonPropertyName("protocols")]
    public Dictionary<string, SchemaProtocolCapability>? Protocols { get; set; }

    [JsonPropertyName("outboundProtocols")]
    public Dictionary<string, SchemaProtocolCapability>? OutboundProtocols { get; set; }
}
