using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Threading;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SentinelDesktop.Models;
using SentinelDesktop.Services;

namespace SentinelDesktop.ViewModels;

public partial class LogsViewModel : ViewModelBase
{
    private readonly List<LogEntry> _allLogs = new(2048);
    private readonly ConcurrentQueue<LogEntry> _incomingQueue = new();
    private readonly DispatcherTimer _batchTimer;

    [ObservableProperty]
    private ObservableCollection<LogEntry> _displayLogs = new();

    [ObservableProperty]
    private string _searchQuery = string.Empty;

    [ObservableProperty]
    private string _selectedFilter = "ALL"; // ALL, CORE, APP, ERROR

    [ObservableProperty]
    private bool _autoScroll = true;

    [ObservableProperty]
    private string _statusMessage = string.Empty;

    [ObservableProperty]
    private bool _hasStatusMessage;

    public List<LogLevelOption> AvailableLogLevels => LogLevelsCatalog.AvailableLevels;

    [ObservableProperty]
    private LogLevelOption _selectedLogLevel;

    public int TotalCount => _allLogs.Count;
    public int DisplayCount => DisplayLogs.Count;

    public LogsViewModel()
    {
        var vault = StorageService.Load();
        _selectedLogLevel = LogLevelsCatalog.GetLevel(vault.Settings.LogLevel);

        _allLogs = LoggingService.Instance.GetAllLogs();
        ApplyFilter();

        LoggingService.Instance.OnLogAdded += entry =>
        {
            _incomingQueue.Enqueue(entry);
        };

        // 10 FPS Batch Dispatcher (100ms interval) to completely prevent UI freeze under high trace load
        _batchTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromMilliseconds(100)
        };
        _batchTimer.Tick += (s, e) => ProcessBatch();
        _batchTimer.Start();

        StorageService.LogLevelChanged += levelId =>
        {
            if (_selectedLogLevel?.Id != levelId)
            {
                _selectedLogLevel = LogLevelsCatalog.GetLevel(levelId);
                OnPropertyChanged(nameof(SelectedLogLevel));
            }
        };
    }

    private void ProcessBatch()
    {
        if (_incomingQueue.IsEmpty) return;

        var batch = new List<LogEntry>();
        while (_incomingQueue.TryDequeue(out var entry) && batch.Count < 300)
        {
            batch.Add(entry);
        }

        if (batch.Count == 0) return;

        _allLogs.AddRange(batch);
        if (_allLogs.Count > 2000)
        {
            _allLogs.RemoveRange(0, _allLogs.Count - 2000);
        }

        bool addedToDisplay = false;
        foreach (var entry in batch)
        {
            if (MatchesFilter(entry))
            {
                DisplayLogs.Add(entry);
                addedToDisplay = true;
            }
        }

        if (DisplayLogs.Count > 500)
        {
            var removeCount = DisplayLogs.Count - 500;
            for (int i = 0; i < removeCount; i++)
            {
                DisplayLogs.RemoveAt(0);
            }
        }

        if (addedToDisplay)
        {
            OnPropertyChanged(nameof(TotalCount));
            OnPropertyChanged(nameof(DisplayCount));
        }
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
            ShowStatus($"Уровень логов: {value.DisplayName}");
            LoggingService.Instance.LogApp($"Уровень детализации логов ядра переключен на '{value.DisplayName}' ({value.SingboxLevel})");

            // Hot reload core dynamically with new log level if VPN is currently active
            if (VpnCoreService.Instance.IsRunning)
            {
                _ = VpnCoreService.Instance.HotReloadLogLevelAsync(value.Id);
            }
        }
    }

    partial void OnSearchQueryChanged(string value)
    {
        ApplyFilter();
    }

    partial void OnSelectedFilterChanged(string value)
    {
        ApplyFilter();
    }

    [RelayCommand]
    public void SetFilter(string filter)
    {
        SelectedFilter = filter;
    }

    [RelayCommand]
    public void ClearLogs()
    {
        LoggingService.Instance.Clear();
        _allLogs.Clear();
        while (_incomingQueue.TryDequeue(out _)) { }
        DisplayLogs.Clear();
        OnPropertyChanged(nameof(TotalCount));
        OnPropertyChanged(nameof(DisplayCount));
        ShowStatus("Логи успешно очищены");
    }

    [RelayCommand]
    public async Task CopyLogsAsync()
    {
        try
        {
            if (Application.Current?.ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop &&
                desktop.MainWindow?.Clipboard != null)
            {
                var sb = new StringBuilder();
                foreach (var log in DisplayLogs)
                {
                    sb.AppendLine(log.FormattedLine);
                }
                await desktop.MainWindow.Clipboard.SetTextAsync(sb.ToString());
                ShowStatus($"Скопировано строк: {DisplayLogs.Count}");
            }
        }
        catch { }
    }

    [RelayCommand]
    public void OpenLogsFolder()
    {
        try
        {
            var logsDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");
            Directory.CreateDirectory(logsDir);
            Process.Start(new ProcessStartInfo
            {
                FileName = logsDir,
                UseShellExecute = true
            });
        }
        catch { }
    }

    private void ApplyFilter()
    {
        var filtered = _allLogs.Where(MatchesFilter).TakeLast(500).ToList();
        DisplayLogs = new ObservableCollection<LogEntry>(filtered);
        OnPropertyChanged(nameof(TotalCount));
        OnPropertyChanged(nameof(DisplayCount));
    }

    private bool MatchesFilter(LogEntry entry)
    {
        // 1. Source filter
        if (SelectedFilter == "CORE" && entry.Source != "CORE") return false;
        if (SelectedFilter == "APP" && entry.Source != "APP") return false;
        if (SelectedFilter == "ERROR" && entry.Level != "ERROR" && entry.Level != "WARN" && entry.Level != "FATAL") return false;

        // 2. Search query
        if (!string.IsNullOrWhiteSpace(SearchQuery))
        {
            var q = SearchQuery.Trim();
            return entry.Message.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                   entry.Level.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                   entry.Source.Contains(q, StringComparison.OrdinalIgnoreCase);
        }

        return true;
    }

    private void ShowStatus(string msg)
    {
        StatusMessage = msg;
        HasStatusMessage = true;
        Task.Delay(3000).ContinueWith(_ =>
        {
            Dispatcher.UIThread.Post(() => HasStatusMessage = false);
        });
    }
}
