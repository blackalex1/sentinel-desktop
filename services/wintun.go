package services

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// EnsureWintunExtracted verifies that wintun.dll exists in binaries/ and the root directory.
func EnsureWintunExtracted(baseDir string) error {
	wintunTarget := filepath.Join(baseDir, "binaries", "wintun.dll")
	if fi, err := os.Stat(wintunTarget); err == nil && fi.Size() > 10000 {
		// Also ensure a copy in root if needed by sing-box
		rootCopy := filepath.Join(baseDir, "wintun.dll")
		if _, err := os.Stat(rootCopy); err != nil {
			_ = copyFile(wintunTarget, rootCopy)
		}
		return nil
	}

	// Check if wintun.dll exists in root
	rootWintun := filepath.Join(baseDir, "wintun.dll")
	if fi, err := os.Stat(rootWintun); err == nil && fi.Size() > 10000 {
		_ = copyFile(rootWintun, wintunTarget)
		return nil
	}

	// Check if wintun.zip exists in binaries/
	zipPath := filepath.Join(baseDir, "binaries", "wintun.zip")
	if _, err := os.Stat(zipPath); err == nil {
		if err := extractWintunFromZip(zipPath, wintunTarget); err == nil {
			_ = copyFile(wintunTarget, rootWintun)
			return nil
		}
	}

	return fmt.Errorf("wintun.dll not found")
}

func extractWintunFromZip(zipFile, destPath string) error {
	r, err := zip.OpenReader(zipFile)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		if strings.HasSuffix(strings.ToLower(f.Name), "amd64/wintun.dll") || strings.EqualFold(filepath.Base(f.Name), "wintun.dll") {
			rc, err := f.Open()
			if err != nil {
				return err
			}
			defer rc.Close()

			_ = os.MkdirAll(filepath.Dir(destPath), 0755)
			outFile, err := os.Create(destPath)
			if err != nil {
				return err
			}
			defer outFile.Close()

			_, err = io.Copy(outFile, rc)
			return err
		}
	}

	return fmt.Errorf("wintun.dll not found inside zip archive")
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	_ = os.MkdirAll(filepath.Dir(dst), 0755)
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}
