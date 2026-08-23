using System;
using System.Linq;
using Avalonia.Controls;
using Avalonia.Controls.Templates;
using SentinelDesktop.ViewModels;
using SentinelDesktop.Views.CoreManager;
using SentinelDesktop.Views.Dashboard;
using SentinelDesktop.Views.Hotspot;
using SentinelDesktop.Views.Logs;
using SentinelDesktop.Views.Routing;
using SentinelDesktop.Views.Security;
using SentinelDesktop.Views.Servers;

namespace SentinelDesktop;

public class ViewLocator : IDataTemplate
{
    public Control? Build(object? param)
    {
        if (param is null)
            return null;

        if (param is DashboardViewModel)
            return new DashboardView();

        if (param is ServersViewModel)
            return new ServersView();

        if (param is RoutingViewModel)
            return new RoutingView();

        if (param is HotspotViewModel)
            return new HotspotView();

        if (param is SecurityViewModel)
            return new SecurityView();

        if (param is CoreManagerViewModel)
            return new CoreManagerView();

        if (param is LogsViewModel)
            return new LogsView();

        var typeName = param.GetType().Name.Replace("ViewModel", "View", StringComparison.Ordinal);
        var type = typeof(ViewLocator).Assembly.GetTypes()
            .FirstOrDefault(t => t.Name == typeName && typeof(Control).IsAssignableFrom(t));

        if (type != null)
        {
            return (Control)Activator.CreateInstance(type)!;
        }

        return new TextBlock { Text = "Not Found: " + typeName };
    }

    public bool Match(object? data) => data is ViewModelBase;
}
