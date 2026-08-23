using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using SentinelDesktop.Models;

namespace SentinelDesktop.Services;

public class CoreUpdateService
{
    private static readonly Lazy<CoreUpdateService> _lazy = new(() => new CoreUpdateService());
    public static CoreUpdateService Instance => _lazy.Value;

    private readonly HttpClient _httpClient;

    public static readonly Dictionary<string, (string Repo, string DisplayName, string ExeName)> Repositories = new()
    {
        { "singbox", ("SagerNet/sing-box", "Sing-box Core", "sing-box.exe") },
        { "sentinel_core", ("blackalex1/sentinel-core", "Sentinel FFI Engine", "sentinel-core.dll") }
    };

    private CoreUpdateService()
    {
        _httpClient = new HttpClient();
        _httpClient.DefaultRequestHeaders.Add("User-Agent", "SentinelDesktop-Updater");
        _httpClient.DefaultRequestHeaders.Add("Accept", "application/vnd.github.v3+json");
    }

    public string GetBinariesDirectory()
    {
        var binDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "binaries");
        Directory.CreateDirectory(binDir);
        return binDir;
    }

    public string DetectInstalledVersion(string coreKey)
    {
        try
        {
            if (coreKey == "sentinel_core")
            {
                var raw = SentinelCoreNative.GetVersion();
                if (string.IsNullOrWhiteSpace(raw)) return "Не установлено";
                var m = Regex.Match(raw, @"v?(\d+\.\d+(\.\d+)?)");
                return m.Success ? $"v{m.Groups[1].Value}" : raw.Trim();
            }

            var binDir = GetBinariesDirectory();
            var exeName = Repositories.TryGetValue(coreKey, out var repo) ? repo.ExeName : "sing-box.exe";
            var targetPath = Path.Combine(binDir, exeName);

            if (!File.Exists(targetPath))
            {
                targetPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, exeName);
            }

            if (!File.Exists(targetPath))
            {
                return "Не установлено";
            }

            var proc = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = targetPath,
                    Arguments = "version",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    StandardOutputEncoding = Encoding.UTF8,
                    CreateNoWindow = true
                }
            };

            proc.Start();
            var output = proc.StandardOutput.ReadToEnd();
            proc.WaitForExit(1500);

            if (!string.IsNullOrWhiteSpace(output))
            {
                // Extract semver e.g. v1.13.19, 24.11.30, v2.4.5
                var match = Regex.Match(output, @"(?:Version:?\s*|version\s+|Xray\s+|^|\s)v?(\d+\.\d+(?:\.\d+)?)", RegexOptions.Multiline | RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    return $"v{match.Groups[1].Value}";
                }

                var lines = output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var l in lines)
                {
                    var clean = l.Trim();
                    if (!clean.Contains("░") && !clean.Contains("█") && clean.Length < 40)
                    {
                        return clean;
                    }
                }
            }

            return "Установлено (v. " + File.GetLastWriteTime(targetPath).ToString("dd.MM.yyyy") + ")";
        }
        catch (Exception ex)
        {
            return $"Не установлено ({ex.Message})";
        }
    }

    private readonly Dictionary<string, (DateTime CachedAt, List<GithubReleaseInfo> Releases)> _releasesCache = new();

    public async Task<List<GithubReleaseInfo>> FetchReleasesAsync(string coreKey, bool includePrereleases, bool forceRefresh = false)
    {
        if (!Repositories.TryGetValue(coreKey, out var meta))
        {
            throw new ArgumentException("Неизвестный тип ядра: " + coreKey);
        }

        var cacheKey = $"{coreKey}_{includePrereleases}";
        if (!forceRefresh && _releasesCache.TryGetValue(cacheKey, out var cached) &&
            DateTime.UtcNow - cached.CachedAt < TimeSpan.FromMinutes(20))
        {
            return cached.Releases;
        }

        try
        {
            var url = $"https://api.github.com/repos/{meta.Repo}/releases?per_page=30";
            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                if (_releasesCache.TryGetValue(cacheKey, out var oldCached))
                {
                    return oldCached.Releases;
                }
                throw new Exception($"GitHub API вернул статус {(int)response.StatusCode}: {response.ReasonPhrase}");
            }

            var json = await response.Content.ReadAsStringAsync();
            var allReleases = JsonSerializer.Deserialize<List<GithubReleaseInfo>>(json) ?? new List<GithubReleaseInfo>();

            var result = includePrereleases ? allReleases : allReleases.FindAll(r => !r.IsPrerelease);
            _releasesCache[cacheKey] = (DateTime.UtcNow, result);
            return result;
        }
        catch when (_releasesCache.TryGetValue(cacheKey, out var fallbackCache))
        {
            return fallbackCache.Releases;
        }
    }

    public GithubAsset? FindWindowsAsset(List<GithubAsset> assets, string coreKey)
    {
        if (assets.Count == 0) return null;

        var norm = coreKey.ToLowerInvariant();

        if (norm == "sentinel_core")
        {
            foreach (var a in assets)
            {
                var n = a.Name.ToLowerInvariant();
                if ((n.Contains("windows") || n.Contains("amd64") || n.Contains("win")) && (n.EndsWith(".dll") || n.EndsWith(".zip")))
                    return a;
            }
            foreach (var a in assets)
            {
                if (a.Name.EndsWith(".dll") || a.Name.EndsWith(".zip")) return a;
            }
        }
        else if (norm == "singbox")
        {
            foreach (var a in assets)
            {
                var n = a.Name.ToLowerInvariant();
                if (n.Contains("windows") && (n.Contains("amd64") || n.Contains("x86_64") || n.Contains("64")) && n.EndsWith(".zip"))
                    return a;
            }
        }


        foreach (var a in assets)
        {
            var n = a.Name.ToLowerInvariant();
            if (n.Contains("windows") || n.EndsWith(".zip") || n.EndsWith(".exe") || n.EndsWith(".dll"))
                return a;
        }

        return assets[0];
    }

    public async Task<string> DownloadAndInstallAssetAsync(
        GithubAsset asset,
        string coreKey,
        IProgress<(double Progress, string Status)> progress)
    {
        progress.Report((0.05, "Подключение к серверу GitHub..."));

        if (VpnCoreService.Instance.IsRunning)
        {
            progress.Report((0.08, "Остановка активного туннеля ядра..."));
            await VpnCoreService.Instance.StopAsync();
        }

        using var response = await _httpClient.GetAsync(asset.DownloadUrl, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();

        var totalBytes = response.Content.Headers.ContentLength ?? asset.Size;
        using var contentStream = await response.Content.ReadAsStreamAsync();

        var tempZip = Path.Combine(Path.GetTempPath(), $"sentinel_dl_{Guid.NewGuid():N}.tmp");
        using (var fileStream = new FileStream(tempZip, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true))
        {
            var buffer = new byte[16384];
            long totalRead = 0;
            int read;

            while ((read = await contentStream.ReadAsync(buffer, 0, buffer.Length)) > 0)
            {
                await fileStream.WriteAsync(buffer, 0, read);
                totalRead += read;

                if (totalBytes > 0)
                {
                    var p = 0.1 + 0.7 * ((double)totalRead / totalBytes);
                    var mb = (totalRead / (1024.0 * 1024.0)).ToString("F1");
                    var totalMb = (totalBytes / (1024.0 * 1024.0)).ToString("F1");
                    progress.Report((Math.Min(0.85, p), $"Загрузка архива: {mb} / {totalMb} МБ"));
                }
            }
        }

        progress.Report((0.88, "Распаковка и установка компонентов..."));
        var binDir = GetBinariesDirectory();

        if (asset.Name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
        {
            var tempExtract = Path.Combine(Path.GetTempPath(), $"sentinel_ext_{Guid.NewGuid():N}");
            Directory.CreateDirectory(tempExtract);

            try
            {
                ZipFile.ExtractToDirectory(tempZip, tempExtract, true);

                var expectedExe = Repositories.TryGetValue(coreKey, out var repo) ? repo.ExeName : "sing-box.exe";
                var allFiles = Directory.GetFiles(tempExtract, "*", SearchOption.AllDirectories);

                foreach (var file in allFiles)
                {
                    var fName = Path.GetFileName(file);
                    if (fName.Equals(expectedExe, StringComparison.OrdinalIgnoreCase) ||
                        fName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) ||
                        fName.EndsWith(".dll", StringComparison.OrdinalIgnoreCase) ||
                        fName.EndsWith(".db", StringComparison.OrdinalIgnoreCase) ||
                        fName.EndsWith(".dat", StringComparison.OrdinalIgnoreCase))
                    {
                        var dest = Path.Combine(binDir, fName);
                        File.Copy(file, dest, true);

                        // If updating sentinel-core.dll, also place it in application root
                        if (fName.Equals("sentinel-core.dll", StringComparison.OrdinalIgnoreCase))
                        {
                            try
                            {
                                File.Copy(file, Path.Combine(AppDomain.CurrentDomain.BaseDirectory, fName), true);
                            }
                            catch { }
                        }
                    }
                }
            }
            finally
            {
                try { Directory.Delete(tempExtract, true); } catch { }
            }
        }
        else
        {
            var expectedName = Repositories.TryGetValue(coreKey, out var repo) ? repo.ExeName : asset.Name;
            var destPath = Path.Combine(binDir, expectedName);
            File.Copy(tempZip, destPath, true);

            if (expectedName.Equals("sentinel-core.dll", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    File.Copy(tempZip, Path.Combine(AppDomain.CurrentDomain.BaseDirectory, expectedName), true);
                }
                catch { }
            }
        }

        try { File.Delete(tempZip); } catch { }

        progress.Report((1.0, "Ядро успешно установлено и готово к работе!"));
        LoggingService.Instance.LogApp($"Ядро {coreKey} успешно обновлено из GitHub релиза: {asset.Name}");
        return Path.Combine(binDir, Repositories[coreKey].ExeName);
    }
}
