package main

import (
	"strings"

	"sentinel-desktop/services"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ---------------------------------------------------------
// System, Storage & Window Management Module
// ---------------------------------------------------------

// CheckIsAdmin returns whether the app is running with elevated privileges.
func (a *App) CheckIsAdmin() bool {
	return services.IsRunningAsAdmin()
}

// RequestAdminElevation requests UAC elevation to restart as Administrator.
func (a *App) RequestAdminElevation() (bool, error) {
	err := services.RequestAdminElevation()
	return err == nil, err
}

// SaveStoreData saves data to local encrypted vault.
func (a *App) SaveStoreData(key, dataJSON string) bool {
	return services.GetStorage().SaveData(key, dataJSON)
}

// ReadStoreData reads data from local encrypted vault.
func (a *App) ReadStoreData(key string) string {
	return services.GetStorage().ReadData(key)
}

// MinimizeWindow minimizes the main application window.
func (a *App) MinimizeWindow() {
	if a.ctx != nil {
		runtime.WindowMinimise(a.ctx)
	}
}

// CloseWindow hides or minimizes window to system tray.
func (a *App) CloseWindow() {
	if a.ctx != nil {
		runtime.WindowHide(a.ctx)
	}
}

// StartDragWindow enables window dragging.
func (a *App) StartDragWindow() {
	if a.ctx != nil {
		// Drag handled natively via data-wails-drag or Wails runtime
	}
}

// OpenURL opens an external URL in the system browser safely.
func (a *App) OpenURL(url string) {
	if a.ctx != nil && (strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://")) {
		runtime.BrowserOpenURL(a.ctx, url)
	}
}
