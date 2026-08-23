using System;
using System.IO;
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
        bool createdNew = true;
        try
        {
            _mutex = new System.Threading.Mutex(true, appMutexName, out createdNew);
            if (!createdNew && !(StartupArgs.Length > 0 && StartupArgs[0] == "--auto-connect"))
            {
                // Another instance is already running
                return;
            }
        }
        catch (System.Threading.AbandonedMutexException)
        {
            createdNew = true;
        }
        catch { }

        AppDomain.CurrentDomain.UnhandledException += (s, e) =>
        {
            LogCrash("AppDomain.UnhandledException", e.ExceptionObject as Exception);
        };

        try
        {
            BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);
        }
        catch (Exception ex)
        {
            LogCrash("Main Catch", ex);
            throw;
        }
        finally
        {
            try { _mutex?.ReleaseMutex(); } catch { }
        }
    }

    public static void LogCrash(string context, Exception? ex)
    {
        try
        {
            var dir = Path.GetDirectoryName(CrashLogPath);
            if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
            var log = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] CRASH ({context}):\n{ex?.ToString()}\n\n";
            File.AppendAllText(CrashLogPath, log);
        }
        catch { }
    }

    public static AppBuilder BuildAvaloniaApp()
        => AppBuilder.Configure<App>()
            .UsePlatformDetect()
            .WithInterFont()
            .LogToTrace();
}
