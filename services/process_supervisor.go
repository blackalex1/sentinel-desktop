package services

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/sys/windows"
)

// ProcessSupervisor manages VPN core processes (sing-box, xray, hysteria) on Windows.
type ProcessSupervisor struct {
	mu            sync.Mutex
	logMu         sync.Mutex
	currentCmd    *exec.Cmd
	activeCore    string
	isRunning     bool
	jobHandle     windows.Handle
	logBuffer     []string
	maxLogLines   int
	wailsCtx      context.Context
	cancelMonitor context.CancelFunc
	downloadSpeed int64
	uploadSpeed   int64
	totalDownload int64
	totalUpload   int64
	socksPort     int
	httpPort      int
	clashPort     int
	startedAt     time.Time
}

var (
	processSupInstance *ProcessSupervisor
	processSupOnce     sync.Once
)

// GetProcessSupervisor returns the singleton ProcessSupervisor instance.
func GetProcessSupervisor() *ProcessSupervisor {
	processSupOnce.Do(func() {
		ps := &ProcessSupervisor{
			maxLogLines: 2000,
			logBuffer:   make([]string, 0, 100),
		}
		ps.initJobObject()
		processSupInstance = ps
	})
	return processSupInstance
}

// SetContext sets the Wails runtime context for event emission.
func (s *ProcessSupervisor) SetContext(ctx context.Context) {
	s.logMu.Lock()
	defer s.logMu.Unlock()
	s.wailsCtx = ctx
}

// initJobObject initializes a Windows Job Object with KILL_ON_JOB_CLOSE flag.
func (s *ProcessSupervisor) initJobObject() {
	job, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		fmt.Printf("[ProcessSupervisor] Warning: Failed to create Windows Job Object: %v\n", err)
		return
	}

	info := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{
		BasicLimitInformation: windows.JOBOBJECT_BASIC_LIMIT_INFORMATION{
			LimitFlags: windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
		},
	}

	_, err = windows.SetInformationJobObject(
		job,
		windows.JobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&info)),
		uint32(unsafe.Sizeof(info)),
	)
	if err != nil {
		fmt.Printf("[ProcessSupervisor] Warning: Failed to set Job Object info: %v\n", err)
		_ = windows.CloseHandle(job)
		return
	}

	s.jobHandle = job
	fmt.Println("[ProcessSupervisor] Windows Job Object initialized successfully (auto-kill child processes on exit).")
}

// StartCore starts a core binary with the specified config JSON.
func (s *ProcessSupervisor) StartCore(coreType, binPath, configJSON string, socksPort, httpPort, clashPort int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Stop any existing core
	s.stopCoreLocked()

	coreLower := strings.ToLower(coreType)
	s.activeCore = coreLower
	s.socksPort = socksPort
	s.httpPort = httpPort
	s.clashPort = clashPort

	// Verify binary
	absBin, err := filepath.Abs(binPath)
	if err != nil {
		absBin = binPath
	}
	if fi, err := os.Stat(absBin); err != nil || fi.Size() < 50000 {
		return fmt.Errorf("core binary not found or invalid at: %s", absBin)
	}

	// Kill any stray instances of this binary (e.g. from a previous crash)
	// that may be holding the proxy port. taskkill /F /IM is best-effort.
	exeName := filepath.Base(absBin)
	killStray := exec.Command("taskkill", "/F", "/IM", exeName)
	killStray.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000, HideWindow: true}
	if out, kerr := killStray.CombinedOutput(); kerr == nil {
		trimmed := strings.TrimSpace(string(out))
		if trimmed != "" {
			s.appendLog(fmt.Sprintf("[Sentinel] Killed stray %s instances: %s", exeName, trimmed))
		}
		time.Sleep(500 * time.Millisecond) // give OS time to release ports
	}

	// Write config to temporary file in binaries directory
	binDir := filepath.Dir(absBin)
	configFile := filepath.Join(binDir, fmt.Sprintf("sentinel_active_%s.json", coreLower))
	if err := os.WriteFile(configFile, []byte(configJSON), 0600); err != nil {
		return fmt.Errorf("failed to write core config file: %w", err)
	}

	// Prepare command arguments based on core type
	var args []string
	switch {
	case strings.Contains(coreLower, "sing"):
		args = []string{"run", "-c", configFile}
	case strings.Contains(coreLower, "xray"):
		args = []string{"run", "-c", configFile}
	case strings.Contains(coreLower, "hysteria"):
		args = []string{"client", "-c", configFile}
	default:
		args = []string{"run", "-c", configFile}
	}

	cmd := exec.Command(absBin, args...)
	cmd.Dir = binDir

	// Hide console window on Windows (CREATE_NO_WINDOW = 0x08000000)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: 0x08000000,
		HideWindow:    true,
	}

	// Setup stdout/stderr pipes
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start core process: %w", err)
	}

	// Assign process to Windows Job Object
	if s.jobHandle != 0 && cmd.Process != nil {
		pH, err := windows.OpenProcess(windows.PROCESS_SET_QUOTA|windows.PROCESS_TERMINATE, false, uint32(cmd.Process.Pid))
		if err == nil {
			_ = windows.AssignProcessToJobObject(s.jobHandle, pH)
			_ = windows.CloseHandle(pH)
		}
	}

	s.currentCmd = cmd
	s.isRunning = true
	s.startedAt = time.Now()
	s.downloadSpeed = 0
	s.uploadSpeed = 0

	s.appendLog(fmt.Sprintf("[Sentinel] Started %s core (PID: %d, SOCKS: %d, HTTP: %d)", coreType, cmd.Process.Pid, socksPort, httpPort))

	// Stream stdout & stderr in background goroutines
	go s.streamPipe(stdoutPipe, coreType)
	go s.streamPipe(stderrPipe, coreType)

	// Monitor process exit
	ctx, cancel := context.WithCancel(context.Background())
	s.cancelMonitor = cancel
	go s.monitorProcess(cmd, ctx)

	// Check if process stays alive
	s.mu.Unlock()
	time.Sleep(150 * time.Millisecond)
	s.mu.Lock()

	if !s.isRunning || s.currentCmd != cmd {
		errMsg := "ядро аварийно завершило работу при запуске"
		s.logMu.Lock()
		if len(s.logBuffer) > 0 {
			last := s.logBuffer[len(s.logBuffer)-1]
			errMsg = fmt.Sprintf("%s: %s", errMsg, last)
		}
		s.logMu.Unlock()
		return fmt.Errorf("%s", errMsg)
	}

	// Start background telemetry polling
	go s.pollTelemetry(ctx)

	return nil
}

func (s *ProcessSupervisor) pollTelemetry(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	client := &http.Client{Timeout: 600 * time.Millisecond}

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.mu.Lock()
			running := s.isRunning
			clashPort := s.clashPort
			if clashPort <= 0 {
				clashPort = 9090
			}
			s.mu.Unlock()
			if !running {
				return
			}

			var dlSpeed, ulSpeed, totalDl, totalUl int64

			// Query Clash API at 127.0.0.1:<clashPort>/connections
			resp, err := client.Get(fmt.Sprintf("http://127.0.0.1:%d/connections", clashPort))
			if err == nil {
				var connStats struct {
					DownloadTotal int64 `json:"downloadTotal"`
					UploadTotal   int64 `json:"uploadTotal"`
				}
				if json.NewDecoder(resp.Body).Decode(&connStats) == nil {
					totalDl = connStats.DownloadTotal
					totalUl = connStats.UploadTotal
				}
				_ = resp.Body.Close()
			}

			s.mu.Lock()
			if s.totalDownload > 0 && totalDl >= s.totalDownload {
				dlSpeed = totalDl - s.totalDownload
			}
			if s.totalUpload > 0 && totalUl >= s.totalUpload {
				ulSpeed = totalUl - s.totalUpload
			}
			if totalDl > 0 {
				s.totalDownload = totalDl
			}
			if totalUl > 0 {
				s.totalUpload = totalUl
			}
			s.downloadSpeed = dlSpeed
			s.uploadSpeed = ulSpeed
			s.mu.Unlock()

			s.logMu.Lock()
			wCtx := s.wailsCtx
			s.logMu.Unlock()

			if wCtx != nil {
				runtime.EventsEmit(wCtx, "traffic-stats", map[string]any{
					"downloadSpeed": dlSpeed,
					"uploadSpeed":   ulSpeed,
					"totalDownload": totalDl,
					"totalUpload":   totalUl,
				})
			}
		}
	}
}

var ansiRegex = regexp.MustCompile(`\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07`)

func stripANSI(str string) string {
	return ansiRegex.ReplaceAllString(str, "")
}

func (s *ProcessSupervisor) streamPipe(r io.Reader, coreType string) {
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		line := scanner.Text()
		cleaned := stripANSI(line)
		trimmed := strings.TrimSpace(cleaned)
		if trimmed == "" {
			continue
		}
		s.appendLog(fmt.Sprintf("[%s] %s", coreType, trimmed))
	}
}

func (s *ProcessSupervisor) monitorProcess(cmd *exec.Cmd, ctx context.Context) {
	err := cmd.Wait()

	s.mu.Lock()
	if s.currentCmd == cmd {
		s.isRunning = false
		s.currentCmd = nil
		s.mu.Unlock()

		msg := "[Sentinel] Core process terminated."
		if err != nil {
			msg = fmt.Sprintf("[Sentinel] Core process exited with error: %v", err)
		}
		s.appendLog(msg)

		s.logMu.Lock()
		wCtx := s.wailsCtx
		s.logMu.Unlock()

		if wCtx != nil {
			runtime.EventsEmit(wCtx, "connection-status-changed", "disconnected")
		}
	} else {
		s.mu.Unlock()
	}
}

func (s *ProcessSupervisor) appendLog(line string) {
	s.logMu.Lock()
	defer s.logMu.Unlock()

	timestamp := time.Now().Format("15:04:05")
	formatted := fmt.Sprintf("[%s] %s", timestamp, line)

	if len(s.logBuffer) >= s.maxLogLines {
		s.logBuffer = s.logBuffer[1:]
	}
	s.logBuffer = append(s.logBuffer, formatted)

	// Stream to sentinel-core.dll LogBroadcaster
	GetCoreDLL().PushCoreLog(s.activeCore, formatted)

	if s.wailsCtx != nil {
		runtime.EventsEmit(s.wailsCtx, "vpn-log", formatted)
	}
}

// StopCore stops any active VPN core process.
func (s *ProcessSupervisor) StopCore() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.stopCoreLocked()
}

func (s *ProcessSupervisor) stopCoreLocked() {
	if s.cancelMonitor != nil {
		s.cancelMonitor()
		s.cancelMonitor = nil
	}

	if s.currentCmd != nil && s.currentCmd.Process != nil {
		_ = s.currentCmd.Process.Kill()
		_ = s.currentCmd.Wait()
		s.currentCmd = nil
	}

	// Also kill any stray core binaries by name to ensure no background zombies
	for _, bin := range []string{"sing-box.exe", "xray.exe", "wxray.exe", "hysteria.exe"} {
		kCmd := exec.Command("taskkill", "/F", "/IM", bin)
		kCmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000, HideWindow: true}
		_ = kCmd.Run()
	}

	s.isRunning = false
	s.activeCore = ""
	s.socksPort = 0
	s.httpPort = 0
	s.clashPort = 0
	s.downloadSpeed = 0
	s.uploadSpeed = 0
}

// GetCurrentSocksPort returns the active SOCKS5 port.
func (s *ProcessSupervisor) GetCurrentSocksPort() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.socksPort > 0 {
		return s.socksPort
	}
	return 10808
}

// GetCurrentHttpPort returns the active HTTP port.
func (s *ProcessSupervisor) GetCurrentHttpPort() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.httpPort > 0 {
		return s.httpPort
	}
	return 10809
}

// IsRunning returns whether a VPN core process is currently active.
func (s *ProcessSupervisor) IsRunning() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.isRunning
}

// GetActiveCore returns the active core name.
func (s *ProcessSupervisor) GetActiveCore() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.activeCore
}

// GetLogs returns buffered log lines from sentinel-core.dll LogBroadcaster or local buffer.
func (s *ProcessSupervisor) GetLogs() []string {
	coreLogs := GetCoreDLL().GetLiveLogs(s.activeCore, 500)
	if len(coreLogs) > 0 {
		return coreLogs
	}

	s.logMu.Lock()
	defer s.logMu.Unlock()
	copied := make([]string, len(s.logBuffer))
	copy(copied, s.logBuffer)
	return copied
}

// ClearLogs clears logs in sentinel-core.dll LogBroadcaster and in-memory buffer.
func (s *ProcessSupervisor) ClearLogs() {
	GetCoreDLL().ClearCoreLogs(s.activeCore)
	s.logMu.Lock()
	defer s.logMu.Unlock()
	s.logBuffer = make([]string, 0, 100)
}

// GetSessionDurationSeconds returns seconds elapsed since connection started.
func (s *ProcessSupervisor) GetSessionDurationSeconds() int64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.isRunning || s.startedAt.IsZero() {
		return 0
	}
	return int64(time.Since(s.startedAt).Seconds())
}
