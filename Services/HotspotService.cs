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
    private readonly HttpClient _httpClient;

    private HotspotService()
    {
        _httpClient = new HttpClient { Timeout = TimeSpan.FromMilliseconds(1800) };
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
                        if (!string.IsNullOrEmpty(addr) && !addr.StartsWith("0.0.0.0") && !addr.StartsWith("127."))
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
                                    gateways.Add($"{ipStr.Substring(0, lastDot)}.1");
                                }
                            }
                        }
                    }
                }
            }
            catch { }

            if (gateways.Count == 0)
            {
                gateways.Add("192.168.43.1");
                gateways.Add("192.168.1.1");
                gateways.Add("10.60.133.124");
            }

            return gateways.ToList();
        });
    }

    public async Task<HotspotDiscoveryResult> ProbePairingServerAsync(string targetIP)
    {
        var ip = targetIP.Trim();
        if (string.IsNullOrWhiteSpace(ip))
        {
            return new HotspotDiscoveryResult
            {
                Found = false,
                ErrorMessage = "Укажите корректный IP-адрес шлюза или телефона"
            };
        }

        foreach (var port in CandidatePorts)
        {
            try
            {
                var pingUri = $"http://{ip}:{port}/pair/ping";
                using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromMilliseconds(1500));
                var response = await _httpClient.GetAsync(pingUri, cts.Token);

                if (response.IsSuccessStatusCode)
                {
                    var body = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(body);
                    var root = doc.RootElement;

                    var pType = root.TryGetProperty("proxyType", out var pt) ? pt.GetString() ?? "SOCKS5" : "SOCKS5";
                    var sPort = root.TryGetProperty("socksPort", out var sp) ? sp.GetInt32() : (root.TryGetProperty("port", out var p) ? p.GetInt32() : 10808);
                    var hPort = root.TryGetProperty("httpPort", out var hp) ? hp.GetInt32() : 10809;
                    var auth = root.TryGetProperty("authRequired", out var ar) && ar.GetBoolean();

                    return new HotspotDiscoveryResult
                    {
                        Found = true,
                        GatewayIP = ip,
                        PairingPort = port,
                        ProxyType = pType,
                        SocksPort = sPort,
                        HttpPort = hPort,
                        AuthRequired = auth
                    };
                }
            }
            catch { }
        }

        return new HotspotDiscoveryResult
        {
            Found = false,
            GatewayIP = ip,
            ErrorMessage = $"Телефон не отвечает на портах {string.Join(", ", CandidatePorts)}"
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
                clientName = "Sentinel Desktop Windows",
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(8));
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

            return (false, null, "Ошибка ответа сервера сопряжения на телефоне");
        }
        catch (Exception ex)
        {
            return (false, null, $"Сбой подключения: {ex.Message}");
        }
    }
}
