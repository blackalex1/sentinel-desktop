package services

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// FileValid checks whether a file exists and has a non-trivial size.
func FileValid(path string) bool {
	fi, err := os.Stat(path)
	return err == nil && fi.Size() > 5000
}

// GetCoreBinaryName maps core types to standard Windows executable / DLL filenames.
func GetCoreBinaryName(coreType string) string {
	c := strings.ToLower(coreType)
	switch {
	case strings.Contains(c, "sing"):
		return "sing-box.exe"
	case strings.Contains(c, "xray"):
		return "xray.exe"
	case strings.Contains(c, "hysteria"):
		return "hysteria.exe"
	case strings.Contains(c, "sentinel"):
		return "sentinel-core.dll"
	default:
		return fmt.Sprintf("%s.exe", coreType)
	}
}

// ExtractFileFromZip searches for targetFilename inside a zip archive and extracts it to destDir.
func ExtractFileFromZip(zipPath, destDir, targetFilename string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()

	targetLower := strings.ToLower(targetFilename)
	for _, f := range r.File {
		baseLower := strings.ToLower(filepath.Base(f.Name))
		if baseLower == targetLower || (strings.HasSuffix(baseLower, ".exe") && strings.Contains(baseLower, strings.TrimSuffix(targetLower, ".exe"))) {
			rc, err := f.Open()
			if err != nil {
				return err
			}
			defer rc.Close()

			destPath := filepath.Join(destDir, targetFilename)
			_ = os.Remove(destPath)
			outFile, err := os.Create(destPath)
			if err != nil {
				return err
			}
			defer outFile.Close()

			_, err = io.Copy(outFile, rc)
			return err
		}
	}
	return fmt.Errorf("target file %s not found in zip", targetFilename)
}

// ExtractFileFromTarGz searches for targetFilename inside a tar.gz archive and extracts it to destDir.
func ExtractFileFromTarGz(tarGzPath, destDir, targetFilename string) error {
	f, err := os.Open(tarGzPath)
	if err != nil {
		return err
	}
	defer f.Close()

	gzr, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gzr.Close()

	tr := tar.NewReader(gzr)
	targetLower := strings.ToLower(targetFilename)

	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		baseLower := strings.ToLower(filepath.Base(header.Name))
		if baseLower == targetLower {
			destPath := filepath.Join(destDir, targetFilename)
			_ = os.Remove(destPath)
			outFile, err := os.Create(destPath)
			if err != nil {
				return err
			}
			defer outFile.Close()

			_, err = io.Copy(outFile, tr)
			return err
		}
	}
	return fmt.Errorf("target file %s not found in tar.gz", targetFilename)
}
