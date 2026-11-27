using System;
using System.Collections.Generic;
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

    private bool _isSyncingEditorFields;

    [ObservableProperty]
    private List<SchemaSelectOption> _availableProtocols = new();

    [ObservableProperty]
    private List<SchemaSelectOption> _availableSecurities = new();

    [ObservableProperty]
    private List<SchemaSelectOption> _availableFingerprints = new();

    [ObservableProperty]
    private List<SchemaSelectOption> _availableTransports = new();

    [ObservableProperty]
    private List<SchemaSelectOption> _availableFlows = new();

    [ObservableProperty]
    private List<SchemaSelectOption> _availableXhttpModes = new();

    [ObservableProperty]
    private List<SchemaSelectOption> _availableHeaderTypes = new();

    [ObservableProperty]
    private string? _editingProtocol;

    [ObservableProperty]
    private string? _editingTransport;

    [ObservableProperty]
    private string? _editingSecurity;

    [ObservableProperty]
    private string? _editingFp;

    [ObservableProperty]
    private string? _editingFlow;

    [ObservableProperty]
    private string? _editingXhttpMode;

    [ObservableProperty]
    private string? _editingHeaderType;

    [ObservableProperty]
    private bool _showFlowField;

    [ObservableProperty]
    private bool _showXhttpModeField;

    [ObservableProperty]
    private bool _showHeaderTypeField;

    [ObservableProperty]
    private bool _showFingerprintField = true;

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
        RefreshSchemaOptions(preserveCurrentValues: true);
        LoadServers();
        StorageService.ServersChanged += () =>
        {
            Avalonia.Threading.Dispatcher.UIThread.Post(LoadServers);
        };
        CoreUpdateService.Instance.CoreInstalled += _ =>
        {
            Avalonia.Threading.Dispatcher.UIThread.Post(() =>
            {
                CheckCoreStatus();
                SentinelCoreNative.InvalidateSchemaCache();
                RefreshSchemaOptions(preserveCurrentValues: true);
            });
        };
        StorageService.CoreTypeChanged += _ =>
        {
            Avalonia.Threading.Dispatcher.UIThread.Post(() => RefreshSchemaOptions(preserveCurrentValues: true));
        };
    }

    private void RefreshSchemaOptions(bool preserveCurrentValues)
    {
        var proto = EditingServer?.Protocol ?? EditingProtocol ?? "vless";
        var opts = CoreSchemaService.GetProfileEditorOptions(
            proto,
            preserveCurrentValues ? EditingTransport : null,
            preserveCurrentValues ? EditingSecurity : null,
            preserveCurrentValues ? EditingFp : null,
            preserveCurrentValues ? EditingFlow : null,
            preserveCurrentValues ? EditingXhttpMode : null,
            preserveCurrentValues ? EditingHeaderType : null);

        AvailableProtocols = opts.Protocols;
        AvailableTransports = opts.Transports;
        AvailableSecurities = opts.Securities;
        AvailableFingerprints = opts.Fingerprints;
        AvailableFlows = opts.Flows;
        AvailableXhttpModes = opts.XhttpModes;
        AvailableHeaderTypes = opts.HeaderTypes;

        ShowFlowField = opts.ShowFlow;
        ShowXhttpModeField = opts.ShowXhttpMode;
        ShowHeaderTypeField = opts.ShowHeaderType;
        ShowFingerprintField = opts.ShowFingerprint;

        if (EditingServer != null)
        {
            _isSyncingEditorFields = true;
            try
            {
                EditingProtocol = ResolveOptionValue(AvailableProtocols, EditingProtocol, proto);
                EditingTransport = ResolveOptionValue(AvailableTransports, EditingTransport, opts.DefaultTransport ?? "tcp");
                EditingSecurity = ResolveOptionValue(AvailableSecurities, EditingSecurity, opts.DefaultSecurity ?? "none");
                EditingFp = ResolveOptionValue(AvailableFingerprints, EditingFp, opts.DefaultFingerprint ?? "chrome");
                EditingFlow = opts.ShowFlow
                    ? ResolveOptionValue(AvailableFlows, EditingFlow, opts.DefaultFlow ?? string.Empty)
                    : string.Empty;
                EditingXhttpMode = opts.ShowXhttpMode
                    ? ResolveOptionValue(AvailableXhttpModes, EditingXhttpMode, opts.DefaultXhttpMode ?? "auto")
                    : string.Empty;
                EditingHeaderType = opts.ShowHeaderType
                    ? ResolveOptionValue(AvailableHeaderTypes, EditingHeaderType, opts.DefaultHeaderType ?? string.Empty)
                    : string.Empty;

                EditingServer.Protocol = EditingProtocol ?? proto;
                EditingServer.Transport = EditingTransport ?? "tcp";
                EditingServer.Security = EditingSecurity ?? "none";
                EditingServer.Fp = EditingFp ?? "chrome";
                EditingServer.Flow = EditingFlow ?? string.Empty;
                EditingServer.XhttpMode = EditingXhttpMode ?? string.Empty;
                EditingServer.HeaderType = EditingHeaderType ?? string.Empty;
            }
            finally
            {
                _isSyncingEditorFields = false;
            }
        }
    }

    private static string ResolveOptionValue(List<SchemaSelectOption> options, string? desired, string fallback)
    {
        if (desired != null)
        {
            var match = options.FirstOrDefault(o => o.Value.Equals(desired, StringComparison.OrdinalIgnoreCase));
            if (match != null) return match.Value;
        }
        return options.FirstOrDefault(o => o.Value.Equals(fallback, StringComparison.OrdinalIgnoreCase))?.Value
            ?? options.FirstOrDefault()?.Value
            ?? fallback;
    }

    partial void OnEditingProtocolChanged(string? value)
    {
        if (_isSyncingEditorFields || EditingServer == null || string.IsNullOrWhiteSpace(value)) return;
        EditingServer.Protocol = value;
        RefreshSchemaOptions(preserveCurrentValues: false);
        UpdateUriPreview();
    }

    partial void OnEditingTransportChanged(string? value)
    {
        if (_isSyncingEditorFields || EditingServer == null || value == null) return;
        EditingServer.Transport = value;
        if ((value.Equals("ws", StringComparison.OrdinalIgnoreCase) ||
             value.Equals("httpupgrade", StringComparison.OrdinalIgnoreCase) ||
             value.Equals("h2", StringComparison.OrdinalIgnoreCase) ||
             value.Equals("http", StringComparison.OrdinalIgnoreCase)) &&
            string.Equals(EditingSecurity, "reality", StringComparison.OrdinalIgnoreCase))
        {
            _isSyncingEditorFields = true;
            EditingSecurity = "tls";
            EditingServer.Security = "tls";
            _isSyncingEditorFields = false;
        }
        RefreshSchemaOptions(preserveCurrentValues: true);
        UpdateUriPreview();
    }

    partial void OnEditingSecurityChanged(string? value)
    {
        if (_isSyncingEditorFields || EditingServer == null || value == null) return;
        EditingServer.Security = value;
        RefreshSchemaOptions(preserveCurrentValues: true);
        UpdateUriPreview();
    }

    partial void OnEditingFpChanged(string? value)
    {
        if (_isSyncingEditorFields || EditingServer == null || value == null) return;
        EditingServer.Fp = value;
        UpdateUriPreview();
    }

    partial void OnEditingFlowChanged(string? value)
    {
        if (_isSyncingEditorFields || EditingServer == null || value == null) return;
        EditingServer.Flow = value;
        UpdateUriPreview();
    }

    partial void OnEditingXhttpModeChanged(string? value)
    {
        if (_isSyncingEditorFields || EditingServer == null || value == null) return;
        EditingServer.XhttpMode = value;
        UpdateUriPreview();
    }

    partial void OnEditingHeaderTypeChanged(string? value)
    {
        if (_isSyncingEditorFields || EditingServer == null || value == null) return;
        EditingServer.HeaderType = value;
        UpdateUriPreview();
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

        _isSyncingEditorFields = true;
        try
        {
            _editingProtocol = EditingServer.Protocol;
            _editingTransport = EditingServer.Transport;
            _editingSecurity = EditingServer.Security;
            _editingFp = EditingServer.Fp;
            _editingFlow = EditingServer.Flow ?? string.Empty;
            _editingXhttpMode = EditingServer.XhttpMode ?? "auto";
            _editingHeaderType = EditingServer.HeaderType ?? string.Empty;
        }
        finally
        {
            _isSyncingEditorFields = false;
        }

        RefreshSchemaOptions(preserveCurrentValues: true);
        OnPropertyChanged(nameof(EditingProtocol));
        OnPropertyChanged(nameof(EditingTransport));
        OnPropertyChanged(nameof(EditingSecurity));
        OnPropertyChanged(nameof(EditingFp));
        OnPropertyChanged(nameof(EditingFlow));
        OnPropertyChanged(nameof(EditingXhttpMode));
        OnPropertyChanged(nameof(EditingHeaderType));

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
