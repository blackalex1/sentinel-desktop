using System;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using System.Threading.Tasks;

namespace SentinelDesktop.Services;

public static class DesktopTunRoutingService
{
    private static string? _lastServerAddress;
    private static string? _lastOriginalGateway;

    public static async Task SetupTunRoutesAsync(string interfaceName, string serverAddress, System.Collections.Generic.List<string>? dnsServers = null)
    {
        if (!OperatingSystem.IsWindows()) return;

        try
        {
            _lastServerAddress = serverAddress;
            _lastOriginalGateway = GetDefaultGateway();

            LoggingService.Instance.LogApp($"[TUN-Route] Ожидание инициализации адаптера '{interfaceName}'...");

            // Wait up to 5 seconds for Wintun adapter to appear
            bool found = false;
            for (int i = 0; i < 25; i++)
            {
                if (NetworkInterface.GetAllNetworkInterfaces().Any(n => n.Name.Equals(interfaceName, StringComparison.OrdinalIgnoreCase)))
                {
                    found = true;
                    break;
                }
                await Task.Delay(200);
            }

            if (!found)
            {
                LoggingService.Instance.LogApp($"[TUN-Route] Внимание: адаптер '{interfaceName}' не обнаружен в системе за отведенное время", "WARN");
                return;
            }

            await Task.Delay(300); // Give Wintun driver a brief moment to settle

            LoggingService.Instance.LogApp($"[TUN-Route] Конфигурация IP, DNS и маршрутов для адаптера '{interfaceName}'...");

            // 1. Set static IP and default gateway
            RunProcess("netsh", $"interface ip set address name=\"{interfaceName}\" source=static addr=172.19.0.1 mask=255.255.255.252 gateway=172.19.0.2 gwmetric=1");

            // 2. Set DNS servers
            var primaryDns = dnsServers?.FirstOrDefault(s => !s.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) ?? "8.8.8.8";
            var secondaryDns = dnsServers?.Where(s => !s.StartsWith("https://", StringComparison.OrdinalIgnoreCase)).Skip(1).FirstOrDefault() ?? "1.1.1.1";

            RunProcess("netsh", $"interface ip set dns name=\"{interfaceName}\" source=static addr={primaryDns} validate=no");
            RunProcess("netsh", $"interface ip add dns name=\"{interfaceName}\" addr={secondaryDns} index=2 validate=no");

            // 3. Add static route to proxy server via original physical gateway to avoid routing loops
            if (!string.IsNullOrWhiteSpace(serverAddress))
            {
                IPAddress? srvIp = null;
                if (!IPAddress.TryParse(serverAddress, out srvIp))
                {
                    try
                    {
                        var ips = await Dns.GetHostAddressesAsync(serverAddress);
                        srvIp = ips.FirstOrDefault(ip => ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork);
                    }
                    catch { }
                }

                if (srvIp != null)
                {
                    var targetIpStr = srvIp.ToString();
                    _lastServerAddress = targetIpStr;

                    var (routeLocalIp, routeIfIndex, routeIfName) = GetRouteForDestination(targetIpStr);

                    if (!IsPrivateIp(srvIp) && !string.IsNullOrEmpty(_lastOriginalGateway))
                    {
                        RunProcess("route", $"add {targetIpStr} mask 255.255.255.255 {_lastOriginalGateway} metric 1");
                        LoggingService.Instance.LogApp($"[TUN-Route] Статический маршрут к узлу {serverAddress} ({targetIpStr}) через шлюз {_lastOriginalGateway} добавлен");
                    }
                    else if (!string.IsNullOrEmpty(routeLocalIp) && routeIfIndex > 0)
                    {
                        RunProcess("route", $"add {targetIpStr} mask 255.255.255.255 {routeLocalIp} metric 1 if {routeIfIndex}");
                        LoggingService.Instance.LogApp($"[TUN-Route] Прямой маршрут к локальному узлу {serverAddress} ({targetIpStr}) на интерфейсе {routeIfName ?? "auto"} (IP: {routeLocalIp}, IF {routeIfIndex}) добавлен");
                    }
                    else
                    {
                        var (physicalIp, ifIndex) = GetPhysicalInterfaceInfo();
                        if (!string.IsNullOrEmpty(physicalIp) && ifIndex > 0)
                        {
                            RunProcess("route", $"add {targetIpStr} mask 255.255.255.255 {physicalIp} metric 1 if {ifIndex}");
                            LoggingService.Instance.LogApp($"[TUN-Route] Прямой маршрут к локальному узлу {serverAddress} ({targetIpStr}) на интерфейсе {physicalIp} (IF {ifIndex}) добавлен");
                        }
                    }
                }
            }

            LoggingService.Instance.LogApp($"[TUN-Route] Адаптер '{interfaceName}' успешно сконфигурирован (IP: 172.19.0.1, GW: 172.19.0.2, DNS: {primaryDns})");
        }
        catch (Exception ex)
        {
            LoggingService.Instance.LogApp($"[TUN-Route] Ошибка настройки маршрутов TUN: {ex.Message}", "WARN");
        }
    }

    public static void TeardownTunRoutes()
    {
        if (!OperatingSystem.IsWindows()) return;

        try
        {
            if (!string.IsNullOrEmpty(_lastServerAddress) && IPAddress.TryParse(_lastServerAddress, out _))
            {
                RunProcess("route", $"delete {_lastServerAddress}");
                LoggingService.Instance.LogApp($"[TUN-Route] Статический маршрут к узлу {_lastServerAddress} удален");
            }
        }
        catch { }
        finally
        {
            _lastServerAddress = null;
            _lastOriginalGateway = null;
        }
    }

    public static (string? localIp, int ifIndex, string? interfaceName) GetRouteForDestination(string? destIpOrHost)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(destIpOrHost)) return (null, 0, null);

            IPAddress? targetIp = null;
            if (!IPAddress.TryParse(destIpOrHost, out targetIp))
            {
                try
                {
                    var ips = Dns.GetHostAddresses(destIpOrHost);
                    targetIp = ips.FirstOrDefault(i => i.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork);
                }
                catch { }
            }

            if (targetIp == null) return (null, 0, null);

            using var socket = new System.Net.Sockets.Socket(System.Net.Sockets.AddressFamily.InterNetwork, System.Net.Sockets.SocketType.Dgram, 0);
            socket.Connect(targetIp, 65530);
            if (socket.LocalEndPoint is IPEndPoint localEp)
            {
                var localIp = localEp.Address.ToString();
                if (localIp.StartsWith("172.19.") || localIp.StartsWith("127."))
                {
                    return (null, 0, null);
                }

                foreach (var card in NetworkInterface.GetAllNetworkInterfaces())
                {
                    try
                    {
                        if (card.OperationalStatus != OperationalStatus.Up) continue;
                        var ipProps = card.GetIPProperties();
                        if (ipProps.UnicastAddresses.Any(u => u.Address.ToString() == localIp))
                        {
                            var ifIndex = ipProps.GetIPv4Properties()?.Index ?? 0;
                            return (localIp, ifIndex, card.Name);
                        }
                    }
                    catch { }
                }
            }
        }
        catch { }

        return (null, 0, null);
    }

    private static string? GetDefaultGateway()
    {
        try
        {
            foreach (var card in NetworkInterface.GetAllNetworkInterfaces())
            {
                try
                {
                    if (card.OperationalStatus != OperationalStatus.Up) continue;
                    if (card.NetworkInterfaceType == NetworkInterfaceType.Loopback || 
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
                            !gw.Address.Equals(IPAddress.Any) &&
                            !gw.Address.ToString().StartsWith("0.0.0.0") &&
                            !gw.Address.ToString().StartsWith("172.19."))
                        {
                            return gw.Address.ToString();
                        }
                    }
                }
                catch { }
            }
        }
        catch { }
        return null;
    }

    private static bool IsPrivateIp(IPAddress ip)
    {
        var bytes = ip.GetAddressBytes();
        if (bytes.Length != 4) return false;
        return bytes[0] == 10 ||
               (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) ||
               (bytes[0] == 192 && bytes[1] == 168);
    }

    public static (string? ip, int ifIndex) GetPhysicalInterfaceInfo()
    {
        try
        {
            // 1. First pass: find physical adapter with valid non-TUN gateway
            foreach (var card in NetworkInterface.GetAllNetworkInterfaces())
            {
                try
                {
                    if (card.OperationalStatus != OperationalStatus.Up) continue;
                    if (card.NetworkInterfaceType == NetworkInterfaceType.Loopback || 
                        card.Description.Contains("Wintun", StringComparison.OrdinalIgnoreCase) ||
                        card.Description.Contains("Virtual", StringComparison.OrdinalIgnoreCase) ||
                        card.Description.Contains("TAP", StringComparison.OrdinalIgnoreCase) ||
                        card.Description.Contains("VMware", StringComparison.OrdinalIgnoreCase) ||
                        card.Description.Contains("Hyper-V", StringComparison.OrdinalIgnoreCase) ||
                        card.Name.Contains("sentinel", StringComparison.OrdinalIgnoreCase) ||
                        card.Name.Contains("tun", StringComparison.OrdinalIgnoreCase)) continue;

                    var ipProps = card.GetIPProperties();
                    var hasValidGateway = ipProps.GatewayAddresses.Any(gw => 
                        gw.Address != null && 
                        gw.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork && 
                        !gw.Address.Equals(IPAddress.Any) && 
                        !gw.Address.ToString().StartsWith("0.0.0.0") &&
                        !gw.Address.ToString().StartsWith("172.19."));

                    if (hasValidGateway)
                    {
                        int ifIndex = 0;
                        try { ifIndex = ipProps.GetIPv4Properties()?.Index ?? 0; } catch { }

                        foreach (var unicast in ipProps.UnicastAddresses)
                        {
                            if (unicast.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork && 
                                !unicast.Address.Equals(IPAddress.Any) && 
                                !unicast.Address.ToString().StartsWith("169.254") &&
                                !unicast.Address.ToString().StartsWith("172.19."))
                            {
                                return (unicast.Address.ToString(), ifIndex);
                            }
                        }
                    }
                }
                catch { }
            }

            // 2. Second pass: fallback to any active physical adapter with non-TUN IPv4
            foreach (var card in NetworkInterface.GetAllNetworkInterfaces())
            {
                try
                {
                    if (card.OperationalStatus != OperationalStatus.Up) continue;
                    if (card.NetworkInterfaceType == NetworkInterfaceType.Loopback || 
                        card.Description.Contains("Wintun", StringComparison.OrdinalIgnoreCase) ||
                        card.Description.Contains("Virtual", StringComparison.OrdinalIgnoreCase) ||
                        card.Description.Contains("TAP", StringComparison.OrdinalIgnoreCase) ||
                        card.Description.Contains("VMware", StringComparison.OrdinalIgnoreCase) ||
                        card.Description.Contains("Hyper-V", StringComparison.OrdinalIgnoreCase) ||
                        card.Name.Contains("sentinel", StringComparison.OrdinalIgnoreCase) ||
                        card.Name.Contains("tun", StringComparison.OrdinalIgnoreCase)) continue;

                    var ipProps = card.GetIPProperties();
                    int ifIndex = 0;
                    try { ifIndex = ipProps.GetIPv4Properties()?.Index ?? 0; } catch { }

                    foreach (var unicast in ipProps.UnicastAddresses)
                    {
                        if (unicast.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork && 
                            !unicast.Address.Equals(IPAddress.Any) && 
                            !unicast.Address.ToString().StartsWith("169.254") &&
                            !unicast.Address.ToString().StartsWith("172.19."))
                        {
                            return (unicast.Address.ToString(), ifIndex);
                        }
                    }
                }
                catch { }
            }
        }
        catch { }
        return (null, 0);
    }

    private static void RunProcess(string fileName, string arguments)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = arguments,
                CreateNoWindow = true,
                UseShellExecute = false,
                WindowStyle = ProcessWindowStyle.Hidden
            };
            using var proc = Process.Start(psi);
            proc?.WaitForExit(3000);
        }
        catch { }
    }
}
