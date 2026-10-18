using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Avalonia.Threading;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SentinelDesktop.Models;
using SentinelDesktop.Services;

namespace SentinelDesktop.ViewModels;

public partial class CoreCardViewModel : ObservableObject
{
    public string CoreKey { get; }
    public string DisplayName { get; }
    public string Subtitle { get; }
    public string Description { get; }
    public string AccentColor { get; }

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsInstalled))]
    [NotifyPropertyChangedFor(nameof(IsSelectedVersionInstalled))]
    [NotifyPropertyChangedFor(nameof(InstallButtonText))]
    [NotifyPropertyChangedFor(nameof(CanDownload))]
    [NotifyPropertyChangedFor(nameof(InstallButtonBg))]
    [NotifyPropertyChangedFor(nameof(InstallButtonBorder))]
    [NotifyPropertyChangedFor(nameof(InstallButtonForeground))]
    [NotifyPropertyChangedFor(nameof(InstallButtonIcon))]
    private string _installedVersion = "Проверка...";

    public bool IsInstalled => !string.IsNullOrWhiteSpace(InstalledVersion) &&
                              !InstalledVersion.Contains("Не установлено", StringComparison.OrdinalIgnoreCase) &&
                              !InstalledVersion.Contains("Ошибка", StringComparison.OrdinalIgnoreCase) &&
                              !InstalledVersion.Contains("Проверка", StringComparison.OrdinalIgnoreCase);

    [ObservableProperty]
    private ObservableCollection<GithubReleaseInfo> _availableReleases = new();

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsSelectedVersionInstalled))]
    [NotifyPropertyChangedFor(nameof(InstallButtonText))]
    [NotifyPropertyChangedFor(nameof(CanDownload))]
    [NotifyPropertyChangedFor(nameof(InstallButtonBg))]
    [NotifyPropertyChangedFor(nameof(InstallButtonBorder))]
    [NotifyPropertyChangedFor(nameof(InstallButtonForeground))]
    [NotifyPropertyChangedFor(nameof(InstallButtonIcon))]
    private GithubReleaseInfo? _selectedRelease;

    [ObservableProperty]
    private bool _isLoading;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(CanDownload))]
    private bool _isDownloading;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(DownloadPercentDisplay))]
    private double _downloadProgress;

    public string DownloadPercentDisplay => $"{(int)(DownloadProgress * 100)}%";

    [ObservableProperty]
    private string _downloadStatus = string.Empty;

    public bool IsSelectedVersionInstalled => CheckIsSelectedVersionInstalled();

    public bool CanDownload => !IsDownloading && SelectedRelease != null && !IsSelectedVersionInstalled;

    public string InstallButtonText
    {
        get
        {
            if (IsSelectedVersionInstalled) return "Установлено";
            if (!IsInstalled) return "Скачать и установить";
            return "Обновить / Установить";
        }
    }

    public string InstallButtonBg => IsSelectedVersionInstalled ? "#064E3B" : "#1E1B4B";

    public string InstallButtonBorder => IsSelectedVersionInstalled ? "#10B981" : "#8B5CF6";

    public string InstallButtonForeground => IsSelectedVersionInstalled ? "#34D399" : "White";

    public string InstallButtonIcon => IsSelectedVersionInstalled
        ? "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" // Checkmark
        : "M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"; // Cloud download

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(ActiveBadgeText))]
    [NotifyPropertyChangedFor(nameof(ActiveBadgeBg))]
    [NotifyPropertyChangedFor(nameof(ActiveBadgeBorder))]
    [NotifyPropertyChangedFor(nameof(ActiveBadgeForeground))]
    private bool _isActiveEngine;

    public bool IsEngineType => CoreKey == "singbox" || CoreKey == "xray";

    public string ActiveBadgeText => IsActiveEngine ? "● Активное ядро" : "Сделать активным";
    public string ActiveBadgeBg => IsActiveEngine ? "#064E3B" : "#141A30";
    public string ActiveBadgeBorder => IsActiveEngine ? "#10B981" : "#253050";
    public string ActiveBadgeForeground => IsActiveEngine ? "#34D399" : "#94A3B8";

    public CoreCardViewModel(string coreKey, string displayName, string subtitle, string description, string accentColor)
    {
        CoreKey = coreKey;
        DisplayName = displayName;
        Subtitle = subtitle;
        Description = description;
        AccentColor = accentColor;
        RefreshInstalledVersion();
    }

    public void RefreshInstalledVersion()
    {
        Task.Run(() =>
        {
            var v = CoreUpdateService.Instance.DetectInstalledVersion(CoreKey);
            Dispatcher.UIThread.Post(() =>
            {
                InstalledVersion = v;
                OnPropertyChanged(nameof(IsInstalled));
                OnPropertyChanged(nameof(IsSelectedVersionInstalled));
                OnPropertyChanged(nameof(InstallButtonText));
                OnPropertyChanged(nameof(CanDownload));
                OnPropertyChanged(nameof(InstallButtonBg));
                OnPropertyChanged(nameof(InstallButtonBorder));
                OnPropertyChanged(nameof(InstallButtonForeground));
                OnPropertyChanged(nameof(InstallButtonIcon));
            });
        });
    }

    public async Task LoadReleasesAsync(bool includePrereleases)
    {
        if (IsLoading) return;
        IsLoading = true;

        try
        {
            var list = await CoreUpdateService.Instance.FetchReleasesAsync(CoreKey, includePrereleases);
            AvailableReleases.Clear();
            foreach (var r in list)
            {
                AvailableReleases.Add(r);
            }
            if (AvailableReleases.Count > 0)
            {
                // Prefer matching currently installed version if found, otherwise first stable
                var matchInstalled = AvailableReleases.FirstOrDefault(r => IsSameVersion(r.TagName, InstalledVersion));
                SelectedRelease = matchInstalled ?? AvailableReleases.FirstOrDefault(r => !r.IsPrerelease) ?? AvailableReleases[0];
            }
        }
        catch (Exception ex)
        {
            LoggingService.Instance.LogApp($"Ошибка загрузки релизов для {DisplayName}: {ex.Message}", "WARN");
        }
        finally
        {
            IsLoading = false;
        }
    }

    [RelayCommand]
    public async Task DownloadSelectedAsync()
    {
        if (IsDownloading || SelectedRelease == null || IsSelectedVersionInstalled) return;

        var asset = CoreUpdateService.Instance.FindWindowsAsset(SelectedRelease.Assets, CoreKey);
        if (asset == null)
        {
            DownloadStatus = "Совместимый Windows бинарник не найден";
            return;
        }

        IsDownloading = true;
        DownloadProgress = 0.0;
        DownloadStatus = "Подключение к GitHub...";

        var progress = new Progress<(double Progress, string Status)>(report =>
        {
            Dispatcher.UIThread.Post(() =>
            {
                DownloadProgress = report.Progress;
                DownloadStatus = report.Status;
            });
        });

        try
        {
            await Task.Run(async () =>
            {
                await CoreUpdateService.Instance.DownloadAndInstallAssetAsync(asset, CoreKey, progress, SelectedRelease?.Assets);
            });

            DownloadStatus = "Успешно установлено!";
            RefreshInstalledVersion();
            await Task.Delay(1500);
        }
        catch (Exception ex)
        {
            DownloadStatus = $"Ошибка: {ex.Message}";
            LoggingService.Instance.LogApp($"Ошибка загрузки {DisplayName}: {ex.Message}", "ERROR");
        }
        finally
        {
            IsDownloading = false;
            RefreshInstalledVersion();
        }
    }

    private bool CheckIsSelectedVersionInstalled()
    {
        if (SelectedRelease == null || string.IsNullOrWhiteSpace(InstalledVersion)) return false;
        if (!IsInstalled) return false;

        return IsSameVersion(SelectedRelease.TagName, InstalledVersion);
    }

    private static bool IsSameVersion(string tag, string installed)
    {
        if (string.IsNullOrWhiteSpace(tag) || string.IsNullOrWhiteSpace(installed)) return false;

        var tClean = Regex.Replace(tag.Trim().ToLowerInvariant(), @"^[^\d]+", "");
        var iClean = Regex.Replace(installed.Trim().ToLowerInvariant(), @"^[^\d]+", "");

        if (string.IsNullOrWhiteSpace(iClean) && installed.Trim().Equals("dev", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(tClean) || string.IsNullOrWhiteSpace(iClean)) return false;

        return tClean == iClean || tClean.StartsWith(iClean) || iClean.StartsWith(tClean);
    }
}

public partial class CoreManagerViewModel : ViewModelBase
{
    [ObservableProperty]
    private ObservableCollection<CoreCardViewModel> _cards = new();

    [ObservableProperty]
    private bool _includePrereleases = false;

    [ObservableProperty]
    private bool _isLoadingAll;

    [ObservableProperty]
    private string _statusMessage = string.Empty;

    [ObservableProperty]
    private bool _hasStatusMessage;

    public List<LogLevelOption> AvailableLogLevels => LogLevelsCatalog.AvailableLevels;

    [ObservableProperty]
    private LogLevelOption _selectedLogLevel;

    public CoreManagerViewModel()
    {
        var vault = StorageService.Load();
        _selectedLogLevel = LogLevelsCatalog.GetLevel(vault.Settings.LogLevel);

        Cards.Add(new CoreCardViewModel(
            "singbox",
            "Sing-box Core",
            "Рекомендуемое ядро (Wintun TUN, Reality, PortShield)",
            "Главное ядро Sentinel по умолчанию. Поддержка нативного TUN-драйвера Windows Wintun, Reality, ECH, Smart Routing и модуля безопасности PortShield.",
            "#38BDF8"
        ));

        Cards.Add(new CoreCardViewModel(
            "xray",
            "Xray-core",
            "Классическое ядро (VLESS Reality, VMess, Trojan)",
            "Быстрое ядро для обхода блокировок. Обратите внимание: для Xray модуль безопасности PortShield отключается и требуются базы GeoData.",
            "#C084FC"
        ));

        Cards.Add(new CoreCardViewModel(
            "geodata",
            "Базы правил GeoIP & GeoSite",
            "Файлы маршрутизации (geoip.dat & geosite.dat)",
            "Необходимы для работы ядра Xray-core и классической маршрутизации доменов и IP-адресов.",
            "#FBBF24"
        ));

        Cards.Add(new CoreCardViewModel(
            "sentinel_core",
            "Sentinel FFI Engine",
            "Нативная Go библиотека (sentinel-core.dll)",
            "Ядро маршрутизации, FFI-мост, компиляция AST-спецификаций, PortShield аудит и сверхбыстрые замеры пинга.",
            "#34D399"
        ));

        UpdateActiveEngineStatus(vault.Settings.CoreType);

        StorageService.LogLevelChanged += levelId =>
        {
            if (_selectedLogLevel?.Id != levelId)
            {
                _selectedLogLevel = LogLevelsCatalog.GetLevel(levelId);
                OnPropertyChanged(nameof(SelectedLogLevel));
            }
        };

        StorageService.CoreTypeChanged += coreType =>
        {
            Dispatcher.UIThread.Post(() => UpdateActiveEngineStatus(coreType));
        };

        _ = RefreshAllAsync();
    }

    public void UpdateActiveEngineStatus(string activeId)
    {
        foreach (var c in Cards)
        {
            var isCurrent = (c.CoreKey == "singbox" && (activeId == "sing-box" || activeId == "singbox" || activeId == "auto")) ||
                            (c.CoreKey == "xray" && activeId == "xray");
            c.IsActiveEngine = isCurrent;
        }
    }

    [RelayCommand]
    public void SetActiveEngine(string coreKey)
    {
        var targetId = coreKey == "xray" ? "xray" : "sing-box";
        var vault = StorageService.Load();
        vault.Settings.CoreType = targetId;
        StorageService.Save(vault);
        StorageService.NotifyCoreTypeChanged(targetId);
        UpdateActiveEngineStatus(targetId);
        ShowStatus($"Активное ядро переключено на {CoreEnginesCatalog.GetEngine(targetId).DisplayName}");
    }

    partial void OnSelectedLogLevelChanged(LogLevelOption value)
    {
        if (value == null) return;
        var vault = StorageService.Load();
        if (vault.Settings.LogLevel != value.Id)
        {
            vault.Settings.LogLevel = value.Id;
            StorageService.Save(vault);
            StorageService.NotifyLogLevelChanged(value.Id);
            ShowStatus($"Уровень логирования ядра изменен на '{value.DisplayName}'");
            LoggingService.Instance.LogApp($"Уровень детализации логов ядра переключен на '{value.DisplayName}' ({value.SingboxLevel})");

            // Hot reload core dynamically with new log level if VPN is currently active
            if (VpnCoreService.Instance.IsRunning)
            {
                _ = VpnCoreService.Instance.HotReloadLogLevelAsync(value.Id);
            }
        }
    }

    partial void OnIncludePrereleasesChanged(bool value)
    {
        _ = RefreshAllAsync();
    }

    [RelayCommand]
    public async Task RefreshAllAsync()
    {
        if (IsLoadingAll) return;
        IsLoadingAll = true;
        ShowStatus("Запрос релизов ядер с GitHub API...");

        foreach (var card in Cards)
        {
            card.RefreshInstalledVersion();
        }

        var tasks = Cards.Select(c => c.LoadReleasesAsync(IncludePrereleases)).ToArray();
        await Task.WhenAll(tasks);

        IsLoadingAll = false;
        ShowStatus("Списки релизов успешно обновлены");
    }

    [RelayCommand]
    public void OpenBinariesFolder()
    {
        try
        {
            var binDir = CoreUpdateService.Instance.GetBinariesDirectory();
            Process.Start(new ProcessStartInfo
            {
                FileName = binDir,
                UseShellExecute = true
            });
        }
        catch (Exception ex)
        {
            ShowStatus($"Ошибка открытия папки: {ex.Message}");
        }
    }

    private void ShowStatus(string msg)
    {
        StatusMessage = msg;
        HasStatusMessage = true;
        Task.Delay(3500).ContinueWith(_ =>
        {
            if (StatusMessage == msg)
            {
                HasStatusMessage = false;
                StatusMessage = string.Empty;
            }
        });
    }
}
