using System;
using System.IO;
using System.IO.Pipes;
using System.Net.WebSockets;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace SentinelDesktop.Services;

public class CoreLogStreamer
{
    private static readonly Regex AnsiRegex = new(@"\x1B\[[0-9;]*[a-zA-Z]", RegexOptions.Compiled);

    private CancellationTokenSource? _wsLogCts;
    private CancellationTokenSource? _pipeCts;

    public void StartNamedPipeStream(string pipeName = "sentinel-xray-log")
    {
        StopNamedPipeStream();
        _pipeCts = new CancellationTokenSource();
        var ct = _pipeCts.Token;

        Task.Run(async () =>
        {
            PipeSecurity? pipeSecurity = null;
            if (OperatingSystem.IsWindows())
            {
                try
                {
                    pipeSecurity = new PipeSecurity();
                    using var identity = WindowsIdentity.GetCurrent();
                    if (identity.User != null)
                    {
                        pipeSecurity.AddAccessRule(new PipeAccessRule(
                            identity.User,
                            PipeAccessRights.ReadWrite,
                            AccessControlType.Allow));
                    }
                    pipeSecurity.AddAccessRule(new PipeAccessRule(
                        new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null),
                        PipeAccessRights.ReadWrite,
                        AccessControlType.Allow));
                }
                catch { }
            }

            while (!ct.IsCancellationRequested)
            {
                NamedPipeServerStream? server = null;
                try
                {
                    if (OperatingSystem.IsWindows() && pipeSecurity != null)
                    {
                        server = NamedPipeServerStreamAcl.Create(
                            pipeName,
                            PipeDirection.In,
                            NamedPipeServerStream.MaxAllowedServerInstances,
                            PipeTransmissionMode.Byte,
                            PipeOptions.Asynchronous,
                            0,
                            0,
                            pipeSecurity);
                    }
                    else
                    {
                        server = new NamedPipeServerStream(
                            pipeName,
                            PipeDirection.In,
                            NamedPipeServerStream.MaxAllowedServerInstances,
                            PipeTransmissionMode.Byte,
                            PipeOptions.Asynchronous);
                    }

                    await server.WaitForConnectionAsync(ct).ConfigureAwait(false);

                    var clientPipe = server;
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            using (clientPipe)
                            using (var reader = new StreamReader(clientPipe, Encoding.UTF8))
                            {
                                while (!ct.IsCancellationRequested)
                                {
                                    var line = await reader.ReadLineAsync(ct).ConfigureAwait(false);
                                    if (line == null) break;
                                    var clean = AnsiRegex.Replace(line, "").Trim();
                                    if (!string.IsNullOrEmpty(clean))
                                    {
                                        LoggingService.Instance.LogCore(clean);
                                    }
                                }
                            }
                        }
                        catch { }
                    }, ct);
                }
                catch (OperationCanceledException) { break; }
                catch
                {
                    try { server?.Dispose(); } catch { }
                    await Task.Delay(100, ct).ConfigureAwait(false);
                }
            }
        }, ct);
    }

    public void StopNamedPipeStream()
    {
        try
        {
            _pipeCts?.Cancel();
            _pipeCts?.Dispose();
        }
        catch { }
        finally
        {
            _pipeCts = null;
        }
    }

    public void StartWebSocketStream(string clashAddr = "127.0.0.1:9090")
    {
        StopWebSocketStream();
        _wsLogCts = new CancellationTokenSource();
        var ct = _wsLogCts.Token;

        Task.Run(async () =>
        {
            var uri = new Uri($"ws://{clashAddr}/logs?level=debug");
            for (int attempt = 0; attempt < 80 && !ct.IsCancellationRequested; attempt++)
            {
                try
                {
                    using var ws = new ClientWebSocket();
                    await ws.ConnectAsync(uri, ct).ConfigureAwait(false);
                    var buffer = new byte[16384];

                    while (ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
                    {
                        var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), ct).ConfigureAwait(false);
                        if (result.MessageType == WebSocketMessageType.Close) break;

                        var text = Encoding.UTF8.GetString(buffer, 0, result.Count);
                        if (!string.IsNullOrWhiteSpace(text))
                        {
                            try
                            {
                                using var doc = JsonDocument.Parse(text);
                                if (doc.RootElement.TryGetProperty("payload", out var payload))
                                {
                                    var msg = payload.GetString();
                                    if (!string.IsNullOrEmpty(msg))
                                    {
                                        var clean = AnsiRegex.Replace(msg, "").Trim();
                                        if (!string.IsNullOrEmpty(clean))
                                        {
                                            LoggingService.Instance.LogCore(clean);
                                        }
                                    }
                                }
                            }
                            catch
                            {
                                var clean = AnsiRegex.Replace(text, "").Trim();
                                if (!string.IsNullOrEmpty(clean))
                                {
                                    LoggingService.Instance.LogCore(clean);
                                }
                            }
                        }
                    }
                    break;
                }
                catch (OperationCanceledException) { break; }
                catch
                {
                    await Task.Delay(50, ct).ConfigureAwait(false);
                }
            }
        }, ct);
    }

    public void StopWebSocketStream()
    {
        try
        {
            _wsLogCts?.Cancel();
            _wsLogCts?.Dispose();
        }
        catch { }
        finally
        {
            _wsLogCts = null;
        }
    }

    public void StopAll()
    {
        StopNamedPipeStream();
        StopWebSocketStream();
    }
}
