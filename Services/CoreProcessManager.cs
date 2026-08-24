using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace SentinelDesktop.Services;

public class CoreProcessManager
{
    private static readonly Regex AnsiRegex = new(@"\x1B\[[0-9;]*[a-zA-Z]", RegexOptions.Compiled);
    private Process? _coreProcess;

    public bool IsRunning
    {
        get
        {
            try
            {
                return _coreProcess != null && !_coreProcess.HasExited;
            }
            catch
            {
                return false;
            }
        }
    }

    public int? CurrentProcessId => _coreProcess?.Id;

    public event Action<int?>? ProcessExited;

    public static void KillExistingCores()
    {
        if (CoreEnvironmentService.IsElevatingHandoff) return;

        foreach (var procName in new[] { "sing-box", "xray", "wxray" })
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

    public (bool success, string? error) Start(
        string coreExe,
        string configPath,
        bool needsElevation,
        string binDir,
        bool isXray = false)
    {
        var args = $"run -c \"{configPath}\"";
        var proc = new Process();

        if (needsElevation)
        {
            LoggingService.Instance.LogApp("Запрос прав Администратора (UAC) для создания Wintun TUN-интерфейса...");
            proc.StartInfo = new ProcessStartInfo
            {
                FileName = coreExe,
                Arguments = args,
                UseShellExecute = true,
                Verb = "runas",
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
                WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory
            };
        }
        else
        {
            proc.StartInfo = new ProcessStartInfo
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
            };

            proc.StartInfo.EnvironmentVariables["XRAY_LOCATION_ASSET"] = binDir;
            proc.StartInfo.EnvironmentVariables["V2RAY_LOCATION_ASSET"] = binDir;

            proc.OutputDataReceived += (s, e) =>
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

            proc.ErrorDataReceived += (s, e) =>
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
        }

        proc.EnableRaisingEvents = true;
        proc.Exited += (s, e) =>
        {
            int? exitCode = null;
            try { exitCode = _coreProcess?.ExitCode; } catch { }
            LoggingService.Instance.LogApp($"Процесс ядра завершил работу (Код: {exitCode})");
            ProcessExited?.Invoke(exitCode);
        };

        try
        {
            proc.Start();
            _coreProcess = proc;
            ChildProcessTracker.Track(proc);

            if (!needsElevation)
            {
                proc.BeginOutputReadLine();
                proc.BeginErrorReadLine();
            }

            return (true, null);
        }
        catch (System.ComponentModel.Win32Exception winEx) when (winEx.NativeErrorCode == 1223)
        {
            try { proc.Dispose(); } catch { }
            _coreProcess = null;
            return (false, "⚠️ Запуск отменен: запрос UAC отклонен пользователем.");
        }
        catch (Exception ex)
        {
            try { proc.Dispose(); } catch { }
            _coreProcess = null;
            return (false, $"Ошибка старта процесса ядра: {ex.Message}");
        }
    }

    public async Task StopAsync()
    {
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

    public void StopSync()
    {
        if (CoreEnvironmentService.IsElevatingHandoff) return;

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
}
