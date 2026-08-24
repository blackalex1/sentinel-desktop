using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using SentinelDesktop.Models;

namespace SentinelDesktop.Services;

public class StorageService
{
    private static readonly string DataDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "data");
    private static readonly string ConfigPath = Path.Combine(DataDir, "vault.json");

    public class VaultData
    {
        public List<ServerProfile> Servers { get; set; } = new();
        public AppSettings Settings { get; set; } = new();
        public string? SelectedServerId { get; set; }
    }

    public static event Action<string>? LogLevelChanged;
    public static event Action? ServersChanged;

    public static void NotifyLogLevelChanged(string levelId)
    {
        LogLevelChanged?.Invoke(levelId);
    }

    public static void NotifyServersChanged()
    {
        ServersChanged?.Invoke();
    }

    public static VaultData Load()
    {
        try
        {
            if (!File.Exists(ConfigPath))
            {
                return GetDefaultVault();
            }
            var json = File.ReadAllText(ConfigPath);
            var vault = JsonSerializer.Deserialize<VaultData>(json) ?? GetDefaultVault();
            
            // Remove legacy mock demo servers if present
            if (vault.Servers != null && vault.Servers.RemoveAll(s => s.Id == "demo-1" || s.Id == "demo-2") > 0)
            {
                Save(vault);
            }

            return vault;
        }
        catch
        {
            return GetDefaultVault();
        }
    }

    public static void Save(VaultData vault)
    {
        try
        {
            Directory.CreateDirectory(DataDir);
            var json = JsonSerializer.Serialize(vault, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(ConfigPath, json);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[StorageService] Save error: {ex.Message}");
        }
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
