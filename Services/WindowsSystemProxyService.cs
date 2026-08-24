using System;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace SentinelDesktop.Services;

public static class WindowsSystemProxyService
{
    [DllImport("wininet.dll", SetLastError = true)]
    private static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);

    private const int INTERNET_OPTION_SETTINGS_CHANGED = 39;
    private const int INTERNET_OPTION_REFRESH = 37;

    public static void SetSystemProxy(string server = "127.0.0.1:10809", bool enabled = true)
    {
        if (!OperatingSystem.IsWindows()) return;

        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Internet Settings", true);
            if (key != null)
            {
                key.SetValue("ProxyEnable", enabled ? 1 : 0, RegistryValueKind.DWord);
                if (enabled)
                {
                    key.SetValue("ProxyServer", server, RegistryValueKind.String);
                    key.SetValue("ProxyOverride", "localhost;127.*;10.*;192.168.*;<local>", RegistryValueKind.String);
                    LoggingService.Instance.LogApp($"Системный прокси Windows активирован: {server}");
                }
                else
                {
                    LoggingService.Instance.LogApp("Системный прокси Windows отключен");
                }
            }

            // Flush changes to WinINET
            InternetSetOption(IntPtr.Zero, INTERNET_OPTION_SETTINGS_CHANGED, IntPtr.Zero, 0);
            InternetSetOption(IntPtr.Zero, INTERNET_OPTION_REFRESH, IntPtr.Zero, 0);
        }
        catch (Exception ex)
        {
            LoggingService.Instance.LogApp($"Ошибка установки системного прокси: {ex.Message}", "WARN");
        }
    }

    public static void DisableSystemProxy()
    {
        SetSystemProxy(enabled: false);
    }
}
