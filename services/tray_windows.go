package services

import (
	"fmt"
	"runtime"
	"sync"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	trayUser32   = windows.NewLazySystemDLL("user32.dll")
	trayShell32  = windows.NewLazySystemDLL("shell32.dll")
	trayKernel32 = windows.NewLazySystemDLL("kernel32.dll")

	procRegisterClassExW   = trayUser32.NewProc("RegisterClassExW")
	procCreateWindowExW     = trayUser32.NewProc("CreateWindowExW")
	procDefWindowProcW      = trayUser32.NewProc("DefWindowProcW")
	procDestroyWindow       = trayUser32.NewProc("DestroyWindow")
	procPostQuitMessage     = trayUser32.NewProc("PostQuitMessage")
	procGetMessageW         = trayUser32.NewProc("GetMessageW")
	procTranslateMessage    = trayUser32.NewProc("TranslateMessage")
	procDispatchMessageW    = trayUser32.NewProc("DispatchMessageW")
	procPostMessageW        = trayUser32.NewProc("PostMessageW")
	procCreatePopupMenu     = trayUser32.NewProc("CreatePopupMenu")
	procAppendMenuW         = trayUser32.NewProc("AppendMenuW")
	procTrackPopupMenu      = trayUser32.NewProc("TrackPopupMenu")
	procDestroyMenu         = trayUser32.NewProc("DestroyMenu")
	procSetForegroundWindow = trayUser32.NewProc("SetForegroundWindow")
	procGetCursorPos        = trayUser32.NewProc("GetCursorPos")
	procExtractIconExW      = trayShell32.NewProc("ExtractIconExW")
	procShell_NotifyIconW   = trayShell32.NewProc("Shell_NotifyIconW")
	procGetModuleFileNameW  = trayKernel32.NewProc("GetModuleFileNameW")
)

const (
	wmUser          = 0x0400
	wmTrayIcon      = wmUser + 100
	wmLButtonUp     = 0x0202
	wmLButtonDblClk = 0x0203
	wmRButtonUp     = 0x0205
	wmDestroy       = 0x0002

	nimAdd    = 0x00000000
	nimModify = 0x00000001
	nimDelete = 0x00000002

	nifMessage = 0x00000001
	nifIcon    = 0x00000002
	nifTip     = 0x00000004

	mfString    = 0x00000000
	mfSeparator = 0x00000800

	tpmRightButton = 0x0002
	tpmReturnCmd   = 0x0100

	cmdOpen   = 1001
	cmdToggle = 1002
	cmdQuit   = 1003
)

type wndClassExW struct {
	cbSize        uint32
	style         uint32
	lpfnWndProc   uintptr
	cbClsExtra    int32
	cbWndExtra    int32
	hInstance     windows.Handle
	hIcon         windows.Handle
	hCursor       windows.Handle
	hbrBackground windows.Handle
	lpszMenuName  *uint16
	lpszClassName *uint16
	hIconSm       windows.Handle
}

type point struct {
	x int32
	y int32
}

type msg struct {
	hwnd    windows.HWND
	message uint32
	wParam  uintptr
	lParam  uintptr
	time    uint32
	pt      point
}

type notifyIconData struct {
	cbSize           uint32
	hWnd             windows.HWND
	uID              uint32
	uFlags           uint32
	uCallbackMessage uint32
	hIcon            windows.Handle
	szTip            [128]uint16
	dwState          uint32
	dwStateMask      uint32
	szInfo           [256]uint16
	uTimeoutOrVer    uint32
	szInfoTitle      [64]uint16
	dwInfoFlags      uint32
	guidItem         windows.GUID
	hBalloonIcon     windows.Handle
}

type TrayCallbacks struct {
	OnOpen    func()
	OnToggle  func()
	OnQuit    func()
	GetStatus func() (isConnected bool, serverName string)
}

type WindowsTray struct {
	hwnd      windows.HWND
	hIcon     windows.Handle
	callbacks TrayCallbacks
	mu        sync.Mutex
	running   bool
}

var (
	globalTray     *WindowsTray
	globalTrayLock sync.Mutex
)

// InitWindowsTray starts the system tray icon in a dedicated Win32 thread.
func InitWindowsTray(cb TrayCallbacks) *WindowsTray {
	globalTrayLock.Lock()
	defer globalTrayLock.Unlock()

	if globalTray != nil {
		globalTray.callbacks = cb
		return globalTray
	}

	tray := &WindowsTray{
		callbacks: cb,
		running:   true,
	}
	globalTray = tray

	go tray.runMessageLoop()
	return tray
}

// UpdateTooltip updates the tooltip text on the tray icon.
func (t *WindowsTray) UpdateTooltip(tip string) {
	if t.hwnd == 0 {
		return
	}
	var nid notifyIconData
	nid.cbSize = uint32(unsafe.Sizeof(nid))
	nid.hWnd = t.hwnd
	nid.uID = 1
	nid.uFlags = nifTip
	tipUtf16, _ := windows.UTF16FromString(tip)
	copy(nid.szTip[:], tipUtf16)

	procShell_NotifyIconW.Call(uintptr(nimModify), uintptr(unsafe.Pointer(&nid)))
}

// RemoveTray removes the icon from the system tray.
func (t *WindowsTray) RemoveTray() {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.hwnd != 0 {
		var nid notifyIconData
		nid.cbSize = uint32(unsafe.Sizeof(nid))
		nid.hWnd = t.hwnd
		nid.uID = 1
		procShell_NotifyIconW.Call(uintptr(nimDelete), uintptr(unsafe.Pointer(&nid)))
		procPostMessageW.Call(uintptr(t.hwnd), wmDestroy, 0, 0)
		t.hwnd = 0
	}
}

func (t *WindowsTray) runMessageLoop() {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	className, _ := windows.UTF16PtrFromString("SentinelTrayWindowClass")
	windowName, _ := windows.UTF16PtrFromString("SentinelTrayWindow")

	// Extract application icon (.ico built into Sentinel-Desktop.exe)
	var exePath [windows.MAX_PATH]uint16
	procGetModuleFileNameW.Call(0, uintptr(unsafe.Pointer(&exePath[0])), uintptr(len(exePath)))
	var hIconLarge, hIconSmall windows.Handle
	procExtractIconExW.Call(uintptr(unsafe.Pointer(&exePath[0])), 0, uintptr(unsafe.Pointer(&hIconLarge)), uintptr(unsafe.Pointer(&hIconSmall)), 1)
	if hIconSmall != 0 {
		t.hIcon = hIconSmall
	} else if hIconLarge != 0 {
		t.hIcon = hIconLarge
	}

	wndProc := syscall.NewCallback(func(hwnd windows.HWND, uMsg uint32, wParam uintptr, lParam uintptr) uintptr {
		switch uMsg {
		case wmTrayIcon:
			switch lParam {
			case wmLButtonUp, wmLButtonDblClk:
				if t.callbacks.OnOpen != nil {
					t.callbacks.OnOpen()
				}
				return 0
			case wmRButtonUp:
				t.showContextMenu(hwnd)
				return 0
			}
		case wmDestroy:
			procPostQuitMessage.Call(0)
			return 0
		}
		ret, _, _ := procDefWindowProcW.Call(uintptr(hwnd), uintptr(uMsg), wParam, lParam)
		return ret
	})

	var wc wndClassExW
	wc.cbSize = uint32(unsafe.Sizeof(wc))
	wc.lpfnWndProc = wndProc
	wc.lpszClassName = className
	wc.hIcon = t.hIcon
	wc.hIconSm = t.hIcon

	procRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc)))

	hwnd, _, _ := procCreateWindowExW.Call(
		0,
		uintptr(unsafe.Pointer(className)),
		uintptr(unsafe.Pointer(windowName)),
		0,
		0, 0, 0, 0,
		0, // HWND_MESSAGE
		0, 0, 0,
	)

	t.hwnd = windows.HWND(hwnd)

	// Add icon to system tray
	var nid notifyIconData
	nid.cbSize = uint32(unsafe.Sizeof(nid))
	nid.hWnd = t.hwnd
	nid.uID = 1
	nid.uFlags = nifMessage | nifIcon | nifTip
	nid.uCallbackMessage = wmTrayIcon
	nid.hIcon = t.hIcon

	tip, _ := windows.UTF16FromString("Sentinel Secure Connect")
	copy(nid.szTip[:], tip)

	procShell_NotifyIconW.Call(uintptr(nimAdd), uintptr(unsafe.Pointer(&nid)))

	// Run message pump
	var m msg
	for {
		res, _, _ := procGetMessageW.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0)
		if int32(res) <= 0 {
			break
		}
		procTranslateMessage.Call(uintptr(unsafe.Pointer(&m)))
		procDispatchMessageW.Call(uintptr(unsafe.Pointer(&m)))
	}
}

func (t *WindowsTray) showContextMenu(hwnd windows.HWND) {
	hMenu, _, _ := procCreatePopupMenu.Call()
	if hMenu == 0 {
		return
	}
	defer procDestroyMenu.Call(hMenu)

	var isConnected bool
	var serverName string
	if t.callbacks.GetStatus != nil {
		isConnected, serverName = t.callbacks.GetStatus()
	}

	openLabel, _ := windows.UTF16PtrFromString("Открыть Sentinel")
	procAppendMenuW.Call(hMenu, mfString, cmdOpen, uintptr(unsafe.Pointer(openLabel)))

	// Connect / Disconnect item
	var toggleText string
	if isConnected {
		if serverName != "" {
			toggleText = fmt.Sprintf("Отключить (%s)", serverName)
		} else {
			toggleText = "Отключить VPN"
		}
	} else {
		toggleText = "Подключить VPN"
	}
	toggleLabel, _ := windows.UTF16PtrFromString(toggleText)
	procAppendMenuW.Call(hMenu, mfString, cmdToggle, uintptr(unsafe.Pointer(toggleLabel)))

	// Separator
	procAppendMenuW.Call(hMenu, mfSeparator, 0, 0)

	// Quit
	quitLabel, _ := windows.UTF16PtrFromString("Выход")
	procAppendMenuW.Call(hMenu, mfString, cmdQuit, uintptr(unsafe.Pointer(quitLabel)))

	// Must bring window to foreground so menu disappears if clicked outside
	procSetForegroundWindow.Call(uintptr(hwnd))

	var pt point
	procGetCursorPos.Call(uintptr(unsafe.Pointer(&pt)))

	cmd, _, _ := procTrackPopupMenu.Call(
		hMenu,
		tpmRightButton|tpmReturnCmd,
		uintptr(pt.x),
		uintptr(pt.y),
		0,
		uintptr(hwnd),
		0,
	)

	switch cmd {
	case cmdOpen:
		if t.callbacks.OnOpen != nil {
			t.callbacks.OnOpen()
		}
	case cmdToggle:
		if t.callbacks.OnToggle != nil {
			t.callbacks.OnToggle()
		}
	case cmdQuit:
		if t.callbacks.OnQuit != nil {
			t.callbacks.OnQuit()
		}
	}
}
