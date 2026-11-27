using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SentinelDesktop.Models;
using SentinelDesktop.Services;

namespace SentinelDesktop.ViewModels;

public partial class HotspotViewModel : ViewModelBase
{
    private string? _lastAutoTargetIp = "192.168.43.1";
    private readonly HashSet<string> _knownAutoGateways = new(StringComparer.Ordinal);
    private CancellationTokenSource? _networkDebounceCts;
    private readonly object _debounceLock = new();

    [ObservableProperty]
    private ObservableCollection<string> _candidateGateways = new();

    [ObservableProperty]
    private string _targetIp = "192.168.43.1";

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(DiscoveryStatusText))]
    private bool _isScanning;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(DiscoveryStatusText))]
    private bool _isPairing;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsPhoneFound))]
    [NotifyPropertyChangedFor(nameof(DiscoveryStatusText))]
    [NotifyPropertyChangedFor(nameof(DiscoveryStatusColor))]
    private HotspotDiscoveryResult? _discoveryResult;

    [ObservableProperty]
    private string _currentPin = "8167";

    [ObservableProperty]
    private string _statusMessage = string.Empty;

    [ObservableProperty]
    private string _statusColor = "#38BDF8";

    public bool IsPhoneFound => DiscoveryResult?.Found == true;

    public string DiscoveryStatusText
    {
        get
        {
            if (IsPairing) return "Ожидание подтверждения PIN на телефоне...";
            if (IsScanning) return "Сканирование портов телефона...";
            if (DiscoveryResult?.Found == true) return $"🟢 Телефон обнаружен на {DiscoveryResult.GatewayIP}:{DiscoveryResult.PairingPort}";
            if (DiscoveryResult != null) return $"❌ {DiscoveryResult.ErrorMessage}";
            return "Готов к поиску устройства в сети Wi-Fi";
        }
    }

    public string DiscoveryStatusColor => DiscoveryResult?.Found == true ? "#34D399" : (DiscoveryResult != null ? "#F87171" : "#94A3B8");

    public HotspotViewModel()
    {
        GeneratePin();
        SubscribeToNetworkChanges();
        _ = RefreshGatewaysAndProbeAsync(autoProbe: true);
    }

    private void SubscribeToNetworkChanges()
    {
        try
        {
            NetworkChange.NetworkAddressChanged += OnNetworkChanged;
            NetworkChange.NetworkAvailabilityChanged += OnNetworkAvailabilityChanged;
        }
        catch { }
    }

    private void OnNetworkChanged(object? sender, EventArgs e)
    {
        ScheduleNetworkRefresh();
    }

    private void OnNetworkAvailabilityChanged(object? sender, NetworkAvailabilityEventArgs e)
    {
        ScheduleNetworkRefresh();
    }

    private void ScheduleNetworkRefresh()
    {
        CancellationTokenSource cts;
        lock (_debounceLock)
        {
            _networkDebounceCts?.Cancel();
            _networkDebounceCts?.Dispose();
            _networkDebounceCts = new CancellationTokenSource();
            cts = _networkDebounceCts;
        }

        _ = Task.Run(async () =>
        {
            try
            {
                // Debounce bursts of Windows network events while DHCP/gateway settles
                await Task.Delay(600, cts.Token);
                if (!IsScanning && !IsPairing)
                {
                    await RefreshGatewaysAndProbeAsync(autoProbe: true, cts.Token);
                }
            }
            catch (OperationCanceledException) { }
            catch { }
        });
    }

    public void RefreshOnActivated()
    {
        if (IsScanning || IsPairing) return;
        _ = RefreshGatewaysAndProbeAsync(autoProbe: true);
    }

    private async Task<List<string>> RefreshGatewaysInternalAsync()
    {
        var list = await HotspotService.Instance.GetCandidateGatewaysAsync();

        await Avalonia.Threading.Dispatcher.UIThread.InvokeAsync(() =>
        {
            CandidateGateways.Clear();
            foreach (var gw in list)
            {
                CandidateGateways.Add(gw);
                _knownAutoGateways.Add(gw);
            }

            var currentTarget = TargetIp?.Trim();
            bool targetWasAuto = string.IsNullOrWhiteSpace(currentTarget) ||
                                 string.Equals(currentTarget, _lastAutoTargetIp, StringComparison.Ordinal);
            bool targetDisappearedAutoGateway = !string.IsNullOrEmpty(currentTarget) &&
                                                _knownAutoGateways.Contains(currentTarget) &&
                                                !list.Contains(currentTarget);

            if ((targetWasAuto || targetDisappearedAutoGateway) && list.Count > 0)
            {
                if (!string.Equals(currentTarget, list[0], StringComparison.Ordinal))
                {
                    TargetIp = list[0];
                }
                _lastAutoTargetIp = list[0];
            }

            if (DiscoveryResult?.Found == true &&
                !string.IsNullOrEmpty(DiscoveryResult.GatewayIP) &&
                !list.Contains(DiscoveryResult.GatewayIP) &&
                (targetWasAuto || targetDisappearedAutoGateway))
            {
                DiscoveryResult = null;
                StatusMessage = string.Empty;
            }
        });

        return list;
    }

    private async Task RefreshGatewaysAndProbeAsync(bool autoProbe, CancellationToken cancellationToken = default)
    {
        try
        {
            var list = await RefreshGatewaysInternalAsync();
            if (!autoProbe || cancellationToken.IsCancellationRequested || IsScanning || IsPairing)
                return;

            var autoResult = await HotspotService.Instance.ScanAllGatewaysAsync(list, cancellationToken);
            if (autoResult.Found && !cancellationToken.IsCancellationRequested)
            {
                Avalonia.Threading.Dispatcher.UIThread.Post(() =>
                {
                    if (IsScanning || IsPairing) return;
                    DiscoveryResult = autoResult;
                    TargetIp = autoResult.GatewayIP;
                    _lastAutoTargetIp = autoResult.GatewayIP;
                    _knownAutoGateways.Add(autoResult.GatewayIP);
                    StatusMessage = $"🟢 Телефон автоматически обнаружен на {autoResult.GatewayIP}:{autoResult.PairingPort}";
                    StatusColor = "#34D399";
                });
            }
        }
        catch { }
    }

    [RelayCommand]
    public void SelectGateway(string ip)
    {
        TargetIp = ip;
        _lastAutoTargetIp = null;
        _ = ProbePhoneAsync();
    }

    [RelayCommand]
    public void GeneratePin()
    {
        CurrentPin = RandomNumberGenerator.GetInt32(1000, 10000).ToString();
    }

    [RelayCommand]
    public async Task ProbePhoneAsync()
    {
        if (IsScanning) return;

        IsScanning = true;
        StatusMessage = "Сканирование всех сетевых шлюзов на наличие Sentinel Mobile...";
        StatusColor = "#38BDF8";

        try
        {
            var freshGateways = await RefreshGatewaysInternalAsync();

            var targets = new List<string>();
            var typedIp = TargetIp?.Trim();
            if (!string.IsNullOrWhiteSpace(typedIp) &&
                IPAddress.TryParse(typedIp, out var parsedIp) &&
                parsedIp.AddressFamily == AddressFamily.InterNetwork)
            {
                targets.Add(typedIp);
            }

            foreach (var gw in freshGateways)
            {
                if (!targets.Contains(gw))
                {
                    targets.Add(gw);
                }
            }

            var res = await HotspotService.Instance.ScanAllGatewaysAsync(targets);

            DiscoveryResult = res;
            if (res.Found)
            {
                TargetIp = res.GatewayIP;
                _lastAutoTargetIp = res.GatewayIP;
                _knownAutoGateways.Add(res.GatewayIP);
                StatusMessage = $"🟢 Телефон обнаружен на {res.GatewayIP} (порт {res.PairingPort})";
                StatusColor = "#34D399";
            }
            else
            {
                StatusMessage = res.ErrorMessage ?? "Телефон с раздачей Sentinel не найден. Убедитесь, что раздача включена на телефоне.";
                StatusColor = "#F87171";
            }
        }
        catch (Exception ex)
        {
            StatusMessage = $"Ошибка поиска: {ex.Message}";
            StatusColor = "#F87171";
        }
        finally
        {
            IsScanning = false;
        }
    }

    [RelayCommand]
    public async Task RequestPairingAndConnectAsync()
    {
        if (string.IsNullOrWhiteSpace(TargetIp))
        {
            StatusMessage = "Укажите IP-адрес телефона";
            StatusColor = "#F87171";
            return;
        }

        IsPairing = true;
        StatusMessage = $"Запрос сопряжения с PIN [{CurrentPin}]. Подтвердите на телефоне...";
        StatusColor = "#C084FC";

        try
        {
            var port = DiscoveryResult?.Found == true ? DiscoveryResult.PairingPort : 18080;
            var (success, server, error) = await HotspotService.Instance.RequestPairingAsync(TargetIp, port, CurrentPin);

            if (success && server != null)
            {
                var vault = StorageService.Load();
                vault.Servers.RemoveAll(s => s.Address == server.Address && s.Port == server.Port);
                vault.Servers.Insert(0, server);
                vault.SelectedServerId = server.Id;
                StorageService.Save(vault);
                StorageService.NotifyServersChanged();

                StatusMessage = $"✅ Сопряжение выполнено! Узел \"{server.Name}\" сохранен и выбран. Запустите защиту на главном экране.";
                StatusColor = "#34D399";
            }
            else
            {
                StatusMessage = error ?? "Сопряжение отклонено на телефоне";
                StatusColor = "#F87171";
            }
        }
        catch (Exception ex)
        {
            StatusMessage = $"Сбой сопряжения: {ex.Message}";
            StatusColor = "#F87171";
        }
        finally
        {
            IsPairing = false;
        }
    }

    [RelayCommand]
    public void OpenMobileGithub()
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "https://github.com/blackalex1/sentinel-mobile",
                UseShellExecute = true
            });
        }
        catch { }
    }
}
