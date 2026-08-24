using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Security.Principal;
using SentinelDesktop.Models;

namespace SentinelDesktop.Services;

public static class CoreEnvironmentService
{
    public static bool IsElevatingHandoff { get; set; } = false;

    public static bool IsAdministrator()
    {
        try
        {
            if (OperatingSystem.IsWindows())
            {
                using var identity = WindowsIdentity.GetCurrent();
                var principal = new WindowsPrincipal(identity);
                return principal.IsInRole(WindowsBuiltInRole.Administrator);
            }
        }
        catch { }
        return false;
    }

    public static void EnsureWintunDriver()
    {
        try
        {
            var exeDir = AppDomain.CurrentDomain.BaseDirectory;
            var binDir = Path.Combine(exeDir, "binaries");
            Directory.CreateDirectory(binDir);

            var targetInBin = Path.Combine(binDir, "wintun.dll");

            if (!File.Exists(targetInBin))
            {
                var assembly = typeof(CoreEnvironmentService).Assembly;
                using var stream = assembly.GetManifestResourceStream("wintun.dll");
                if (stream != null)
                {
                    using var ms = new MemoryStream();
                    stream.CopyTo(ms);
                    var bytes = ms.ToArray();
                    File.WriteAllBytes(targetInBin, bytes);
                    LoggingService.Instance.LogApp("Драйвер Wintun успешно извлечен в binaries/wintun.dll.");
                }
            }
        }
        catch (Exception ex)
        {
            LoggingService.Instance.LogApp($"Не удалось извлечь wintun.dll: {ex.Message}", "WARN");
        }
    }

    public static bool AreGeoDataFilesInstalled()
    {
        var exeDir = AppDomain.CurrentDomain.BaseDirectory;
        var binDir = Path.Combine(exeDir, "binaries");
        var currDir = Directory.GetCurrentDirectory();

        bool hasGeoip = File.Exists(Path.Combine(binDir, "geoip.dat")) || 
                        File.Exists(Path.Combine(exeDir, "geoip.dat")) ||
                        File.Exists(Path.Combine(currDir, "binaries", "geoip.dat")) ||
                        File.Exists(Path.Combine(currDir, "geoip.dat"));

        bool hasGeosite = File.Exists(Path.Combine(binDir, "geosite.dat")) || 
                          File.Exists(Path.Combine(exeDir, "geosite.dat")) ||
                          File.Exists(Path.Combine(currDir, "binaries", "geosite.dat")) ||
                          File.Exists(Path.Combine(currDir, "geosite.dat"));

        return hasGeoip && hasGeosite;
    }

    public static bool IsCoreBinaryInstalled(string coreType = "sing-box")
    {
        EnsureWintunDriver();
        var resolvedCore = CoreEnginesCatalog.GetEngine(coreType);
        var exeDir = AppDomain.CurrentDomain.BaseDirectory;
        var coreExe = Path.Combine(exeDir, "binaries", resolvedCore.ExeName);
        if (File.Exists(coreExe)) return true;
        if (File.Exists(Path.Combine(exeDir, resolvedCore.ExeName))) return true;

        if (resolvedCore.Id == "xray")
        {
            if (File.Exists(Path.Combine(exeDir, "binaries", "wxray.exe"))) return true;
            if (File.Exists(Path.Combine(exeDir, "wxray.exe"))) return true;
            return false;
        }

        if (File.Exists(Path.Combine(exeDir, "binaries", "sing-box.exe"))) return true;
        if (File.Exists(Path.Combine(exeDir, "sing-box.exe"))) return true;
        return false;
    }

    public static string? ResolveCoreExecutable(CoreEngineOption resolvedCore, bool isXray)
    {
        var exeDir = AppDomain.CurrentDomain.BaseDirectory;
        var binDir = Path.Combine(exeDir, "binaries");
        var coreExe = Path.Combine(binDir, resolvedCore.ExeName);
        if (File.Exists(coreExe)) return coreExe;

        coreExe = Path.Combine(exeDir, resolvedCore.ExeName);
        if (File.Exists(coreExe)) return coreExe;

        if (isXray)
        {
            var wxray = Path.Combine(binDir, "wxray.exe");
            if (File.Exists(wxray)) return wxray;

            wxray = Path.Combine(exeDir, "wxray.exe");
            if (File.Exists(wxray)) return wxray;
        }
        else
        {
            var fallback = Path.Combine(binDir, "sing-box.exe");
            if (File.Exists(fallback)) return fallback;

            fallback = Path.Combine(exeDir, "sing-box.exe");
            if (File.Exists(fallback)) return fallback;
        }

        return null;
    }

    public static int FindAvailablePort(int startingPort)
    {
        for (int port = startingPort; port < startingPort + 50; port++)
        {
            try
            {
                var listener = new TcpListener(IPAddress.Loopback, port);
                listener.Start();
                listener.Stop();
                return port;
            }
            catch { }
        }
        return startingPort;
    }
}
