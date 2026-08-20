package main

import (
	"sentinel-desktop/services"
)

// ---------------------------------------------------------
// Cores & Geo Assets Management Module
// ---------------------------------------------------------

// CheckInstalledCores returns a map of which core binaries exist locally.
func (a *App) CheckInstalledCores() map[string]bool {
	return services.GetDownloader(a.baseDir, a.ctx).CheckInstalledCores()
}

// GetInstalledCoresDetails returns detailed status and version info for all cores.
func (a *App) GetInstalledCoresDetails() map[string]services.CoreDetails {
	return services.GetDownloader(a.baseDir, a.ctx).GetInstalledCoresDetails()
}

// FetchGitHubReleasesNative fetches releases for a repository with optional pre-releases.
func (a *App) FetchGitHubReleasesNative(repo string, includePrerelease bool) ([]map[string]any, error) {
	return services.GetDownloader(a.baseDir, a.ctx).FetchGitHubReleases(repo, includePrerelease)
}

// DownloadCoreBinary downloads a core binary from GitHub with progress events.
func (a *App) DownloadCoreBinary(coreType, downloadURL string) (bool, error) {
	err := services.GetDownloader(a.baseDir, a.ctx).DownloadCoreBinary(coreType, downloadURL)
	return err == nil, err
}

// CheckGeoDatabases returns metadata of local GeoIP and GeoSite files.
func (a *App) CheckGeoDatabases() map[string]any {
	return services.GetDownloader(a.baseDir, a.ctx).CheckGeoDatabases()
}

// UpdateGeoDatabases downloads latest GeoIP and GeoSite databases.
func (a *App) UpdateGeoDatabases() (bool, error) {
	err := services.GetDownloader(a.baseDir, a.ctx).UpdateGeoDatabases()
	return err == nil, err
}
