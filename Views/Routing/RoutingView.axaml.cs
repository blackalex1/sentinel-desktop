using System;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using SentinelDesktop.Models;
using SentinelDesktop.ViewModels;

namespace SentinelDesktop.Views.Routing;

public partial class RoutingView : UserControl
{
    private Point _dragStartPoint;
    private RoutingTableItem? _draggedItem;

    public RoutingView()
    {
        InitializeComponent();
        AddHandler(DragDrop.DragOverEvent, OnTableDragOver);
        AddHandler(DragDrop.DragLeaveEvent, OnTableDragLeave);
        AddHandler(DragDrop.DropEvent, OnTableDrop);
    }

    public void OnDragHandlePointerPressed(object? sender, PointerPressedEventArgs e)
    {
        if (sender is Control control && control.DataContext is RoutingTableItem item)
        {
            _draggedItem = item;
            _dragStartPoint = e.GetPosition(this);
        }
    }

    public async void OnDragHandlePointerMoved(object? sender, PointerEventArgs e)
    {
        if (_draggedItem == null) return;
        var currentPoint = e.GetPosition(this);

        if (Math.Abs(currentPoint.Y - _dragStartPoint.Y) > 5 || Math.Abs(currentPoint.X - _dragStartPoint.X) > 5)
        {
            var item = _draggedItem;
            _draggedItem = null;
            item.IsDragging = true;

            var dragData = new DataObject();
            dragData.Set("RoutingTableItem", item);
            try
            {
                await DragDrop.DoDragDrop(e, dragData, DragDropEffects.Move);
            }
            finally
            {
                item.IsDragging = false;
                ClearAllDragOverStates();
            }
        }
    }

    public void OnDragHandlePointerReleased(object? sender, PointerReleasedEventArgs e)
    {
        if (_draggedItem != null)
        {
            _draggedItem.IsDragging = false;
            _draggedItem = null;
        }
        ClearAllDragOverStates();
    }

    private void OnTableDragOver(object? sender, DragEventArgs e)
    {
        if (e.Data.Contains("RoutingTableItem"))
        {
            e.DragEffects = DragDropEffects.Move;

            if (e.Source is Control control)
            {
                var targetItem = control.DataContext as RoutingTableItem;
                if (targetItem == null && control.Parent is Control parentControl)
                {
                    targetItem = parentControl.DataContext as RoutingTableItem;
                }

                if (DataContext is RoutingViewModel vm)
                {
                    foreach (var item in vm.TableRules)
                    {
                        item.IsDragOver = (item == targetItem && targetItem != e.Data.Get("RoutingTableItem"));
                    }
                }
            }
        }
        else
        {
            e.DragEffects = DragDropEffects.None;
        }
    }

    private void OnTableDragLeave(object? sender, DragEventArgs e)
    {
        ClearAllDragOverStates();
    }

    private void OnTableDrop(object? sender, DragEventArgs e)
    {
        ClearAllDragOverStates();

        if (e.Source is Control control)
        {
            var targetItem = control.DataContext as RoutingTableItem;
            if (targetItem == null && control.Parent is Control parentControl)
            {
                targetItem = parentControl.DataContext as RoutingTableItem;
            }

            if (targetItem != null && e.Data.Get("RoutingTableItem") is RoutingTableItem sourceItem && sourceItem != targetItem)
            {
                sourceItem.IsDragging = false;
                if (DataContext is RoutingViewModel vm)
                {
                    vm.ReorderTableItems(sourceItem, targetItem);
                }
            }
        }
    }

    private void ClearAllDragOverStates()
    {
        if (DataContext is RoutingViewModel vm)
        {
            foreach (var item in vm.TableRules)
            {
                item.IsDragOver = false;
                item.IsDragging = false;
            }
        }
    }
}
