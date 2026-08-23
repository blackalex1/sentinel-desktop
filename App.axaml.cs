using System;
using System.Linq;
using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;
using Avalonia.Threading;
using SentinelDesktop.Services;
using SentinelDesktop.ViewModels;
using SentinelDesktop.Views.MainWindow;

namespace SentinelDesktop;

public partial class App : Application
{
    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
    }

    public override void OnFrameworkInitializationCompleted()
    {
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            var mainVm = new MainWindowViewModel();
            desktop.MainWindow = new MainWindow
            {
                DataContext = mainVm,
            };

            // Hook application exit to safely terminate core subprocesses
            desktop.Exit += (s, e) =>
            {
                VpnCoreService.Instance.StopSync();
            };

            AppDomain.CurrentDomain.ProcessExit += (s, e) =>
            {
                VpnCoreService.Instance.StopSync();
            };

            // If elevated with --auto-connect flag, trigger connection seamlessly
            if (Program.StartupArgs != null && Program.StartupArgs.Any(a => a == "--auto-connect"))
            {
                Dispatcher.UIThread.Post(async () =>
                {
                    await mainVm.Dashboard.StartConnectionAsync();
                }, DispatcherPriority.Loaded);
            }
        }

        base.OnFrameworkInitializationCompleted();
    }
}