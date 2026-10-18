using System;
using System.Security.Cryptography;
using System.Text;

namespace SentinelDesktop.Services;

public static class HotspotCrypto
{
    private const string PinSalt = "SentinelHotspotSecureSalt_v1";
    private const int GcmIvLength = 12;
    private const int GcmTagLength = 16;

    /// <summary>
    /// Derives a 256-bit AES key from a PIN code and salt using SHA-256 (matches Android SentinelCrypto).
    /// </summary>
    public static byte[] DeriveKeyFromPin(string pin)
    {
        using var sha256 = SHA256.Create();
        var combined = Encoding.UTF8.GetBytes($"{PinSalt}:{pin.Trim()}");
        return sha256.ComputeHash(combined);
    }

    /// <summary>
    /// Derives a 256-bit AES key from a PIN code using PBKDF2WithHmacSHA256 (100,000 iterations).
    /// </summary>
    public static byte[] DeriveKeyFromPinPbkdf2(string pin, byte[]? salt = null)
    {
        salt ??= Encoding.UTF8.GetBytes(PinSalt);
        using var pbkdf2 = new Rfc2898DeriveBytes(pin.Trim(), salt, 100_000, HashAlgorithmName.SHA256);
        return pbkdf2.GetBytes(32);
    }

    /// <summary>
    /// Generates a random nonce string for request freshness and replay prevention.
    /// </summary>
    public static string GenerateNonce()
    {
        var nonceBytes = new byte[16];
        RandomNumberGenerator.Fill(nonceBytes);
        return Convert.ToBase64String(nonceBytes)
            .Replace("+", "-").Replace("/", "_").TrimEnd('=');
    }

    /// <summary>
    /// Encrypts plaintext string using AES-256-GCM.
    /// Output format: Base64([12-byte Nonce/IV] + [Ciphertext] + [16-byte Tag])
    /// </summary>
    public static string Encrypt(string plainText, byte[] key)
    {
        var nonce = new byte[GcmIvLength];
        RandomNumberGenerator.Fill(nonce);

        var plainBytes = Encoding.UTF8.GetBytes(plainText);
        var cipherBytes = new byte[plainBytes.Length];
        var tag = new byte[GcmTagLength];

        using var aes = new AesGcm(key, GcmTagLength);
        aes.Encrypt(nonce, plainBytes, cipherBytes, tag);

        var combined = new byte[GcmIvLength + cipherBytes.Length + GcmTagLength];
        Buffer.BlockCopy(nonce, 0, combined, 0, GcmIvLength);
        Buffer.BlockCopy(cipherBytes, 0, combined, GcmIvLength, cipherBytes.Length);
        Buffer.BlockCopy(tag, 0, combined, GcmIvLength + cipherBytes.Length, GcmTagLength);

        return Convert.ToBase64String(combined);
    }

    /// <summary>
    /// Decrypts Base64 payload containing [12-byte Nonce/IV] + [Ciphertext] + [16-byte Tag] using AES-256-GCM.
    /// </summary>
    public static string Decrypt(string base64Payload, byte[] key)
    {
        var combined = Convert.FromBase64String(base64Payload.Trim());
        if (combined.Length < GcmIvLength + GcmTagLength)
        {
            throw new ArgumentException("Invalid ciphertext payload: length too short");
        }

        var nonce = combined.AsSpan(0, GcmIvLength);
        var cipherLen = combined.Length - GcmIvLength - GcmTagLength;
        var cipherBytes = combined.AsSpan(GcmIvLength, cipherLen);
        var tag = combined.AsSpan(GcmIvLength + cipherLen, GcmTagLength);

        var plainBytes = new byte[cipherLen];
        using var aes = new AesGcm(key, GcmTagLength);
        aes.Decrypt(nonce, cipherBytes, tag, plainBytes);

        return Encoding.UTF8.GetString(plainBytes);
    }
}
