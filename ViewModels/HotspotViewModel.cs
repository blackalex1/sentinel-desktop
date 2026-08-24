using System;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SentinelDesktop.Models;
using SentinelDesktop.Services;

namespace SentinelDesktop.ViewModels;

public partial class HotspotViewModel : ViewModelBase
{
    private static readonly Random _random = new();

    [ObservableProperty]
    private ObservableCollection<string> _candidateGateways = new();

    [ObservableProperty]
    private string _targetIp = "192.168.43.1";

    [ObservableProperty]
    private bool _isScanning;

    [ObservableProperty]
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
        LoadGateways();
    }

    private async void LoadGateways()
    {
        try
        {
            var list = await HotspotService.Instance.GetCandidateGatewaysAsync();
            CandidateGateways.Clear();
            foreach (var gw in list)
            {
                CandidateGateways.Add(gw);
            }
            if (list.Count > 0)
            {
                TargetIp = list[0];
            }

            // Automatic background fast probe on startup
            _ = Task.Run(async () =>
            {
                var autoResult = await HotspotService.Instance.ScanAllGatewaysAsync(list);
                if (autoResult.Found)
                {
                    Avalonia.Threading.Dispatcher.UIThread.Post(() =>
                    {
                        DiscoveryResult = autoResult;
                        TargetIp = autoResult.GatewayIP;
                        StatusMessage = $"🟢 Телефон автоматически обнаружен на {autoResult.GatewayIP}:{autoResult.PairingPort}";
                        StatusColor = "#34D399";
                    });
                }
            });
        }
        catch { }
    }

    [RelayCommand]
    public void SelectGateway(string ip)
    {
        TargetIp = ip;
        _ = ProbePhoneAsync();
    }

    [RelayCommand]
    public void GeneratePin()
    {
        CurrentPin = _random.Next(1000, 9999).ToString();
    }

    [RelayCommand]
    public async Task ProbePhoneAsync()
    {
        IsScanning = true;
        StatusMessage = "Сканирование всех сетевых шлюзов на наличие Sentinel Mobile...";
        StatusColor = "#38BDF8";

        try
        {
            HotspotDiscoveryResult res;

            if (!string.IsNullOrWhiteSpace(TargetIp))
            {
                res = await HotspotService.Instance.ProbePairingServerAsync(TargetIp);
                if (!res.Found)
                {
                    // If target IP probe fails, search all other gateways concurrently
                    var allGateways = CandidateGateways.ToList();
                    res = await HotspotService.Instance.ScanAllGatewaysAsync(allGateways);
                }
            }
            else
            {
                var allGateways = CandidateGateways.ToList();
                res = await HotspotService.Instance.ScanAllGatewaysAsync(allGateways);
            }

            DiscoveryResult = res;
            if (res.Found)
            {
                TargetIp = res.GatewayIP;
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

                StatusMessage = $"✅ Сопряжение успешно! Сервер \"{server.Name}\" активирован.";
                StatusColor = "#34D399";

                // Auto connect via VpnCoreService
                await VpnCoreService.Instance.StartAsync(server, vault.Settings);
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
