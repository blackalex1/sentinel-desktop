package services

import (
	"fmt"
	"os"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	modShell32        = syscall.NewLazyDLL("shell32.dll")
	procShellExecuteW = modShell32.NewProc("ShellExecuteW")
)

// IsRunningAsAdmin checks if the current process has Administrator privileges on Windows.
func IsRunningAsAdmin() bool {
	var token windows.Token
	err := windows.OpenProcessToken(windows.CurrentProcess(), windows.TOKEN_QUERY, &token)
	if err != nil {
		return false
	}
	defer token.Close()

	var elevation uint32
	var returnedLen uint32
	err = windows.GetTokenInformation(
		token,
		windows.TokenElevation,
		(*byte)(unsafe.Pointer(&elevation)),
		uint32(unsafe.Sizeof(elevation)),
		&returnedLen,
	)
	if err != nil {
		return false
	}

	return elevation != 0
}

// RequestAdminElevation triggers a Windows UAC prompt to restart the application with elevated Administrator rights.
func RequestAdminElevation() error {
	if IsRunningAsAdmin() {
		return nil
	}

	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	verbPtr, err := syscall.UTF16PtrFromString("runas")
	if err != nil {
		return err
	}
	filePtr, err := syscall.UTF16PtrFromString(exePath)
	if err != nil {
		return err
	}

	// Stop any active VPN process before exiting
	GetProcessSupervisor().StopCore()
	_ = GetWindowsNet().DisableSystemProxy()

	ret, _, _ := procShellExecuteW.Call(
		0,
		uintptr(unsafe.Pointer(verbPtr)),
		uintptr(unsafe.Pointer(filePtr)),
		0,
		0,
		1, // SW_SHOWNORMAL
	)

	if ret <= 32 {
		return fmt.Errorf("ShellExecuteW failed with error code: %d", ret)
	}

	os.Exit(0)
	return nil
}
