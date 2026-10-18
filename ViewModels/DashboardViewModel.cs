using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
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
    private string _publicIp = "—";

    [ObservableProperty]
    private string _country = "—";

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
    [NotifyPropertyChangedFor(nameof(IsSingboxSelected))]
    [NotifyPropertyChangedFor(nameof(IsXraySelected))]
    private CoreEngineOption _selectedCoreEngine = CoreEnginesCatalog.GetEngine("sing-box");

    public bool IsSingboxSelected => SelectedCoreEngine?.Id == "sing-box" || SelectedCoreEngine?.Id == "auto";
    public bool IsXraySelected => SelectedCoreEngine?.Id == "xray";

    [ObservableProperty]
    private bool _isCoreMissing;

    [ObservableProperty]
    private string _coreMissingMessage = string.Empty;

    [ObservableProperty]
    private bool _hasAlert;

    [ObservableProperty]
    private string _alertTitle = string.Empty;

    [ObservableProperty]
    private string _alertMessage = string.Empty;

    [ObservableProperty]
    private string _alertActionText = "Скачать ядро →";

    public event Action? RequestNavigateToCores;
    public event Action? RequestNavigateToServers;

    [RelayCommand]
    public void GoToCoreManager() => RequestNavigateToCores?.Invoke();

    [RelayCommand]
    public void GoToServers() => RequestNavigateToServers?.Invoke();

    [RelayCommand]
    public void DismissAlert()
    {
        HasAlert = false;
    }

    [RelayCommand]
    public void ExecuteAlertAction()
    {
        HasAlert = false;
        if (AlertActionText.Contains("сервер", StringComparison.OrdinalIgnoreCase) || AlertActionText.Contains("узел", StringComparison.OrdinalIgnoreCase))
        {
            GoToServers();
        }
        else
        {
            GoToCoreManager();
        }
    }

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
        CoreUpdateService.Instance.CoreInstalled += _ =>
        {
            Avalonia.Threading.Dispatcher.UIThread.Post(CheckCoreBinaryStatus);
        };
        StorageService.CoreTypeChanged += coreType =>
        {
            Avalonia.Threading.Dispatcher.UIThread.Post(() =>
            {
                if (SelectedCoreEngine?.Id != coreType)
                {
                    SelectedCoreEngine = CoreEnginesCatalog.GetEngine(coreType);
                    OnPropertyChanged(nameof(SelectedCoreEngine));
                    CheckCoreBinaryStatus();
                }
            });
        };

        LoadInitialData();
    }

    public void CheckCoreBinaryStatus()
    {
        var vpnCoreInstalled = VpnCoreService.IsCoreBinaryInstalled(SelectedCoreEngine.Id);
        var ffiCoreInstalled = SentinelCoreNative.IsAvailable();
        var geodataInstalled = VpnCoreService.AreGeoDataFilesInstalled();

        if (SelectedCoreEngine.Id == "xray" && !geodataInstalled)
        {
            IsCoreMissing = true;
            CoreMissingMessage = "Для работы ядра Xray-core требуются базы geoip.dat и geosite.dat. Нажмите для перехода к скачиванию.";
        }
        else if (!vpnCoreInstalled && !ffiCoreInstalled)
        {
            IsCoreMissing = true;
            CoreMissingMessage = "Ядра Sing-box и Sentinel FFI Engine не найдены на этом ПК. Нажмите для перехода к скачиванию.";
        }
        else if (!vpnCoreInstalled)
        {
            IsCoreMissing = true;
            CoreMissingMessage = $"Исполняемое ядро {SelectedCoreEngine.DisplayName} не найдено на этом ПК. Нажмите для перехода к скачиванию.";
        }
        else if (!ffiCoreInstalled)
        {
            IsCoreMissing = true;
            CoreMissingMessage = "Нативное ядро Sentinel FFI Engine (sentinel-core.dll) не найдено. Нажмите для перехода к скачиванию.";
        }
        else
        {
            IsCoreMissing = false;
            CoreMissingMessage = string.Empty;
        }
    }

    partial void OnSelectedServerChanged(ServerProfile? value)
    {
        if (value != null)
        {
            PingDisplay = value.PingDisplay;
            PingSelectedServer();
        }
        else
        {
            PingDisplay = "— ms";
        }
    }

    public void PingSelectedServer()
    {
        var s = SelectedServer;
        if (s == null || string.IsNullOrWhiteSpace(s.Address)) return;

        Task.Run(() =>
        {
            try
            {
                var port = s.Port > 0 ? s.Port : 443;
                var p = SentinelCoreNative.TestPing(s.Address, port, 2500);
                s.Ping = p;
                PingDisplay = s.PingDisplay;
            }
            catch { }
        });
    }

    public void LoadInitialData()
    {
        var vault = StorageService.Load();
        if (vault.Servers.Count > 0)
        {
            SelectedServer = vault.Servers.FirstOrDefault(s => s.Id == vault.SelectedServerId) ?? vault.Servers[0];
            PingDisplay = SelectedServer?.PingDisplay ?? "— ms";
            PingSelectedServer();
        }
        else
        {
            SelectedServer = null;
            PingDisplay = "— ms";
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
        StorageService.NotifyCoreTypeChanged(SelectedCoreEngine.Id);
        OnPropertyChanged(nameof(IsCoreProtocolCompatible));
        OnPropertyChanged(nameof(CoreProtocolWarning));
        CheckCoreBinaryStatus();
    }

    [RelayCommand]
    private async Task ToggleConnectionAsync()
    {
        if (IsConnecting) return;

        if (IsConnected)
        {
            await VpnCoreService.Instance.StopAsync();
        }
        else
        {
            if (SelectedServer == null)
            {
                AlertTitle = "СЕРВЕР НЕ ВЫБРАН";
                AlertMessage = "Для запуска туннеля выберите сервер из списка или добавьте новый узел через вкладку «Серверы».";
                AlertActionText = "Выбрать узел →";
                HasAlert = true;
                return;
            }

            CheckCoreBinaryStatus();
            if (SelectedCoreEngine.Id == "xray" && !VpnCoreService.AreGeoDataFilesInstalled())
            {
                AlertTitle = "ТРЕБУЮТСЯ БАЗЫ GEODATA";
                AlertMessage = "Для работы ядра Xray-core необходимо наличие файлов гео-баз 'geoip.dat' и 'geosite.dat'.\n\nПерейдите в раздел «Управление ядрами» и загрузите базы GeoData.";
                AlertActionText = "Загрузить базы →";
                HasAlert = true;
                LoggingService.Instance.LogApp("Невозможно запустить Xray: отсутствуют базы geoip.dat / geosite.dat. Скачайте их во вкладке «Ядра».", "WARN");
                return;
            }

            if (IsCoreMissing)
            {
                AlertTitle = "ТРЕБУЕТСЯ ЗАГРУЗКА ЯДРА";
                AlertMessage = $"Ядро «{SelectedCoreEngine.DisplayName}» не установлено на этом ПК.\n\nПерейдите в менеджер ядер для автоматической загрузки и установки.";
                AlertActionText = "Скачать ядро →";
                HasAlert = true;
                LoggingService.Instance.LogApp($"Невозможно запустить подключение: ядро {SelectedCoreEngine.DisplayName} не установлено. Скачайте его во вкладке «Ядра».", "WARN");
                return;
            }

            await StartConnectionAsync();
        }
    }

    public async Task StartConnectionAsync()
    {
        if (IsConnecting || IsConnected) return;
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

        var success = await Task.Run(async () =>
        {
            return await VpnCoreService.Instance.StartAsync(SelectedServer, settings);
        });

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

            PingSelectedServer();
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
        Avalonia.Threading.Dispatcher.UIThread.Post(() =>
        {
            DownloadSpeed = stats.DownSpeedFormatted;
            UploadSpeed = stats.UpSpeedFormatted;
            TotalDownload = stats.TotalDownFormatted;
            TotalUpload = stats.TotalUpFormatted;
        });
    }
}
