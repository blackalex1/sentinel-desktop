package services

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// UpdateGeoDatabases downloads latest geoip.dat and geosite.dat.
func (d *Downloader) UpdateGeoDatabases() error {
	geoipURL := "https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geoip.dat"
	geositeURL := "https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geosite.dat"

	binDir := filepath.Join(d.baseDir, "binaries")
	_ = os.MkdirAll(binDir, 0755)

	// Download GeoIP
	if err := d.downloadDirectFile(geoipURL, filepath.Join(binDir, "geoip.dat"), "geoip"); err != nil {
		return fmt.Errorf("failed downloading geoip: %w", err)
	}

	// Download GeoSite
	if err := d.downloadDirectFile(geositeURL, filepath.Join(binDir, "geosite.dat"), "geosite"); err != nil {
		return fmt.Errorf("failed downloading geosite: %w", err)
	}

	return nil
}

func (d *Downloader) downloadDirectFile(urlStr, destPath, itemType string) error {
	req, err := http.NewRequest("GET", urlStr, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "Sentinel-Secure-Desktop/2.0")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("status: %d", resp.StatusCode)
	}

	tmpPath := destPath + ".tmp"
	out, err := os.Create(tmpPath)
	if err != nil {
		return err
	}
	defer func() {
		out.Close()
		_ = os.Remove(tmpPath)
	}()

	totalBytes := resp.ContentLength
	var downloaded int64
	buf := make([]byte, 64*1024)

	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			if _, wErr := out.Write(buf[:n]); wErr != nil {
				return wErr
			}
			downloaded += int64(n)
			if totalBytes > 0 && d.wailsCtx != nil {
				percent := int((downloaded * 100) / totalBytes)
				runtime.EventsEmit(d.wailsCtx, "download-progress", DownloadProgressPayload{
					CoreType:        itemType,
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

	_ = os.Remove(destPath)
	return os.Rename(tmpPath, destPath)
}

// CheckGeoDatabases returns metadata of local GeoIP and GeoSite database files.
func (d *Downloader) CheckGeoDatabases() map[string]any {
	binDir := filepath.Join(d.baseDir, "binaries")
	geoipPath := filepath.Join(binDir, "geoip.dat")
	geositePath := filepath.Join(binDir, "geosite.dat")

	res := map[string]any{
		"geoip_exists":   false,
		"geoip_size":     int64(0),
		"geoip_mtime":    int64(0),
		"geosite_exists": false,
		"geosite_size":   int64(0),
		"geosite_mtime":  int64(0),
	}

	if fi, err := os.Stat(geoipPath); err == nil {
		res["geoip_exists"] = true
		res["geoip_size"] = fi.Size()
		res["geoip_mtime"] = fi.ModTime().Unix()
	}

	if fi, err := os.Stat(geositePath); err == nil {
		res["geosite_exists"] = true
		res["geosite_size"] = fi.Size()
		res["geosite_mtime"] = fi.ModTime().Unix()
	}

	return res
}
