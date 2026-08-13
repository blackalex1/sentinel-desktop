import { useState, useCallback } from 'react';
import { VpnServer } from '../types/vpn';

export function useModals() {
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<VpnServer | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleEditServer = useCallback((server: VpnServer) => {
    setEditingServer(server);
    setIsEditModalOpen(true);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setEditingServer(null);
  }, []);

  return {
    isSubscriptionOpen,
    setIsSubscriptionOpen,
    isExportOpen,
    setIsExportOpen,
    editingServer,
    isEditModalOpen,
    handleEditServer,
    handleCloseEditModal,
  };
}
