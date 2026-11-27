using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Threading;
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
        var handler = new SocketsHttpHandler
        {
            UseProxy = false,
            PooledConnectionLifetime = TimeSpan.Zero,
            ConnectTimeout = TimeSpan.FromSeconds(3)
        };
        _httpClient = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(60) };
    }

    public async Task<List<string>> GetCandidateGatewaysAsync()
    {
        return await Task.Run(() =>
        {
            var wifiGateways = new List<string>();
            var wifiDhcpServers = new List<string>();
            var otherGateways = new List<string>();
            var otherDhcpServers = new List<string>();

            static bool IsUsableIpv4(IPAddress? ipAddress, out string addr)
            {
                addr = string.Empty;
                if (ipAddress == null || ipAddress.AddressFamily != AddressFamily.InterNetwork)
                    return false;

                addr = ipAddress.ToString();
                return !string.IsNullOrEmpty(addr) &&
                       !addr.StartsWith("0.0.0.0", StringComparison.Ordinal) &&
                       !addr.StartsWith("127.", StringComparison.Ordinal) &&
                       !addr.StartsWith("169.254.", StringComparison.Ordinal) &&
                       !addr.StartsWith("172.19.", StringComparison.Ordinal);
            }

            static void AddUnique(List<string> list, string addr)
            {
                if (!list.Contains(addr)) list.Add(addr);
            }

            try
            {
                var interfaces = NetworkInterface.GetAllNetworkInterfaces();
                foreach (var iface in interfaces)
                {
                    try
                    {
                        if (iface.OperationalStatus != OperationalStatus.Up) continue;
                        if (iface.NetworkInterfaceType == NetworkInterfaceType.Loopback ||
                            iface.NetworkInterfaceType == NetworkInterfaceType.Tunnel) continue;

                        var name = iface.Name.ToLowerInvariant();
                        var desc = iface.Description.ToLowerInvariant();

                        bool isHypervisorOrVpn =
                            name.Contains("vmware") || desc.Contains("vmware") ||
                            name.Contains("virtualbox") || desc.Contains("virtualbox") ||
                            name.Contains("hyper-v") || desc.Contains("hyper-v") ||
                            name.Contains("vethernet") || desc.Contains("vethernet") ||
                            name.Contains("wsl") || desc.Contains("wsl") ||
                            name.Contains("wintun") || desc.Contains("wintun") ||
                            name.Contains("wireguard") || desc.Contains("wireguard") ||
                            name.Contains("openvpn") || desc.Contains("openvpn") ||
                            name.Contains("tailscale") || desc.Contains("tailscale") ||
                            name.Contains("zerotier") || desc.Contains("zerotier") ||
                            name.Contains("sentinel") || desc.Contains("sentinel") ||
                            name.Contains("singbox") || desc.Contains("singbox") ||
                            name.Contains("sing-box") || desc.Contains("sing-box") ||
                            name.Contains("xray") || desc.Contains("xray") ||
                            name.Contains("radmin") || desc.Contains("radmin") ||
                            name.Contains("hamachi") || desc.Contains("hamachi");

                        if (isHypervisorOrVpn) continue;

                        bool isTapOrTun =
                            name.Contains("tun") || desc.Contains("tun") ||
                            name.Contains("tap") || desc.Contains("tap");

                        // Skip generic TUN/TAP adapters unless the OS classifies the NIC as hardware 802.11 Wi-Fi
                        if (isTapOrTun && iface.NetworkInterfaceType != NetworkInterfaceType.Wireless80211)
                            continue;

                        bool isWifi = iface.NetworkInterfaceType == NetworkInterfaceType.Wireless80211 ||
                                      name.Contains("wi-fi") || name.Contains("wifi") ||
                                      name.Contains("беспроводн") || desc.Contains("wireless") || desc.Contains("wi-fi");

                        var ipProps = iface.GetIPProperties();
                        foreach (var gw in ipProps.GatewayAddresses)
                        {
                            if (IsUsableIpv4(gw.Address, out var addr))
                            {
                                AddUnique(isWifi ? wifiGateways : otherGateways, addr);
                            }
                        }

                        if (OperatingSystem.IsWindows())
                        {
                            foreach (var dhcp in ipProps.DhcpServerAddresses)
                            {
                                if (IsUsableIpv4(dhcp, out var addr))
                                {
                                    AddUnique(isWifi ? wifiDhcpServers : otherDhcpServers, addr);
                                }
                            }
                        }
                    }
                    catch { }
                }
            }
            catch { }

            var result = new List<string>();
            foreach (var ip in wifiGateways) AddUnique(result, ip);
            foreach (var ip in wifiDhcpServers) AddUnique(result, ip);
            foreach (var ip in otherGateways) AddUnique(result, ip);
            foreach (var ip in otherDhcpServers) AddUnique(result, ip);

            if (result.Count == 0)
            {
                result.Add("192.168.43.1");
            }

            return result;
        });
    }

    public async Task<HotspotDiscoveryResult> ScanAllGatewaysAsync(List<string>? candidateGateways, CancellationToken cancellationToken = default)
    {
        if (candidateGateways == null || candidateGateways.Count == 0)
        {
            candidateGateways = await GetCandidateGatewaysAsync();
        }

        var uniqueIps = candidateGateways
            .Select(ip => ip?.Trim() ?? string.Empty)
            .Where(ip => !string.IsNullOrWhiteSpace(ip) &&
                         IPAddress.TryParse(ip, out var parsed) &&
                         parsed.AddressFamily == AddressFamily.InterNetwork)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (uniqueIps.Count == 0)
        {
            return new HotspotDiscoveryResult
            {
                Found = false,
                ErrorMessage = "Устройства с активной раздачей Sentinel не обнаружены в сети"
            };
        }

        var (found, firstFailure) = await RunUntilFirstMatchAsync(
            uniqueIps.Select<string, Func<CancellationToken, Task<HotspotDiscoveryResult>>>(
                ip => ct => ProbePairingServerAsync(ip, ct)),
            res => res.Found,
            cancellationToken).ConfigureAwait(false);

        if (found != null)
        {
            return found;
        }

        if (uniqueIps.Count == 1 && firstFailure != null)
        {
            return firstFailure;
        }

        return new HotspotDiscoveryResult
        {
            Found = false,
            GatewayIP = uniqueIps[0],
            ErrorMessage = $"Телефон не обнаружен (проверены: {string.Join(", ", uniqueIps)})"
        };
    }

    public async Task<HotspotDiscoveryResult> ProbePairingServerAsync(string targetIP, CancellationToken cancellationToken = default)
    {
        var ip = targetIP?.Trim() ?? string.Empty;
        if (!IPAddress.TryParse(ip, out var parsedIp) || parsedIp.AddressFamily != AddressFamily.InterNetwork)
        {
            return new HotspotDiscoveryResult
            {
                Found = false,
                ErrorMessage = "Укажите корректный IPv4-адрес шлюза или телефона"
            };
        }

        if (cancellationToken.IsCancellationRequested)
        {
            return new HotspotDiscoveryResult
            {
                Found = false,
                GatewayIP = ip,
                ErrorMessage = $"Поиск на {ip} отменен"
            };
        }

        // 1. Probe all HTTP pairing ports concurrently (canceling siblings on first hit)
        var (httpHit, _) = await RunUntilFirstMatchAsync(
            CandidatePorts.Select<int, Func<CancellationToken, Task<HotspotDiscoveryResult?>>>(
                port => ct => ProbeHttpPairingPortAsync(ip, port, ct)),
            res => res != null && res.Found,
            cancellationToken).ConfigureAwait(false);

        if (httpHit != null)
        {
            return httpHit;
        }

        if (cancellationToken.IsCancellationRequested)
        {
            return new HotspotDiscoveryResult
            {
                Found = false,
                GatewayIP = ip,
                ErrorMessage = $"Поиск на {ip} отменен"
            };
        }

        // 2. Direct TCP Fallback: Check concurrently if SOCKS5 or HTTP proxy is open on target IP
        var (tcpHit, _) = await RunUntilFirstMatchAsync(
            ProxyFallbackPorts.Select<int, Func<CancellationToken, Task<HotspotDiscoveryResult?>>>(
                pPort => ct => ProbeTcpFallbackPortAsync(ip, pPort, ct)),
            res => res != null && res.Found,
            cancellationToken).ConfigureAwait(false);

        if (tcpHit != null)
        {
            return tcpHit;
        }

        return new HotspotDiscoveryResult
        {
            Found = false,
            GatewayIP = ip,
            ErrorMessage = $"Телефон ({ip}) не отвечает на портах сопряжения и прокси"
        };
    }

    private static async Task<(T? match, T? firstResult)> RunUntilFirstMatchAsync<T>(
        IEnumerable<Func<CancellationToken, Task<T>>> taskFactories,
        Func<T, bool> isMatch,
        CancellationToken cancellationToken) where T : class?
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        var pending = taskFactories.Select(factory => factory(cts.Token)).ToList();

        T? firstResult = default;
        while (pending.Count > 0)
        {
            var completed = await Task.WhenAny(pending).ConfigureAwait(false);
            pending.Remove(completed);

            var result = await completed.ConfigureAwait(false);
            if (result != null)
            {
                firstResult ??= result;
                if (isMatch(result))
                {
                    cts.Cancel();
                    try { await Task.WhenAll(pending).ConfigureAwait(false); } catch { }
                    return (result, firstResult);
                }
            }
        }

        return (default, firstResult);
    }

    private async Task<HotspotDiscoveryResult?> ProbeHttpPairingPortAsync(string ip, int port, CancellationToken cancellationToken)
    {
        try
        {
            var pingUri = $"http://{ip}:{port}/pair/ping";
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromMilliseconds(1500));
            using var response = await _httpClient.GetAsync(pingUri, cts.Token).ConfigureAwait(false);

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

        return null;
    }

    private static async Task<HotspotDiscoveryResult?> ProbeTcpFallbackPortAsync(string ip, int pPort, CancellationToken cancellationToken)
    {
        if (await TestTcpPortAsync(ip, pPort, 800, cancellationToken).ConfigureAwait(false))
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

        return null;
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

    private static async Task<bool> TestTcpPortAsync(string ip, int port, int timeoutMs = 800, CancellationToken cancellationToken = default)
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(timeoutMs);
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
