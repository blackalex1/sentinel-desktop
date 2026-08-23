using Avalonia.Controls;
using SentinelDesktop.Services;

namespace SentinelDesktop.Views.MainWindow;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Closing += (s, e) =>
        {
            VpnCoreService.Instance.StopSync();
        };
    }
}
