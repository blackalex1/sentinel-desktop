/**
 * Sentinel Secure Desktop - Toast Notification System
 */

class ToastManager {
  constructor() {
    this.container = null;
  }

  init() {
    this.container = document.getElementById('toasts-container');
  }

  show(message, type = 'info', duration = 3500) {
    if (!this.container) this.init();
    if (!this.container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '✕';

    toast.innerHTML = `
      <span class="toast-icon font-bold">${icon}</span>
      <span class="toast-message">${message}</span>
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(30px)';
      toast.style.transition = 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  success(msg) { this.show(msg, 'success'); }
  error(msg) { this.show(msg, 'error', 4500); }
  info(msg) { this.show(msg, 'info'); }
}

window.toasts = new ToastManager();
