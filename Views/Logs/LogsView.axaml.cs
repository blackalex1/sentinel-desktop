using Avalonia.Controls;
using Avalonia.Threading;
using SentinelDesktop.ViewModels;

namespace SentinelDesktop.Views.Logs;

public partial class LogsView : UserControl
{
    private ScrollViewer? _scrollViewer;

    public LogsView()
    {
        InitializeComponent();
        _scrollViewer = this.FindControl<ScrollViewer>("LogsScrollViewer");

        DataContextChanged += (s, e) =>
        {
            if (DataContext is LogsViewModel vm)
            {
                vm.DisplayLogs.CollectionChanged += (sender, args) =>
                {
                    if (vm.AutoScroll && _scrollViewer != null)
                    {
                        Dispatcher.UIThread.Post(() => _scrollViewer.ScrollToEnd(), DispatcherPriority.Background);
                    }
                };
            }
        };
    }
}
