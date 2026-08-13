import React from 'react';
import { SubscriptionModal } from './SubscriptionModal';
import { EditServerModal } from './EditServerModal';
import { ExportModal } from './ExportModal';
import { ToastContainer, ToastMessage } from './Toast';
import { VpnServer, AppSettings } from '../types/vpn';

interface AppModalsProps {
  isSubscriptionOpen: boolean;
  onCloseSubscription: () => void;
  onAddServers: (newServers: VpnServer[]) => void;

  isEditModalOpen: boolean;
  editingServer: VpnServer | null;
  onCloseEdit: () => void;
  onSaveServer: (server: VpnServer) => void;

  isExportOpen: boolean;
  onCloseExport: () => void;
  servers: VpnServer[];
  selectedServer: VpnServer | null;
  settings: AppSettings;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info' | 'warning') => void;

  toasts: ToastMessage[];
  onDismissToast: (id: string) => void;
}

export function AppModals({
  isSubscriptionOpen,
  onCloseSubscription,
  onAddServers,
  isEditModalOpen,
  editingServer,
  onCloseEdit,
  onSaveServer,
  isExportOpen,
  onCloseExport,
  servers,
  selectedServer,
  settings,
  onShowToast,
  toasts,
  onDismissToast,
}: AppModalsProps) {
  return (
    <>
      {/* Subscription Modal (1-click link/base64 import) */}
      <SubscriptionModal
        isOpen={isSubscriptionOpen}
        onClose={onCloseSubscription}
        onAddServers={onAddServers}
      />

      {/* Edit Server Modal */}
      <EditServerModal
        isOpen={isEditModalOpen}
        server={editingServer}
        onClose={onCloseEdit}
        onSave={onSaveServer}
      />

      {/* Export & Backup Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={onCloseExport}
        servers={servers}
        selectedServer={selectedServer}
        settings={settings}
        onShowToast={onShowToast}
      />

      {/* Toast Notification Layer */}
      <ToastContainer toasts={toasts} onDismiss={onDismissToast} />
    </>
  );
}
