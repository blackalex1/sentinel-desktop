package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"sentinel-desktop/services"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx     context.Context
	baseDir string
}

// NewApp creates a new App application struct
func NewApp() *App {
	exePath, err := os.Executable()
	baseDir := "."
	if err == nil {
		baseDir = filepath.Dir(exePath)
	}
	return &App{
		baseDir: baseDir,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	fmt.Printf("[Sentinel Desktop] Starting up in: %s\n", a.baseDir)

	// Set context for event streaming
	services.GetProcessSupervisor().SetContext(ctx)
	services.GetStorage().Init(a.baseDir)

	// Initialize dynamic DLL loader
	if err := services.GetCoreDLL().Init(a.baseDir); err != nil {
		fmt.Printf("[Sentinel Desktop] Core DLL init warning: %v\n", err)
	} else {
		fmt.Printf("[Sentinel Desktop] Dynamic Sentinel-Core DLL loaded (version: %s)\n", services.GetCoreDLL().GetVersion())
	}

	// Ensure wintun.dll is in place
	_ = services.EnsureWintunExtracted(a.baseDir)

	// Initialize Windows System Tray Icon
	services.InitWindowsTray(services.TrayCallbacks{
		OnOpen: func() {
			if a.ctx != nil {
				runtime.WindowShow(a.ctx)
				runtime.WindowUnminimise(a.ctx)
			}
		},
		OnToggle: func() {
			if a.ctx != nil {
				runtime.EventsEmit(a.ctx, "tray-toggle-connect")
			}
		},
		OnQuit: func() {
			if a.ctx != nil {
				runtime.Quit(a.ctx)
			}
		},
		GetStatus: func() (bool, string) {
			running := services.GetProcessSupervisor().IsRunning()
			return running, ""
		},
	})

	// Emit detected gateway and adapters to frontend
	go func() {
		time.Sleep(300 * time.Millisecond)
		gw := services.GetWindowsNet().DetectDefaultGateway()
		adapters := services.GetWindowsNet().GetNetworkAdapters()
		b, _ := json.Marshal(adapters)
		if a.ctx != nil {
			if gw != "" {
				runtime.EventsEmit(a.ctx, "gateway-detected", gw)
			}
			runtime.EventsEmit(a.ctx, "adapters-detected", string(b))
		}
	}()
}

// shutdown is called when the app closes
func (a *App) shutdown(ctx context.Context) {
	fmt.Println("[Sentinel Desktop] Shutting down...")
	services.InitWindowsTray(services.TrayCallbacks{}).RemoveTray()
	services.GetProcessSupervisor().StopCore()
	_ = services.GetWindowsNet().DisableSystemProxy()
	services.GetWindowsNet().StopLANProxy()
}

// ---------------------------------------------------------
// VPN Connection & Core Supervision
// ---------------------------------------------------------

// ConnectVPN compiles configuration using sentinel-core.dll and launches the active core.
func (a *App) ConnectVPN(serverJSON string, settingsJSON string) (map[string]any, error) {
	var server map[string]any
	if err := json.Unmarshal([]byte(serverJSON), &server); err != nil {
		return map[string]any{"success": false, "error": "Invalid server JSON"}, err
	}

	var settings struct {
		ActiveCore    string `json:"activeCore"`
		TunMode       bool   `json:"tunMode"`
		SystemProxy   bool   `json:"systemProxy"`
		SocksPort     int    `json:"socksPort"`
		HttpPort      int    `json:"httpPort"`
		LogLevel      string `json:"logLevel"`
		RoutingPreset string `json:"routingPreset"`
		BypassRu      bool   `json:"bypassRu"`
		QuickRules    map[string]struct {
			Enabled  bool   `json:"enabled"`
			Outbound string `json:"outbound"`
		} `json:"quickRules"`
		RoutingRules []map[string]any `json:"routingRules"`
	}
	_ = json.Unmarshal([]byte(settingsJSON), &settings)

	if settings.SocksPort <= 0 {
		settings.SocksPort = 10808
	}
	if settings.HttpPort <= 0 {
		settings.HttpPort = 10809
	}
	if settings.ActiveCore == "" {
		settings.ActiveCore = "singbox"
	}
	if settings.LogLevel == "" {
		settings.LogLevel = "info"
	}

	// Validate protocol & core compatibility
	serverProto, _ := server["protocol"].(string)
	serverProtoLower := strings.ToLower(strings.TrimSpace(serverProto))
	activeCoreLower := strings.ToLower(strings.TrimSpace(settings.ActiveCore))

	if strings.Contains(activeCoreLower, "hysteria") {
		if !strings.Contains(serverProtoLower, "hy") && !strings.Contains(serverProtoLower, "hysteria") {
			return map[string]any{
				"success": false,
				"error":   fmt.Sprintf("Ядро Hysteria 2 не поддерживает протокол %s (поддерживается только Hysteria 2). Для %s выберите ядро Sing-box или Xray-core.", strings.ToUpper(serverProto), strings.ToUpper(serverProto)),
			}, nil
		}
	} else if strings.Contains(activeCoreLower, "xray") {
		if strings.Contains(serverProtoLower, "hy") || strings.Contains(serverProtoLower, "hysteria") {
			return map[string]any{
				"success": false,
				"error":   "Ядро Xray-core не поддерживает протокол Hysteria 2. Для Hysteria 2 выберите ядро Sing-box или Hysteria 2.",
			}, nil
		}
	}

	// If TUN mode is enabled on Windows and not admin, prompt for elevation
	if settings.TunMode && !services.IsRunningAsAdmin() {
		_ = services.RequestAdminElevation()
		return map[string]any{
			"success": false,
			"error":   "Требуются права Администратора для TUN-режима. Подтвердите запрос UAC.",
		}, nil
	}

	// Normalize server keys
	if pbk, ok := server["pbk"].(string); ok && pbk != "" {
		server["publicKey"] = pbk
	}
	if sid, ok := server["sid"].(string); ok && sid != "" {
		server["shortId"] = sid
	}
	if fp, ok := server["fp"].(string); ok && fp != "" {
		server["fingerprint"] = fp
	}

	// Safety: if security is reality but publicKey is empty, fallback to tls
	sec, _ := server["security"].(string)
	pk, _ := server["publicKey"].(string)
	if strings.EqualFold(sec, "reality") && pk == "" {
		server["security"] = "tls"
	}

	// Dynamic routing policy compilation
	enabledPresets := make([]string, 0)
	targetOverrides := make(map[string]string)

	if len(settings.QuickRules) > 0 {
		for pid, q := range settings.QuickRules {
			if q.Enabled {
				enabledPresets = append(enabledPresets, pid)
				target := strings.ToLower(q.Outbound)
				if target == "blocked" || target == "block" {
					targetOverrides[pid] = "block"
				} else if target == "direct" {
					targetOverrides[pid] = "direct"
				} else if strings.HasPrefix(target, "srv_") {
					targetOverrides[pid] = "proxy"
				} else {
					targetOverrides[pid] = target
				}
			}
		}
	} else {
		// Fallback defaults
		enabledPresets = []string{"ads"}
		targetOverrides["ads"] = "block"
		if settings.BypassRu {
			enabledPresets = append(enabledPresets, "ru")
			targetOverrides["ru"] = "direct"
		}
	}

	customRules := make([]map[string]any, 0)
	for _, r := range settings.RoutingRules {
		enableVal, _ := r["enable"].(float64)
		if enableVal == 0 {
			if en, ok := r["enabled"].(bool); ok && !en {
				continue
			}
		}
		ruleTarget := "direct"
		if out, ok := r["outbound_tag"].(string); ok {
			outLow := strings.ToLower(out)
			if outLow == "blocked" || outLow == "block" {
				ruleTarget = "block"
			} else if outLow == "proxy" {
				ruleTarget = "proxy"
			}
		}
		customRules = append(customRules, map[string]any{
			"name":      r["remark"],
			"enabled":   true,
			"target":    ruleTarget,
			"domains":   r["domains"],
			"ips":       r["ips"],
			"protocols": r["protocols"],
		})
	}

	// Prepare ConfigSpec JSON for sentinel-core compiler
	spec := map[string]any{
		"targetCore":      settings.ActiveCore,
		"logLevel":        settings.LogLevel,
		"serverNode":      server,
		"clashApiAddress": "127.0.0.1:9090",
		"clientInbound": map[string]any{
			"mode": func() string {
				if settings.TunMode {
					return "desktop_tun"
				}
				return "system_proxy"
			}(),
			"socksPort":        settings.SocksPort,
			"httpPort":         settings.HttpPort,
			"tunInterfaceName": "Sentinel-TUN",
			"strictRoute":      true,
			"autoRoute":        true,
		},
		"routing": map[string]any{
			"mode":                  "smart_rule",
			"enabledPresets":        enabledPresets,
			"presetTargetOverrides": targetOverrides,
			"customRules":           customRules,
		},
	}

	specBytes, _ := json.Marshal(spec)

	// Compile config via sentinel-core.dll
	dllRes, err := services.GetCoreDLL().BuildConfig(string(specBytes))
	if err != nil || dllRes == "" {
		return map[string]any{
			"success": false,
			"error":   fmt.Sprintf("Ошибка компиляции конфигурации ядром: %v", err),
		}, err
	}

	var compiledJSON string
	var buildRes struct {
		ConfigJSON string `json:"configJson"`
		Error      string `json:"error"`
	}
	if err := json.Unmarshal([]byte(dllRes), &buildRes); err == nil && buildRes.ConfigJSON != "" {
		if buildRes.Error != "" {
			return map[string]any{
				"success": false,
				"error":   fmt.Sprintf("Ошибка ядра: %s", buildRes.Error),
			}, fmt.Errorf("%s", buildRes.Error)
		}
		compiledJSON = buildRes.ConfigJSON
	} else if strings.HasPrefix(strings.TrimSpace(dllRes), "{") {
		compiledJSON = dllRes
	}

	// Sanitize Sing-box 1.10+/1.12+ TUN fields if present
	if strings.Contains(strings.ToLower(settings.ActiveCore), "sing") && compiledJSON != "" {
		var cfg map[string]any
		if err := json.Unmarshal([]byte(compiledJSON), &cfg); err == nil {
			if inbounds, ok := cfg["inbounds"].([]any); ok {
				modified := false
				for _, in := range inbounds {
					if inMap, ok := in.(map[string]any); ok {
						if inMap["type"] == "tun" {
							if inet4, ok := inMap["inet4_address"]; ok && inet4 != nil {
								var addrList []string
								if s, ok := inet4.(string); ok && s != "" {
									addrList = append(addrList, s)
								} else if arr, ok := inet4.([]any); ok {
									for _, item := range arr {
										if str, ok := item.(string); ok && str != "" {
											addrList = append(addrList, str)
										}
									}
								}
								if inet6, ok := inMap["inet6_address"].(string); ok && inet6 != "" {
									addrList = append(addrList, inet6)
								}
								if len(addrList) > 0 {
									inMap["address"] = addrList
								} else {
									inMap["address"] = []string{"172.19.0.1/30"}
								}
								delete(inMap, "inet4_address")
								delete(inMap, "inet6_address")
								modified = true
							}
						}
					}
				}
				if modified {
					if b, err := json.MarshalIndent(cfg, "", "  "); err == nil {
						compiledJSON = string(b)
					}
				}
			}
		}
	}

	if compiledJSON == "" {
		return map[string]any{
			"success": false,
			"error":   "Ядро вернуло пустую конфигурацию",
		}, fmt.Errorf("empty config returned from core")
	}

	// Locate core binary
	binName := "sing-box.exe"
	if strings.Contains(strings.ToLower(settings.ActiveCore), "xray") {
		binName = "xray.exe"
		// Fallback to wxray if xray not present
		if _, err := os.Stat(filepath.Join(a.baseDir, "binaries", "xray.exe")); err != nil {
			if _, err2 := os.Stat(filepath.Join(a.baseDir, "binaries", "wxray.exe")); err2 == nil {
				binName = "wxray.exe"
			}
		}
	} else if strings.Contains(strings.ToLower(settings.ActiveCore), "hysteria") {
		binName = "hysteria.exe"
	}

	binPath := filepath.Join(a.baseDir, "binaries", binName)

	// Ensure Wintun driver if TUN mode
	if settings.TunMode {
		_ = services.EnsureWintunExtracted(a.baseDir)
	}

	// Start core process
	if err := services.GetProcessSupervisor().StartCore(settings.ActiveCore, binPath, compiledJSON); err != nil {
		return map[string]any{
			"success": false,
			"error":   fmt.Sprintf("Не удалось запустить ядро %s: %v", settings.ActiveCore, err),
		}, err
	}

	// Enable System Proxy if requested
	if settings.SystemProxy && !settings.TunMode {
		_ = services.GetWindowsNet().EnableSystemProxy(settings.HttpPort, settings.SocksPort)
	}

	return map[string]any{
		"success": true,
		"core":    settings.ActiveCore,
	}, nil
}

// DisconnectVPN stops the active core and restores system proxy.
func (a *App) DisconnectVPN() (map[string]any, error) {
	services.GetProcessSupervisor().StopCore()
	_ = services.GetWindowsNet().DisableSystemProxy()
	return map[string]any{"success": true}, nil
}

// GetConnectionStatus returns current connection status.
func (a *App) GetConnectionStatus() map[string]any {
	ps := services.GetProcessSupervisor()
	isRunning := ps.IsRunning()
	return map[string]any{
		"connected":       isRunning,
		"status":          func() string { if isRunning { return "connected" }; return "disconnected" }(),
		"activeCore":      ps.GetActiveCore(),
		"durationSeconds": ps.GetSessionDurationSeconds(),
	}
}

// GetLiveLogs returns buffered live core logs.
func (a *App) GetLiveLogs() []string {
	return services.GetProcessSupervisor().GetLogs()
}

// ClearLiveLogs clears buffered core logs.
func (a *App) ClearLiveLogs() {
	services.GetProcessSupervisor().ClearLogs()
}

// ---------------------------------------------------------
// Sentinel-Core DLL Operations
// ---------------------------------------------------------

// ParseProxyURI parses any proxy link via sentinel-core.dll.
func (a *App) ParseProxyURI(rawURI string) (map[string]any, error) {
	jsonStr, err := services.GetCoreDLL().ParseURI(rawURI)
	if err != nil {
		return nil, err
	}
	var res map[string]any
	if err := json.Unmarshal([]byte(jsonStr), &res); err != nil {
		return nil, err
	}
	return res, nil
}

// GenerateProxyURI generates a shareable URI from profile JSON.
func (a *App) GenerateProxyURI(profileJSON string) (string, error) {
	resJSON, err := services.GetCoreDLL().GenerateURI(profileJSON)
	if err != nil {
		return "", err
	}
	var mapRes map[string]string
	if err := json.Unmarshal([]byte(resJSON), &mapRes); err == nil && mapRes["uri"] != "" {
		return mapRes["uri"], nil
	}
	return resJSON, nil
}

// BatchPingNodes executes parallel TCP ping via sentinel-core.dll.
func (a *App) BatchPingNodes(targetsJSON string, timeoutMs int) (string, error) {
	if timeoutMs <= 0 {
		timeoutMs = 2500
	}
	return services.GetCoreDLL().BatchPing(targetsJSON, timeoutMs)
}

// ProxyPingActive tests latency through active SOCKS5 proxy or directly via sentinel-core.dll.
func (a *App) ProxyPingActive(socksPort int, authUser, authPass string, targetURL string, timeoutMs int) (string, error) {
	if socksPort <= 0 && services.GetProcessSupervisor().IsRunning() {
		socksPort = 10808
	}
	if targetURL == "" {
		targetURL = "http://cp.cloudflare.com/generate_204"
	}
	if timeoutMs <= 0 {
		timeoutMs = 3000
	}
	return services.GetCoreDLL().ProxyPing(socksPort, authUser, authPass, targetURL, timeoutMs)
}

// FetchPublicIPInfo retrieves current public IP and Geo info via sentinel-core.dll.
func (a *App) FetchPublicIPInfo(socksPort int, authUser, authPass string, timeoutMs int) (string, error) {
	if timeoutMs <= 0 {
		timeoutMs = 3500
	}
	if socksPort <= 0 && services.GetProcessSupervisor().IsRunning() {
		socksPort = 10808
	}
	return services.GetCoreDLL().GetPublicIP(socksPort, authUser, authPass, timeoutMs)
}

// FetchRoutingPresets returns atomic routing presets from sentinel-core.dll.
func (a *App) FetchRoutingPresets() (string, error) {
	return services.GetCoreDLL().ListPresets()
}

// FetchPresetDetails returns details of a single preset from sentinel-core.dll.
func (a *App) FetchPresetDetails(presetID string) (string, error) {
	return services.GetCoreDLL().GetPreset(presetID)
}

// GetDefaultRoutingRules builds default routing rules directly from sentinel-core presets.
func (a *App) GetDefaultRoutingRules() (string, error) {
	defaultPresetIDs := []string{"bittorrent", "lan", "ip_checkers", "ru"}
	rules := make([]map[string]any, 0)
	order := 1

	for _, pid := range defaultPresetIDs {
		raw, err := services.GetCoreDLL().GetPreset(pid)
		if err != nil || raw == "" {
			continue
		}
		var p struct {
			ID            string   `json:"id"`
			Name          string   `json:"name"`
			Description   string   `json:"description"`
			DefaultTarget string   `json:"defaultTarget"`
			Domains       []string `json:"domains"`
			IPs           []string `json:"ips"`
			Protocols     []string `json:"protocols"`
		}
		if err := json.Unmarshal([]byte(raw), &p); err == nil && p.Name != "" {
			outbound := "DIRECT"
			if strings.EqualFold(p.DefaultTarget, "block") || strings.EqualFold(p.DefaultTarget, "blocked") {
				outbound = "BLOCKED"
			}
			rules = append(rules, map[string]any{
				"id":           order,
				"remark":       p.Name,
				"outbound_tag": outbound,
				"domains":      p.Domains,
				"ips":          p.IPs,
				"protocols":    p.Protocols,
				"enable":       1,
			})
			order++
		}
	}

	b, _ := json.Marshal(rules)
	return string(b), nil
}

// GetSecuritySchema returns the JSON security schema for UI.
func (a *App) GetSecuritySchema(lang string) (string, error) {
	if lang == "" {
		lang = "ru"
	}
	return services.GetCoreDLL().GetSecuritySchema(lang)
}

// GenerateCryptoKeys generates X25519 & ML-KEM-768 keys via sentinel-core.dll.
func (a *App) GenerateCryptoKeys() (string, error) {
	return services.GetCoreDLL().GenerateVlessEncKeys()
}

// ValidateSecurityConfig validates security rules via sentinel-core.dll.
func (a *App) ValidateSecurityConfig(configJSON string) (bool, error) {
	return services.GetCoreDLL().ValidateSecurityConfig(configJSON)
}

// GetCoreDLLVersion returns the version of the currently loaded sentinel-core.dll.
func (a *App) GetCoreDLLVersion() string {
	return services.GetCoreDLL().GetVersion()
}

// ReloadCoreDLL reloads sentinel-core.dll from disk without restarting the app.
func (a *App) ReloadCoreDLL() (map[string]any, error) {
	err := services.GetCoreDLL().Reload()
	if err != nil {
		return map[string]any{"success": false, "error": err.Error()}, err
	}
	return map[string]any{
		"success": true,
		"version": services.GetCoreDLL().GetVersion(),
		"path":    services.GetCoreDLL().GetDLLPath(),
	}, nil
}
