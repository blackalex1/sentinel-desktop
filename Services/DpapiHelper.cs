using System;
using System.Runtime.InteropServices;
using System.Text;

namespace SentinelDesktop.Services;

/// <summary>
/// Provides secure encryption and decryption for sensitive configuration files using Windows DPAPI (Data Protection API).
/// Encrypted payloads are tied to the current Windows user account and cannot be decrypted by unauthorized users or machines.
/// </summary>
public static class DpapiHelper
{
    private const int CRYPTPROTECT_UI_FORBIDDEN = 0x1;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct DATA_BLOB
    {
        public int cbData;
        public IntPtr pbData;
    }

    [DllImport("crypt32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CryptProtectData(
        ref DATA_BLOB pDataIn,
        string? szDataDescr,
        IntPtr pOptionalEntropy,
        IntPtr pvReserved,
        IntPtr pPromptStruct,
        int dwFlags,
        ref DATA_BLOB pDataOut);

    [DllImport("crypt32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CryptUnprotectData(
        ref DATA_BLOB pDataIn,
        StringBuilder? ppszDataDescr,
        IntPtr pOptionalEntropy,
        IntPtr pvReserved,
        IntPtr pPromptStruct,
        int dwFlags,
        ref DATA_BLOB pDataOut);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr LocalFree(IntPtr hMem);

    /// <summary>
    /// Encrypts byte array using Windows Data Protection API (CurrentUser scope).
    /// </summary>
    public static byte[] Protect(byte[] data)
    {
        if (!OperatingSystem.IsWindows() || data.Length == 0)
            return data;

        var inBlob = new DATA_BLOB();
        var outBlob = new DATA_BLOB();
        var inHandle = GCHandle.Alloc(data, GCHandleType.Pinned);

        try
        {
            inBlob.cbData = data.Length;
            inBlob.pbData = inHandle.AddrOfPinnedObject();

            if (!CryptProtectData(ref inBlob, "SentinelVault", IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, CRYPTPROTECT_UI_FORBIDDEN, ref outBlob))
            {
                var err = Marshal.GetLastWin32Error();
                throw new InvalidOperationException($"CryptProtectData failed with win32 error code {err}");
            }

            var result = new byte[outBlob.cbData];
            Marshal.Copy(outBlob.pbData, result, 0, outBlob.cbData);
            return result;
        }
        finally
        {
            inHandle.Free();
            if (outBlob.pbData != IntPtr.Zero)
            {
                LocalFree(outBlob.pbData);
            }
        }
    }

    /// <summary>
    /// Decrypts DPAPI-encrypted byte array using Windows Data Protection API.
    /// </summary>
    public static byte[] Unprotect(byte[] protectedData)
    {
        if (!OperatingSystem.IsWindows() || protectedData.Length == 0)
            return protectedData;

        var inBlob = new DATA_BLOB();
        var outBlob = new DATA_BLOB();
        var inHandle = GCHandle.Alloc(protectedData, GCHandleType.Pinned);

        try
        {
            inBlob.cbData = protectedData.Length;
            inBlob.pbData = inHandle.AddrOfPinnedObject();

            if (!CryptUnprotectData(ref inBlob, null, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, CRYPTPROTECT_UI_FORBIDDEN, ref outBlob))
            {
                var err = Marshal.GetLastWin32Error();
                throw new InvalidOperationException($"CryptUnprotectData failed with win32 error code {err}");
            }

            var result = new byte[outBlob.cbData];
            Marshal.Copy(outBlob.pbData, result, 0, outBlob.cbData);
            return result;
        }
        finally
        {
            inHandle.Free();
            if (outBlob.pbData != IntPtr.Zero)
            {
                LocalFree(outBlob.pbData);
            }
        }
    }
}
