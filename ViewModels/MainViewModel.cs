using CommunityToolkit.Mvvm.ComponentModel;

namespace SentinelDesktop.ViewModels;

public partial class MainViewModel : ViewModelBase
{
    [ObservableProperty]
    private string _greeting = "Sentinel Secure Desktop (Avalonia)";
}
