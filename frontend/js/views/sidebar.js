/**
 * Sentinel Secure Desktop - Sidebar Component
 */

class SidebarView {
  init() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Update footer info
    this.updateFooter();
  }

  switchTab(tabId) {
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('data-tab') === tabId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    document.querySelectorAll('.tab-view').forEach(view => {
      if (view.id === `view-${tabId}`) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    if (window.dashboardView) {
      if (window.dashboardView.radar) {
        window.dashboardView.radar.isVisible = (tabId === 'dashboard' && !document.hidden);
      }
      if (window.dashboardView.mascot) {
        window.dashboardView.mascot.isVisible = (tabId === 'dashboard' && !document.hidden);
      }
    }

    if (tabId === 'logs' && window.logsView) {
      window.logsView.render();
    }
    if (tabId === 'routing' && window.routingView) {
      window.routingView.render();
    }
    if (tabId === 'hotspot' && window.hotspotView) {
      window.hotspotView.detectGateway(false);
      window.hotspotView.loadInterfaces();
    }
  }

  async updateFooter() {
    const verEl = document.getElementById('sidebar-engine-version');
    const coreEl = document.getElementById('sidebar-active-core');

    if (verEl) {
      const ver = await window.bridge.getCoreDLLVersion();
      verEl.textContent = ver || 'v2.0.0';
    }

    if (coreEl) {
      coreEl.textContent = window.state?.settings?.activeCore || 'sing-box';
    }
  }
}

window.sidebarView = new SidebarView();
