package main

import (
	"encoding/json"

	"sentinel-desktop/services"
)

// ---------------------------------------------------------
// Sentinel Hotspot & LAN Sharing Module
// ---------------------------------------------------------

// GetDefaultGateways discovers active default gateway IPs.
func (a *App) GetDefaultGateways() []string {
	return services.GetWindowsNet().GetDefaultGateways()
}

// GetNetworkAdapters returns all active network adapters with IP and Gateway as JSON string.
func (a *App) GetNetworkAdapters() string {
	adapters := services.GetWindowsNet().GetNetworkAdapters()
	b, _ := json.Marshal(adapters)
	return string(b)
}

// DetectDefaultGateway discovers active primary default gateway IP.
func (a *App) DetectDefaultGateway() string {
	return services.GetWindowsNet().DetectDefaultGateway()
}

// ProbeHotspotPairingServer probes for Sentinel Phone pairing server on target gateway.
func (a *App) ProbeHotspotPairingServer(gatewayIP string) string {
	res, _ := services.GetWindowsNet().ProbeHotspotPairingServer(gatewayIP)
	b, _ := json.Marshal(res)
	return string(b)
}

// RequestHotspotPairingWithPIN requests pairing with PIN verification.
func (a *App) RequestHotspotPairingWithPIN(gatewayIP string, pairingPort int, pinCode string) string {
	res, _ := services.GetWindowsNet().RequestHotspotPairingWithPIN(gatewayIP, pairingPort, pinCode)
	b, _ := json.Marshal(res)
	return string(b)
}

// StartLANProxy starts LAN proxy forwarder.
func (a *App) StartLANProxy(lanPort, localHttpPort int) (map[string]any, error) {
	if lanPort <= 0 {
		lanPort = 10811
	}
	if localHttpPort <= 0 {
		localHttpPort = 10809
	}
	err := services.GetWindowsNet().StartLANProxy(lanPort, localHttpPort)
	if err != nil {
		return map[string]any{"success": false, "error": err.Error()}, err
	}
	return map[string]any{"success": true, "port": lanPort}, nil
}

// StopLANProxy stops LAN proxy forwarder.
func (a *App) StopLANProxy() bool {
	services.GetWindowsNet().StopLANProxy()
	return true
}
