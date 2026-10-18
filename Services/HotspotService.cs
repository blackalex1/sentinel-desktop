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
            var wifiGateways = new List<string>();
            var otherGateways = new List<string>();

            try
            {
                var interfaces = NetworkInterface.GetAllNetworkInterfaces();
                foreach (var iface in interfaces)
                {
                    if (iface.OperationalStatus != OperationalStatus.Up) continue;
                    if (iface.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;

                    var name = iface.Name.ToLowerInvariant();
                    var desc = iface.Description.ToLowerInvariant();

                    // Filter out known virtual / VM / VPN adapters
                    bool isVirtual = name.Contains("vmware") || desc.Contains("vmware") ||
                                     name.Contains("virtualbox") || desc.Contains("virtualbox") ||
                                     name.Contains("hyper-v") || desc.Contains("hyper-v") ||
                                     name.Contains("vethernet") || desc.Contains("vethernet") ||
                                     name.Contains("wsl") || desc.Contains("wsl") ||
                                     name.Contains("tun") || desc.Contains("tun") ||
                                     name.Contains("tap") || desc.Contains("tap") ||
                                     name.Contains("wintun") || desc.Contains("wintun");

                    bool isWifi = iface.NetworkInterfaceType == NetworkInterfaceType.Wireless80211 ||
                                  name.Contains("wi-fi") || name.Contains("wifi") ||
                                  name.Contains("беспроводн") || desc.Contains("wireless") || desc.Contains("wi-fi");

                    var ipProps = iface.GetIPProperties();
                    foreach (var gw in ipProps.GatewayAddresses)
                    {
                        var addr = gw.Address.ToString();
                        if (!string.IsNullOrEmpty(addr) &&
                            !addr.Contains(':') &&
                            !addr.StartsWith("0.0.0.0") &&
                            !addr.StartsWith("127."))
                        {
                            if (isWifi && !wifiGateways.Contains(addr))
                            {
                                wifiGateways.Add(addr);
                            }
                            else if (!isVirtual && !otherGateways.Contains(addr))
                            {
                                otherGateways.Add(addr);
                            }
                        }
                    }
                }
            }
            catch { }

            var result = new List<string>();
            result.AddRange(wifiGateways);
            foreach (var og in otherGateways)
            {
                if (!result.Contains(og)) result.Add(og);
            }

            if (result.Count == 0)
            {
                result.Add("192.168.43.1");
            }

            return result;
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
            // 0. Fast-path: If device was already paired, sync configs instantly via Bearer token without modal prompt on phone
            var vault = StorageService.Load();
            var existing = vault.Servers.FirstOrDefault(s => s.Address == ip && !string.IsNullOrEmpty(s.HotspotToken) && !string.IsNullOrEmpty(s.HotspotKey));
            if (existing != null)
            {
                var fastResult = await TryFastTokenSyncAsync(ip, port, existing);
                if (fastResult.success && fastResult.server != null)
                {
                    LoggingService.Instance.LogApp($"⚡ Мгновенная синхронизация сопряженного устройства ({ip}) выполнена успешно");
                    return (true, fastResult.server, null);
                }
            }

            var reqUri = $"http://{ip}:{port}/pair/request";
            var payload = new
            {
                pin = pin,
                pinCode = pin,
                kdf = "pbkdf2",
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
                    string? deviceToken = null;
                    string? masterKey = null;
                    int socksPort = 10808;
                    string proto = "socks";
                    string? user = null;
                    string? pass = null;

                    // 1. Try to decrypt confidential payload with PIN key
                    if (root.TryGetProperty("encryptedPayload", out var encProp))
                    {
                        try
                        {
                            var encPayload = encProp.GetString();
                            if (!string.IsNullOrEmpty(encPayload))
                            {
                                string decrypted;
                                try
                                {
                                    var pinKeyPbkdf2 = HotspotCrypto.DeriveKeyFromPinPbkdf2(pin);
                                    decrypted = HotspotCrypto.Decrypt(encPayload, pinKeyPbkdf2);
                                }
                                catch
                                {
                                    var pinKey = HotspotCrypto.DeriveKeyFromPin(pin);
                                    decrypted = HotspotCrypto.Decrypt(encPayload, pinKey);
                                }
                                using var decDoc = JsonDocument.Parse(decrypted);
                                var decRoot = decDoc.RootElement;

                                deviceToken = decRoot.TryGetProperty("token", out var t) ? t.GetString() : null;
                                masterKey = decRoot.TryGetProperty("masterKey", out var mk) ? mk.GetString() : null;
                                socksPort = decRoot.TryGetProperty("socksPort", out var sp) ? sp.GetInt32() : (decRoot.TryGetProperty("port", out var p) ? p.GetInt32() : 10808);
                                proto = decRoot.TryGetProperty("proxyType", out var pt) ? pt.GetString()?.ToLowerInvariant() ?? "socks" : "socks";
                                user = decRoot.TryGetProperty("username", out var u) ? u.GetString() : null;
                                pass = decRoot.TryGetProperty("password", out var pw) ? pw.GetString() : null;
                            }
                        }
                        catch (Exception ex)
                        {
                            LoggingService.Instance.LogApp($"Ошибка расшифровки пакета сопряжения: {ex.Message}", "WARN");
                        }
                    }

                    // Fallback to plain fields if decryption wasn't needed
                    if (string.IsNullOrEmpty(deviceToken) && root.TryGetProperty("token", out var tFallback))
                    {
                        deviceToken = tFallback.GetString();
                    }
                    if (string.IsNullOrEmpty(masterKey) && root.TryGetProperty("masterKey", out var mkFallback))
                    {
                        masterKey = mkFallback.GetString();
                    }
                    if (socksPort == 10808 && root.TryGetProperty("socksPort", out var spFallback))
                    {
                        socksPort = spFallback.GetInt32();
                    }
                    if (user == null && root.TryGetProperty("username", out var uFallback))
                    {
                        user = uFallback.GetString();
                    }
                    if (pass == null && root.TryGetProperty("password", out var pwFallback))
                    {
                        pass = pwFallback.GetString();
                    }

                    var server = new ServerProfile
                    {
                        Id = $"hotspot-{DateTime.Now.Ticks}",
                        Name = $"Sentinel Hotspot ({ip})",
                        Address = ip,
                        Port = socksPort,
                        Protocol = proto == "http" ? "http" : "socks",
                        Username = user,
                        Password = pass,
                        Country = "HOTSPOT",
                        HotspotKey = masterKey,
                        HotspotToken = deviceToken,
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
        catch (OperationCanceledException)
        {
            return (false, null, "Время ожидания подтверждения на телефоне истекло (35 сек)");
        }
        catch (Exception ex)
        {
            return (false, null, $"Сбой подключения: {ex.Message}");
        }
    }

    private async Task<(bool success, ServerProfile? server)> TryFastTokenSyncAsync(string ip, int port, ServerProfile existing)
    {
        try
        {
            var reqUri = $"http://{ip}:{port}/pair/config";
            using var req = new HttpRequestMessage(HttpMethod.Get, reqUri);
            req.Headers.Add("Authorization", $"Bearer {existing.HotspotToken}");

            using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromMilliseconds(1500));
            var resp = await _httpClient.SendAsync(req, cts.Token);

            if (resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(body);
                if (doc.RootElement.TryGetProperty("encryptedPayload", out var encProp))
                {
                    var encPayload = encProp.GetString();
                    if (!string.IsNullOrEmpty(encPayload) && !string.IsNullOrEmpty(existing.HotspotKey))
                    {
                        var keyBytes = Convert.FromBase64String(existing.HotspotKey);
                        var decrypted = HotspotCrypto.Decrypt(encPayload, keyBytes);
                        using var decDoc = JsonDocument.Parse(decrypted);
                        var decRoot = decDoc.RootElement;

                        var socksPort = decRoot.TryGetProperty("socksPort", out var sp) ? sp.GetInt32() : (decRoot.TryGetProperty("port", out var p) ? p.GetInt32() : existing.Port);
                        var proto = decRoot.TryGetProperty("proxyType", out var pt) ? pt.GetString()?.ToLowerInvariant() ?? existing.Protocol : existing.Protocol;
                        var user = decRoot.TryGetProperty("username", out var u) ? u.GetString() : existing.Username;
                        var pass = decRoot.TryGetProperty("password", out var pw) ? pw.GetString() : existing.Password;

                        existing.Port = socksPort;
                        existing.Protocol = proto == "http" ? "http" : "socks";
                        existing.Username = user;
                        existing.Password = pass;

                        return (true, existing);
                    }
                }
            }
        }
        catch { }
        return (false, null);
    }

    /// <summary>
    /// Sends an encrypted session start signal to Sentinel Mobile to dynamically enable hotspot proxying inbounds.
    /// </summary>
    public async Task<bool> NotifySessionStartAsync(ServerProfile server)
    {
        if (server == null || string.IsNullOrWhiteSpace(server.Address)) return false;
        if (string.IsNullOrEmpty(server.HotspotToken) || string.IsNullOrEmpty(server.HotspotKey))
        {
            // Legacy / unencrypted fallback
            return true;
        }

        try
        {
            var candidatePorts = new[] { 18080, 18081, 18082, 19080, 19081 };
            foreach (var port in candidatePorts)
            {
                try
                {
                    var reqUri = $"http://{server.Address}:{port}/hotspot/session/start";
                    var startPayload = new
                    {
                        client = "Sentinel Desktop Windows",
                        timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                        nonce = HotspotCrypto.GenerateNonce()
                    };

                    var plainJson = JsonSerializer.Serialize(startPayload);
                    var keyBytes = Convert.FromBase64String(server.HotspotKey);
                    var encryptedPayload = HotspotCrypto.Encrypt(plainJson, keyBytes);

                    var bodyObj = new
                    {
                        token = server.HotspotToken,
                        encryptedPayload = encryptedPayload
                    };

                    var reqContent = new StringContent(JsonSerializer.Serialize(bodyObj), Encoding.UTF8, "application/json");
                    using var req = new HttpRequestMessage(HttpMethod.Post, reqUri) { Content = reqContent };
                    req.Headers.Add("Authorization", $"Bearer {server.HotspotToken}");

                    using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(3));
                    var resp = await _httpClient.SendAsync(req, cts.Token);

                    if (resp.IsSuccessStatusCode)
                    {
                        var respBody = await resp.Content.ReadAsStringAsync();
                        using var doc = JsonDocument.Parse(respBody);
                        if (doc.RootElement.TryGetProperty("encryptedPayload", out var encProp))
                        {
                            var encStr = encProp.GetString();
                            if (!string.IsNullOrEmpty(encStr))
                            {
                                var decResp = HotspotCrypto.Decrypt(encStr, keyBytes);
                                using var decDoc = JsonDocument.Parse(decResp);
                                if (decDoc.RootElement.TryGetProperty("socksPort", out var spProp))
                                {
                                    server.Port = spProp.GetInt32();
                                }
                            }
                        }
                        LoggingService.Instance.LogApp($"✅ Защищенная сессия Hotspot успешно запущена на телефоне ({server.Address}:{server.Port})");
                        return true;
                    }
                }
                catch { }
            }
        }
        catch (Exception ex)
        {
            LoggingService.Instance.LogApp($"Ошибка отправки сигнала старта сессии: {ex.Message}", "WARN");
        }

        return false;
    }

    /// <summary>
    /// Sends an encrypted session stop signal to Sentinel Mobile to safely deactivate hotspot proxying inbounds.
    /// </summary>
    public async Task NotifySessionStopAsync(ServerProfile? server)
    {
        if (server == null || string.IsNullOrWhiteSpace(server.Address)) return;
        if (string.IsNullOrEmpty(server.HotspotToken) || string.IsNullOrEmpty(server.HotspotKey)) return;

        try
        {
            var candidatePorts = new[] { 18080, 18081, 18082, 19080, 19081 };
            foreach (var port in candidatePorts)
            {
                try
                {
                    var reqUri = $"http://{server.Address}:{port}/hotspot/session/stop";
                    var stopPayload = new
                    {
                        client = "Sentinel Desktop Windows",
                        timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                        nonce = HotspotCrypto.GenerateNonce()
                    };

                    var plainJson = JsonSerializer.Serialize(stopPayload);
                    var keyBytes = Convert.FromBase64String(server.HotspotKey);
                    var encryptedPayload = HotspotCrypto.Encrypt(plainJson, keyBytes);

                    var bodyObj = new
                    {
                        token = server.HotspotToken,
                        encryptedPayload = encryptedPayload
                    };

                    var reqContent = new StringContent(JsonSerializer.Serialize(bodyObj), Encoding.UTF8, "application/json");
                    using var req = new HttpRequestMessage(HttpMethod.Post, reqUri) { Content = reqContent };
                    req.Headers.Add("Authorization", $"Bearer {server.HotspotToken}");

                    using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(2));
                    var resp = await _httpClient.SendAsync(req, cts.Token);
                    if (resp.IsSuccessStatusCode)
                    {
                        LoggingService.Instance.LogApp($"Защищенная сессия Hotspot остановлена на телефоне ({server.Address})");
                        break;
                    }
                }
                catch { }
            }
        }
        catch { }
    }

    private static async Task<bool> TestTcpPortAsync(string ip, int port, int timeoutMs = 800)
    {
        try
        {
            using var cts = new System.Threading.CancellationTokenSource(timeoutMs);
            using var socket = new Socket(SocketType.Stream, ProtocolType.Tcp);
            socket.NoDelay = true;
            await socket.ConnectAsync(ip, port, cts.Token).ConfigureAwait(false);
            return socket.Connected;
        }
        catch
        {
            return false;
        }
    }
}
