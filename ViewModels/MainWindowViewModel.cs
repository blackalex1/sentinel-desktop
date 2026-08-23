using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SentinelDesktop.Models;

namespace SentinelDesktop.ViewModels;

public partial class MainWindowViewModel : ViewModelBase
{
    [ObservableProperty]
    private ViewModelBase _currentPage;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsDashboardActive))]
    [NotifyPropertyChangedFor(nameof(IsServersActive))]
    [NotifyPropertyChangedFor(nameof(IsRoutingActive))]
    [NotifyPropertyChangedFor(nameof(IsHotspotActive))]
    [NotifyPropertyChangedFor(nameof(IsSecurityActive))]
    [NotifyPropertyChangedFor(nameof(IsCoreManagerActive))]
    [NotifyPropertyChangedFor(nameof(IsLogsActive))]
    [NotifyPropertyChangedFor(nameof(DashboardForeground))]
    [NotifyPropertyChangedFor(nameof(DashboardIconColor))]
    [NotifyPropertyChangedFor(nameof(ServersForeground))]
    [NotifyPropertyChangedFor(nameof(ServersIconColor))]
    [NotifyPropertyChangedFor(nameof(RoutingForeground))]
    [NotifyPropertyChangedFor(nameof(RoutingIconColor))]
    [NotifyPropertyChangedFor(nameof(HotspotForeground))]
    [NotifyPropertyChangedFor(nameof(HotspotIconColor))]
    [NotifyPropertyChangedFor(nameof(SecurityForeground))]
    [NotifyPropertyChangedFor(nameof(SecurityIconColor))]
    [NotifyPropertyChangedFor(nameof(CoreManagerForeground))]
    [NotifyPropertyChangedFor(nameof(CoreManagerIconColor))]
    [NotifyPropertyChangedFor(nameof(LogsForeground))]
    [NotifyPropertyChangedFor(nameof(LogsIconColor))]
    private string _activePage = "dashboard";

    public bool IsDashboardActive => ActivePage == "dashboard";
    public bool IsServersActive => ActivePage == "servers";
    public bool IsRoutingActive => ActivePage == "routing";
    public bool IsHotspotActive => ActivePage == "hotspot" || ActivePage == "connect";
    public bool IsSecurityActive => ActivePage == "security" || ActivePage == "threats";
    public bool IsCoreManagerActive => ActivePage == "cores" || ActivePage == "coremanager";
    public bool IsLogsActive => ActivePage == "logs";

    public string DashboardForeground => IsDashboardActive ? "White" : "#94A3B8";
    public string DashboardIconColor => IsDashboardActive ? "#C084FC" : "#64748B";

    public string ServersForeground => IsServersActive ? "White" : "#94A3B8";
    public string ServersIconColor => IsServersActive ? "#38BDF8" : "#64748B";

    public string RoutingForeground => IsRoutingActive ? "White" : "#94A3B8";
    public string RoutingIconColor => IsRoutingActive ? "#A78BFA" : "#64748B";

    public string HotspotForeground => IsHotspotActive ? "White" : "#94A3B8";
    public string HotspotIconColor => IsHotspotActive ? "#38BDF8" : "#64748B";

    public string SecurityForeground => IsSecurityActive ? "White" : "#94A3B8";
    public string SecurityIconColor => IsSecurityActive ? "#F87171" : "#64748B";

    public string CoreManagerForeground => IsCoreManagerActive ? "White" : "#94A3B8";
    public string CoreManagerIconColor => IsCoreManagerActive ? "#34D399" : "#64748B";

    public string LogsForeground => IsLogsActive ? "White" : "#94A3B8";
    public string LogsIconColor => IsLogsActive ? "#FBBF24" : "#64748B";

    public string ActiveCoreDisplayName => Dashboard?.SelectedCoreEngine?.DisplayName ?? "Sing-box";
    public string ActiveCoreColor => Dashboard?.SelectedCoreEngine?.Color ?? "#38BDF8";
    public string ActiveCoreBg => Dashboard?.SelectedCoreEngine?.BgColor ?? "#082F49";

    public DashboardViewModel Dashboard { get; }
    public ServersViewModel Servers { get; }
    public RoutingViewModel Routing { get; }
    public HotspotViewModel Hotspot { get; }
    public SecurityViewModel Security { get; }
    public CoreManagerViewModel CoreManager { get; }
    public LogsViewModel Logs { get; }

    public MainWindowViewModel()
    {
        Dashboard = new DashboardViewModel();
        Servers = new ServersViewModel();
        Routing = new RoutingViewModel();
        Hotspot = new HotspotViewModel();
        Security = new SecurityViewModel();
        CoreManager = new CoreManagerViewModel();
        Logs = new LogsViewModel();
        _currentPage = Dashboard;

        Dashboard.PropertyChanged += (s, e) =>
        {
            if (e.PropertyName == nameof(Dashboard.SelectedCoreEngine))
            {
                OnPropertyChanged(nameof(ActiveCoreDisplayName));
                OnPropertyChanged(nameof(ActiveCoreColor));
                OnPropertyChanged(nameof(ActiveCoreBg));
            }
        };
    }

    [RelayCommand]
    private void Navigate(string page)
    {
        ActivePage = page.ToLowerInvariant();
        CurrentPage = ActivePage switch
        {
            "servers" => Servers,
            "routing" => Routing,
            "hotspot" or "connect" => Hotspot,
            "security" or "threats" => Security,
            "cores" or "coremanager" => CoreManager,
            "logs" => Logs,
            _ => Dashboard
        };
    }
}
