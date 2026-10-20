using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Security.Principal;
using System.Threading.Tasks;
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

    // Minimal valid 17-byte compiled sing-box binary rule-set (.srs)
    // Magic bytes: SRS\x01 + zlib-compressed empty rule list.
    public static readonly byte[] EmptySrsStub = new byte[]
    {
        0x53, 0x52, 0x53, 0x01, 0x78, 0xda, 0x62, 0x00, 0x04, 0x00, 0x00, 0xff, 0xff, 0x00, 0x01, 0x00, 0x01
    };

    private static readonly (string Type, string Name)[] DefaultRuleSets = new[]
    {
        ("geosite", "geosite-category-ru"),
        ("geosite", "geosite-vk"),
        ("geosite", "geosite-yandex"),
        ("geosite", "geosite-category-ads-all"),
        ("geoip", "geoip-ru"),
        ("geosite", "geosite-mailru"),
        ("geosite", "geosite-category-gov-ru")
    };

    private static readonly string[] RuleMirrors = new[]
    {
        "https://testingcf.jsdelivr.net/gh/SagerNet/sing-{0}@rule-set/{1}.srs",
        "https://fastly.jsdelivr.net/gh/SagerNet/sing-{0}@rule-set/{1}.srs",
        "https://cdn.jsdelivr.net/gh/SagerNet/sing-{0}@rule-set/{1}.srs",
        "https://gcore.jsdelivr.net/gh/SagerNet/sing-{0}@rule-set/{1}.srs",
        "https://gh-proxy.com/https://raw.githubusercontent.com/SagerNet/sing-{0}/rule-set/{1}.srs",
        "https://raw.githubusercontent.com/SagerNet/sing-{0}/rule-set/{1}.srs"
    };

    private static bool _ruleSetsInitStarted = false;

    public static string GetRulesDirectory()
    {
        var exeDir = AppDomain.CurrentDomain.BaseDirectory;
        var rulesDir = Path.Combine(exeDir, "rules");
        try
        {
            Directory.CreateDirectory(rulesDir);
        }
        catch { }
        return rulesDir;
    }

    public static void EnsureRuleStub(string ruleFileName)
    {
        try
        {
            var rulesDir = GetRulesDirectory();
            var targetPath = Path.Combine(rulesDir, ruleFileName);
            if (!File.Exists(targetPath) || new FileInfo(targetPath).Length == 0)
            {
                File.WriteAllBytes(targetPath, EmptySrsStub);
            }
        }
        catch { }
    }

    public static async Task EnsureRuleSetsAsync()
    {
        if (_ruleSetsInitStarted) return;
        _ruleSetsInitStarted = true;

        await Task.Run(async () =>
        {
            try
            {
                var rulesDir = GetRulesDirectory();

                // 1. Immediately ensure safe stubs for all default rules so Sing-box can NEVER crash
                foreach (var (_, name) in DefaultRuleSets)
                {
                    var filePath = Path.Combine(rulesDir, $"{name}.srs");
                    if (!File.Exists(filePath) || new FileInfo(filePath).Length == 0)
                    {
                        try
                        {
                            File.WriteAllBytes(filePath, EmptySrsStub);
                        }
                        catch { }
                    }
                }

                // 2. In background, asynchronously download full binary rules directly from CDN mirrors
                using var client = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(5) };
                client.DefaultRequestHeaders.Add("User-Agent", "SentinelDesktop-RuleSync");

                foreach (var (type, name) in DefaultRuleSets)
                {
                    var filePath = Path.Combine(rulesDir, $"{name}.srs");
                    if (File.Exists(filePath) && new FileInfo(filePath).Length > EmptySrsStub.Length)
                    {
                        continue; // Already has full rule set
                    }

                    foreach (var mirrorPattern in RuleMirrors)
                    {
                        var url = string.Format(mirrorPattern, type, name);
                        try
                        {
                            var bytes = await client.GetByteArrayAsync(url);
                            if (bytes != null && bytes.Length > EmptySrsStub.Length &&
                                bytes.Length > 4 && bytes[0] == 0x53 && bytes[1] == 0x52 && bytes[2] == 0x53)
                            {
                                await File.WriteAllBytesAsync(filePath, bytes);
                                break;
                            }
                        }
                        catch
                        {
                            // Try next mirror
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                LoggingService.Instance.LogApp($"[RuleSet] Ошибка фоновой инициализации правил: {ex.Message}", "WARN");
            }
        });
    }
}
