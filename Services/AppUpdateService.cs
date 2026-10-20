using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using SentinelDesktop.Models;

namespace SentinelDesktop.Services;

public class AppUpdateService
{
    private static readonly Lazy<AppUpdateService> _instance = new(() => new AppUpdateService());
    public static AppUpdateService Instance => _instance.Value;

    public const string CurrentVersion = "0.0.1";
    private readonly HttpClient _httpClient;

    public string LatestVersion { get; private set; } = CurrentVersion;
    public string TagName { get; private set; } = $"v{CurrentVersion}";
    public bool HasUpdate { get; private set; }
    public string ReleaseNotes { get; private set; } = string.Empty;
    public string ReleaseUrl { get; private set; } = "https://github.com/blackalex1/sentinel-desktop/releases";
    public string DownloadUrl { get; private set; } = string.Empty;
    public string PublishedAt { get; private set; } = string.Empty;
    public bool IsChecking { get; private set; }
    public bool IsDownloading { get; private set; }
    public double DownloadProgress { get; private set; }
    public string StatusMessage { get; private set; } = "Проверка обновлений...";

    public event Action? UpdateStatusChanged;

    private AppUpdateService()
    {
        _httpClient = new HttpClient();
        _httpClient.DefaultRequestHeaders.Add("User-Agent", "Sentinel-Desktop-Client/0.0.1");
        _httpClient.DefaultRequestHeaders.Add("Accept", "application/vnd.github.v3+json");
    }

    private static (int, int, int) ParseVersion(string v)
    {
        if (string.IsNullOrWhiteSpace(v)) return (0, 0, 0);
        var matches = Regex.Matches(v, @"\d+");
        int major = matches.Count > 0 ? int.Parse(matches[0].Value) : 0;
        int minor = matches.Count > 1 ? int.Parse(matches[1].Value) : 0;
        int patch = matches.Count > 2 ? int.Parse(matches[2].Value) : 0;
        return (major, minor, patch);
    }

    public async Task<bool> CheckForUpdateAsync(bool force = false)
    {
        if (IsChecking) return HasUpdate;
        IsChecking = true;
        StatusMessage = "Проверка обновлений на GitHub...";
        UpdateStatusChanged?.Invoke();

        try
        {
            var url = "https://api.github.com/repos/blackalex1/sentinel-desktop/releases/latest";
            var response = await _httpClient.GetAsync(url);
            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync();
                var release = JsonSerializer.Deserialize<GithubReleaseInfo>(json);
                if (release != null)
                {
                    TagName = release.TagName;
                    LatestVersion = release.TagName.TrimStart('v', 'V');
                    ReleaseNotes = release.Body ?? string.Empty;
                    ReleaseUrl = release.HtmlUrl ?? "https://github.com/blackalex1/sentinel-desktop/releases";
                    PublishedAt = release.PublishedAt?.ToString("dd.MM.yyyy") ?? string.Empty;

                    // Locate Windows EXE or ZIP asset
                    if (release.Assets != null)
                    {
                        foreach (var asset in release.Assets)
                        {
                            if (asset.Name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) &&
                                asset.Name.Contains("SentinelDesktop", StringComparison.OrdinalIgnoreCase))
                            {
                                DownloadUrl = asset.DownloadUrl;
                                break;
                            }
                        }
                    }

                    var currentVerParsed = ParseVersion(CurrentVersion);
                    var latestVerParsed = ParseVersion(LatestVersion);

                    HasUpdate = latestVerParsed.CompareTo(currentVerParsed) > 0;
                    StatusMessage = HasUpdate
                        ? $"Доступна новая версия v{LatestVersion}!"
                        : "Установлена актуальная версия";

                    UpdateStatusChanged?.Invoke();
                    return HasUpdate;
                }
            }
        }
        catch (Exception ex)
        {
            LoggingService.Instance.LogApp($"[Updater] Ошибка проверки обновлений: {ex.Message}", "WARN");
            StatusMessage = "Не удалось проверить обновления";
        }
        finally
        {
            IsChecking = false;
            UpdateStatusChanged?.Invoke();
        }

        return false;
    }

    public async Task<bool> DownloadAndInstallUpdateAsync(Action<double, string>? progressCallback = null)
    {
        if (IsDownloading || string.IsNullOrWhiteSpace(DownloadUrl)) return false;

        IsDownloading = true;
        StatusMessage = "Загрузка обновления...";
        UpdateStatusChanged?.Invoke();

        try
        {
            var tempDir = Path.Combine(Path.GetTempPath(), "SentinelDesktopUpdate");
            Directory.CreateDirectory(tempDir);
            var tempExePath = Path.Combine(tempDir, "SentinelDesktop.exe");

            progressCallback?.Invoke(0.1, "Подключение к GitHub...");

            using (var resp = await _httpClient.GetAsync(DownloadUrl, HttpCompletionOption.ResponseHeadersRead))
            {
                resp.EnsureSuccessStatusCode();
                var totalBytes = resp.Content.Headers.ContentLength ?? 65_000_000L;
                using var stream = await resp.Content.ReadAsStreamAsync();
                using var fs = new FileStream(tempExePath, FileMode.Create, FileAccess.Write, FileShare.None);

                var buffer = new byte[81920];
                long readBytes = 0;
                int bytesRead;

                while ((bytesRead = await stream.ReadAsync(buffer)) > 0)
                {
                    await fs.WriteAsync(buffer.AsMemory(0, bytesRead));
                    readBytes += bytesRead;
                    var progress = (double)readBytes / totalBytes;
                    DownloadProgress = progress;
                    progressCallback?.Invoke(progress, $"Загрузка: {progress * 100:0}% ({readBytes / (1024 * 1024)} MB)");
                }
            }

            progressCallback?.Invoke(1.0, "Запуск процесса обновления...");

            // Create batch script to replace current running executable and restart
            var currentExe = Process.GetCurrentProcess().MainModule?.FileName ??
                             Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "SentinelDesktop.exe");
            var currentDir = Path.GetDirectoryName(currentExe)!;
            var scriptPath = Path.Combine(tempDir, "apply_update.bat");

            var scriptContent = $@"@echo off
timeout /t 1 /nobreak > nul
taskkill /f /im SentinelDesktop.exe > nul 2>&1
timeout /t 1 /nobreak > nul
copy /y ""{tempExePath}"" ""{currentExe}"" > nul
start """" ""{currentExe}""
del ""{tempExePath}"" > nul 2>&1
(goto) 2>nul & del ""%~f0""
exit
";
            await File.WriteAllTextAsync(scriptPath, scriptContent);

            var psi = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = $"/c \"{scriptPath}\"",
                UseShellExecute = true,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            };

            Process.Start(psi);
            Environment.Exit(0);
            return true;
        }
        catch (Exception ex)
        {
            LoggingService.Instance.LogApp($"[Updater] Ошибка при установке обновления: {ex.Message}", "ERROR");
            StatusMessage = $"Ошибка обновления: {ex.Message}";
            progressCallback?.Invoke(0, StatusMessage);
            return false;
        }
        finally
        {
            IsDownloading = false;
            UpdateStatusChanged?.Invoke();
        }
    }
}
