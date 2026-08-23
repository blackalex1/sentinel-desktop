using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SentinelDesktop.Models;
using SentinelDesktop.Services;

namespace SentinelDesktop.ViewModels;

public partial class ServersViewModel : ViewModelBase
{
    [ObservableProperty]
    private ObservableCollection<ServerProfile> _servers = new();

    [ObservableProperty]
    private ServerProfile? _selectedServer;

    [ObservableProperty]
    private bool _isPinging;

    [ObservableProperty]
    private bool _isImportOpen;

    [ObservableProperty]
    private string _importUriText = string.Empty;

    [ObservableProperty]
    private string _statusMessage = string.Empty;

    [ObservableProperty]
    private bool _hasStatusMessage;

    public int TotalServersCount => Servers.Count;

    public ServersViewModel()
    {
        LoadServers();
    }

    public void LoadServers()
    {
        var vault = StorageService.Load();
        Servers.Clear();
        foreach (var s in vault.Servers)
        {
            s.IsSelected = (s.Id == vault.SelectedServerId);
            Servers.Add(s);
        }

        if (Servers.Count > 0)
        {
            SelectedServer = Servers.FirstOrDefault(x => x.Id == vault.SelectedServerId) ?? Servers[0];
            if (SelectedServer != null) SelectedServer.IsSelected = true;
        }

        OnPropertyChanged(nameof(TotalServersCount));
    }

    [RelayCommand]
    public void SelectServer(ServerProfile server)
    {
        foreach (var s in Servers)
        {
            s.IsSelected = (s.Id == server.Id);
        }
        SelectedServer = server;

        var copy = Servers.ToList();
        Servers.Clear();
        foreach (var c in copy) Servers.Add(c);

        SaveVault();
        ShowStatus($"Выбран активный узел: {server.Name}");
    }

    [RelayCommand]
    public async Task PingAllAsync()
    {
        if (IsPinging || Servers.Count == 0) return;
        IsPinging = true;
        ShowStatus("Тестирование пинга через sentinel-core...");

        var list = Servers.ToList();
        await Task.Run(() =>
        {
            Parallel.ForEach(list, s =>
            {
                s.Ping = SentinelCoreNative.TestPing(s.Address, s.Port, 2000);
            });
        });

        SaveVault();
        IsPinging = false;
        ShowStatus("Тест задержки всех узлов завершен");
    }

    [RelayCommand]
    public async Task PingSingleAsync(ServerProfile server)
    {
        ShowStatus($"Пинг узла {server.Address}:{server.Port}...");
        await Task.Run(() =>
        {
            server.Ping = SentinelCoreNative.TestPing(server.Address, server.Port, 2000);
        });

        SaveVault();
        ShowStatus($"Пинг узла {server.Name}: {server.PingDisplay}");
    }

    [RelayCommand]
    public void DeleteServer(ServerProfile server)
    {
        Servers.Remove(server);
        if (SelectedServer?.Id == server.Id)
        {
            SelectedServer = Servers.FirstOrDefault();
            if (SelectedServer != null) SelectedServer.IsSelected = true;
        }
        SaveVault();
        OnPropertyChanged(nameof(TotalServersCount));
        ShowStatus($"Узел удален: {server.Name}");
    }

    [RelayCommand]
    public void OpenImportDialog()
    {
        ImportUriText = string.Empty;
        IsImportOpen = true;
    }

    [RelayCommand]
    public void CloseImportDialog()
    {
        ImportUriText = string.Empty;
        IsImportOpen = false;
    }

    [RelayCommand]
    public async Task PasteFromClipboardAsync()
    {
        try
        {
            if (Application.Current?.ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop &&
                desktop.MainWindow?.Clipboard != null)
            {
                var text = await desktop.MainWindow.Clipboard.GetTextAsync();
                if (!string.IsNullOrEmpty(text))
                {
                    ImportUriText = text;
                    ShowStatus("Ссылка вставлена из буфера обмена");
                }
            }
        }
        catch { }
    }

    [RelayCommand]
    public void ImportUri()
    {
        if (string.IsNullOrWhiteSpace(ImportUriText))
        {
            ShowStatus("Вставьте ссылку формата vless://, vmess://, trojan://, ss://, hysteria2://");
            return;
        }

        var lines = ImportUriText.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
        int addedCount = 0;

        foreach (var line in lines)
        {
            var trimmed = line.Trim();
            if (string.IsNullOrEmpty(trimmed) || !trimmed.Contains("://")) continue;

            // Core Parsing via FFI
            var parsedJson = SentinelCoreNative.ParseUri(trimmed);
            if (!string.IsNullOrEmpty(parsedJson) && !parsedJson.StartsWith("{\"error\""))
            {
                try
                {
                    var srv = JsonSerializer.Deserialize<ServerProfile>(parsedJson);
                    if (srv != null && !string.IsNullOrEmpty(srv.Address))
                    {
                        srv.Id = "srv-" + Guid.NewGuid().ToString("N");
                        
                        // Infer country from name or address
                        if (string.IsNullOrEmpty(srv.Country) || srv.Country == "AUTO")
                        {
                            var upper = srv.Name.ToUpperInvariant();
                            if (upper.Contains("DE") || upper.Contains("GERMAN")) srv.Country = "DE";
                            else if (upper.Contains("NL") || upper.Contains("NETHERLAND")) srv.Country = "NL";
                            else if (upper.Contains("US") || upper.Contains("USA")) srv.Country = "US";
                            else if (upper.Contains("FI") || upper.Contains("FIN")) srv.Country = "FI";
                            else if (upper.Contains("RU") || upper.Contains("RUSS")) srv.Country = "RU";
                            else srv.Country = "AUTO";
                        }

                        Servers.Add(srv);
                        addedCount++;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[ImportUri] JSON error: {ex.Message}");
                }
            }
        }

        if (addedCount > 0)
        {
            SaveVault();
            OnPropertyChanged(nameof(TotalServersCount));
            IsImportOpen = false;
            ImportUriText = string.Empty;
            ShowStatus($"Ядро успешно импортировало узлов: {addedCount}");

            // Auto ping newly added nodes in background
            _ = PingAllAsync();
        }
        else
        {
            ShowStatus("Ошибка парсинга ядра: не удалось распознать ссылку");
        }
    }

    private void SaveVault()
    {
        var vault = StorageService.Load();
        vault.Servers = Servers.ToList();
        vault.SelectedServerId = SelectedServer?.Id;
        StorageService.Save(vault);
    }

    private void ShowStatus(string msg)
    {
        StatusMessage = msg;
        HasStatusMessage = true;
        Task.Delay(4000).ContinueWith(_ =>
        {
            if (StatusMessage == msg)
            {
                HasStatusMessage = false;
                StatusMessage = string.Empty;
            }
        });
    }
}
