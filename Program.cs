using System;
using System.IO;
using System.Threading.Tasks;
using Avalonia;

namespace SentinelDesktop;

sealed class Program
{
    public static string[] StartupArgs { get; private set; } = Array.Empty<string>();

    private static readonly string CrashLogPath = Path.Combine(
        AppDomain.CurrentDomain.BaseDirectory,
        "logs",
        "crash_log.txt"
    );

    private static System.Threading.Mutex? _mutex;

    [STAThread]
    public static void Main(string[] args)
    {
        StartupArgs = args ?? Array.Empty<string>();

        const string appMutexName = "Local\\SentinelDesktop_SingleInstance_Mutex";
        bool isAutoConnect = StartupArgs != null && Array.Exists(StartupArgs, a => a == "--auto-connect");
        bool createdNew = true;
        try
        {
            _mutex = new System.Threading.Mutex(true, appMutexName, out createdNew);
            if (!createdNew)
            {
                if (isAutoConnect)
                {
                    try { createdNew = _mutex.WaitOne(2000, false); } catch { createdNew = true; }
                }
                else
                {
                    // Another instance is already running
                    return;
                }
            }
        }
        catch (System.Threading.AbandonedMutexException)
        {
            createdNew = true;
        }
        catch { }

        AppDomain.CurrentDomain.UnhandledException += (s, e) =>
        {
            try { Services.WindowsSystemProxyService.DisableSystemProxy(); } catch { }
            LogCrash("AppDomain.UnhandledException", e.ExceptionObject as Exception);
        };

        TaskScheduler.UnobservedTaskException += (s, e) =>
        {
            LogCrash("TaskScheduler.UnobservedTaskException", e.Exception);
            e.SetObserved();
        };

        try
        {
            BuildAvaloniaApp().StartWithClassicDesktopLifetime(args ?? Array.Empty<string>());
        }
        catch (Exception ex)
        {
            try { Services.WindowsSystemProxyService.DisableSystemProxy(); } catch { }
            LogCrash("Main Catch", ex);
            throw;
        }
        finally
        {
            try { _mutex?.ReleaseMutex(); } catch { }
            try { _mutex?.Dispose(); } catch { }
            _mutex = null;
        }
    }

    public static void LogCrash(string context, Exception? ex)
    {
        var log = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] CRASH ({context}):\n{ex?.ToString()}\n\n";

        // 1. App local logs folder
        try
        {
            var dir = Path.GetDirectoryName(CrashLogPath);
            if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
            File.AppendAllText(CrashLogPath, log);
        }
        catch { }

        // 2. AppData roaming folder
        try
        {
            var appDataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "SentinelDesktop", "logs");
            Directory.CreateDirectory(appDataDir);
            File.AppendAllText(Path.Combine(appDataDir, "crash_log.txt"), log);
        }
        catch { }

        // 3. Temp folder fallback
        try
        {
            var tempPath = Path.Combine(Path.GetTempPath(), "SentinelDesktop_crash_log.txt");
            File.AppendAllText(tempPath, log);
        }
        catch { }
    }

    public static AppBuilder BuildAvaloniaApp()
        => AppBuilder.Configure<App>()
            .UsePlatformDetect()
            .WithInterFont()
            .LogToTrace();
}
