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

    public static void NotifyLogLevelChanged(string levelId)
    {
        LogLevelChanged?.Invoke(levelId);
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
            return JsonSerializer.Deserialize<VaultData>(json) ?? GetDefaultVault();
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
            Servers = new List<ServerProfile>
            {
                new ServerProfile
                {
                    Id = "demo-1",
                    Name = "Germany - VLESS Reality (Fast)",
                    Protocol = "vless",
                    Address = "185.220.101.5",
                    Port = 443,
                    Uuid = "e98a3b11-5d20-4a87-8e6f-123456789abc",
                    Sni = "yahoo.com",
                    Pbk = "k3J8...",
                    Ping = 42,
                    Country = "DE"
                },
                new ServerProfile
                {
                    Id = "demo-2",
                    Name = "Netherlands - High Bandwidth",
                    Protocol = "vless",
                    Address = "194.26.29.112",
                    Port = 443,
                    Uuid = "d43b2a11-8c44-4f91-9e12-987654321def",
                    Sni = "microsoft.com",
                    Pbk = "n9K2...",
                    Ping = 36,
                    Country = "NL"
                }
            },
            Settings = new AppSettings()
        };
    }
}
