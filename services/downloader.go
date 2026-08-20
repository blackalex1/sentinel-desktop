package services

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"syscall"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Downloader manages downloading of VPN cores and GeoIP/GeoSite databases.
type Downloader struct {
	baseDir    string
	httpClient *http.Client
	wailsCtx   context.Context
}

var (
	downloaderInstance *Downloader
)

// GetDownloader returns the Downloader instance.
func GetDownloader(baseDir string, ctx context.Context) *Downloader {
	if downloaderInstance == nil {
		downloaderInstance = &Downloader{
			baseDir: baseDir,
			httpClient: &http.Client{
				Timeout: 120 * time.Second,
			},
			wailsCtx: ctx,
		}
	}
	downloaderInstance.baseDir = baseDir
	downloaderInstance.wailsCtx = ctx
	return downloaderInstance
}

// DownloadProgressPayload is emitted to the frontend during downloads.
type DownloadProgressPayload struct {
	CoreType        string `json:"core_type"`
	Percent         int    `json:"percent"`
	BytesDownloaded int64  `json:"bytes_downloaded"`
	TotalBytes      int64  `json:"total_bytes"`
}

// CoreDetails holds installation and version info of a core.
type CoreDetails struct {
	Installed bool   `json:"installed"`
	Version   string `json:"version"`
	Path      string `json:"path"`
}

// CheckInstalledCores returns the presence of each core binary in binaries/.
func (d *Downloader) CheckInstalledCores() map[string]bool {
	binDir := filepath.Join(d.baseDir, "binaries")
	return map[string]bool{
		"singbox":       FileValid(filepath.Join(binDir, "sing-box.exe")),
		"xray":          FileValid(filepath.Join(binDir, "xray.exe")) || FileValid(filepath.Join(binDir, "wxray.exe")),
		"hysteria":      FileValid(filepath.Join(binDir, "hysteria.exe")),
		"wintun":        FileValid(filepath.Join(binDir, "wintun.dll")) || FileValid(filepath.Join(d.baseDir, "wintun.dll")),
		"sentinel_core": FileValid(filepath.Join(binDir, "sentinel-core.dll")),
		"geoip":         FileValid(filepath.Join(binDir, "geoip.dat")),
		"geosite":       FileValid(filepath.Join(binDir, "geosite.dat")),
	}
}

// GetInstalledCoresDetails returns detailed info for all cores.
func (d *Downloader) GetInstalledCoresDetails() map[string]CoreDetails {
	binDir := filepath.Join(d.baseDir, "binaries")
	return map[string]CoreDetails{
		"sentinel_core": {
			Installed: FileValid(filepath.Join(binDir, "sentinel-core.dll")),
			Version:   GetCoreDLL().GetVersion(),
			Path:      "binaries/sentinel-core.dll",
		},
		"singbox": {
			Installed: FileValid(filepath.Join(binDir, "sing-box.exe")),
			Version:   detectExeVersion(filepath.Join(binDir, "sing-box.exe")),
			Path:      "binaries/sing-box.exe",
		},
		"xray": {
			Installed: FileValid(filepath.Join(binDir, "xray.exe")) || FileValid(filepath.Join(binDir, "wxray.exe")),
			Version:   detectExeVersion(filepath.Join(binDir, "xray.exe")),
			Path:      "binaries/xray.exe",
		},
		"hysteria": {
			Installed: FileValid(filepath.Join(binDir, "hysteria.exe")),
			Version:   detectExeVersion(filepath.Join(binDir, "hysteria.exe")),
			Path:      "binaries/hysteria.exe",
		},
		"wintun": {
			Installed: FileValid(filepath.Join(binDir, "wintun.dll")) || FileValid(filepath.Join(d.baseDir, "wintun.dll")),
			Version:   "0.14.1",
			Path:      "binaries/wintun.dll",
		},
		"geoip": {
			Installed: FileValid(filepath.Join(binDir, "geoip.dat")),
			Version:   "Latest",
			Path:      "binaries/geoip.dat",
		},
		"geosite": {
			Installed: FileValid(filepath.Join(binDir, "geosite.dat")),
			Version:   "Latest",
			Path:      "binaries/geosite.dat",
		},
	}
}

var semverRegex = regexp.MustCompile(`(?i)\b(v?[0-9]+\.[0-9]+(?:\.[0-9]+)?(?:-[a-zA-Z0-9\.]+)?)\b`)

func detectExeVersion(binPath string) string {
	if !FileValid(binPath) {
		return "Не установлено"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, binPath, "version")
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: 0x08000000,
		HideWindow:    true,
	}
	out, err := cmd.CombinedOutput()
	if err != nil && len(out) == 0 {
		return "Установлено"
	}
	s := string(out)
	for _, line := range strings.Split(s, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		matches := semverRegex.FindAllString(line, -1)
		for _, m := range matches {
			if strings.HasPrefix(strings.ToLower(m), "go") {
				continue
			}
			return m
		}
	}
	return "Установлено"
}

// DownloadCoreBinary downloads a core binary from URL with progress reporting.
func (d *Downloader) DownloadCoreBinary(coreType, downloadURL string) error {
	req, err := http.NewRequest("GET", downloadURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "Sentinel-Secure-Desktop/2.0")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download returned status: %d", resp.StatusCode)
	}

	binDir := filepath.Join(d.baseDir, "binaries")
	_ = os.MkdirAll(binDir, 0755)

	tmpFile := filepath.Join(binDir, fmt.Sprintf("temp_download_%s.tmp", coreType))
	out, err := os.Create(tmpFile)
	if err != nil {
		return err
	}
	defer func() {
		out.Close()
		_ = os.Remove(tmpFile)
	}()

	totalBytes := resp.ContentLength
	var downloaded int64
	buf := make([]byte, 64*1024)

	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			_, wErr := out.Write(buf[:n])
			if wErr != nil {
				return wErr
			}
			downloaded += int64(n)
			if totalBytes > 0 && d.wailsCtx != nil {
				percent := int((downloaded * 100) / totalBytes)
				runtime.EventsEmit(d.wailsCtx, "download-progress", DownloadProgressPayload{
					CoreType:        coreType,
					Percent:         percent,
					BytesDownloaded: downloaded,
					TotalBytes:      totalBytes,
				})
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
	}
	out.Close()

	// Extract or move to target
	downloadLower := strings.ToLower(downloadURL)
	targetExe := filepath.Join(binDir, GetCoreBinaryName(coreType))

	if strings.HasSuffix(downloadLower, ".zip") {
		if err := ExtractFileFromZip(tmpFile, binDir, GetCoreBinaryName(coreType)); err != nil {
			return err
		}
	} else if strings.HasSuffix(downloadLower, ".tar.gz") || strings.HasSuffix(downloadLower, ".tgz") {
		if err := ExtractFileFromTarGz(tmpFile, binDir, GetCoreBinaryName(coreType)); err != nil {
			return err
		}
	} else {
		// Direct executable or dll
		_ = os.Remove(targetExe)
		if err := copyFile(tmpFile, targetExe); err != nil {
			return err
		}
	}

	// If sentinel-core was updated, reload DLL
	if strings.Contains(strings.ToLower(coreType), "sentinel") {
		_ = GetCoreDLL().Reload()
	}

	return nil
}
