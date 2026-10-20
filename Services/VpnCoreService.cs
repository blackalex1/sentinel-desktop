using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using SentinelDesktop.Models;

namespace SentinelDesktop.Services;

public class VpnCoreService
{
    private static readonly Lazy<VpnCoreService> _lazy = new(() => new VpnCoreService());
    public static VpnCoreService Instance => _lazy.Value;

    private readonly CoreProcessManager _processManager = new();
    private readonly CoreLogStreamer _logStreamer = new();
    private readonly CoreTrafficMonitor _trafficMonitor = new();
    private readonly System.Threading.SemaphoreSlim _lifecycleLock = new(1, 1);

    public bool IsRunning => _processManager.IsRunning;
    public bool IsStarting { get; private set; }
    public ServerProfile? ActiveServer { get; private set; }
    public AppSettings? ActiveSettings { get; private set; }

    public event Action<bool>? StateChanged;
    public event Action<TrafficStats>? TrafficUpdated
    {
        add => _trafficMonitor.TrafficUpdated += value;
        remove => _trafficMonitor.TrafficUpdated -= value;
    }

    #region Static Environment Delegations (Backward Compatibility)
    public static bool IsElevatingHandoff
    {
        get => CoreEnvironmentService.IsElevatingHandoff;
        set => CoreEnvironmentService.IsElevatingHandoff = value;
    }

    public static bool IsAdministrator() => CoreEnvironmentService.IsAdministrator();
    public static void EnsureWintunDriver() => CoreEnvironmentService.EnsureWintunDriver();
    public static bool AreGeoDataFilesInstalled() => CoreEnvironmentService.AreGeoDataFilesInstalled();
    public static bool IsCoreBinaryInstalled(string coreType = "sing-box") => CoreEnvironmentService.IsCoreBinaryInstalled(coreType);
    public static void KillExistingCores(int? excludePid = null) => CoreProcessManager.KillExistingCores(excludePid);
    public static int FindAvailablePort(int startingPort) => CoreEnvironmentService.FindAvailablePort(startingPort);
    #endregion

    private VpnCoreService()
    {
        _processManager.ProcessExited += exitCode =>
        {
            _trafficMonitor.Stop();
            _logStreamer.StopAll();
            StateChanged?.Invoke(false);
        };
    }

    public async Task HotReloadLogLevelAsync(string newLogLevel)
    {
        if (!IsRunning || ActiveServer == null || ActiveSettings == null) return;
        ActiveSettings.LogLevel = newLogLevel;
        LoggingService.Instance.LogApp($"⚡ Горячее переключение детализации логов ядра на '{newLogLevel}'...");
        await StartAsync(ActiveServer, ActiveSettings);
    }

    public async Task RestartWithNewSettingsAsync()
    {
        if (!IsRunning || ActiveServer == null) return;
        var vault = StorageService.Load();
        LoggingService.Instance.LogApp("⚡ Перезапуск активного туннеля с новыми настройками DNS...");
        await StartAsync(ActiveServer, vault.Settings);
    }

    public async Task<bool> StartAsync(ServerProfile server, AppSettings settings)
    {
        await _lifecycleLock.WaitAsync();
        IsStarting = true;
        try
        {
            if (IsRunning)
            {
                await StopInternalAsync();
            }

            // Terminate any orphaned background cores and ensure ports are released
            CoreProcessManager.KillExistingCores();
            await Task.Delay(250);

            var socksPort = CoreEnvironmentService.FindAvailablePort(settings.SocksPort);
            var httpPort = CoreEnvironmentService.FindAvailablePort(settings.HttpPort == socksPort ? socksPort + 1 : settings.HttpPort);

            // Ensure rule sets and stubs are initialized for zero-crash startup
            await CoreEnvironmentService.EnsureRuleSetsAsync();

            if (server.Country == "HOTSPOT" || !string.IsNullOrEmpty(server.HotspotToken))
            {
                LoggingService.Instance.LogApp("📡 Отправка зашифрованного сигнала старта сессии на телефон...");
                var hotspotAck = await HotspotService.Instance.NotifySessionStartAsync(server);
                if (!hotspotAck)
                {
                    LoggingService.Instance.LogApp("⚠️ Мобильная точка Sentinel не ответила на сигнал старта сессии (порты 18080-19081 недоступны). Убедитесь, что приложение на телефоне запущено и устройства подключены к одной Wi-Fi сети.", "WARN");
                }
            }

            var resolvedCore = CoreEnginesCatalog.GetEngine(settings.CoreType);
            bool isXray = resolvedCore.Id == "xray";

            if (isXray)
            {
                if (!CoreEnvironmentService.AreGeoDataFilesInstalled())
                {
                    LoggingService.Instance.LogApp("❌ Ошибка запуска: для работы ядра Xray-core требуются базы geoip.dat и geosite.dat. Скачайте их во вкладке «Управление ядрами».", "ERROR");
                    return false;
                }

                LoggingService.Instance.LogApp("ℹ️ Запуск ядра Xray-core. Модуль безопасности Sentinel PortShield и блокировки приложений отключены.");
            }

            var logLevelOpt = LogLevelsCatalog.GetLevel(settings.LogLevel);
            var coreLogLevel = logLevelOpt.SingboxLevel;
            var modeStr = settings.IsTunMode ? "desktop_tun" : "system_proxy";

            LoggingService.Instance.LogApp($"Запуск ядра {resolvedCore.DisplayName} для узла {server.Name} ({server.Protocol.ToUpperInvariant()})...");
            LoggingService.Instance.LogApp($"Параметры: Режим={modeStr}, SOCKS5={socksPort}, HTTP={httpPort}, Логи={coreLogLevel}");

            // 1. Build and persist configuration via AST compiler / Xray fallbacks
            var (buildSuccess, configPath, buildError) = await CoreConfigBuilder.BuildAndSaveConfigAsync(
                server,
                settings,
                resolvedCore,
                socksPort,
                httpPort,
                coreLogLevel
            );

            if (!buildSuccess)
            {
                LoggingService.Instance.LogApp(buildError ?? "Ошибка сборки конфигурации ядра", "ERROR");
                return false;
            }

            // 2. Resolve executable binary path
            var coreExe = CoreEnvironmentService.ResolveCoreExecutable(resolvedCore, isXray);
            if (string.IsNullOrEmpty(coreExe) || !File.Exists(coreExe))
            {
                LoggingService.Instance.LogApp($"Исполняемый файл ядра ({resolvedCore.DisplayName}) не найден. Установите ядро во вкладке «Управление ядрами».", "ERROR");
                return false;
            }

            // In TUN mode, Administrator privileges are required for Wintun driver and routing tables
            if (settings.IsTunMode && !CoreEnvironmentService.IsAdministrator())
            {
                LoggingService.Instance.LogApp("Перезапуск Sentinel Desktop с правами Администратора для активации TUN-режима и Wintun...");
                CoreEnvironmentService.IsElevatingHandoff = true;

                var procPath = Environment.ProcessPath;
                if (string.IsNullOrEmpty(procPath))
                {
                    try { procPath = Process.GetCurrentProcess().MainModule?.FileName; } catch { }
                }

                if (!string.IsNullOrEmpty(procPath) && File.Exists(procPath))
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = procPath,
                        Arguments = "--auto-connect",
                        UseShellExecute = true,
                        Verb = "runas",
                        WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory
                    };

                    try
                    {
                        Process.Start(psi);
                        if (Avalonia.Application.Current?.ApplicationLifetime is Avalonia.Controls.ApplicationLifetimes.IClassicDesktopStyleApplicationLifetime desktop)
                        {
                            Avalonia.Threading.Dispatcher.UIThread.Post(() => desktop.Shutdown(0));
                        }
                        else
                        {
                            Environment.Exit(0);
                        }
                        return true;
                    }
                    catch (System.ComponentModel.Win32Exception winEx) when (winEx.NativeErrorCode == 1223)
                    {
                        CoreEnvironmentService.IsElevatingHandoff = false;
                        LoggingService.Instance.LogApp("⚠️ Перезапуск отменен: запрос UAC отклонен пользователем.", "WARN");
                        return false;
                    }
                    catch (Exception ex)
                    {
                        CoreEnvironmentService.IsElevatingHandoff = false;
                        LoggingService.Instance.LogApp($"Ошибка перезапуска с правами Администратора: {ex.Message}", "ERROR");
                        return false;
                    }
                }
            }

            var needsElevation = !CoreEnvironmentService.IsAdministrator() && settings.IsTunMode;
            var binDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "binaries");

            // 3. Start in-memory log listeners (for Sing-box elevated mode)
            if (needsElevation && !isXray)
            {
                _logStreamer.StartWebSocketStream("127.0.0.1:9090");
            }

            // 4. Start subprocess
            var (processStarted, startError) = _processManager.Start(coreExe, configPath, needsElevation, binDir, isXray);
            if (!processStarted)
            {
                LoggingService.Instance.LogApp(startError ?? "Не удалось запустить процесс ядра", "ERROR");
                _logStreamer.StopAll();
                return false;
            }

            // 5. If in System Proxy mode, enable Windows WinINET system proxy. If in Xray TUN mode, configure Windows TUN routes.
            if (!settings.IsTunMode)
            {
                WindowsSystemProxyService.SetSystemProxy($"127.0.0.1:{httpPort}", true);
            }
            else if (isXray)
            {
                var dnsPreset = DnsPresetsCatalog.GetPreset(settings.SelectedDnsPresetId);
                var dnsList = dnsPreset.Id == "custom" && !string.IsNullOrWhiteSpace(settings.CustomDnsServers)
                    ? settings.CustomDnsServers.Split(new[] { ',', '\n', '\r', ';' }, StringSplitOptions.RemoveEmptyEntries).Select(s => s.Trim()).ToList()
                    : dnsPreset.Servers;

                _ = DesktopTunRoutingService.SetupTunRoutesAsync("sentinel-tun", server.Address, dnsList);
            }

            // 6. Start traffic monitoring
            _trafficMonitor.Start(() => IsRunning);
            StateChanged?.Invoke(true);

            ActiveServer = server;
            ActiveSettings = settings;

            LoggingService.Instance.LogApp($"Ядро {resolvedCore.DisplayName} успешно запущено (PID: {_processManager.CurrentProcessId})");
            return true;
        }
        catch (Exception ex)
        {
            LoggingService.Instance.LogApp($"Ошибка запуска ядра: {ex.Message}", "ERROR");
            _logStreamer.StopAll();
            return false;
        }
        finally
        {
            IsStarting = false;
            _lifecycleLock.Release();
        }
    }

    public async Task StopAsync()
    {
        await _lifecycleLock.WaitAsync();
        try
        {
            await StopInternalAsync();
        }
        finally
        {
            _lifecycleLock.Release();
        }
    }

    private async Task StopInternalAsync()
    {
        try
        {
            WindowsSystemProxyService.DisableSystemProxy();
            DesktopTunRoutingService.TeardownTunRoutes();
            _trafficMonitor.Stop();
            _logStreamer.StopAll();
            await _processManager.StopAsync();

            if (ActiveServer?.Country == "HOTSPOT" || !string.IsNullOrEmpty(ActiveServer?.HotspotToken))
            {
                await HotspotService.Instance.NotifySessionStopAsync(ActiveServer);
            }
        }
        catch (Exception ex)
        {
            LoggingService.Instance.LogApp($"Ошибка остановки ядра: {ex.Message}", "WARN");
        }
        finally
        {
            WindowsSystemProxyService.DisableSystemProxy();
            DesktopTunRoutingService.TeardownTunRoutes();
            _trafficMonitor.Stop();
            _logStreamer.StopAll();
            ActiveServer = null;
            ActiveSettings = null;
            StateChanged?.Invoke(false);
            CleanupRunningConfig();
        }
    }

    public void StopSync()
    {
        if (IsElevatingHandoff) return;

        try
        {
            WindowsSystemProxyService.DisableSystemProxy();
            DesktopTunRoutingService.TeardownTunRoutes();
            _trafficMonitor.Stop();
            _logStreamer.StopAll();
            _processManager.StopSync();
        }
        catch { }
        finally
        {
            _trafficMonitor.Stop();
            _logStreamer.StopAll();
            StateChanged?.Invoke(false);
            CleanupRunningConfig();
        }
    }

    public static void CleanupRunningConfig()
    {
        try
        {
            var dataDir = CoreEnvironmentService.GetDataDirectory();
            var configPath = Path.Combine(dataDir, "running_config.json");
            if (File.Exists(configPath))
            {
                try { File.WriteAllText(configPath, "{}"); } catch { }
                File.Delete(configPath);
            }
        }
        catch { }
    }
}
