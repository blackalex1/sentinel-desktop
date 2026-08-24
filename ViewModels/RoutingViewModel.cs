using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SentinelDesktop.Models;
using SentinelDesktop.Services;

namespace SentinelDesktop.ViewModels;

public partial class RoutingViewModel : ViewModelBase
{
    [ObservableProperty]
    private ObservableCollection<CorePreset> _presets = new();

    [ObservableProperty]
    private ObservableCollection<CustomRoutingRule> _customRules = new();

    [ObservableProperty]
    private ObservableCollection<RoutingTableItem> _tableRules = new();

    [ObservableProperty]
    private bool _isRuleEditorOpen;

    [ObservableProperty]
    private CustomRoutingRule? _editingRule;

    [ObservableProperty]
    private string _formRuleName = string.Empty;

    [ObservableProperty]
    private string _formRuleAction = "direct";

    [ObservableProperty]
    private string _formDomainsText = string.Empty;

    [ObservableProperty]
    private string _formIpsText = string.Empty;

    [ObservableProperty]
    private string _formPortsText = string.Empty;

    [ObservableProperty]
    private string _formProtocolsText = string.Empty;

    [ObservableProperty]
    private string _statusMessage = string.Empty;

    [ObservableProperty]
    private bool _hasStatusMessage;

    [ObservableProperty]
    private ObservableCollection<DnsPresetItemViewModel> _dnsPresets = new();

    [ObservableProperty]
    private DnsPresetItemViewModel? _selectedDnsPreset;

    [ObservableProperty]
    private string _customDnsInput = string.Empty;

    [ObservableProperty]
    private bool _isCustomDnsSelected;

    [ObservableProperty]
    private ObservableCollection<DnsResolverItem> _activeResolvers = new();

    [ObservableProperty]
    private bool _isDnsSavedFeedback;

    public int EnabledPresetsCount => Presets.Count(p => p.IsEnabled);
    public int CustomRulesCount => CustomRules.Count;

    public RoutingViewModel()
    {
        LoadData();
        LoadDnsSettings();
    }

    public void LoadData()
    {
        RoutingService.Instance.LoadPresetsFromCore();
        var pList = RoutingService.Instance.GetPresets();
        Presets.Clear();
        foreach (var p in pList)
        {
            p.PropertyChanged += (s, e) =>
            {
                if (e.PropertyName == nameof(CorePreset.IsEnabled))
                {
                    OnPresetToggled(p);
                    OnPropertyChanged(nameof(EnabledPresetsCount));
                    SaveRouting();
                }
                else if (e.PropertyName == nameof(CorePreset.SelectedTarget))
                {
                    var matchedTableItem = TableRules.FirstOrDefault(t => t.IsPreset && t.Id == p.Id);
                    if (matchedTableItem != null)
                    {
                        matchedTableItem.Action = p.SelectedTarget;
                    }
                    SaveRouting();
                }
            };
            Presets.Add(p);
        }

        var rList = RoutingService.Instance.GetCustomRules();
        CustomRules.Clear();
        foreach (var r in rList)
        {
            CustomRules.Add(r);
        }

        ComputeTableRules();
        OnPropertyChanged(nameof(EnabledPresetsCount));
        OnPropertyChanged(nameof(CustomRulesCount));
    }

    private void OnPresetToggled(CorePreset p)
    {
        var existing = TableRules.FirstOrDefault(t => t.IsPreset && t.Id == p.Id);
        if (p.IsEnabled)
        {
            if (existing == null)
            {
                TableRules.Add(new RoutingTableItem
                {
                    Id = p.Id,
                    IsPreset = true,
                    PresetRef = p,
                    Order = TableRules.Count + 1,
                    Name = p.Name,
                    Action = p.SelectedTarget,
                    ConditionsText = p.ConditionsSummary,
                    IsEnabled = true
                });
            }
            else
            {
                existing.IsEnabled = true;
            }
        }
        else
        {
            if (existing != null)
            {
                TableRules.Remove(existing);
            }
        }

        RecalculateOrders();
    }

    public void ComputeTableRules()
    {
        var list = new List<RoutingTableItem>();
        int order = 1;

        // 1. Add ALL custom rules (both enabled and disabled remain in the table!)
        foreach (var cr in CustomRules)
        {
            list.Add(new RoutingTableItem
            {
                Id = cr.Id,
                IsPreset = false,
                CustomRuleRef = cr,
                Order = order++,
                Name = cr.Name,
                Action = cr.Action,
                ConditionsText = cr.SummaryText,
                IsEnabled = cr.IsEnabled
            });
        }

        // 2. Add ONLY enabled quick security presets from Go core
        foreach (var p in Presets.Where(p => p.IsEnabled))
        {
            list.Add(new RoutingTableItem
            {
                Id = p.Id,
                IsPreset = true,
                PresetRef = p,
                Order = order++,
                Name = p.Name,
                Action = p.SelectedTarget,
                ConditionsText = p.ConditionsSummary,
                IsEnabled = true
            });
        }

        TableRules.Clear();
        foreach (var item in list)
        {
            TableRules.Add(item);
        }
    }

    [RelayCommand]
    public void TogglePreset(CorePreset preset)
    {
        // PropertyChanged listener handles sync & saving
        OnPropertyChanged(nameof(EnabledPresetsCount));
    }

    [RelayCommand]
    public void ToggleTableRow(RoutingTableItem item)
    {
        if (item.IsPreset && item.PresetRef != null)
        {
            if (!item.IsEnabled)
            {
                item.PresetRef.IsEnabled = false;
                TableRules.Remove(item);
                RecalculateOrders();
            }
            else
            {
                item.PresetRef.IsEnabled = true;
            }
        }
        else if (item.CustomRuleRef != null)
        {
            // Custom rules stay in the table, updating their disabled/enabled appearance
            item.CustomRuleRef.IsEnabled = item.IsEnabled;
        }

        OnPropertyChanged(nameof(EnabledPresetsCount));
        SaveRouting();
    }

    public void ReorderTableItems(RoutingTableItem source, RoutingTableItem target)
    {
        if (source == null || target == null || source == target) return;

        var oldIndex = TableRules.IndexOf(source);
        var newIndex = TableRules.IndexOf(target);

        if (oldIndex < 0 || newIndex < 0 || oldIndex == newIndex) return;

        if (!source.IsPreset && !target.IsPreset && source.CustomRuleRef != null && target.CustomRuleRef != null)
        {
            var crOld = CustomRules.IndexOf(source.CustomRuleRef);
            var crNew = CustomRules.IndexOf(target.CustomRuleRef);
            if (crOld >= 0 && crNew >= 0)
            {
                CustomRules.Move(crOld, crNew);
            }
        }

        TableRules.Move(oldIndex, newIndex);
        RecalculateOrders();
        SaveRouting();
    }

    private void RecalculateOrders()
    {
        for (int i = 0; i < TableRules.Count; i++)
        {
            TableRules[i].Order = i + 1;
        }
    }

    [RelayCommand]
    public void SaveRouting()
    {
        RoutingService.Instance.Save(Presets.ToList(), CustomRules.ToList());
        ShowStatus("Правила маршрутизации успешно сохранены в ядро");
    }

    [RelayCommand]
    public void AddNewRule()
    {
        EditingRule = null;
        FormRuleName = "Новое правило";
        FormRuleAction = "direct";
        FormDomainsText = string.Empty;
        FormIpsText = string.Empty;
        FormPortsText = string.Empty;
        FormProtocolsText = string.Empty;
        IsRuleEditorOpen = true;
    }

    [RelayCommand]
    public void EditTableRow(RoutingTableItem item)
    {
        if (item.IsPreset)
        {
            ShowStatus($"Пресет «{item.Name}» настраивается в блоке «Быстрые правила безопасности»");
            return;
        }

        if (item.CustomRuleRef != null)
        {
            EditRule(item.CustomRuleRef);
        }
    }

    [RelayCommand]
    public void DeleteTableRow(RoutingTableItem item)
    {
        if (item.IsPreset && item.PresetRef != null)
        {
            item.PresetRef.IsEnabled = false;
            TableRules.Remove(item);
        }
        else if (item.CustomRuleRef != null)
        {
            CustomRules.Remove(item.CustomRuleRef);
            TableRules.Remove(item);
        }
        RecalculateOrders();
        OnPropertyChanged(nameof(CustomRulesCount));
        OnPropertyChanged(nameof(EnabledPresetsCount));
        SaveRouting();
    }

    [RelayCommand]
    public void MoveTableRowUp(RoutingTableItem item)
    {
        var idx = TableRules.IndexOf(item);
        if (idx > 0)
        {
            ReorderTableItems(item, TableRules[idx - 1]);
        }
    }

    [RelayCommand]
    public void MoveTableRowDown(RoutingTableItem item)
    {
        var idx = TableRules.IndexOf(item);
        if (idx < TableRules.Count - 1)
        {
            ReorderTableItems(item, TableRules[idx + 1]);
        }
    }

    public void EditRule(CustomRoutingRule rule)
    {
        EditingRule = rule;
        FormRuleName = rule.Name;
        FormRuleAction = rule.Action;
        FormDomainsText = string.Join(", ", rule.Domains);
        FormIpsText = string.Join(", ", rule.IPs);
        FormPortsText = string.Join(", ", rule.Ports);
        FormProtocolsText = string.Join(", ", rule.Protocols);
        IsRuleEditorOpen = true;
    }

    [RelayCommand]
    public void SaveRuleEditor()
    {
        var domains = SplitEntries(FormDomainsText);
        var ips = SplitEntries(FormIpsText);
        var ports = SplitEntries(FormPortsText);
        var protocols = SplitEntries(FormProtocolsText);

        if (EditingRule != null)
        {
            EditingRule.Name = FormRuleName;
            EditingRule.Action = FormRuleAction;
            EditingRule.Domains = domains;
            EditingRule.IPs = ips;
            EditingRule.Ports = ports;
            EditingRule.Protocols = protocols;
            EditingRule.RefreshSummary();

            var matched = TableRules.FirstOrDefault(t => !t.IsPreset && t.Id == EditingRule.Id);
            if (matched != null)
            {
                matched.Name = FormRuleName;
                matched.Action = FormRuleAction;
                matched.ConditionsText = EditingRule.SummaryText;
            }
        }
        else
        {
            var newRule = new CustomRoutingRule
            {
                Name = FormRuleName,
                Action = FormRuleAction,
                Domains = domains,
                IPs = ips,
                Ports = ports,
                Protocols = protocols
            };
            CustomRules.Add(newRule);
            
            var newTableItem = new RoutingTableItem
            {
                Id = newRule.Id,
                IsPreset = false,
                CustomRuleRef = newRule,
                Order = TableRules.Count + 1,
                Name = newRule.Name,
                Action = newRule.Action,
                ConditionsText = newRule.SummaryText,
                IsEnabled = true
            };
            TableRules.Insert(CustomRules.Count - 1, newTableItem);
        }

        RecalculateOrders();
        IsRuleEditorOpen = false;
        OnPropertyChanged(nameof(CustomRulesCount));
        SaveRouting();
    }

    [RelayCommand]
    public void CloseRuleEditor()
    {
        IsRuleEditorOpen = false;
    }

    [RelayCommand]
    public async Task ExportPresetAsync()
    {
        try
        {
            var json = RoutingService.Instance.ExportToJson();
            if (Application.Current?.ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop &&
                desktop.MainWindow?.Clipboard != null)
            {
                await desktop.MainWindow.Clipboard.SetTextAsync(json);
                ShowStatus("Конфигурация скопирована в буфер обмена");
            }
        }
        catch (Exception ex)
        {
            ShowStatus($"Ошибка экспорта: {ex.Message}");
        }
    }

    [RelayCommand]
    public async Task ImportPresetAsync()
    {
        try
        {
            if (Application.Current?.ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop &&
                desktop.MainWindow?.Clipboard != null)
            {
                var text = await desktop.MainWindow.Clipboard.GetTextAsync();
                if (!string.IsNullOrWhiteSpace(text) && RoutingService.Instance.ImportFromJson(text))
                {
                    LoadData();
                    ShowStatus("Конфигурация успешно импортирована из буфера");
                }
                else
                {
                    ShowStatus("Буфер обмена не содержит валидного JSON пресета");
                }
            }
        }
        catch (Exception ex)
        {
            ShowStatus($"Ошибка импорта: {ex.Message}");
        }
    }

    public void LoadDnsSettings()
    {
        var vault = StorageService.Load();
        var selectedId = vault.Settings.SelectedDnsPresetId ?? "google";
        CustomDnsInput = vault.Settings.CustomDnsServers ?? "https://dns.google/dns-query, 8.8.8.8, 8.8.4.4";

        DnsPresets.Clear();
        foreach (var p in DnsPresetsCatalog.Presets)
        {
            var isSel = p.Id.Equals(selectedId, StringComparison.OrdinalIgnoreCase);
            var itemVm = new DnsPresetItemViewModel(p, isSel);
            DnsPresets.Add(itemVm);
            if (isSel)
            {
                SelectedDnsPreset = itemVm;
                IsCustomDnsSelected = p.Id == "custom";
            }
        }

        if (SelectedDnsPreset == null && DnsPresets.Count > 1)
        {
            SelectedDnsPreset = DnsPresets[1];
            SelectedDnsPreset.IsSelected = true;
        }

        UpdateActiveResolvers();
    }

    [RelayCommand]
    public void SelectDnsPreset(DnsPresetItemViewModel preset)
    {
        if (preset == null) return;
        foreach (var p in DnsPresets)
        {
            p.IsSelected = p.Id == preset.Id;
        }
        SelectedDnsPreset = preset;
        IsCustomDnsSelected = preset.Id == "custom";
        UpdateActiveResolvers();
    }

    [RelayCommand]
    public async Task SaveDnsSettingsAsync()
    {
        var vault = StorageService.Load();
        var selectedId = SelectedDnsPreset?.Id ?? "google";
        vault.Settings.SelectedDnsPresetId = selectedId;
        vault.Settings.CustomDnsServers = CustomDnsInput;

        var preset = DnsPresetsCatalog.GetPreset(selectedId);
        if (preset.Id == "custom" && !string.IsNullOrWhiteSpace(CustomDnsInput))
        {
            var parts = SplitEntries(CustomDnsInput);
            vault.Settings.DnsServer = parts.FirstOrDefault(p => !p.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) ?? "8.8.8.8";
        }
        else
        {
            vault.Settings.DnsServer = preset.DirectServer;
        }

        StorageService.Save(vault);
        UpdateActiveResolvers();

        IsDnsSavedFeedback = true;
        ShowStatus("Настройки DNS сохранены и применены");

        if (VpnCoreService.Instance.IsRunning)
        {
            await VpnCoreService.Instance.RestartWithNewSettingsAsync();
        }

        _ = Task.Delay(2500).ContinueWith(_ => IsDnsSavedFeedback = false);
    }

    private void UpdateActiveResolvers()
    {
        ActiveResolvers.Clear();
        var selectedId = SelectedDnsPreset?.Id ?? "google";
        var preset = DnsPresetsCatalog.GetPreset(selectedId);

        List<string> serverList;
        if (preset.Id == "custom" && !string.IsNullOrWhiteSpace(CustomDnsInput))
        {
            serverList = SplitEntries(CustomDnsInput);
        }
        else
        {
            serverList = preset.Servers;
        }

        foreach (var s in serverList)
        {
            var isDoh = s.StartsWith("https://", StringComparison.OrdinalIgnoreCase);
            ActiveResolvers.Add(new DnsResolverItem
            {
                Protocol = isDoh ? "DOH" : "UDP",
                Address = s,
                BadgeColor = isDoh ? "#C084FC" : "#38BDF8",
                BadgeBg = isDoh ? "#2E1065" : "#082F49"
            });
        }
    }

    private static List<string> SplitEntries(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return new List<string>();
        return input.Split(new[] { ',', '\n', '\r', ';' }, StringSplitOptions.RemoveEmptyEntries)
                    .Select(s => s.Trim())
                    .Where(s => !string.IsNullOrEmpty(s))
                    .ToList();
    }

    private void ShowStatus(string msg)
    {
        StatusMessage = msg;
        HasStatusMessage = true;
        Task.Delay(3500).ContinueWith(_ =>
        {
            if (StatusMessage == msg)
            {
                HasStatusMessage = false;
                StatusMessage = string.Empty;
            }
        });
    }
}

public class DnsPresetItemViewModel : ObservableObject
{
    public DnsPresetOption Option { get; }
    public string Id => Option.Id;
    public string Title => Option.Title;
    public string Subtitle => Option.Subtitle;
    public string IconPath => Option.IconPath;

    private bool _isSelected;
    public bool IsSelected
    {
        get => _isSelected;
        set
        {
            if (SetProperty(ref _isSelected, value))
            {
                OnPropertyChanged(nameof(BorderColor));
                OnPropertyChanged(nameof(BackgroundColor));
                OnPropertyChanged(nameof(TitleColor));
                OnPropertyChanged(nameof(IconColor));
            }
        }
    }

    public string BorderColor => IsSelected ? "#8B5CF6" : "#1E2638";
    public string BackgroundColor => IsSelected ? "#1E1B4B" : "#090D1C";
    public string TitleColor => IsSelected ? "#FFFFFF" : "#E2E8F0";
    public string IconColor => IsSelected ? "#38BDF8" : "#818CF8";

    public DnsPresetItemViewModel(DnsPresetOption option, bool isSelected = false)
    {
        Option = option;
        _isSelected = isSelected;
    }
}
