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
    private bool _isEditOpen;

    [ObservableProperty]
    private ServerProfile? _editingServer;

    [ObservableProperty]
    private ServerProfile? _targetOriginalServer;

    [ObservableProperty]
    private string _generatedUriPreview = string.Empty;

    public string[] AvailableProtocols { get; } = ["vless", "trojan", "hysteria2", "shadowsocks", "vmess", "tuic"];
    public string[] AvailableSecurities { get; } = ["reality", "tls", "none"];
    public string[] AvailableFingerprints { get; } = ["chrome", "firefox", "safari", "ios", "edge", "randomized"];
    public string[] AvailableTransports { get; } = ["tcp", "ws", "grpc", "http", "quic"];

    [ObservableProperty]
    private string _statusMessage = string.Empty;

    [ObservableProperty]
    private bool _hasStatusMessage;

    [ObservableProperty]
    private bool _isCoreMissing;

    public event Action? RequestNavigateToCores;

    [RelayCommand]
    public void GoToCoreManager() => RequestNavigateToCores?.Invoke();

    public int TotalServersCount => Servers.Count;

    public ServersViewModel()
    {
        CheckCoreStatus();
        LoadServers();
        StorageService.ServersChanged += () =>
        {
            Avalonia.Threading.Dispatcher.UIThread.Post(LoadServers);
        };
        CoreUpdateService.Instance.CoreInstalled += _ =>
        {
            Avalonia.Threading.Dispatcher.UIThread.Post(CheckCoreStatus);
        };
    }

    public void CheckCoreStatus()
    {
        IsCoreMissing = !SentinelCoreNative.IsAvailable();
    }

    public void LoadServers()
    {
        var vault = StorageService.Load();
        Servers.Clear();
        bool needsSave = false;
        foreach (var s in vault.Servers)
        {
            if (string.IsNullOrEmpty(s.Country) || s.Country == "AUTO")
            {
                var inferred = ServerProfile.InferCountry(s.Name, s.Address, s.Sni, s.Host);
                if (inferred != "AUTO" && inferred != s.Country)
                {
                    s.Country = inferred;
                    needsSave = true;
                }
            }
            s.IsSelected = (s.Id == vault.SelectedServerId);
            Servers.Add(s);
        }

        if (needsSave)
        {
            StorageService.Save(vault, notifyServers: false);
        }

        if (Servers.Count > 0)
        {
            SelectedServer = Servers.FirstOrDefault(x => x.Id == vault.SelectedServerId) ?? Servers[0];
            if (SelectedServer != null) SelectedServer.IsSelected = true;
        }
        else
        {
            SelectedServer = null;
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
                var p = SentinelCoreNative.TestPing(s.Address, s.Port, 2000);
                Avalonia.Threading.Dispatcher.UIThread.Post(() => s.Ping = p);
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
            var p = SentinelCoreNative.TestPing(server.Address, server.Port, 2000);
            Avalonia.Threading.Dispatcher.UIThread.Post(() => server.Ping = p);
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
    public void OpenEditDialog(ServerProfile server)
    {
        TargetOriginalServer = server;
        EditingServer = server.Clone();
        UpdateUriPreview();
        IsEditOpen = true;
        IsImportOpen = false;
    }

    [RelayCommand]
    public void CloseEditDialog()
    {
        IsEditOpen = false;
        EditingServer = null;
        TargetOriginalServer = null;
    }

    [RelayCommand]
    public void UpdateUriPreview()
    {
        if (EditingServer != null)
        {
            GeneratedUriPreview = SentinelCoreNative.GenerateUri(EditingServer);
        }
    }

    [RelayCommand]
    public async Task CopyGeneratedUriAsync()
    {
        if (string.IsNullOrEmpty(GeneratedUriPreview)) return;
        try
        {
            if (Application.Current?.ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop &&
                desktop.MainWindow?.Clipboard != null)
            {
                await desktop.MainWindow.Clipboard.SetTextAsync(GeneratedUriPreview);
                ShowStatus("Ссылка конфигурации скопирована в буфер обмена");
            }
        }
        catch { }
    }

    [RelayCommand]
    public void SaveEditedServer()
    {
        if (EditingServer == null || TargetOriginalServer == null) return;

        if (string.IsNullOrWhiteSpace(EditingServer.Address))
        {
            ShowStatus("⚠️ Ошибка: укажите хост или IP-адрес сервера");
            return;
        }

        if (EditingServer.Port <= 0 || EditingServer.Port > 65535)
        {
            ShowStatus("⚠️ Ошибка: порт должен быть от 1 до 65535");
            return;
        }

        TargetOriginalServer.CopyFrom(EditingServer);

        if (SelectedServer?.Id == TargetOriginalServer.Id)
        {
            SelectedServer.CopyFrom(EditingServer);
        }

        SaveVault();
        IsEditOpen = false;
        ShowStatus($"Подключение «{TargetOriginalServer.Name}» успешно сохранено");

        // Test ping with updated parameters
        _ = PingSingleAsync(TargetOriginalServer);
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

        if (!SentinelCoreNative.IsAvailable())
        {
            ShowStatus("⚠️ Нативное ядро Sentinel FFI Engine (sentinel-core.dll) не найдено. Скачайте его во вкладке «Ядра».");
            LoggingService.Instance.LogApp("Попытка импорта ссылки без загруженного ядра sentinel-core.dll", "WARN");
            return;
        }

        var lines = ImportUriText.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
        int addedCount = 0;
        string lastError = string.Empty;

        foreach (var line in lines)
        {
            var trimmed = line.Trim();
            if (string.IsNullOrEmpty(trimmed) || !trimmed.Contains("://")) continue;

            // Core Parsing via Native FFI Engine
            var parsedJson = SentinelCoreNative.ParseUri(trimmed);
            if (!string.IsNullOrEmpty(parsedJson))
            {
                if (parsedJson.Contains("DLL_NOT_FOUND"))
                {
                    ShowStatus("⚠️ Нативное ядро sentinel-core.dll не установлено. Скачайте его во вкладке «Ядра».");
                    return;
                }

                if (parsedJson.StartsWith("{\"error\""))
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(parsedJson);
                        if (doc.RootElement.TryGetProperty("error", out var errProp))
                        {
                            lastError = errProp.GetString() ?? "Ошибка парсинга";
                        }
                    }
                    catch
                    {
                        lastError = "Неверный формат ссылки";
                    }
                    continue;
                }

                try
                {
                    var srv = JsonSerializer.Deserialize<ServerProfile>(parsedJson);
                    if (srv != null && !string.IsNullOrEmpty(srv.Address))
                    {
                        srv.Id = "srv-" + Guid.NewGuid().ToString("N");
                        
                        // Infer country from name, address, SNI or host
                        if (string.IsNullOrEmpty(srv.Country) || srv.Country == "AUTO")
                        {
                            srv.Country = ServerProfile.InferCountry(srv.Name, srv.Address, srv.Sni, srv.Host);
                        }

                        Servers.Add(srv);
                        addedCount++;
                    }
                }
                catch (Exception ex)
                {
                    lastError = ex.Message;
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
            ShowStatus(!string.IsNullOrEmpty(lastError) 
                ? $"⚠️ {lastError}" 
                : "⚠️ Ошибка парсинга ядра: не удалось распознать ссылку (vless, vmess, trojan, ss, hy2)");
        }
    }

    private void SaveVault(bool notify = true)
    {
        var vault = StorageService.Load();
        vault.Servers = Servers.ToList();
        vault.SelectedServerId = SelectedServer?.Id;
        StorageService.Save(vault, notifyServers: notify);
    }

    private void ShowStatus(string msg)
    {
        StatusMessage = msg;
        HasStatusMessage = true;
        Task.Delay(4000).ContinueWith(_ =>
        {
            Avalonia.Threading.Dispatcher.UIThread.Post(() =>
            {
                if (StatusMessage == msg)
                {
                    HasStatusMessage = false;
                    StatusMessage = string.Empty;
                }
            });
        });
    }
}
