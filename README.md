# sentinel-desktop — Sentinel Secure Connect Desktop v1.0

**sentinel-desktop** — Нативное прикладное VPN-приложение для Windows 11, построенное на базе стека **Tauri 2.0 + React 18 (TypeScript)**, с поддержкой прокси-ядер **Xray-core**, **Sing-box** и **Hysteria 2**, загрузчиком версий с GitHub Releases / Pre-Releases, и прямой интеграцией с **sentinel-mobile (Android Hotspot SOCKS5)** и **sentinel-panel**.

---

## ⚡ Ключевые возможности

1. **Мульти-ядерная архитектура (Multi-Core Engine)**:
   - **Sing-box** (`sing-box.exe`) — универсальное ядро для VLESS, Hysteria2, TUIC, ShadowTLS, SOCKS5, WireGuard.
   - **Xray-core** (`xray.exe`) — VLESS (REALITY), VMess, Trojan, Shadowsocks.
   - **Hysteria 2** (`hysteria.exe`) — высокоскоростной UDP-протокол для обхода блокировок.

2. **Загрузчик версий с GitHub (Releases & Pre-Releases)**:
   - Скачивание и обновление всех 3 ядер прямо из официальных репозиториев GitHub (`XTLS/Xray-core`, `SagerNet/sing-box`, `apernet/hysteria`).
   - Переключатель отображения **Pre-release (Бета/Nightly)** версий.

3. **Совместимость с sentinel-mobile (Android Hotspot Proxy)**:
   - Совместимость с раздачей SOCKS5 из Android-клиента `sentinel-mobile`.
   - Быстрый пресет подключения `socks5://192.168.43.1:1080` в 1 клик.

4. **Элитный дизайн Windows 11 (High-End Visual Design)**:
   - **OLED Dark Glassmorphism** с акцентными неоновыми сияниями.
   - **Double-Bezel Architecture** (двойной ободок карточек и контейнеров).
   - Анимированное неоновое кольцо подключения с пульсацией радара и счетчиком времени.
   - Живые виджеты входящей и исходящей скорости, пинга и объемов трафика.

5. **Режимы сетевого туннелирования**:
   - **TUN mode (Wintun.dll)** — системный виртуальный VPN адаптер Windows 11.
   - **System Proxy** — установка SOCKS5/HTTP прокси в систему.

---

## 🚀 Запуск и сборка

### Режим разработки (Vite Web Preview):
```bash
npm run dev
```

### Сборка приложения Windows 11 (.exe / .msi):
```bash
npm run tauri build
```
