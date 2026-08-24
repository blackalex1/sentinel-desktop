using System;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Platform;
using SentinelDesktop.Services;

namespace SentinelDesktop.Views.MainWindow;

public partial class MainWindow : Window
{
    private TrayIcon? _trayIcon;
    private bool _isExplicitExit = false;

    public MainWindow()
    {
        InitializeComponent();
        SetupTrayIcon();

        Closing += OnWindowClosing;
    }

    private void SetupTrayIcon()
    {
        try
        {
            var iconUri = new Uri("avares://SentinelDesktop/Assets/app.ico");
            var windowIcon = new WindowIcon(AssetLoader.Open(iconUri));
            Icon = windowIcon;

            var menu = new NativeMenu();

            var openItem = new NativeMenuItem("Показать Sentinel");
            openItem.Click += (s, e) => ShowFromTray();

            var exitItem = new NativeMenuItem("Выход");
            exitItem.Click += (s, e) => ExitApplication();

            menu.Add(openItem);
            menu.Add(new NativeMenuItemSeparator());
            menu.Add(exitItem);

            _trayIcon = new TrayIcon
            {
                Icon = windowIcon,
                ToolTipText = "Sentinel Secure VPN",
                Menu = menu,
                IsVisible = true
            };

            _trayIcon.Clicked += (s, e) => ShowFromTray();
        }
        catch (Exception ex)
        {
            LoggingService.Instance.LogApp($"Ошибка инициализации TrayIcon: {ex.Message}", "WARN");
        }
    }

    private void OnWindowClosing(object? sender, WindowClosingEventArgs e)
    {
        if (!_isExplicitExit)
        {
            e.Cancel = true;
            Hide();
            return;
        }

        _trayIcon?.Dispose();
        _trayIcon = null;
        VpnCoreService.Instance.StopSync();
    }

    public void ShowFromTray()
    {
        Show();
        WindowState = WindowState.Normal;
        Activate();
        Focus();
    }

    public void ExitApplication()
    {
        _isExplicitExit = true;
        _trayIcon?.Dispose();
        _trayIcon = null;
        VpnCoreService.Instance.StopSync();

        if (Application.Current?.ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            desktop.Shutdown();
        }
        else
        {
            Environment.Exit(0);
        }
    }
}
