using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using SentinelDesktop.Models;

namespace SentinelDesktop.Services;

public class StorageService
{
    private static string DataDir => CoreEnvironmentService.GetDataDirectory();
    private static string ConfigPath => Path.Combine(DataDir, "vault.json");
    private static string BackupConfigPath => Path.Combine(DataDir, "vault.json.bak");

    public class VaultData
    {
        public List<ServerProfile> Servers { get; set; } = new();
        public AppSettings Settings { get; set; } = new();
        public string? SelectedServerId { get; set; }
    }

    public static event Action<string>? LogLevelChanged;
    public static event Action<string>? CoreTypeChanged;
    public static event Action? ServersChanged;

    public static void NotifyLogLevelChanged(string levelId)
    {
        LogLevelChanged?.Invoke(levelId);
    }

    public static void NotifyCoreTypeChanged(string coreType)
    {
        CoreTypeChanged?.Invoke(coreType);
    }

    public static void NotifyServersChanged()
    {
        ServersChanged?.Invoke();
    }

    private static readonly byte[] DpapiHeader = new byte[] { 0x53, 0x45, 0x4E, 0x54, 0x44, 0x50, 0x30, 0x31 }; // "SENTDP01"

    public static VaultData Load()
    {
        try
        {
            if (!File.Exists(ConfigPath))
            {
                if (File.Exists(BackupConfigPath))
                {
                    try
                    {
                        var bakJson = ReadVaultContent(BackupConfigPath);
                        var bakVault = JsonSerializer.Deserialize<VaultData>(bakJson);
                        if (bakVault != null && bakVault.Servers.Count > 0) return bakVault;
                    }
                    catch { }
                }
                return GetDefaultVault();
            }

            var json = ReadVaultContent(ConfigPath);
            if (string.IsNullOrWhiteSpace(json) && File.Exists(BackupConfigPath))
            {
                json = ReadVaultContent(BackupConfigPath);
            }

            var vault = JsonSerializer.Deserialize<VaultData>(json) ?? GetDefaultVault();
            
            // Remove legacy mock demo servers if present
            if (vault.Servers != null && vault.Servers.RemoveAll(s => s.Id == "demo-1" || s.Id == "demo-2") > 0)
            {
                Save(vault, notifyServers: false);
            }

            return vault;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[StorageService] Load error: {ex.Message}");
            if (File.Exists(BackupConfigPath))
            {
                try
                {
                    var bakJson = ReadVaultContent(BackupConfigPath);
                    var bakVault = JsonSerializer.Deserialize<VaultData>(bakJson);
                    if (bakVault != null) return bakVault;
                }
                catch { }
            }
            return GetDefaultVault();
        }
    }

    public static void Save(VaultData vault, bool notifyServers = false)
    {
        try
        {
            Directory.CreateDirectory(DataDir);
            var json = JsonSerializer.Serialize(vault, new JsonSerializerOptions { WriteIndented = true });
            var jsonBytes = System.Text.Encoding.UTF8.GetBytes(json);

            byte[] finalBytes;
            if (OperatingSystem.IsWindows())
            {
                try
                {
                    var encryptedPayload = DpapiHelper.Protect(jsonBytes);
                    finalBytes = new byte[DpapiHeader.Length + encryptedPayload.Length];
                    Buffer.BlockCopy(DpapiHeader, 0, finalBytes, 0, DpapiHeader.Length);
                    Buffer.BlockCopy(encryptedPayload, 0, finalBytes, DpapiHeader.Length, encryptedPayload.Length);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[StorageService] DPAPI encryption fallback: {ex.Message}");
                    finalBytes = jsonBytes;
                }
            }
            else
            {
                finalBytes = jsonBytes;
            }

            var tempPath = Path.Combine(DataDir, $"vault_{Guid.NewGuid():N}.tmp");
            File.WriteAllBytes(tempPath, finalBytes);

            if (File.Exists(ConfigPath))
            {
                try { File.Copy(ConfigPath, BackupConfigPath, true); } catch { }
                File.Move(tempPath, ConfigPath, overwrite: true);
            }
            else
            {
                File.Move(tempPath, ConfigPath);
            }

            if (notifyServers)
            {
                NotifyServersChanged();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[StorageService] Save error: {ex.Message}");
        }
    }

    private static string ReadVaultContent(string filePath)
    {
        var rawBytes = File.ReadAllBytes(filePath);
        if (rawBytes.Length == 0) return string.Empty;

        if (rawBytes.Length > DpapiHeader.Length && HasHeader(rawBytes, DpapiHeader))
        {
            try
            {
                var payload = new byte[rawBytes.Length - DpapiHeader.Length];
                Buffer.BlockCopy(rawBytes, DpapiHeader.Length, payload, 0, payload.Length);
                var decryptedBytes = DpapiHelper.Unprotect(payload);
                return System.Text.Encoding.UTF8.GetString(decryptedBytes);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[StorageService] DPAPI decryption error: {ex.Message}");
                throw;
            }
        }

        // Legacy unencrypted plaintext JSON fallback
        return System.Text.Encoding.UTF8.GetString(rawBytes);
    }

    private static bool HasHeader(byte[] data, byte[] header)
    {
        for (int i = 0; i < header.Length; i++)
        {
            if (data[i] != header[i]) return false;
        }
        return true;
    }

    private static VaultData GetDefaultVault()
    {
        return new VaultData
        {
            Servers = new List<ServerProfile>(),
            Settings = new AppSettings()
        };
    }
}
