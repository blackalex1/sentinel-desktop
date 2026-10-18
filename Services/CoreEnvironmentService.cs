using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Security.Principal;
using SentinelDesktop.Models;

namespace SentinelDesktop.Services;

public static class CoreEnvironmentService
{
    public static bool IsElevatingHandoff { get; set; } = false;

    public static string GetDataDirectory()
    {
        var localData = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "data");
        var appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "SentinelDesktop", "data");

        try
        {
            Directory.CreateDirectory(localData);
            var testFile = Path.Combine(localData, ".writetest");
            File.WriteAllText(testFile, "ok");
            File.Delete(testFile);
            return localData;
        }
        catch
        {
            // Fallback for Program Files / non-writable installations
            try
            {
                Directory.CreateDirectory(appData);
                // Migrate existing vault if present in localData but not in appData
                var localVault = Path.Combine(localData, "vault.json");
                var appVault = Path.Combine(appData, "vault.json");
                if (File.Exists(localVault) && !File.Exists(appVault))
                {
                    File.Copy(localVault, appVault, true);
                }
            }
            catch { }
            return appData;
        }
    }

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

    public static string GetCoreVersion(string? coreExe, bool isXray)
    {
        if (string.IsNullOrEmpty(coreExe) || !File.Exists(coreExe))
        {
            return isXray ? "1.8.0" : "1.13.18";
        }

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = coreExe,
                Arguments = "version",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var p = Process.Start(psi);
            if (p != null)
            {
                var output = p.StandardOutput.ReadToEnd();
                p.WaitForExit(800);
                var match = System.Text.RegularExpressions.Regex.Match(output, @"version\s+([0-9.]+)");
                if (match.Success) return match.Groups[1].Value;
            }
        }
        catch { }

        return isXray ? "1.8.0" : "1.13.18";
    }
}
