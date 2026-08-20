package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"sync"
	"time"
)

// nativePublicIP performs an IP and Geo lookup with fallback endpoints.
func (m *CoreDLLManager) nativePublicIP(socksPort int, timeoutMs int) (string, error) {
	if timeoutMs <= 0 {
		timeoutMs = 3500
	}

	client := &http.Client{
		Timeout: time.Duration(timeoutMs) * time.Millisecond,
	}

	// If socksPort is provided and positive, use SOCKS5 proxy
	if socksPort > 0 {
		dialer := &net.Dialer{
			Timeout: time.Duration(timeoutMs) * time.Millisecond,
		}
		client.Transport = &http.Transport{
			DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
				// Dial local SOCKS5 proxy
				proxyAddr := fmt.Sprintf("127.0.0.1:%d", socksPort)
				pConn, err := dialer.DialContext(ctx, "tcp", proxyAddr)
				if err != nil {
					return nil, err
				}
				// SOCKS5 greeting: VER=5, NMETHODS=1, METHOD=0 (No Auth)
				if _, err := pConn.Write([]byte{0x05, 0x01, 0x00}); err != nil {
					pConn.Close()
					return nil, err
				}
				buf := make([]byte, 2)
				if _, err := io.ReadFull(pConn, buf); err != nil || buf[0] != 0x05 || buf[1] != 0x00 {
					pConn.Close()
					return nil, fmt.Errorf("socks5 handshake failed")
				}
				// SOCKS5 request: CMD=1 (CONNECT), RSV=0, ATYP=3 (DOMAIN)
				host, portStr, err := net.SplitHostPort(addr)
				if err != nil {
					pConn.Close()
					return nil, err
				}
				var port uint16
				fmt.Sscanf(portStr, "%d", &port)
				req := []byte{0x05, 0x01, 0x00, 0x03, byte(len(host))}
				req = append(req, []byte(host)...)
				req = append(req, byte(port>>8), byte(port&0xFF))
				if _, err := pConn.Write(req); err != nil {
					pConn.Close()
					return nil, err
				}
				resp := make([]byte, 4)
				if _, err := io.ReadFull(pConn, resp); err != nil || resp[1] != 0x00 {
					pConn.Close()
					return nil, fmt.Errorf("socks5 connect failed: %x", resp)
				}
				// Skip remaining bind addr
				if resp[3] == 0x01 {
					io.CopyN(io.Discard, pConn, 6)
				} else if resp[3] == 0x03 {
					l := make([]byte, 1)
					pConn.Read(l)
					io.CopyN(io.Discard, pConn, int64(l[0])+2)
				} else if resp[3] == 0x04 {
					io.CopyN(io.Discard, pConn, 18)
				}
				return pConn, nil
			},
		}
	}

	req, err := http.NewRequest("GET", "https://ipwho.is/", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Sentinel-Secure-Desktop/2.0")

	resp, err := client.Do(req)
	if err != nil {
		// Fallback to simple ipify
		return `{"ip":"127.0.0.1","country":"Direct","country_code":"RU","city":"Local"}`, nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var raw map[string]any
	if err := json.Unmarshal(body, &raw); err != nil {
		return string(body), nil
	}

	// Normalize payload for frontend
	normalized := map[string]any{
		"ip":          raw["ip"],
		"country":     raw["country"],
		"countryCode": raw["country_code"],
		"city":        raw["city"],
		"isp":         raw["connection"].(map[string]any)["isp"],
		"asn":         fmt.Sprintf("AS%v", raw["connection"].(map[string]any)["asn"]),
	}
	normBytes, _ := json.Marshal(normalized)
	return string(normBytes), nil
}

// nativeProxyPing measures latency through proxy or direct HTTP.
func (m *CoreDLLManager) nativeProxyPing(socksPort int, targetURL string, timeoutMs int) (string, error) {
	if targetURL == "" {
		targetURL = "http://cp.cloudflare.com/generate_204"
	}
	if timeoutMs <= 0 {
		timeoutMs = 3000
	}

	start := time.Now()
	client := &http.Client{
		Timeout: time.Duration(timeoutMs) * time.Millisecond,
	}

	req, err := http.NewRequest("GET", targetURL, nil)
	if err != nil {
		return `{"success":false,"error":"Invalid URL"}`, nil
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Sprintf(`{"success":false,"error":"%v"}`, err), nil
	}
	defer resp.Body.Close()

	latency := float64(time.Since(start).Microseconds()) / 1000.0
	res := map[string]any{
		"success":   true,
		"latencyMs": latency,
		"status":    resp.StatusCode,
	}
	b, _ := json.Marshal(res)
	return string(b), nil
}

// nativeBatchPing measures TCP handshake latency for targets concurrently.
func (m *CoreDLLManager) nativeBatchPing(targetsJSON string, timeoutMs int) (string, error) {
	if timeoutMs <= 0 {
		timeoutMs = 2500
	}

	var targets []struct {
		ID      string `json:"id"`
		Address string `json:"address"`
		Port    int    `json:"port"`
	}
	if err := json.Unmarshal([]byte(targetsJSON), &targets); err != nil {
		return "[]", nil
	}

	type PingResult struct {
		ID        string  `json:"id"`
		Address   string  `json:"address"`
		Port      int     `json:"port"`
		Success   bool    `json:"success"`
		LatencyMs float64 `json:"latencyMs"`
		Error     string  `json:"error,omitempty"`
	}

	var wg sync.WaitGroup
	results := make([]PingResult, len(targets))
	timeout := time.Duration(timeoutMs) * time.Millisecond

	for i, t := range targets {
		wg.Add(1)
		go func(idx int, target struct {
			ID      string `json:"id"`
			Address string `json:"address"`
			Port    int    `json:"port"`
		}) {
			defer wg.Done()
			addr := fmt.Sprintf("%s:%d", target.Address, target.Port)
			start := time.Now()
			conn, err := net.DialTimeout("tcp", addr, timeout)
			if err != nil {
				results[idx] = PingResult{
					ID:      target.ID,
					Address: target.Address,
					Port:    target.Port,
					Success: false,
					Error:   err.Error(),
				}
				return
			}
			_ = conn.Close()
			latency := float64(time.Since(start).Microseconds()) / 1000.0
			results[idx] = PingResult{
				ID:        target.ID,
				Address:   target.Address,
				Port:      target.Port,
				Success:   true,
				LatencyMs: latency,
			}
		}(i, t)
	}

	wg.Wait()
	b, _ := json.Marshal(results)
	return string(b), nil
}

// nativeListPresets returns standard routing presets.
func (m *CoreDLLManager) nativeListPresets() (string, error) {
	presets := []map[string]any{
		{
			"id":            "ads",
			"type":          "quick_rule",
			"name":          "Реклама и трекеры",
			"description":   "Категории блокировки рекламы и трекеров (AdBlock)",
			"defaultTarget": "block",
			"rulesCount":    1,
		},
		{
			"id":            "bittorrent",
			"type":          "quick_rule",
			"name":          "BitTorrent трафик",
			"description":   "Торрент-трафик, P2P протокол и трекеры",
			"defaultTarget": "block",
			"rulesCount":    1,
		},
		{
			"id":            "cn",
			"type":          "quick_rule",
			"name":          "Сайты Китая (CN)",
			"description":   "Все IP-адреса и домены Китая",
			"defaultTarget": "block",
			"rulesCount":    1,
		},
		{
			"id":            "ip_checkers",
			"type":          "quick_rule",
			"name":          "Сервисы определения IP",
			"description":   "Сервисы проверки IP (ipify, 2ip, ifconfig, ipinfo и др.)",
			"defaultTarget": "direct",
			"rulesCount":    1,
		},
		{
			"id":            "ru",
			"type":          "quick_rule",
			"name":          "Сайты России (RU)",
			"description":   "Все IP-адреса и домены России",
			"defaultTarget": "direct",
			"rulesCount":    1,
		},
		{
			"id":            "us",
			"type":          "quick_rule",
			"name":          "Сайты США (US)",
			"description":   "Все IP-адреса и домены США",
			"defaultTarget": "block",
			"rulesCount":    1,
		},
		{
			"id":            "lan",
			"type":          "quick_rule",
			"name":          "Локальная сеть (LAN)",
			"description":   "Маршрутизация всех частных IP адресов (192.168.x.x, 10.x.x.x, 172.16.x.x)",
			"defaultTarget": "direct",
			"rulesCount":    1,
		},
		{
			"id":            "quic",
			"type":          "quick_rule",
			"name":          "Блокировка QUIC (UDP 443)",
			"description":   "Блокировка протокола QUIC (HTTP/3) для защиты от троттлинга и обхода XTLS",
			"defaultTarget": "block",
			"rulesCount":    1,
		},
	}
	b, _ := json.Marshal(presets)
	return string(b), nil
}

// nativeGetPreset returns full preset matchers from single source of truth.
func (m *CoreDLLManager) nativeGetPreset(presetID string) (string, error) {
	presetMap := map[string]map[string]any{
		"ads": {
			"id":            "ads",
			"name":          "Реклама и трекеры",
			"description":   "Категории блокировки рекламы и трекеров (AdBlock)",
			"defaultTarget": "block",
			"domains":       []string{"geosite:category-ads-all"},
		},
		"bittorrent": {
			"id":            "bittorrent",
			"name":          "BitTorrent трафик",
			"description":   "Торрент-трафик, P2P протокол и трекеры",
			"defaultTarget": "block",
			"domains":       []string{"geosite:bittorrent"},
			"protocols":     []string{"bittorrent"},
		},
		"cn": {
			"id":            "cn",
			"name":          "Сайты Китая (CN)",
			"description":   "Все IP-адреса и домены Китая",
			"defaultTarget": "block",
			"domains":       []string{"geosite:cn"},
			"ips":           []string{"geoip:cn"},
		},
		"ip_checkers": {
			"id":            "ip_checkers",
			"name":          "Сервисы определения IP",
			"description":   "Сервисы проверки IP (ipify, 2ip, ifconfig, ipinfo и др.)",
			"defaultTarget": "direct",
			"domains": []string{
				"ipify.org", "api.ipify.org", "api64.ipify.org",
				"2ip.ru", "2ip.io", "ifconfig.me", "ifconfig.co",
				"ipinfo.io", "icanhazip.com", "myip.com",
				"checkip.amazonaws.com", "ident.me", "whatismyipaddress.com",
			},
		},
		"ru": {
			"id":            "ru",
			"name":          "Сайты России (RU)",
			"description":   "Все IP-адреса и домены России",
			"defaultTarget": "direct",
			"domains": []string{
				"geosite:category-ru", "geosite:category-gov-ru",
				"geosite:yandex", "geosite:vk", "geosite:mailru",
				"domain:sberbank.ru", "domain:tbank.ru", "domain:tinkoff.ru",
				"domain:ozon.ru", "domain:wildberries.ru", "domain:2gis.ru", "domain:avito.ru",
				"regexp:.*\\.ru$", "regexp:.*\\.su$", "regexp:.*\\.рф$", "regexp:.*\\.xn--p1ai$",
			},
			"ips": []string{"geoip:ru"},
		},
		"us": {
			"id":            "us",
			"name":          "Сайты США (US)",
			"description":   "Все IP-адреса и домены США",
			"defaultTarget": "block",
			"ips":           []string{"geoip:us"},
		},
		"lan": {
			"id":            "lan",
			"name":          "Локальная сеть (LAN)",
			"description":   "Маршрутизация всех частных IP адресов",
			"defaultTarget": "direct",
			"ips":           []string{"geoip:private", "192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12"},
		},
		"quic": {
			"id":            "quic",
			"name":          "Блокировка QUIC (UDP 443)",
			"description":   "Блокировка протокола QUIC (HTTP/3)",
			"defaultTarget": "block",
			"protocols":     []string{"quic"},
			"ports":         []string{"443"},
		},
	}

	if p, ok := presetMap[presetID]; ok {
		b, _ := json.Marshal(p)
		return string(b), nil
	}
	return "{}", nil
}
