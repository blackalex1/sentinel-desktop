using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using SentinelDesktop.Models;

namespace SentinelDesktop.Services;

public static class SentinelCoreNative
{
    private const string DllName = "sentinel-core.dll";

    static SentinelCoreNative()
    {
        try
        {
            NativeLibrary.SetDllImportResolver(typeof(SentinelCoreNative).Assembly, (libraryName, assembly, searchPath) =>
            {
                if (libraryName.Equals(DllName, StringComparison.OrdinalIgnoreCase) ||
                    libraryName.Equals("sentinel-core", StringComparison.OrdinalIgnoreCase))
                {
                    var baseDir = AppDomain.CurrentDomain.BaseDirectory;
                    var candidates = new[]
                    {
                        Path.Combine(baseDir, "binaries", "sentinel-core.dll"),
                        Path.Combine(baseDir, "binaries", "sentinel-core-windows-amd64.dll"),
                        Path.Combine(baseDir, "sentinel-core.dll")
                    };

                    foreach (var path in candidates)
                    {
                        if (File.Exists(path) && NativeLibrary.TryLoad(path, out var handle))
                        {
                            return handle;
                        }
                    }
                }
                return IntPtr.Zero;
            });
        }
        catch { }
    }

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelFreeString")]
    public static extern void FreeString(IntPtr str);

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelGetEngineVersion")]
    private static extern IntPtr _GetEngineVersion();

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelBuildConfig")]
    private static extern IntPtr _BuildConfig(IntPtr specJson);

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelParseURI")]
    private static extern IntPtr _ParseURI(IntPtr uri);

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelGenerateURI")]
    private static extern IntPtr _GenerateURI(IntPtr profileJson);

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelPing")]
    private static extern IntPtr _Ping(IntPtr host, int port, int timeoutMs);

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelGetPublicIP")]
    private static extern IntPtr _GetPublicIP(int socksPort, IntPtr authUser, IntPtr authPass, int timeoutMs);

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelGetUnifiedTraffic")]
    private static extern IntPtr _GetUnifiedTraffic();

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelGetRealtimeTraffic")]
    private static extern IntPtr _GetRealtimeTraffic(IntPtr clashAddr);

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelResetRealtimeTraffic")]
    private static extern IntPtr _ResetRealtimeTraffic();

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelPopLogLine")]
    private static extern IntPtr _PopLogLine(IntPtr core, int timeoutMs);

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelGetInMemoryLogs")]
    private static extern IntPtr _GetInMemoryLogs(IntPtr core, int limit);

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelPushLogLine")]
    private static extern IntPtr _PushLogLine(IntPtr core, IntPtr line);

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelGetPortShieldCatalog")]
    private static extern IntPtr _GetPortShieldCatalog(IntPtr lang);

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelConfigureSecurityPolicy")]
    private static extern IntPtr _ConfigureSecurityPolicy(IntPtr policyJson);

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelAuditConnection")]
    private static extern IntPtr _AuditConnection(IntPtr reqJson);

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelIngestCoreLog")]
    private static extern IntPtr _IngestCoreLog(IntPtr logLine);

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelGetBlockedApps")]
    private static extern IntPtr _GetBlockedApps();

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelUnblockApp")]
    private static extern IntPtr _UnblockApp(IntPtr callerId);

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelUnblockAllApps")]
    private static extern IntPtr _UnblockAllApps();

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelGetPcapStatus")]
    private static extern IntPtr _GetPcapStatus();

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelStopPcapCapture")]
    private static extern IntPtr _StopPcapCapture();

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelListPresets")]
    private static extern IntPtr _ListPresets();

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl, EntryPoint = "SentinelGetPreset")]
    private static extern IntPtr _GetPreset(IntPtr presetId);

    public static string GetVersion()
    {
        try
        {
            var ptr = _GetEngineVersion();
            var res = PtrToStringAndFree(ptr);
            return string.IsNullOrWhiteSpace(res) ? "v0.0.1" : res;
        }
        catch (Exception)
        {
            var baseDir = AppDomain.CurrentDomain.BaseDirectory;
            var binDir = Path.Combine(baseDir, "binaries");
            if (File.Exists(Path.Combine(baseDir, "sentinel-core.dll")) ||
                File.Exists(Path.Combine(binDir, "sentinel-core.dll")) ||
                File.Exists(Path.Combine(binDir, "sentinel-core-windows-amd64.dll")))
            {
                return "v0.0.1";
            }
            return "Не установлено";
        }
    }

    public static string BuildConfig(string specJson)
    {
        var sPtr = StringToPtr(specJson);
        try
        {
            var resPtr = _BuildConfig(sPtr);
            return PtrToStringAndFree(resPtr);
        }
        finally
        {
            Marshal.FreeHGlobal(sPtr);
        }
    }

    public static bool IsAvailable()
    {
        var baseDir = AppDomain.CurrentDomain.BaseDirectory;
        var candidates = new[]
        {
            Path.Combine(baseDir, "binaries", "sentinel-core.dll"),
            Path.Combine(baseDir, "binaries", "sentinel-core-windows-amd64.dll"),
            Path.Combine(baseDir, "sentinel-core.dll")
        };

        foreach (var path in candidates)
        {
            if (File.Exists(path))
            {
                return true;
            }
        }
        return false;
    }

    public static string ParseUri(string uri)
    {
        var uPtr = StringToPtr(uri);
        try
        {
            var resPtr = _ParseURI(uPtr);
            var result = PtrToStringAndFree(resPtr);
            if (!string.IsNullOrEmpty(result))
            {
                return result;
            }
        }
        catch (DllNotFoundException)
        {
            return "{\"error\":\"DLL_NOT_FOUND: Нативная библиотека ядра sentinel-core.dll не найдена. Установите её во вкладке «Ядра».\"}";
        }
        catch (Exception ex)
        {
            return $"{{\"error\":\"{ex.Message}\"}}";
        }
        finally
        {
            Marshal.FreeHGlobal(uPtr);
        }

        return "{\"error\":\"Не удалось распарсить ссылку через ядро Sentinel-Core\"}";
    }

    public static string GenerateUri(ServerProfile profile)
    {
        try
        {
            var options = new JsonSerializerOptions { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };
            var json = JsonSerializer.Serialize(profile, options);
            var jPtr = StringToPtr(json);
            try
            {
                var resPtr = _GenerateURI(jPtr);
                var resJson = PtrToStringAndFree(resPtr);
                if (!string.IsNullOrEmpty(resJson))
                {
                    using var doc = JsonDocument.Parse(resJson);
                    if (doc.RootElement.TryGetProperty("uri", out var u))
                    {
                        return u.GetString() ?? string.Empty;
                    }
                }
            }
            finally
            {
                Marshal.FreeHGlobal(jPtr);
            }
        }
        catch { }
        return string.Empty;
    }

    public static int TestPing(string host, int port, int timeoutMs = 2000)
    {
        var hPtr = StringToPtr(host);
        try
        {
            var resPtr = _Ping(hPtr, port, timeoutMs);
            var json = PtrToStringAndFree(resPtr);
            if (!string.IsNullOrEmpty(json))
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                if (root.TryGetProperty("success", out var succ) && !succ.GetBoolean())
                {
                    return -1;
                }

                if (root.TryGetProperty("latencyMs", out var latProp) ||
                    root.TryGetProperty("latency_ms", out latProp))
                {
                    if (latProp.ValueKind == JsonValueKind.Number)
                    {
                        var val = latProp.GetDouble();
                        return (int)Math.Max(1, Math.Round(val));
                    }
                }
            }
            return -1;
        }
        catch
        {
            return -1;
        }
        finally
        {
            Marshal.FreeHGlobal(hPtr);
        }
    }

    public static (string Ip, string Country) GetPublicIp(int socksPort = 0, int timeoutMs = 3000)
    {
        try
        {
            var resPtr = _GetPublicIP(socksPort, IntPtr.Zero, IntPtr.Zero, timeoutMs);
            var json = PtrToStringAndFree(resPtr);
            if (!string.IsNullOrEmpty(json))
            {
                using var doc = JsonDocument.Parse(json);
                var ip = doc.RootElement.TryGetProperty("ip", out var ipProp) ? ipProp.GetString() ?? "" : "";
                var country = doc.RootElement.TryGetProperty("country", out var cProp) ? cProp.GetString() ?? "RU" : "RU";
                return (ip, country);
            }
        }
        catch { }
        return ("", "");
    }

    public static string GetUnifiedTraffic()
    {
        try
        {
            var resPtr = _GetUnifiedTraffic();
            return PtrToStringAndFree(resPtr);
        }
        catch
        {
            return "{\"down\":0,\"up\":0}";
        }
    }

    public static string GetRealtimeTraffic(string clashAddr = "127.0.0.1:9090")
    {
        var addrPtr = StringToPtr(clashAddr);
        try
        {
            var resPtr = _GetRealtimeTraffic(addrPtr);
            return PtrToStringAndFree(resPtr);
        }
        catch
        {
            return "{}";
        }
    }

    public static void ResetRealtimeTraffic()
    {
        try
        {
            var resPtr = _ResetRealtimeTraffic();
            PtrToStringAndFree(resPtr);
        }
        catch { }
    }

    public static List<PortShieldRule> GetPortShieldCatalog(string lang = "ru")
    {
        var lPtr = StringToPtr(lang);
        try
        {
            var resPtr = _GetPortShieldCatalog(lPtr);
            var json = PtrToStringAndFree(resPtr);
            if (!string.IsNullOrEmpty(json))
            {
                return JsonSerializer.Deserialize<List<PortShieldRule>>(json) ?? GetDefaultShieldRules();
            }
            return GetDefaultShieldRules();
        }
        catch
        {
            return GetDefaultShieldRules();
        }
        finally
        {
            Marshal.FreeHGlobal(lPtr);
        }
    }

    public static bool ConfigureSecurityPolicy(string policyJson)
    {
        var pPtr = StringToPtr(policyJson);
        try
        {
            var resPtr = _ConfigureSecurityPolicy(pPtr);
            var json = PtrToStringAndFree(resPtr);
            return !string.IsNullOrEmpty(json) && json.Contains("true");
        }
        catch
        {
            return false;
        }
        finally
        {
            Marshal.FreeHGlobal(pPtr);
        }
    }

    public static string AuditConnection(string reqJson)
    {
        var rPtr = StringToPtr(reqJson);
        try
        {
            var resPtr = _AuditConnection(rPtr);
            return PtrToStringAndFree(resPtr);
        }
        catch (Exception ex)
        {
            return $"{{\"verdict\":\"ALLOW\",\"error\":\"{ex.Message}\"}}";
        }
        finally
        {
            Marshal.FreeHGlobal(rPtr);
        }
    }

    public static List<CorePreset> ListPresets()
    {
        try
        {
            var ptr = _ListPresets();
            var json = PtrToStringAndFree(ptr);
            if (!string.IsNullOrEmpty(json))
            {
                return JsonSerializer.Deserialize<List<CorePreset>>(json) ?? new List<CorePreset>();
            }
            return new List<CorePreset>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SentinelCoreNative] ListPresets error: {ex.Message}");
            return new List<CorePreset>();
        }
    }

    public static string GetPreset(string presetId)
    {
        var idPtr = StringToPtr(presetId);
        try
        {
            var ptr = _GetPreset(idPtr);
            return PtrToStringAndFree(ptr);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SentinelCoreNative] GetPreset error: {ex.Message}");
            return string.Empty;
        }
        finally
        {
            Marshal.FreeHGlobal(idPtr);
        }
    }

    public static string IngestCoreLog(string logLine)
    {
        var lPtr = StringToPtr(logLine);
        try
        {
            var resPtr = _IngestCoreLog(lPtr);
            return PtrToStringAndFree(resPtr);
        }
        finally
        {
            Marshal.FreeHGlobal(lPtr);
        }
    }

    public static string GetBlockedApps()
    {
        try
        {
            var resPtr = _GetBlockedApps();
            return PtrToStringAndFree(resPtr);
        }
        catch
        {
            return "[]";
        }
    }

    public static bool UnblockApp(string callerId)
    {
        var cPtr = StringToPtr(callerId);
        try
        {
            var resPtr = _UnblockApp(cPtr);
            var json = PtrToStringAndFree(resPtr);
            return !string.IsNullOrEmpty(json) && json.Contains("true");
        }
        finally
        {
            Marshal.FreeHGlobal(cPtr);
        }
    }

    public static bool UnblockAllApps()
    {
        try
        {
            var resPtr = _UnblockAllApps();
            var json = PtrToStringAndFree(resPtr);
            return !string.IsNullOrEmpty(json) && json.Contains("true");
        }
        catch
        {
            return false;
        }
    }

    public static string GetPcapStatus()
    {
        try
        {
            var resPtr = _GetPcapStatus();
            return PtrToStringAndFree(resPtr);
        }
        catch
        {
            return "{}";
        }
    }

    public static bool StopPcapCapture()
    {
        try
        {
            var resPtr = _StopPcapCapture();
            var json = PtrToStringAndFree(resPtr);
            return !string.IsNullOrEmpty(json) && json.Contains("true");
        }
        catch
        {
            return false;
        }
    }

    private static List<PortShieldRule> GetDefaultShieldRules()
    {
        return new List<PortShieldRule>
        {
            new() { Port = 445, Protocol = "TCP", Name = "SMB / Windows File Sharing", ThreatRisk = "Вектор распространения вирусов-вымогателей (Ransomware, WannaCry) и EternalBlue.", Severity = "critical", IsProtected = true },
            new() { Port = 3389, Protocol = "TCP", Name = "RDP Remote Desktop", ThreatRisk = "Удаленный рабочий стол Windows, подверженный брутфорсу и BlueKeep эксплойтам.", Severity = "critical", IsProtected = true },
            new() { Port = 135, Protocol = "TCP", Name = "RPC Endpoint Mapper", ThreatRisk = "Удаленное выполнение кода и перечисление сетевых сервисов через DCOM RPC.", Severity = "critical", IsProtected = true },
            new() { Port = 139, Protocol = "TCP", Name = "NetBIOS Session Service", ThreatRisk = "Утечка NTLM-хэшей и несанкционированный доступ к локальным ресурсам.", Severity = "high", IsProtected = true },
            new() { Port = 22, Protocol = "TCP", Name = "SSH Remote Access", ThreatRisk = "Незащищенный порт SSH доступа, частая цель автоматических ботнетов.", Severity = "high", IsProtected = true },
            new() { Port = 23, Protocol = "TCP", Name = "Telnet Plaintext Protocol", ThreatRisk = "Устаревший протокол без шифрования с передачей паролей в открытом виде.", Severity = "high", IsProtected = true },
            new() { Port = 53, Protocol = "UDP", Name = "Unencrypted DNS", ThreatRisk = "Открытый DNS-трафик, уязвимый для DNS Spoofing, перехвата и слежки провайдеров.", Severity = "medium", IsProtected = true }
        };
    }

    private static IntPtr StringToPtr(string str)
    {
        if (str == null) return IntPtr.Zero;
        var bytes = System.Text.Encoding.UTF8.GetBytes(str + '\0');
        var ptr = Marshal.AllocHGlobal(bytes.Length);
        Marshal.Copy(bytes, 0, ptr, bytes.Length);
        return ptr;
    }

    private static string PtrToStringAndFree(IntPtr ptr)
    {
        if (ptr == IntPtr.Zero) return string.Empty;
        try
        {
            return Marshal.PtrToStringUTF8(ptr) ?? string.Empty;
        }
        finally
        {
            FreeString(ptr);
        }
    }
}
