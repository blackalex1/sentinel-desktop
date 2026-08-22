package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os/exec"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

var (
	modWinINet             = syscall.NewLazyDLL("wininet.dll")
	procInternetSetOptionW = modWinINet.NewProc("InternetSetOptionW")
)

const (
	internetOptionSettingsChanged = 39
	internetOptionRefresh         = 37
)

// WindowsNetManager manages Windows System Proxy and LAN sharing.
type WindowsNetManager struct {
	mu           sync.Mutex
	proxyEnabled bool
	lanListener  net.Listener
	lanProxyPort int
}

var (
	winNetInstance *WindowsNetManager
	winNetOnce     sync.Once
)

// GetWindowsNet returns the singleton WindowsNetManager instance.
func GetWindowsNet() *WindowsNetManager {
	winNetOnce.Do(func() {
		winNetInstance = &WindowsNetManager{}
	})
	return winNetInstance
}

// EnableSystemProxy configures and activates Windows System Proxy.
func (w *WindowsNetManager) EnableSystemProxy(httpPort, socksPort int) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	k, err := registry.OpenKey(
		registry.CURRENT_USER,
		`Software\Microsoft\Windows\CurrentVersion\Internet Settings`,
		registry.SET_VALUE|registry.QUERY_VALUE,
	)
	if err != nil {
		return fmt.Errorf("failed to open Internet Settings registry key: %w", err)
	}
	defer k.Close()

	var proxyServer string
	if httpPort > 0 && socksPort > 0 {
		proxyServer = fmt.Sprintf("http=127.0.0.1:%d;https=127.0.0.1:%d;socks=127.0.0.1:%d", httpPort, httpPort, socksPort)
	} else if httpPort > 0 {
		proxyServer = fmt.Sprintf("127.0.0.1:%d", httpPort)
	} else if socksPort > 0 {
		proxyServer = fmt.Sprintf("socks=127.0.0.1:%d", socksPort)
	} else {
		proxyServer = "127.0.0.1:10809"
	}

	proxyOverride := "<local>;localhost;127.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.20.*;172.21.*;172.22.*;172.23.*;172.24.*;172.25.*;172.26.*;172.27.*;172.28.*;172.29.*;172.30.*;172.31.*;192.168.*"

	if err := k.SetDWordValue("ProxyEnable", 1); err != nil {
		return fmt.Errorf("failed to set ProxyEnable: %w", err)
	}
	if err := k.SetStringValue("ProxyServer", proxyServer); err != nil {
		return fmt.Errorf("failed to set ProxyServer: %w", err)
	}
	if err := k.SetStringValue("ProxyOverride", proxyOverride); err != nil {
		return fmt.Errorf("failed to set ProxyOverride: %w", err)
	}

	w.refreshWinINet()
	w.proxyEnabled = true
	fmt.Printf("[WindowsNet] System proxy enabled: %s\n", proxyServer)
	return nil
}

// DisableSystemProxy turns off Windows System Proxy.
func (w *WindowsNetManager) DisableSystemProxy() error {
	w.mu.Lock()
	defer w.mu.Unlock()

	k, err := registry.OpenKey(
		registry.CURRENT_USER,
		`Software\Microsoft\Windows\CurrentVersion\Internet Settings`,
		registry.SET_VALUE,
	)
	if err != nil {
		return fmt.Errorf("failed to open Internet Settings registry key: %w", err)
	}
	defer k.Close()

	_ = k.SetDWordValue("ProxyEnable", 0)
	w.refreshWinINet()
	w.proxyEnabled = false
	fmt.Println("[WindowsNet] System proxy disabled.")
	return nil
}

func (w *WindowsNetManager) refreshWinINet() {
	_, _, _ = procInternetSetOptionW.Call(0, uintptr(internetOptionSettingsChanged), 0, 0)
	_, _, _ = procInternetSetOptionW.Call(0, uintptr(internetOptionRefresh), 0, 0)
}

// GetDefaultGateways discovers active default gateway IPs on the system.
func (w *WindowsNetManager) GetDefaultGateways() []string {
	var gateways []string
	seen := make(map[string]bool)

	// Approach 1: Parse route print
	cmd := exec.Command("cmd", "/c", "route print 0.0.0.0")
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000, HideWindow: true}
	if out, err := cmd.Output(); err == nil {
		lines := strings.Split(string(out), "\n")
		for _, line := range lines {
			fields := strings.Fields(line)
			if len(fields) >= 5 && fields[0] == "0.0.0.0" && fields[1] == "0.0.0.0" {
				gw := fields[2]
				if ip := net.ParseIP(gw); ip != nil && !ip.IsLoopback() && !ip.IsUnspecified() {
					if !seen[gw] {
						gateways = append(gateways, gw)
						seen[gw] = true
					}
				}
			}
		}
	}

	// Approach 2: Enumerate non-loopback local interface IPs
	ifaces, err := net.Interfaces()
	if err == nil {
		for _, iface := range ifaces {
			if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
				continue
			}
			addrs, err := iface.Addrs()
			if err != nil {
				continue
			}
			for _, addr := range addrs {
				if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
					if ip4 := ipnet.IP.To4(); ip4 != nil {
						ipStr := ip4.String()
						if !seen[ipStr] && (strings.HasPrefix(ipStr, "192.168.") || strings.HasPrefix(ipStr, "10.") || strings.HasPrefix(ipStr, "172.")) {
							gateways = append(gateways, ipStr)
							seen[ipStr] = true
						}
					}
				}
			}
		}
	}

	return gateways
}

// StartLANProxy starts a LAN forwarder proxy listening on 0.0.0.0:lanPort forwarding to 127.0.0.1:localHttpPort.
func (w *WindowsNetManager) StartLANProxy(lanPort, localHttpPort int) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.lanListener != nil {
		_ = w.lanListener.Close()
		w.lanListener = nil
	}

	listenAddr := fmt.Sprintf("0.0.0.0:%d", lanPort)
	l, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %w", listenAddr, err)
	}

	w.lanListener = l
	w.lanProxyPort = lanPort
	targetAddr := fmt.Sprintf("127.0.0.1:%d", localHttpPort)

	go func() {
		for {
			clientConn, err := l.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer c.Close()
				targetConn, err := net.Dial("tcp", targetAddr)
				if err != nil {
					return
				}
				defer targetConn.Close()

				var wg sync.WaitGroup
				wg.Add(2)
				go func() {
					defer wg.Done()
					_, _ = io.Copy(targetConn, c)
				}()
				go func() {
					defer wg.Done()
					_, _ = io.Copy(c, targetConn)
				}()
				wg.Wait()
			}(clientConn)
		}
	}()

	fmt.Printf("[WindowsNet] LAN proxy gateway active on %s -> %s\n", listenAddr, targetAddr)
	return nil
}

// NetworkAdapterInfo holds details about an active network adapter on Windows.
type NetworkAdapterInfo struct {
	Name       string `json:"name"`
	IP         string `json:"ip"`
	Gateway    string `json:"gateway"`
	IsWireless bool   `json:"isWireless"`
}

// GetNetworkAdapters discovers all active network adapters using native Win32 GetAdaptersAddresses API.
func (w *WindowsNetManager) GetNetworkAdapters() []NetworkAdapterInfo {
	var list []NetworkAdapterInfo
	seen := make(map[string]bool)

	var b []byte
	l := uint32(15000)
	for {
		b = make([]byte, l)
		err := windows.GetAdaptersAddresses(windows.AF_INET, windows.GAA_FLAG_INCLUDE_GATEWAYS, 0, (*windows.IpAdapterAddresses)(unsafe.Pointer(&b[0])), &l)
		if err == nil {
			break
		}
		if err.(windows.Errno) == windows.ERROR_BUFFER_OVERFLOW {
			continue
		}
		return list
	}

	addr := (*windows.IpAdapterAddresses)(unsafe.Pointer(&b[0]))
	for ; addr != nil; addr = addr.Next {
		name := windows.UTF16PtrToString(addr.FriendlyName)
		isWireless := addr.IfType == 71 || strings.Contains(strings.ToLower(name), "wi-fi") || strings.Contains(strings.ToLower(name), "беспроводн") || strings.Contains(strings.ToLower(name), "wireless") || strings.Contains(strings.ToLower(name), "wlan")

		// First IPv4 address
		var ipStr string
		for u := addr.FirstUnicastAddress; u != nil; u = u.Next {
			sockaddr := (*windows.RawSockaddrInet4)(unsafe.Pointer(u.Address.Sockaddr))
			if sockaddr.Family == windows.AF_INET {
				ip := net.IP(sockaddr.Addr[:])
				if !ip.IsLoopback() && !ip.IsUnspecified() {
					ipStr = ip.String()
					break
				}
			}
		}

		// First Gateway address
		var gwStr string
		for g := addr.FirstGatewayAddress; g != nil; g = g.Next {
			sockaddr := (*windows.RawSockaddrInet4)(unsafe.Pointer(g.Address.Sockaddr))
			if sockaddr.Family == windows.AF_INET {
				gw := net.IP(sockaddr.Addr[:])
				if !gw.IsLoopback() && !gw.IsUnspecified() {
					gwStr = gw.String()
					break
				}
			}
		}

		if ipStr != "" && gwStr != "" && !seen[gwStr] {
			seen[gwStr] = true
			info := NetworkAdapterInfo{
				Name:       name,
				IP:         ipStr,
				Gateway:    gwStr,
				IsWireless: isWireless,
			}
			if isWireless {
				list = append([]NetworkAdapterInfo{info}, list...)
			} else {
				list = append(list, info)
			}
		}
	}

	return list
}

// DetectDefaultGateway finds the active default gateway IP, prioritizing Wi-Fi / Hotspot interfaces.
func (w *WindowsNetManager) DetectDefaultGateway() string {
	adapters := w.GetNetworkAdapters()
	for _, a := range adapters {
		if a.IsWireless && a.Gateway != "" {
			return a.Gateway
		}
	}
	if len(adapters) > 0 && adapters[0].Gateway != "" {
		return adapters[0].Gateway
	}
	return "127.0.0.1"
}

// ProbeHotspotPairingServer attempts to detect SentinelPairingServer on target gateway or all active gateways in parallel.
func (w *WindowsNetManager) ProbeHotspotPairingServer(gatewayIP string) (map[string]any, error) {
	var targetGateways []string
	if gatewayIP != "" {
		targetGateways = []string{gatewayIP}
	} else {
		adapters := w.GetNetworkAdapters()
		for _, a := range adapters {
			if a.Gateway != "" {
				targetGateways = append(targetGateways, a.Gateway)
			}
		}
		if len(targetGateways) == 0 {
			targetGateways = []string{w.DetectDefaultGateway()}
		}
	}

	candidatePorts := []int{18080, 18081, 18082, 19080, 19081}
	client := &http.Client{Timeout: 1200 * time.Millisecond}

	for _, gw := range targetGateways {
		for _, port := range candidatePorts {
			pingURL := fmt.Sprintf("http://%s:%d/pair/ping", gw, port)
			resp, err := client.Get(pingURL)
			if err != nil || resp.StatusCode != http.StatusOK {
				continue
			}
			_ = resp.Body.Close()

			// Found active pairing server! Query config
			configURL := fmt.Sprintf("http://%s:%d/pair/config", gw, port)
			cfgResp, err := client.Get(configURL)
			if err == nil && cfgResp.StatusCode == http.StatusOK {
				body, _ := io.ReadAll(cfgResp.Body)
				_ = cfgResp.Body.Close()

				var data map[string]any
				if json.Unmarshal(body, &data) == nil {
					data["found"] = true
					data["gatewayIP"] = gw
					data["pairingPort"] = port
					return data, nil
				}
			}

			return map[string]any{
				"found":        true,
				"gatewayIP":    gw,
				"pairingPort":  port,
				"proxyType":    "SOCKS5",
				"port":         10808,
				"socksPort":    10808,
				"httpPort":     10809,
				"authRequired": false,
			}, nil
		}
	}

	lastGW := gatewayIP
	if lastGW == "" && len(targetGateways) > 0 {
		lastGW = strings.Join(targetGateways, ", ")
	}
	return map[string]any{
		"found":     false,
		"gatewayIP": lastGW,
		"error":     fmt.Sprintf("Sentinel Pairing Server не найден на шлюзах: %s", lastGW),
	}, nil
}

// RequestHotspotPairingWithPIN sends an interactive pairing request with PIN code to Sentinel Phone.
func (w *WindowsNetManager) RequestHotspotPairingWithPIN(gatewayIP string, pairingPort int, pinCode string) (map[string]any, error) {
	if gatewayIP == "" {
		gatewayIP = w.DetectDefaultGateway()
	}
	if pairingPort <= 0 {
		pairingPort = 18080
	}

	reqURL := fmt.Sprintf("http://%s:%d/pair/request", gatewayIP, pairingPort)
	payload := map[string]string{
		"clientName": "Sentinel Windows Desktop",
		"pinCode":    pinCode,
	}
	payloadBytes, _ := json.Marshal(payload)

	client := &http.Client{Timeout: 32 * time.Second}
	resp, err := client.Post(reqURL, "application/json", strings.NewReader(string(payloadBytes)))
	if err != nil {
		return map[string]any{
			"success": false,
			"error":   fmt.Sprintf("Ошибка связи с сервером телефона: %v", err),
		}, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var data map[string]any
	if err := json.Unmarshal(body, &data); err == nil {
		data["gatewayIP"] = gatewayIP
		data["pairingPort"] = pairingPort
		return data, nil
	}

	return map[string]any{
		"success": false,
		"error":   "Неверный ответ от телефона",
	}, nil
}

// StopLANProxy stops any active LAN forwarder listener.
func (w *WindowsNetManager) StopLANProxy() {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.lanListener != nil {
		_ = w.lanListener.Close()
		w.lanListener = nil
		w.lanProxyPort = 0
		fmt.Println("[WindowsNet] LAN proxy gateway stopped.")
	}
}

// IsPortAvailable checks if a TCP port can be bound on 127.0.0.1.
func IsPortAvailable(port int) bool {
	if port <= 0 || port > 65535 {
		return false
	}
	l, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return false
	}
	_ = l.Close()
	return true
}

// FindAvailablePort returns preferredPort if free, or the next available TCP port.
func FindAvailablePort(preferredPort int) int {
	if preferredPort <= 0 {
		preferredPort = 10808
	}
	for p := preferredPort; p < preferredPort+100; p++ {
		if IsPortAvailable(p) {
			return p
		}
	}
	// Fallback to random free port by binding to 0
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err == nil {
		defer l.Close()
		if tcpAddr, ok := l.Addr().(*net.TCPAddr); ok {
			return tcpAddr.Port
		}
	}
	return preferredPort
}
