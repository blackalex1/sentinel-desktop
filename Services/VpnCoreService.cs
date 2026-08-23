using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Timers;
using SentinelDesktop.Models;

namespace SentinelDesktop.Services;

public class VpnCoreService
{
    private static readonly Lazy<VpnCoreService> _lazy = new(() => new VpnCoreService());
    public static VpnCoreService Instance => _lazy.Value;

    private static readonly Regex AnsiRegex = new(@"\x1B\[[0-9;]*[a-zA-Z]", RegexOptions.Compiled);

    private Process? _coreProcess;
    private readonly Timer _trafficTimer;
    private long _totalDown;
    private long _totalUp;

    public bool IsRunning => _coreProcess != null && !_coreProcess.HasExited;
    public ServerProfile? ActiveServer { get; private set; }
    public AppSettings? ActiveSettings { get; private set; }
    public event Action<bool>? StateChanged;
    public event Action<TrafficStats>? TrafficUpdated;

    public async Task HotReloadLogLevelAsync(string newLogLevel)
    {
        if (!IsRunning || ActiveServer == null || ActiveSettings == null) return;
        ActiveSettings.LogLevel = newLogLevel;
        LoggingService.Instance.LogApp($"⚡ Горячее переключение детализации логов ядра на '{newLogLevel}'...");
        await StartAsync(ActiveServer, ActiveSettings);
    }

    private VpnCoreService()
    {
        _trafficTimer = new Timer(1000);
        _trafficTimer.Elapsed += (s, e) => PollTraffic();
    }

    public static bool IsAdministrator()
    {
        try
        {
            if (OperatingSystem.IsWindows())
            {
                using var identity = WindowsIdentity.GetCurrent();
                var principal = new WindowsPrincipal(identity);
                return principal.IsInRole(WindowsBuiltInRole.Administrator);
            }
        }
        catch { }
        return false;
    }

    public static bool IsElevatingHandoff { get; set; } = false;

    public static void KillExistingCores()
    {
        if (IsElevatingHandoff) return;

        foreach (var procName in new[] { "sing-box" })
        {
            try
            {
                foreach (var p in Process.GetProcessesByName(procName))
                {
                    try
                    {
                        p.Kill(true);
                        p.WaitForExit(300);
                        p.Dispose();
                    }
                    catch { }
                }
            }
            catch { }
        }
    }

    public static int FindAvailablePort(int startingPort)
    {
        for (int port = startingPort; port < startingPort + 50; port++)
        {
            try
            {
                var listener = new TcpListener(IPAddress.Loopback, port);
                listener.Start();
                listener.Stop();
                return port;
            }
            catch { }
        }
        return startingPort;
    }

    public async Task<bool> StartAsync(ServerProfile server, AppSettings settings)
    {
        if (IsRunning)
        {
            await StopAsync();
        }

        // Terminate any orphaned background cores and ensure ports are released
        KillExistingCores();
        await Task.Delay(150);

        var socksPort = FindAvailablePort(settings.SocksPort);
        var httpPort = FindAvailablePort(settings.HttpPort == socksPort ? socksPort + 1 : settings.HttpPort);

        try
        {
            var modeStr = settings.IsTunMode ? "desktop_tun" : "system_proxy";

            // Resolve core engine (defaults to universal Sing-box)
            var resolvedCore = CoreEnginesCatalog.GetEngine("sing-box");
            var logLevelOpt = LogLevelsCatalog.GetLevel(settings.LogLevel);
            var coreLogLevel = logLevelOpt.SingboxLevel;

            LoggingService.Instance.LogApp($"Запуск ядра {resolvedCore.DisplayName} для узла {server.Name} ({server.Protocol.ToUpperInvariant()})...");
            LoggingService.Instance.LogApp($"Параметры: Режим={modeStr}, SOCKS5={socksPort}, HTTP={httpPort}, Логи={coreLogLevel}");

            // Pure Intent Specification for sentinel-core Go compiler
            var spec = new
            {
                targetCore = resolvedCore.TargetCoreAst,
                logLevel = coreLogLevel,
                serverNode = server,
                clientInbound = new
                {
                    mode = modeStr,
                    socksPort = socksPort,
                    httpPort = httpPort,
                    autoRoute = settings.IsTunMode
                },
                routing = RoutingService.Instance.BuildRoutingSpecForAst()
            };

            var specJson = JsonSerializer.Serialize(spec);
            var buildResultJson = SentinelCoreNative.BuildConfig(specJson);
            if (string.IsNullOrEmpty(buildResultJson) || buildResultJson.StartsWith("{\"error\""))
            {
                LoggingService.Instance.LogApp($"Ошибка сборщика SentinelBuildConfig: {buildResultJson}", "ERROR");
                return false;
            }

            string actualConfig;
            try
            {
                using var doc = JsonDocument.Parse(buildResultJson);
                if (doc.RootElement.TryGetProperty("configJson", out var cfgProp))
                {
                    actualConfig = cfgProp.GetString() ?? buildResultJson;
                }
                else if (doc.RootElement.TryGetProperty("config", out var cProp))
                {
                    actualConfig = cProp.GetString() ?? buildResultJson;
                }
                else
                {
                    actualConfig = buildResultJson;
                }
            }
            catch
            {
                actualConfig = buildResultJson;
            }

            var dataDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "data");
            Directory.CreateDirectory(dataDir);
            var configPath = Path.Combine(dataDir, "running_config.json");
            await File.WriteAllTextAsync(configPath, actualConfig);
            LoggingService.Instance.LogApp($"Конфигурация ядра скомпилирована через Sentinel AST Core и сохранена в data/running_config.json");

            var exeDir = AppDomain.CurrentDomain.BaseDirectory;
            var coreExe = Path.Combine(exeDir, "binaries", resolvedCore.ExeName);
            if (!File.Exists(coreExe))
            {
                coreExe = Path.Combine(exeDir, resolvedCore.ExeName);
            }

            if (!File.Exists(coreExe))
            {
                var fallback = Path.Combine(exeDir, "binaries", "sing-box.exe");
                if (File.Exists(fallback)) coreExe = fallback;
                else coreExe = Path.Combine(exeDir, "sing-box.exe");
            }

            if (!File.Exists(coreExe))
            {
                LoggingService.Instance.LogApp($"Исполняемый файл ядра не найден по пути: {coreExe}", "WARN");
            }

            var args = $"run -c \"{configPath}\"";

            // Direct in-memory stdout/stderr pipe streaming with zero disk I/O
            _coreProcess = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = coreExe,
                    Arguments = args,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    StandardOutputEncoding = Encoding.UTF8,
                    StandardErrorEncoding = Encoding.UTF8,
                    WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory
                }
            };

            _coreProcess.OutputDataReceived += (s, e) =>
            {
                if (!string.IsNullOrWhiteSpace(e.Data))
                {
                    var clean = AnsiRegex.Replace(e.Data, "").Trim();
                    if (!string.IsNullOrEmpty(clean))
                    {
                        LoggingService.Instance.LogCore(clean);
                    }
                }
            };

            _coreProcess.ErrorDataReceived += (s, e) =>
            {
                if (!string.IsNullOrWhiteSpace(e.Data))
                {
                    var clean = AnsiRegex.Replace(e.Data, "").Trim();
                    if (!string.IsNullOrEmpty(clean))
                    {
                        LoggingService.Instance.LogCore(clean);
                    }
                }
            };

            _coreProcess.EnableRaisingEvents = true;
            _coreProcess.Exited += (s, e) =>
            {
                LoggingService.Instance.LogApp($"Процесс ядра завершил работу (Код: {_coreProcess?.ExitCode})");
                _trafficTimer.Stop();
                StateChanged?.Invoke(false);
            };

            _coreProcess.Start();
            ChildProcessTracker.Track(_coreProcess);
            _coreProcess.BeginOutputReadLine();
            _coreProcess.BeginErrorReadLine();

            _trafficTimer.Start();
            StateChanged?.Invoke(true);

            ActiveServer = server;
            ActiveSettings = settings;

            LoggingService.Instance.LogApp($"Ядро {resolvedCore.DisplayName} успешно запущено (PID: {_coreProcess.Id})");
            return true;
        }
        catch (Exception ex)
        {
            LoggingService.Instance.LogApp($"Ошибка запуска ядра: {ex.Message}", "ERROR");
            return false;
        }
    }

    public async Task StopAsync()
    {
        try
        {
            _trafficTimer.Stop();

            if (_coreProcess != null)
            {
                try
                {
                    if (!_coreProcess.HasExited)
                    {
                        LoggingService.Instance.LogApp("Остановка процесса ядра...");
                        _coreProcess.Kill(true);
                        await Task.Run(() =>
                        {
                            try { _coreProcess?.WaitForExit(800); } catch { }
                        }).ConfigureAwait(false);
                    }
                }
                catch { }
                finally
                {
                    try { _coreProcess?.Dispose(); } catch { }
                    _coreProcess = null;
                }
            }

            KillExistingCores();
        }
        catch (Exception ex)
        {
            LoggingService.Instance.LogApp($"Ошибка остановки ядра: {ex.Message}", "WARN");
        }
        finally
        {
            _coreProcess = null;
            StateChanged?.Invoke(false);
            TrafficUpdated?.Invoke(new TrafficStats());
        }
    }

    public void StopSync()
    {
        if (IsElevatingHandoff) return;

        try
        {
            _trafficTimer.Stop();

            if (_coreProcess != null)
            {
                try
                {
                    if (!_coreProcess.HasExited)
                    {
                        _coreProcess.Kill(true);
                        _coreProcess.WaitForExit(600);
                    }
                }
                catch { }
                finally
                {
                    try { _coreProcess?.Dispose(); } catch { }
                    _coreProcess = null;
                }
            }

            KillExistingCores();
        }
        catch { }
        finally
        {
            _coreProcess = null;
            StateChanged?.Invoke(false);
            TrafficUpdated?.Invoke(new TrafficStats());
        }
    }

    private void PollTraffic()
    {
        try
        {
            var json = SentinelCoreNative.GetUnifiedTraffic();
            if (!string.IsNullOrEmpty(json) && json != "{}")
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                long downSpeed = 0;
                long upSpeed = 0;

                if (root.TryGetProperty("down_speed", out var ds)) downSpeed = ds.GetInt64();
                else if (root.TryGetProperty("down", out var d)) downSpeed = d.GetInt64();

                if (root.TryGetProperty("up_speed", out var us)) upSpeed = us.GetInt64();
                else if (root.TryGetProperty("up", out var u)) upSpeed = u.GetInt64();

                _totalDown += downSpeed;
                _totalUp += upSpeed;

                var stats = new TrafficStats
                {
                    DownSpeedBytes = downSpeed,
                    UpSpeedBytes = upSpeed,
                    TotalDownBytes = _totalDown,
                    TotalUpBytes = _totalUp,
                    IsConnected = IsRunning
                };

                TrafficUpdated?.Invoke(stats);
            }
        }
        catch { }
    }
}
