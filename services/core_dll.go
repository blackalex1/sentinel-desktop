package services

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"syscall"
	"unsafe"
)

// CoreDLLManager dynamically loads and manages sentinel-core.dll at runtime.
type CoreDLLManager struct {
	mu      sync.RWMutex
	dllPath string
	dll     *syscall.DLL
	isReady bool
	version string
}

var (
	coreDLLInstance *CoreDLLManager
	coreDLLOnce     sync.Once
)

// GetCoreDLL returns the singleton CoreDLLManager instance.
func GetCoreDLL() *CoreDLLManager {
	coreDLLOnce.Do(func() {
		coreDLLInstance = &CoreDLLManager{}
	})
	return coreDLLInstance
}

// Init loads the sentinel-core.dll from the binaries directory or app directory.
func (m *CoreDLLManager) Init(baseDir string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	candidates := []string{
		filepath.Join(baseDir, "binaries", "sentinel-core.dll"),
		filepath.Join(baseDir, "sentinel-core.dll"),
		filepath.Join(baseDir, "..", "..", "binaries", "sentinel-core.dll"),
		filepath.Join(baseDir, "..", "binaries", "sentinel-core.dll"),
		filepath.Join("binaries", "sentinel-core.dll"),
		"sentinel-core.dll",
		`c:\Users\black\PycharmProjects\sentinel_core\sentinel-core.dll`,
	}

	var lastErr error
	for _, p := range candidates {
		if fi, err := os.Stat(p); err == nil && fi.Size() > 1000000 {
			if err := m.loadDLLLocked(p); err == nil {
				return nil
			} else {
				lastErr = err
			}
		}
	}

	m.isReady = false
	if lastErr != nil {
		return fmt.Errorf("failed to load sentinel-core.dll: %w", lastErr)
	}
	return fmt.Errorf("sentinel-core.dll not found in candidate paths")
}

func (m *CoreDLLManager) loadDLLLocked(path string) error {
	if m.dll != nil {
		_ = m.dll.Release()
		m.dll = nil
		m.isReady = false
	}

	absPath, err := filepath.Abs(path)
	if err != nil {
		absPath = path
	}

	dll, err := syscall.LoadDLL(absPath)
	if err != nil {
		m.isReady = false
		return fmt.Errorf("failed to load DLL at %s: %w", absPath, err)
	}

	m.dll = dll
	m.dllPath = absPath
	m.isReady = true

	// Read version
	if proc, err := dll.FindProc("SentinelGetEngineVersion"); err == nil {
		r, _, _ := proc.Call()
		m.version = m.readAndFreeCString(r)
	} else {
		m.version = "dev"
	}

	return nil
}

// Reload reloads the DLL from disk (hot reload after update).
func (m *CoreDLLManager) Reload() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.dllPath == "" {
		return fmt.Errorf("no DLL path configured")
	}
	return m.loadDLLLocked(m.dllPath)
}

// IsReady returns whether the DLL is loaded and ready for calls.
func (m *CoreDLLManager) IsReady() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.isReady
}

// GetVersion returns the loaded engine version.
func (m *CoreDLLManager) GetVersion() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if !m.isReady {
		return "Not loaded"
	}
	return m.version
}

// GetDLLPath returns the active DLL path.
func (m *CoreDLLManager) GetDLLPath() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.dllPath
}

// Helper: convert Go string to null-terminated C string pointer
func cString(s string) uintptr {
	b := append([]byte(s), 0)
	return uintptr(unsafe.Pointer(&b[0]))
}

// Helper: read null-terminated UTF-8 string from C pointer and free it using SentinelFreeString
func (m *CoreDLLManager) readAndFreeCString(ptr uintptr) string {
	if ptr == 0 {
		return ""
	}

	origPtr := ptr
	var bytes []byte
	p := (*byte)(unsafe.Pointer(ptr))
	for *p != 0 {
		bytes = append(bytes, *p)
		ptr++
		p = (*byte)(unsafe.Pointer(ptr))
	}
	res := string(bytes)

	// Free C-allocated string to prevent memory leaks
	if m.dll != nil {
		if procFree, err := m.dll.FindProc("SentinelFreeString"); err == nil {
			_, _, _ = procFree.Call(origPtr)
		}
	}

	return res
}

func (m *CoreDLLManager) callAndReadString(procName string, args ...uintptr) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if !m.isReady || m.dll == nil {
		return "", fmt.Errorf("sentinel-core.dll is not loaded")
	}

	proc, err := m.dll.FindProc(procName)
	if err != nil {
		return "", fmt.Errorf("proc %s not found in DLL: %w", procName, err)
	}

	r, _, errSys := proc.Call(args...)
	if r == 0 {
		if errSys != nil && errSys.Error() != "The operation completed successfully." {
			return "", errSys
		}
		return "", nil
	}

	// Read string from pointer
	var bytes []byte
	curr := r
	p := (*byte)(unsafe.Pointer(curr))
	for *p != 0 {
		bytes = append(bytes, *p)
		curr++
		p = (*byte)(unsafe.Pointer(curr))
	}
	res := string(bytes)

	// Free the string via SentinelFreeString
	if procFree, err := m.dll.FindProc("SentinelFreeString"); err == nil {
		procFree.Call(r)
	}

	return res, nil
}

// BuildConfig invokes SentinelBuildConfig in DLL.
func (m *CoreDLLManager) BuildConfig(specJSON string) (string, error) {
	res, err := m.callAndReadString("SentinelBuildConfig", cString(specJSON))
	if err != nil {
		return "", err
	}
	return res, nil
}

// BuildServerConfig invokes SentinelBuildServerConfig in DLL.
func (m *CoreDLLManager) BuildServerConfig(specJSON string) (string, error) {
	return m.callAndReadString("SentinelBuildServerConfig", cString(specJSON))
}

// ParseURI invokes SentinelParseURI in DLL.
func (m *CoreDLLManager) ParseURI(rawURI string) (string, error) {
	res, err := m.callAndReadString("SentinelParseURI", cString(rawURI))
	if err != nil {
		return "", err
	}
	return res, nil
}

// GenerateURI invokes SentinelGenerateURI in DLL.
func (m *CoreDLLManager) GenerateURI(profileJSON string) (string, error) {
	return m.callAndReadString("SentinelGenerateURI", cString(profileJSON))
}

// BatchPing invokes SentinelBatchPing in DLL or native concurrent TCP dialer.
func (m *CoreDLLManager) BatchPing(targetsJSON string, timeoutMs int) (string, error) {
	res, err := m.callAndReadString("SentinelBatchPing", cString(targetsJSON), uintptr(timeoutMs))
	if err == nil && res != "" {
		return res, nil
	}
	return m.nativeBatchPing(targetsJSON, timeoutMs)
}

// ProxyPing invokes SentinelProxyPing in DLL or native HTTP proxy latency tester.
func (m *CoreDLLManager) ProxyPing(socksPort int, authUser, authPass, targetURL string, timeoutMs int) (string, error) {
	res, err := m.callAndReadString("SentinelProxyPing", uintptr(socksPort), cString(authUser), cString(authPass), cString(targetURL), uintptr(timeoutMs))
	if err == nil && res != "" {
		return res, nil
	}
	return m.nativeProxyPing(socksPort, targetURL, timeoutMs)
}

// GetPublicIP invokes SentinelGetPublicIP in DLL or native IP lookup.
func (m *CoreDLLManager) GetPublicIP(socksPort int, authUser, authPass string, timeoutMs int) (string, error) {
	res, err := m.callAndReadString("SentinelGetPublicIP", uintptr(socksPort), cString(authUser), cString(authPass), uintptr(timeoutMs))
	if err == nil && res != "" {
		return res, nil
	}
	return m.nativePublicIP(socksPort, timeoutMs)
}

// ListPresets invokes SentinelListPresets in DLL or native presets.
func (m *CoreDLLManager) ListPresets() (string, error) {
	res, err := m.callAndReadString("SentinelListPresets")
	if err == nil && res != "" {
		return res, nil
	}
	return m.nativeListPresets()
}

// GetPreset invokes SentinelGetPreset in DLL or native presets.
func (m *CoreDLLManager) GetPreset(presetID string) (string, error) {
	res, err := m.callAndReadString("SentinelGetPreset", cString(presetID))
	if err == nil && res != "" && res != "{}" {
		return res, nil
	}
	return m.nativeGetPreset(presetID)
}

// GetSecuritySchema invokes SentinelGetSecuritySchema in DLL.
func (m *CoreDLLManager) GetSecuritySchema(lang string) (string, error) {
	return m.callAndReadString("SentinelGetSecuritySchema", cString(lang))
}

// GetDefaultSecurityConfig invokes SentinelGetDefaultSecurityConfig in DLL.
func (m *CoreDLLManager) GetDefaultSecurityConfig() (string, error) {
	return m.callAndReadString("SentinelGetDefaultSecurityConfig")
}

// ValidateSecurityConfig invokes SentinelValidateSecurityConfig in DLL.
func (m *CoreDLLManager) ValidateSecurityConfig(configJSON string) (bool, error) {
	res, err := m.callAndReadString("SentinelValidateSecurityConfig", cString(configJSON))
	if err != nil {
		return false, err
	}
	var out struct {
		Valid bool   `json:"valid"`
		Error string `json:"error"`
	}
	if err := json.Unmarshal([]byte(res), &out); err != nil {
		return false, nil
	}
	return out.Valid, nil
}

// GenerateX25519Keys invokes SentinelGenerateX25519Keys in DLL.
func (m *CoreDLLManager) GenerateX25519Keys() (string, error) {
	return m.callAndReadString("SentinelGenerateX25519Keys")
}

// GenerateVlessEncKeys invokes SentinelGenerateVlessEncKeys in DLL.
func (m *CoreDLLManager) GenerateVlessEncKeys() (string, error) {
	return m.callAndReadString("SentinelGenerateVlessEncKeys")
}

// PushCoreLog pushes a log line into sentinel-core.dll.
func (m *CoreDLLManager) PushCoreLog(coreName, line string) {
	_, _ = m.callAndReadString("SentinelPushLogLine", cString(coreName), cString(line))
}

// GetLiveLogs retrieves recent log lines from sentinel-core.dll.
func (m *CoreDLLManager) GetLiveLogs(coreName string, limit int) []string {
	res, err := m.callAndReadString("SentinelGetInMemoryLogs", cString(coreName), uintptr(limit))
	if err != nil || res == "" {
		return nil
	}
	var logs []string
	if err := json.Unmarshal([]byte(res), &logs); err == nil {
		return logs
	}
	return nil
}

// ClearCoreLogs clears in-memory logs in sentinel-core.dll.
func (m *CoreDLLManager) ClearCoreLogs(coreName string) {
	_, _ = m.callAndReadString("SentinelClearInMemoryLogs", cString(coreName))
}
