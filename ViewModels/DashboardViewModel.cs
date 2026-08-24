using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using System.Timers;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SentinelDesktop.Models;
using SentinelDesktop.Services;

namespace SentinelDesktop.ViewModels;

public partial class DashboardViewModel : ViewModelBase
{
    private readonly Timer _sessionTimer;
    private int _secondsElapsed;

    [ObservableProperty]
    private bool _isConnected;

    [ObservableProperty]
    private bool _isConnecting;

    [ObservableProperty]
    private string _connectButtonText = "⚡ ПОДКЛЮЧИТЬ";

    [ObservableProperty]
    private string _sessionDuration = "00:00:00";

    [ObservableProperty]
    private string _downloadSpeed = "0.0 KB/s";

    [ObservableProperty]
    private string _uploadSpeed = "0.0 KB/s";

    [ObservableProperty]
    private string _totalDownload = "0 MB";

    [ObservableProperty]
    private string _totalUpload = "0 MB";

    [ObservableProperty]
    private string _publicIp = "127.0.0.1";

    [ObservableProperty]
    private string _country = "RU";

    [ObservableProperty]
    private string _pingDisplay = "— ms";

    [ObservableProperty]
    private bool _isTunMode = true;

    [ObservableProperty]
    private bool _isSystemProxy = false;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsCoreProtocolCompatible))]
    [NotifyPropertyChangedFor(nameof(CoreProtocolWarning))]
    private ServerProfile? _selectedServer;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsCoreProtocolCompatible))]
    [NotifyPropertyChangedFor(nameof(CoreProtocolWarning))]
    private CoreEngineOption _selectedCoreEngine = CoreEnginesCatalog.GetEngine("sing-box");

    [ObservableProperty]
    private bool _isCoreMissing;

    [ObservableProperty]
    private string _coreMissingMessage = string.Empty;

    public event Action? RequestNavigateToCores;
    public event Action? RequestNavigateToServers;

    [RelayCommand]
    public void GoToCoreManager() => RequestNavigateToCores?.Invoke();

    [RelayCommand]
    public void GoToServers() => RequestNavigateToServers?.Invoke();

    public List<CoreEngineOption> AvailableCoreEngines => CoreEnginesCatalog.AvailableEngines;

    public bool IsCoreProtocolCompatible => SelectedServer == null || SelectedCoreEngine.SupportsProtocol(SelectedServer.Protocol);

    public string CoreProtocolWarning => (SelectedServer != null && !SelectedCoreEngine.SupportsProtocol(SelectedServer.Protocol))
        ? $"⚠️ Ядро {SelectedCoreEngine.DisplayName} не поддерживает {SelectedServer.Protocol.ToUpperInvariant()}"
        : string.Empty;

    public DashboardViewModel()
    {
        _sessionTimer = new Timer(1000);
        _sessionTimer.Elapsed += (s, e) =>
        {
            _secondsElapsed++;
            var ts = TimeSpan.FromSeconds(_secondsElapsed);
            SessionDuration = ts.ToString(@"hh\:mm\:ss");
        };

        VpnCoreService.Instance.StateChanged += OnVpnStateChanged;
        VpnCoreService.Instance.TrafficUpdated += OnTrafficUpdated;
        StorageService.ServersChanged += () =>
        {
            Avalonia.Threading.Dispatcher.UIThread.Post(LoadInitialData);
        };

        LoadInitialData();
    }

    public void CheckCoreBinaryStatus()
    {
        var installed = VpnCoreService.IsCoreBinaryInstalled(SelectedCoreEngine.Id);
        IsCoreMissing = !installed;
        if (IsCoreMissing)
        {
            CoreMissingMessage = $"Ядро {SelectedCoreEngine.DisplayName} не найдено на этом ПК. Нажмите для перехода к скачиванию.";
        }
        else
        {
            CoreMissingMessage = string.Empty;
        }
    }

    private void LoadInitialData()
    {
        var vault = StorageService.Load();
        if (vault.Servers.Count > 0)
        {
            SelectedServer = vault.Servers[0];
            PingDisplay = SelectedServer.PingDisplay;
        }
        IsTunMode = vault.Settings.IsTunMode;
        IsSystemProxy = vault.Settings.IsSystemProxy;
        SelectedCoreEngine = CoreEnginesCatalog.GetEngine(vault.Settings.CoreType);
        CheckCoreBinaryStatus();

        Task.Run(() =>
        {
            try
            {
                var (ip, country) = SentinelCoreNative.GetPublicIp(0);
                if (!string.IsNullOrEmpty(ip))
                {
                    PublicIp = ip;
                    Country = country;
                }
            }
            catch { }
        });
    }

    [RelayCommand]
    public void SetCoreEngine(string coreId)
    {
        SelectedCoreEngine = CoreEnginesCatalog.GetEngine(coreId);
        var vault = StorageService.Load();
        vault.Settings.CoreType = SelectedCoreEngine.Id;
        StorageService.Save(vault);
        OnPropertyChanged(nameof(IsCoreProtocolCompatible));
        OnPropertyChanged(nameof(CoreProtocolWarning));
        CheckCoreBinaryStatus();
    }

    [RelayCommand]
    private async Task ToggleConnectionAsync()
    {
        if (IsConnected)
        {
            await VpnCoreService.Instance.StopAsync();
        }
        else
        {
            if (SelectedServer == null) return;

            CheckCoreBinaryStatus();
            if (IsCoreMissing)
            {
                LoggingService.Instance.LogApp($"Невозможно запустить подключение: ядро {SelectedCoreEngine.DisplayName} не установлено. Скачайте его во вкладке «Ядра».", "WARN");
                return;
            }

            // If in TUN mode and not yet elevated, request UAC elevation for the application on demand
            if (IsTunMode && !VpnCoreService.IsAdministrator())
            {
                var exePath = Environment.ProcessPath ?? Process.GetCurrentProcess().MainModule?.FileName;
                if (!string.IsNullOrEmpty(exePath) && File.Exists(exePath))
                {
                    LoggingService.Instance.LogApp("Запрос прав Администратора (UAC) для создания Wintun TUN-интерфейса...");
                    var startInfo = new ProcessStartInfo
                    {
                        FileName = exePath,
                        Arguments = "--auto-connect",
                        UseShellExecute = true,
                        Verb = "runas"
                    };

                    try
                    {
                        VpnCoreService.IsElevatingHandoff = true;
                        Process.Start(startInfo);
                        if (Avalonia.Application.Current?.ApplicationLifetime is Avalonia.Controls.ApplicationLifetimes.IClassicDesktopStyleApplicationLifetime desktop)
                        {
                            desktop.Shutdown();
                        }
                        else
                        {
                            Environment.Exit(0);
                        }
                        return;
                    }
                    catch (System.ComponentModel.Win32Exception winEx) when (winEx.NativeErrorCode == 1223)
                    {
                        LoggingService.Instance.LogApp("⚠️ Подключение отменено: запрос UAC отклонен пользователем.", "WARN");
                        IsConnecting = false;
                        ConnectButtonText = "⚡ ПОДКЛЮЧИТЬ";
                        return;
                    }
                    catch (Exception ex)
                    {
                        LoggingService.Instance.LogApp($"Ошибка запроса повышения прав: {ex.Message}", "ERROR");
                    }
                }
            }

            await StartConnectionAsync();
        }
    }

    public async Task StartConnectionAsync()
    {
        if (SelectedServer == null) return;

        CheckCoreBinaryStatus();
        if (IsCoreMissing)
        {
            LoggingService.Instance.LogApp($"Невозможно запустить подключение: ядро {SelectedCoreEngine.DisplayName} не установлено. Скачайте его во вкладке «Ядра».", "WARN");
            IsConnecting = false;
            ConnectButtonText = "⚡ ПОДКЛЮЧИТЬ";
            return;
        }

        IsConnecting = true;
        ConnectButtonText = "⟳ ПОДКЛЮЧЕНИЕ...";

        var vault = StorageService.Load();
        var settings = vault.Settings;
        settings.IsTunMode = IsTunMode;
        settings.IsSystemProxy = IsSystemProxy;
        settings.CoreType = SelectedCoreEngine.Id;

        await Task.Delay(350); // UI micro-feedback
        var success = await VpnCoreService.Instance.StartAsync(SelectedServer, settings);
        if (!success)
        {
            IsConnecting = false;
            ConnectButtonText = "⚡ ПОДКЛЮЧИТЬ";
        }
    }

    [RelayCommand]
    public void SetMode(string mode)
    {
        if (mode == "tun")
        {
            IsTunMode = true;
            IsSystemProxy = false;
        }
        else
        {
            IsTunMode = false;
            IsSystemProxy = true;
        }

        var vault = StorageService.Load();
        vault.Settings.IsTunMode = IsTunMode;
        vault.Settings.IsSystemProxy = IsSystemProxy;
        StorageService.Save(vault);
    }

    [RelayCommand]
    public void RefreshIp()
    {
        Task.Run(() =>
        {
            try
            {
                var (ip, country) = SentinelCoreNative.GetPublicIp(0);
                if (!string.IsNullOrEmpty(ip))
                {
                    PublicIp = ip;
                    Country = country;
                }
            }
            catch { }
        });
    }

    private void OnVpnStateChanged(bool running)
    {
        IsConnected = running;
        IsConnecting = false;
        if (running)
        {
            ConnectButtonText = "✓ ОТКЛЮЧИТЬ";
            _secondsElapsed = 0;
            _sessionTimer.Start();
            RefreshIp();
        }
        else
        {
            ConnectButtonText = "⚡ ПОДКЛЮЧИТЬ";
            _sessionTimer.Stop();
            DownloadSpeed = "0.0 KB/s";
            UploadSpeed = "0.0 KB/s";
        }
    }

    private void OnTrafficUpdated(TrafficStats stats)
    {
        DownloadSpeed = stats.DownSpeedFormatted;
        UploadSpeed = stats.UpSpeedFormatted;
        TotalDownload = stats.TotalDownFormatted;
        TotalUpload = stats.TotalUpFormatted;
    }
}
