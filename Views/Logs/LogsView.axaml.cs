using Avalonia.Controls;
using Avalonia.Threading;
using SentinelDesktop.ViewModels;

namespace SentinelDesktop.Views.Logs;

public partial class LogsView : UserControl
{
    private ListBox? _listBox;

    public LogsView()
    {
        InitializeComponent();
        _listBox = this.FindControl<ListBox>("LogsListBox");

        DataContextChanged += (s, e) =>
        {
            if (DataContext is LogsViewModel vm)
            {
                vm.DisplayLogs.CollectionChanged += (sender, args) =>
                {
                    if (vm.AutoScroll && _listBox != null && vm.DisplayLogs.Count > 0)
                    {
                        Dispatcher.UIThread.Post(() =>
                        {
                            try
                            {
                                var last = vm.DisplayLogs[^1];
                                _listBox.ScrollIntoView(last);
                            }
                            catch { }
                        }, DispatcherPriority.Background);
                    }
                };
            }
        };
    }
}
