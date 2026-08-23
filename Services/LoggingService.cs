using System;
using System.Collections.Generic;
using SentinelDesktop.Models;

namespace SentinelDesktop.Services;

public class LoggingService
{
    private static readonly Lazy<LoggingService> _lazy = new(() => new LoggingService());
    public static LoggingService Instance => _lazy.Value;

    private readonly object _lock = new();
    private readonly List<LogEntry> _logs = new(2048);

    public event Action<LogEntry>? OnLogAdded;

    private LoggingService()
    {
        LogApp("Служба логирования Sentinel Desktop инициализирована", "INFO");
    }

    public List<LogEntry> GetAllLogs()
    {
        lock (_lock)
        {
            return new List<LogEntry>(_logs);
        }
    }

    public void Clear()
    {
        lock (_lock)
        {
            _logs.Clear();
        }
        LogApp("Журнал логов очищен пользователем", "INFO");
    }

    public void LogApp(string message, string level = "INFO")
    {
        AddEntry(new LogEntry
        {
            Timestamp = DateTime.Now,
            Source = "APP",
            Level = level,
            Message = message
        });
    }

    public void LogCore(string message, bool isError = false)
    {
        var level = "INFO";
        if (message.Contains("WARN", StringComparison.OrdinalIgnoreCase))
        {
            level = "WARN";
        }
        else if (message.Contains("ERROR", StringComparison.OrdinalIgnoreCase) ||
                 message.Contains("FATAL", StringComparison.OrdinalIgnoreCase) ||
                 message.Contains("PANIC", StringComparison.OrdinalIgnoreCase))
        {
            level = "ERROR";
        }
        else if (message.Contains("DEBUG", StringComparison.OrdinalIgnoreCase) ||
                 message.Contains("TRACE", StringComparison.OrdinalIgnoreCase))
        {
            level = "DEBUG";
        }
        else if (message.Contains("INFO", StringComparison.OrdinalIgnoreCase))
        {
            level = "INFO";
        }
        else if (isError)
        {
            level = "WARN";
        }

        AddEntry(new LogEntry
        {
            Timestamp = DateTime.Now,
            Source = "CORE",
            Level = level,
            Message = message
        });
    }

    public void LogFfi(string message, string level = "INFO")
    {
        AddEntry(new LogEntry
        {
            Timestamp = DateTime.Now,
            Source = "APP",
            Level = level,
            Message = $"[SENTINEL-CORE] {message}"
        });
    }

    public void LogSentinelCore(string message, string level = "INFO")
    {
        LogFfi(message, level);
    }

    private void AddEntry(LogEntry entry)
    {
        lock (_lock)
        {
            _logs.Add(entry);
            if (_logs.Count > 2000)
            {
                _logs.RemoveRange(0, 200); // In-memory ring-buffer trimming
            }
        }

        OnLogAdded?.Invoke(entry);
    }
}
