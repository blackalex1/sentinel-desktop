using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using SentinelDesktop.Models;

namespace SentinelDesktop.Services;

public static class CoreConfigBuilder
{
    public static async Task<(bool success, string configPath, string? error)> BuildAndSaveConfigAsync(
        ServerProfile server,
        AppSettings settings,
        CoreEngineOption resolvedCore,
        int socksPort,
        int httpPort,
        string coreLogLevel)
    {
        var isXray = resolvedCore.Id == "xray";
        var modeStr = settings.IsTunMode ? "desktop_tun" : "system_proxy";

        var dataDir = CoreEnvironmentService.GetDataDirectory();
        Directory.CreateDirectory(dataDir);
        var configPath = Path.Combine(dataDir, "running_config.json");

        var dnsPreset = DnsPresetsCatalog.GetPreset(settings.SelectedDnsPresetId);
        List<string> activeDnsList;
        string remoteServer;
        string directServer;
        if (dnsPreset.Id == "custom" && !string.IsNullOrWhiteSpace(settings.CustomDnsServers))
        {
            activeDnsList = settings.CustomDnsServers
                .Split(new[] { ',', '\n', '\r', ';' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(s => s.Trim())
                .Where(s => !string.IsNullOrEmpty(s))
                .ToList();
            remoteServer = activeDnsList.FirstOrDefault(s => s.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) ?? "https://dns.google/dns-query";
            directServer = activeDnsList.FirstOrDefault(s => !s.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) ?? "8.8.8.8";
        }
        else
        {
            activeDnsList = dnsPreset.Servers;
            remoteServer = dnsPreset.RemoteServer;
            directServer = dnsPreset.DirectServer;
        }

        var coreExe = CoreEnvironmentService.ResolveCoreExecutable(resolvedCore, isXray);
        var coreVersion = CoreEnvironmentService.GetCoreVersion(coreExe, isXray);

        // Pure Intent Specification for sentinel-core Go compiler
        var spec = new
        {
            targetCore = resolvedCore.TargetCoreAst,
            coreVersion = coreVersion,
            logLevel = coreLogLevel,
            clashApiAddress = "127.0.0.1:9090",
            serverNode = server,
            clientInbound = new
            {
                mode = modeStr,
                socksPort = socksPort,
                httpPort = httpPort,
                autoRoute = settings.IsTunMode
            },
            dns = new
            {
                remoteServer = remoteServer,
                directServer = directServer,
                strategy = "ipv4_only",
                servers = activeDnsList
            },
            routing = RoutingService.Instance.BuildRoutingSpecForAst(includeSecurityRules: !isXray)
        };

        var specJson = JsonSerializer.Serialize(spec);
        var buildResultJson = SentinelCoreNative.BuildConfig(specJson);

        string actualConfig;
        if (string.IsNullOrEmpty(buildResultJson) || buildResultJson.StartsWith("{\"error\""))
        {
            if (isXray && (server.Protocol.Equals("socks", StringComparison.OrdinalIgnoreCase) ||
                           server.Protocol.Equals("socks5", StringComparison.OrdinalIgnoreCase) ||
                           server.Protocol.Equals("http", StringComparison.OrdinalIgnoreCase) ||
                           server.Protocol.Equals("https", StringComparison.OrdinalIgnoreCase)))
            {
                actualConfig = BuildXrayProxyConfig(server, socksPort, httpPort, settings.IsTunMode, coreLogLevel, activeDnsList);
            }
            else
            {
                return (false, configPath, $"Ошибка сборщика SentinelBuildConfig: {buildResultJson}");
            }
        }
        else
        {
            try
            {
                using var doc = JsonDocument.Parse(buildResultJson);
                if (doc.RootElement.TryGetProperty("configJson", out var cfgProp))
                {
                    actualConfig = cfgProp.GetString() ?? buildResultJson;
                }
                else if (doc.RootElement.TryGetProperty("config", out var cProp))
                {
                    actualConfig = cProp.GetString() ?? buildResultJson;
                }
                else
                {
                    actualConfig = buildResultJson;
                }
            }
            catch
            {
                actualConfig = buildResultJson;
            }
        }

        // Ensure log section is set to stream in-memory to stdout/stderr without disk I/O
        try
        {
            var nodeObj = JsonNode.Parse(actualConfig);
            if (nodeObj != null)
            {
                if (nodeObj["log"] == null) nodeObj["log"] = new JsonObject();
                if (!isXray)
                {
                    nodeObj["log"]!["disabled"] = false;
                    nodeObj["log"]!["level"] = coreLogLevel;
                    nodeObj["log"]!["timestamp"] = true;

                    // Guarantee all initial_path files referenced by route.rule_set exist on disk
                    if (nodeObj["route"]?["rule_set"] is JsonArray ruleSetsArr)
                    {
                        foreach (var rs in ruleSetsArr)
                        {
                            if (rs is JsonObject rsObj && rsObj["initial_path"] != null)
                            {
                                var initialPath = rsObj["initial_path"]!.ToString();
                                var fileName = Path.GetFileName(initialPath);
                                CoreEnvironmentService.EnsureRuleStub(fileName);
                            }
                        }
                    }
                }
                else
                {
                    var xrayLevel = coreLogLevel.ToLowerInvariant() switch
                    {
                        "trace" or "debug" => "debug",
                        "warn" => "warning",
                        "error" => "error",
                        _ => "info"
                    };
                    nodeObj["log"]!["loglevel"] = xrayLevel;
                    nodeObj["log"]!["access"] = "";
                    nodeObj["log"]!["error"] = "";
                    nodeObj["log"]!["dnsLog"] = true;

                    // Ensure Xray DNS uses IPv4 strategy to prevent empty AAAA caching errors
                    if (nodeObj["dns"] is not JsonObject dnsObj)
                    {
                        dnsObj = new JsonObject();
                        nodeObj["dns"] = dnsObj;
                    }
                    dnsObj["queryStrategy"] = "UseIPv4";

                    var serversArr = new JsonArray();
                    foreach (var s in activeDnsList)
                    {
                        serversArr.Add(s);
                    }
                    if (!activeDnsList.Contains("localhost"))
                    {
                        serversArr.Add("localhost");
                    }
                    dnsObj["servers"] = serversArr;

                    if (nodeObj["routing"] is JsonObject routingObj)
                    {
                        routingObj["domainStrategy"] = "IPIfNonMatch";
                    }

                    // In TUN mode, bind physical IP (sendThrough) and physical interface (sockopt.interface) to direct and proxy outbounds to strictly prevent routing loops
                    if (settings.IsTunMode)
                    {
                        var (defaultPhysicalIp, _) = DesktopTunRoutingService.GetPhysicalInterfaceInfo();
                        var defaultPhysicalIfName = GetPhysicalInterfaceName();

                        var (serverLocalIp, _, serverIfName) = DesktopTunRoutingService.GetRouteForDestination(server.Address);
                        var proxyIp = serverLocalIp ?? defaultPhysicalIp;
                        var proxyIfName = serverIfName ?? defaultPhysicalIfName;

                        LoggingService.Instance.LogApp($"[CoreConfig] Привязка прокси к интерфейсу {proxyIfName ?? "auto"} (IP: {proxyIp ?? "auto"}), прямого трафика к {defaultPhysicalIfName ?? "auto"} (IP: {defaultPhysicalIp ?? "auto"})");

                        if (nodeObj["outbounds"] is JsonArray outboundsArr)
                        {
                            foreach (var ob in outboundsArr)
                            {
                                if (ob is JsonObject obObj)
                                {
                                    var proto = obObj["protocol"]?.ToString();
                                    var tag = obObj["tag"]?.ToString();

                                    // Skip local blackhole and DNS outbounds
                                    if (proto == "blackhole" || tag == "block" || tag == "blocked" || tag == "api" || proto == "dns")
                                    {
                                        continue;
                                    }

                                    bool isDirect = (tag == "direct" || proto == "freedom");
                                    var targetIp = isDirect ? defaultPhysicalIp : proxyIp;
                                    var targetIfName = isDirect ? defaultPhysicalIfName : proxyIfName;

                                    if (!string.IsNullOrEmpty(targetIp))
                                    {
                                        obObj["sendThrough"] = targetIp;
                                    }

                                    if (!string.IsNullOrEmpty(targetIfName))
                                    {
                                        if (obObj["streamSettings"] is not JsonObject ss)
                                        {
                                            ss = new JsonObject();
                                            obObj["streamSettings"] = ss;
                                        }
                                        if (ss["sockopt"] is not JsonObject so)
                                        {
                                            so = new JsonObject();
                                            ss["sockopt"] = so;
                                        }
                                        so["interface"] = targetIfName;
                                    }
                                }
                            }
                        }
                    }
                }
                actualConfig = nodeObj.ToString();
            }
        }
        catch (Exception ex)
        {
            LoggingService.Instance.LogApp($"[CoreConfig] Ошибка пост-обработки конфигурации ядра: {ex.Message}", "WARN");
        }

        await File.WriteAllTextAsync(configPath, actualConfig);

        if (OperatingSystem.IsWindows())
        {
            try
            {
                var fileInfo = new FileInfo(configPath);
                var fileSecurity = new System.Security.AccessControl.FileSecurity();
                var currentUser = System.Security.Principal.WindowsIdentity.GetCurrent().User;
                if (currentUser != null)
                {
                    fileSecurity.SetOwner(currentUser);
                    fileSecurity.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);
                    fileSecurity.AddAccessRule(new System.Security.AccessControl.FileSystemAccessRule(
                        currentUser,
                        System.Security.AccessControl.FileSystemRights.FullControl,
                        System.Security.AccessControl.AccessControlType.Allow));
                    fileSecurity.AddAccessRule(new System.Security.AccessControl.FileSystemAccessRule(
                        new System.Security.Principal.SecurityIdentifier(System.Security.Principal.WellKnownSidType.BuiltinAdministratorsSid, null),
                        System.Security.AccessControl.FileSystemRights.FullControl,
                        System.Security.AccessControl.AccessControlType.Allow));
                    fileInfo.SetAccessControl(fileSecurity);
                }
            }
            catch { }
        }

        LoggingService.Instance.LogApp("Конфигурация ядра скомпилирована через Sentinel AST Core и защищена правами доступа");
        return (true, configPath, null);
    }

    public static string BuildXrayProxyConfig(ServerProfile server, int socksPort, int httpPort, bool isTunMode, string logLevel, List<string> dnsServers)
    {
        var proto = server.Protocol.ToLowerInvariant() switch
        {
            "http" or "https" => "http",
            _ => "socks"
        };

        var xrayLevel = logLevel.ToLowerInvariant() switch
        {
            "trace" or "debug" => "debug",
            "warn" => "warning",
            "error" => "error",
            _ => "info"
        };

        var serverItem = new Dictionary<string, object>
        {
            ["address"] = server.Address,
            ["port"] = server.Port
        };

        if (!string.IsNullOrEmpty(server.Username) || !string.IsNullOrEmpty(server.Password))
        {
            serverItem["users"] = new object[]
            {
                new
                {
                    user = server.Username ?? "",
                    pass = server.Password ?? "",
                    level = 0
                }
            };
        }

        var inboundsList = new List<object>
        {
            new
            {
                tag = "socks-in",
                port = socksPort,
                listen = "127.0.0.1",
                protocol = "socks",
                settings = new { auth = "noauth", udp = true },
                sniffing = new
                {
                    enabled = true,
                    destOverride = new[] { "http", "tls", "quic", "fakedns" },
                    routeOnly = false
                }
            },
            new
            {
                tag = "http-in",
                port = httpPort,
                listen = "127.0.0.1",
                protocol = "http",
                settings = new { allowTransparent = false },
                sniffing = new
                {
                    enabled = true,
                    destOverride = new[] { "http", "tls", "quic", "fakedns" }
                }
            }
        };

        if (isTunMode)
        {
            inboundsList.Add(new
            {
                tag = "tun-in",
                protocol = "tun",
                settings = new
                {
                    name = "sentinel-tun",
                    address = new[] { "172.19.0.1/30" },
                    autoRoute = true,
                    strictRoute = true,
                    stack = "mixed",
                    mtu = 9000
                },
                sniffing = new
                {
                    enabled = true,
                    destOverride = new[] { "http", "tls", "quic", "fakedns" },
                    routeOnly = false
                }
            });
        }

        var routingRules = new List<object>
        {
            new
            {
                type = "field",
                outboundTag = "dns-out",
                port = "53",
                network = "udp,tcp"
            },
            new
            {
                type = "field",
                outboundTag = "direct",
                ip = new[] { server.Address }
            },
            new
            {
                type = "field",
                outboundTag = "block",
                ip = new[] { "169.254.0.0/16", "224.0.0.0/4", "255.255.255.255/32", "fe80::/10", "ff00::/8", "::1" }
            },
            new
            {
                type = "field",
                outboundTag = "block",
                port = "137,138,1900,5353",
                network = "udp"
            },
            new
            {
                type = "field",
                outboundTag = "direct",
                domain = new[]
                {
                    "detectportal.firefox.com",
                    "www.msftconnecttest.com",
                    "msftconnecttest.com",
                    "ipv6.msftconnecttest.com",
                    "connectivitycheck.gstatic.com",
                    "connectivitycheck.android.com",
                    "captive.apple.com"
                }
            },
            new
            {
                type = "field",
                outboundTag = "block",
                domain = new[] { "geosite:category-ads-all" }
            },
            new
            {
                type = "field",
                outboundTag = "block",
                protocol = new[] { "bittorrent" },
                domain = new[] { "domain:torrent", "domain:tracker", "domain:peerexchange", "keyword:torrent", "keyword:tracker" }
            },
            new
            {
                type = "field",
                outboundTag = "direct",
                ip = new[] { "geoip:private" }
            },
            new
            {
                type = "field",
                outboundTag = "block",
                port = "443",
                network = "udp"
            },
            new
            {
                type = "field",
                outboundTag = "direct",
                domain = new[]
                {
                    "geosite:category-ru",
                    "geosite:category-gov-ru",
                    "geosite:yandex",
                    "geosite:vk",
                    "geosite:mailru",
                    "domain:sberbank.ru",
                    "domain:tbank.ru",
                    "domain:tinkoff.ru",
                    "domain:ozon.ru",
                    "domain:wildberries.ru",
                    "domain:2gis.ru",
                    "domain:avito.ru",
                    "regexp:.*\\.ru$",
                    "regexp:.*\\.su$",
                    "regexp:.*\\.рф$",
                    "regexp:.*\\.xn--p1ai$"
                }
            },
            new
            {
                type = "field",
                outboundTag = "direct",
                ip = new[] { "geoip:ru" }
            }
        };

        var config = new
        {
            log = new
            {
                loglevel = xrayLevel,
                dnsLog = true,
                access = "",
                error = ""
            },
            dns = new
            {
                queryStrategy = "UseIPv4",
                servers = dnsServers
            },
            inbounds = inboundsList,
            outbounds = new object[]
            {
                new
                {
                    tag = "proxy",
                    protocol = proto,
                    settings = new
                    {
                        servers = new object[] { serverItem }
                    }
                },
                new
                {
                    tag = "dns-out",
                    protocol = "dns"
                },
                new
                {
                    tag = "direct",
                    protocol = "freedom"
                },
                new
                {
                    tag = "block",
                    protocol = "blackhole"
                },
                new
                {
                    tag = "blocked",
                    protocol = "blackhole"
                }
            },
            routing = new
            {
                domainStrategy = "IPIfNonMatch",
                rules = routingRules
            }
        };

        return JsonSerializer.Serialize(config, new JsonSerializerOptions { WriteIndented = true });
    }

    private static string? GetPhysicalInterfaceName()
    {
        try
        {
            // 1. First pass: find active physical interface with valid non-TUN IPv4 gateway
            foreach (var card in System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces())
            {
                try
                {
                    if (card.OperationalStatus != System.Net.NetworkInformation.OperationalStatus.Up) continue;
                    if (card.NetworkInterfaceType == System.Net.NetworkInformation.NetworkInterfaceType.Loopback || 
                        card.Description.Contains("Wintun", StringComparison.OrdinalIgnoreCase) ||
                        card.Description.Contains("Virtual", StringComparison.OrdinalIgnoreCase) ||
                        card.Description.Contains("TAP", StringComparison.OrdinalIgnoreCase) ||
                        card.Description.Contains("VMware", StringComparison.OrdinalIgnoreCase) ||
                        card.Description.Contains("Hyper-V", StringComparison.OrdinalIgnoreCase) ||
                        card.Name.Contains("sentinel", StringComparison.OrdinalIgnoreCase) ||
                        card.Name.Contains("tun", StringComparison.OrdinalIgnoreCase)) continue;

                    var props = card.GetIPProperties();
                    foreach (var gw in props.GatewayAddresses)
                    {
                        if (gw.Address != null && 
                            gw.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork && 
                            !gw.Address.Equals(System.Net.IPAddress.Any) &&
                            !gw.Address.ToString().StartsWith("0.0.0.0") &&
                            !gw.Address.ToString().StartsWith("172.19."))
                        {
                            return card.Name;
                        }
                    }
                }
                catch { }
            }

            // 2. Second pass: fallback to any active physical adapter with non-TUN private IPv4
            foreach (var card in System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces())
            {
                try
                {
                    if (card.OperationalStatus != System.Net.NetworkInformation.OperationalStatus.Up) continue;
                    if (card.NetworkInterfaceType == System.Net.NetworkInformation.NetworkInterfaceType.Loopback || 
                        card.Description.Contains("Wintun", StringComparison.OrdinalIgnoreCase) ||
                        card.Description.Contains("Virtual", StringComparison.OrdinalIgnoreCase) ||
                        card.Description.Contains("TAP", StringComparison.OrdinalIgnoreCase) ||
                        card.Description.Contains("VMware", StringComparison.OrdinalIgnoreCase) ||
                        card.Description.Contains("Hyper-V", StringComparison.OrdinalIgnoreCase) ||
                        card.Name.Contains("sentinel", StringComparison.OrdinalIgnoreCase) ||
                        card.Name.Contains("tun", StringComparison.OrdinalIgnoreCase)) continue;

                    var ipProps = card.GetIPProperties();
                    var hasIpv4 = ipProps.UnicastAddresses.Any(u => 
                        u.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork && 
                        !System.Net.IPAddress.IsLoopback(u.Address) &&
                        !u.Address.ToString().StartsWith("169.254") &&
                        !u.Address.ToString().StartsWith("172.19."));

                    if (hasIpv4)
                    {
                        return card.Name;
                    }
                }
                catch { }
            }
        }
        catch { }
        return null;
    }
}
