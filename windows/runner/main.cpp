#include <flutter/dart_project.h>
#include <flutter/flutter_view_controller.h>
#include <windows.h>
#include <shellapi.h>

#include "flutter_window.h"
#include "utils.h"

// Check if current process has Administrator privileges
static bool IsRunningAsAdmin() {
  BOOL isAdmin = FALSE;
  PSID adminGroup = nullptr;
  SID_IDENTIFIER_AUTHORITY ntAuthority = SECURITY_NT_AUTHORITY;
  if (AllocateAndInitializeSid(&ntAuthority, 2, SECURITY_BUILTIN_DOMAIN_RID,
                               DOMAIN_ALIAS_RID_ADMINS, 0, 0, 0, 0, 0, 0,
                               &adminGroup)) {
    CheckTokenMembership(nullptr, adminGroup, &isAdmin);
    FreeSid(adminGroup);
  }
  return isAdmin == TRUE;
}

// Request UAC Elevation to run as Administrator
static bool ElevateToAdmin(wchar_t* command_line, int show_command) {
  wchar_t szPath[MAX_PATH];
  if (GetModuleFileNameW(NULL, szPath, MAX_PATH)) {
    SHELLEXECUTEINFOW sei = { sizeof(sei) };
    sei.cbSize = sizeof(sei);
    sei.lpVerb = L"runas";
    sei.lpFile = szPath;
    sei.lpParameters = command_line;
    sei.hwnd = NULL;
    sei.nShow = show_command;
    if (ShellExecuteExW(&sei)) {
      return true;
    }
  }
  return false;
}

int APIENTRY wWinMain(_In_ HINSTANCE instance, _In_opt_ HINSTANCE prev,
                      _In_ wchar_t *command_line, _In_ int show_command) {
  // Automatically request Administrator rights (UAC elevation) on launch for Wintun/TUN networking
  if (!IsRunningAsAdmin()) {
    if (ElevateToAdmin(command_line, show_command)) {
      return EXIT_SUCCESS;
    }
  }

  // Attach to console when present (e.g., 'flutter run') or create a
  // new console when running with a debugger.
  if (!::AttachConsole(ATTACH_PARENT_PROCESS) && ::IsDebuggerPresent()) {
    CreateAndAttachConsole();
  }

  // Initialize COM, so that it is available for use in the library and/or
  // plugins.
  ::CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

  flutter::DartProject project(L"data");

  std::vector<std::string> command_line_arguments =
      GetCommandLineArguments();

  project.set_dart_entrypoint_arguments(std::move(command_line_arguments));

  FlutterWindow window(project);
  Win32Window::Point origin(10, 10);
  Win32Window::Size size(1280, 720);
  if (!window.Create(L"sentinel_desktop", origin, size)) {
    return EXIT_FAILURE;
  }
  window.SetQuitOnClose(true);

  ::MSG msg;
  while (::GetMessage(&msg, nullptr, 0, 0)) {
    ::TranslateMessage(&msg);
    ::DispatchMessage(&msg);
  }

  ::CoUninitialize();
  return EXIT_SUCCESS;
}
