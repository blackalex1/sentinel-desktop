using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using SentinelDesktop.Models;

namespace SentinelDesktop.Services;

public class HotspotDiscoveryResult
{
    public bool Found { get; set; }
    public string GatewayIP { get; set; } = string.Empty;
    public int PairingPort { get; set; } = 18080;
    public string ProxyType { get; set; } = "SOCKS5";
    public int SocksPort { get; set; } = 10808;
    public int HttpPort { get; set; } = 10809;
    public bool AuthRequired { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string? ErrorMessage { get; set; }
}

public class HotspotService
{
    private static readonly Lazy<HotspotService> _lazy = new(() => new HotspotService());
    public static HotspotService Instance => _lazy.Value;

    private static readonly int[] CandidatePorts = { 18080, 18081, 18082, 19080, 19081 };
    private static readonly int[] ProxyFallbackPorts = { 10808, 10809, 20808, 20809 };
    private readonly HttpClient _httpClient;

    private HotspotService()
    {
        _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
    }

    public async Task<List<string>> GetCandidateGatewaysAsync()
    {
        return await Task.Run(() =>
        {
            var gateways = new HashSet<string>();

            try
            {
                var interfaces = NetworkInterface.GetAllNetworkInterfaces();
                foreach (var iface in interfaces)
                {
                    if (iface.OperationalStatus != OperationalStatus.Up) continue;
                    if (iface.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;

                    var ipProps = iface.GetIPProperties();
                    foreach (var gw in ipProps.GatewayAddresses)
                    {
                        var addr = gw.Address.ToString();
                        // Keep only valid IPv4 non-loopback addresses
                        if (!string.IsNullOrEmpty(addr) &&
                            !addr.Contains(':') &&
                            !addr.StartsWith("0.0.0.0") &&
                            !addr.StartsWith("127."))
                        {
                            gateways.Add(addr);
                        }
                    }

                    foreach (var u in ipProps.UnicastAddresses)
                    {
                        if (u.Address.AddressFamily == AddressFamily.InterNetwork)
                        {
                            var ipStr = u.Address.ToString();
                            if (ipStr.StartsWith("192.168.") || ipStr.StartsWith("10.") || ipStr.StartsWith("172."))
                            {
                                var lastDot = ipStr.LastIndexOf('.');
                                if (lastDot != -1)
                                {
                                    var prefix = ipStr.Substring(0, lastDot);
                                    gateways.Add($"{prefix}.1");
                                }
                            }
                        }
                    }
                }
            }
            catch { }

            // Common default mobile hotspot gateways
            var defaults = new[] { "192.168.43.1", "172.20.10.1", "192.168.137.1", "192.168.80.1", "192.168.1.1" };
            foreach (var d in defaults)
            {
                gateways.Add(d);
            }

            return gateways.Where(g => !g.Contains(':')).ToList();
        });
    }

    public async Task<HotspotDiscoveryResult> ScanAllGatewaysAsync(List<string> candidateGateways)
    {
        if (candidateGateways == null || candidateGateways.Count == 0)
        {
            candidateGateways = await GetCandidateGatewaysAsync();
        }

        var tasks = candidateGateways
            .Where(ip => !string.IsNullOrWhiteSpace(ip) && !ip.Contains(':'))
            .Select(ip => ProbePairingServerAsync(ip))
            .ToList();

        var results = await Task.WhenAll(tasks);
        var found = results.FirstOrDefault(r => r.Found);
        if (found != null)
        {
            return found;
        }

        return results.FirstOrDefault() ?? new HotspotDiscoveryResult
        {
            Found = false,
            ErrorMessage = "Устройства с активной раздачей Sentinel не обнаружены в сети"
        };
    }

    public async Task<HotspotDiscoveryResult> ProbePairingServerAsync(string targetIP)
    {
        var ip = targetIP.Trim();
        if (string.IsNullOrWhiteSpace(ip) || ip.Contains(':'))
        {
            return new HotspotDiscoveryResult
            {
                Found = false,
                ErrorMessage = "Укажите корректный IPv4-адрес шлюза или телефона"
            };
        }

        // 1. Probe HTTP Pairing Server
        foreach (var port in CandidatePorts)
        {
            try
            {
                var configUri = $"http://{ip}:{port}/pair/config";
                using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromMilliseconds(1200));
                var response = await _httpClient.GetAsync(configUri, cts.Token);

                if (response.IsSuccessStatusCode)
                {
                    var body = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(body);
                    var root = doc.RootElement;

                    var pType = root.TryGetProperty("proxyType", out var pt) ? pt.GetString() ?? "SOCKS5" : "SOCKS5";
                    var sPort = root.TryGetProperty("socksPort", out var sp) ? sp.GetInt32() : (root.TryGetProperty("port", out var p) ? p.GetInt32() : 10808);
                    var hPort = root.TryGetProperty("httpPort", out var hp) ? hp.GetInt32() : 10809;
                    var auth = root.TryGetProperty("authRequired", out var ar) && ar.GetBoolean();
                    var user = root.TryGetProperty("username", out var u) ? u.GetString() : null;
                    var pass = root.TryGetProperty("password", out var pw) ? pw.GetString() : null;

                    return new HotspotDiscoveryResult
                    {
                        Found = true,
                        GatewayIP = ip,
                        PairingPort = port,
                        ProxyType = pType,
                        SocksPort = sPort,
                        HttpPort = hPort,
                        AuthRequired = auth,
                        Username = user,
                        Password = pass
                    };
                }
            }
            catch { }

            try
            {
                var pingUri = $"http://{ip}:{port}/pair/ping";
                using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromMilliseconds(1000));
                var response = await _httpClient.GetAsync(pingUri, cts.Token);

                if (response.IsSuccessStatusCode)
                {
                    return new HotspotDiscoveryResult
                    {
                        Found = true,
                        GatewayIP = ip,
                        PairingPort = port,
                        ProxyType = "SOCKS5",
                        SocksPort = 10808,
                        HttpPort = 10809,
                        AuthRequired = false
                    };
                }
            }
            catch { }
        }

        // 2. Direct TCP Fallback: Check if SOCKS5 or HTTP proxy is open on target IP
        foreach (var pPort in ProxyFallbackPorts)
        {
            if (await TestTcpPortAsync(ip, pPort, 800))
            {
                var isHttp = pPort == 10809 || pPort == 20809;
                return new HotspotDiscoveryResult
                {
                    Found = true,
                    GatewayIP = ip,
                    PairingPort = 18080,
                    ProxyType = isHttp ? "HTTP" : "SOCKS5",
                    SocksPort = pPort,
                    HttpPort = pPort,
                    AuthRequired = false
                };
            }
        }

        return new HotspotDiscoveryResult
        {
            Found = false,
            GatewayIP = ip,
            ErrorMessage = $"Телефон ({ip}) не отвечает на портах сопряжения и прокси"
        };
    }

    public async Task<(bool success, ServerProfile? server, string? error)> RequestPairingAsync(string ip, int port, string pin)
    {
        try
        {
            var reqUri = $"http://{ip}:{port}/pair/request";
            var payload = new
            {
                pin = pin,
                pinCode = pin,
                clientName = "Sentinel Desktop Windows",
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            // Allow up to 35 seconds for the user to confirm pairing on Android screen
            using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(35));
            var response = await _httpClient.PostAsync(reqUri, content, cts.Token);

            if (response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;

                var isApproved = root.TryGetProperty("success", out var s) && s.GetBoolean();
                if (isApproved)
                {
                    var socksPort = root.TryGetProperty("socksPort", out var sp) ? sp.GetInt32() : (root.TryGetProperty("port", out var p) ? p.GetInt32() : 10808);
                    var proto = root.TryGetProperty("proxyType", out var pt) ? pt.GetString()?.ToLowerInvariant() ?? "socks" : "socks";
                    var user = root.TryGetProperty("username", out var u) ? u.GetString() : null;
                    var pass = root.TryGetProperty("password", out var pw) ? pw.GetString() : null;

                    var server = new ServerProfile
                    {
                        Id = $"hotspot-{DateTime.Now.Ticks}",
                        Name = $"Раздача с телефона ({ip})",
                        Address = ip,
                        Port = socksPort,
                        Protocol = proto == "http" ? "http" : "socks",
                        Username = user,
                        Password = pass,
                        Country = "LAN",
                        IsSelected = true
                    };

                    return (true, server, null);
                }
                else
                {
                    var err = root.TryGetProperty("error", out var e) ? e.GetString() : "Сопряжение отклонено на телефоне";
                    return (false, null, err);
                }
            }

            // Fallback: If pairing server refused but proxy port is open, connect directly
            if (await TestTcpPortAsync(ip, 10808, 1000))
            {
                var fallbackServer = new ServerProfile
                {
                    Id = $"hotspot-direct-{DateTime.Now.Ticks}",
                    Name = $"Раздача с телефона ({ip})",
                    Address = ip,
                    Port = 10808,
                    Protocol = "socks",
                    Country = "LAN",
                    IsSelected = true
                };
                return (true, fallbackServer, null);
            }

            return (false, null, "Ошибка ответа сервера сопряжения на телефоне");
        }
        catch (OperationCanceledException)
        {
            // If pairing timed out on Android prompt, check if direct SOCKS5 port is active
            if (await TestTcpPortAsync(ip, 10808, 1000))
            {
                var directServer = new ServerProfile
                {
                    Id = $"hotspot-direct-{DateTime.Now.Ticks}",
                    Name = $"Раздача с телефона ({ip})",
                    Address = ip,
                    Port = 10808,
                    Protocol = "socks",
                    Country = "LAN",
                    IsSelected = true
                };
                return (true, directServer, null);
            }

            return (false, null, "Время ожидания подтверждения на телефоне истекло (35 сек)");
        }
        catch (Exception ex)
        {
            return (false, null, $"Сбой подключения: {ex.Message}");
        }
    }

    private static async Task<bool> TestTcpPortAsync(string ip, int port, int timeoutMs = 1000)
    {
        try
        {
            using var tcp = new TcpClient();
            var connectTask = tcp.ConnectAsync(ip, port);
            var delayTask = Task.Delay(timeoutMs);
            if (await Task.WhenAny(connectTask, delayTask) == connectTask && tcp.Connected)
            {
                return true;
            }
        }
        catch { }
        return false;
    }
}
