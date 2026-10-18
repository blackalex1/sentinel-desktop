using System;
using System.IO;
using System.Net;
using System.Text.Json;
using SentinelDesktop.Models;

namespace SentinelDesktop.Services;

public class CoreTrafficMonitor
{
    private readonly System.Timers.Timer _trafficTimer;
    private long _totalDown;
    private long _totalUp;
    private Func<bool>? _isRunningProvider;

    public event Action<TrafficStats>? TrafficUpdated;

    public CoreTrafficMonitor()
    {
        _trafficTimer = new System.Timers.Timer(1000);
        _trafficTimer.Elapsed += (s, e) => _ = PollTrafficAsync();
    }

    public void Start(Func<bool> isRunningProvider)
    {
        _isRunningProvider = isRunningProvider;
        Reset();
        _trafficTimer.Start();
    }

    public void Stop()
    {
        _trafficTimer.Stop();
        TrafficUpdated?.Invoke(new TrafficStats());
    }

    public void Reset()
    {
        SentinelCoreNative.ResetRealtimeTraffic();
        _totalDown = 0;
        _totalUp = 0;
    }

    private static readonly System.Net.Http.HttpClient _httpClient = new() { Timeout = TimeSpan.FromMilliseconds(800) };

    public async System.Threading.Tasks.Task PollTrafficAsync(string clashAddr = "127.0.0.1:9090")
    {
        var isRunning = _isRunningProvider?.Invoke() ?? false;
        if (!isRunning) return;

        try
        {
            // 1. Primary Strategy: Clash API /traffic endpoint
            using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromMilliseconds(800));
            var resp = await _httpClient.GetAsync($"http://{clashAddr}/traffic", cts.Token).ConfigureAwait(false);
            if (resp.IsSuccessStatusCode)
            {
                var json = await resp.Content.ReadAsStringAsync(cts.Token).ConfigureAwait(false);
                if (!string.IsNullOrWhiteSpace(json))
                {
                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;
                    long downSpeed = 0;
                long upSpeed = 0;
                long downTotal = 0;
                long upTotal = 0;

                if (root.TryGetProperty("up", out var upProp)) upSpeed = upProp.GetInt64();
                if (root.TryGetProperty("down", out var downProp)) downSpeed = downProp.GetInt64();

                if (root.TryGetProperty("downloadSpeed", out var ds)) downSpeed = ds.GetInt64();
                else if (root.TryGetProperty("down_speed", out var ds2)) downSpeed = ds2.GetInt64();
                else if (root.TryGetProperty("down", out var d)) downSpeed = d.GetInt64();

                if (root.TryGetProperty("uploadSpeed", out var us)) upSpeed = us.GetInt64();
                else if (root.TryGetProperty("up_speed", out var us2)) upSpeed = us2.GetInt64();
                else if (root.TryGetProperty("up", out var u)) upSpeed = u.GetInt64();

                if (root.TryGetProperty("downloadTotal", out var dt)) downTotal = dt.GetInt64();
                if (root.TryGetProperty("uploadTotal", out var ut)) upTotal = ut.GetInt64();

                if (downTotal > 0) _totalDown = downTotal;
                else _totalDown += downSpeed;

                if (upTotal > 0) _totalUp = upTotal;
                else _totalUp += upSpeed;

                var stats = new TrafficStats
                {
                    DownSpeedBytes = downSpeed,
                    UpSpeedBytes = upSpeed,
                    TotalDownBytes = _totalDown,
                    TotalUpBytes = _totalUp,
                    IsConnected = isRunning
                };

                TrafficUpdated?.Invoke(stats);
            }
        }
    }
    catch
        {
            // Fallback: Sentinel FFI Native Engine Traffic Monitor
            try
            {
                var json = SentinelCoreNative.GetRealtimeTraffic();
                if (!string.IsNullOrEmpty(json))
                {
                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;
                    long downSpeed = 0;
                    long upSpeed = 0;

                    if (root.TryGetProperty("downSpeed", out var ds)) downSpeed = ds.GetInt64();
                    if (root.TryGetProperty("upSpeed", out var us)) upSpeed = us.GetInt64();

                    _totalDown += downSpeed;
                    _totalUp += upSpeed;

                    var stats = new TrafficStats
                    {
                        DownSpeedBytes = downSpeed,
                        UpSpeedBytes = upSpeed,
                        TotalDownBytes = _totalDown,
                        TotalUpBytes = _totalUp,
                        IsConnected = isRunning
                    };

                    TrafficUpdated?.Invoke(stats);
                }
            }
            catch { }
        }
    }
}
