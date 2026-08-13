import { useState, useEffect } from 'react';
import { TrafficStats, ConnectionStatus, VpnServer } from '../types/vpn';

interface UseTrafficStatsProps {
  status: ConnectionStatus;
  isWindowVisible: boolean;
  selectedServer: VpnServer | null;
}

export function useTrafficStats({
  status,
  isWindowVisible,
  selectedServer,
}: UseTrafficStatsProps) {
  const [stats, setStats] = useState<TrafficStats>({
    downloadSpeed: 0,
    uploadSpeed: 0,
    totalDownloaded: 0,
    totalUploaded: 0,
    pingMs: 35,
  });

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (status === 'connected' && isWindowVisible) {
      interval = setInterval(() => {
        // TODO: Replace with real Clash API stats from sing-box/xray when available
        const downloadSpeed = Math.floor(Math.random() * 4500000) + 1200000;
        const uploadSpeed = Math.floor(Math.random() * 800000) + 200000;
        setStats(prev => ({
          downloadSpeed,
          uploadSpeed,
          totalDownloaded: prev.totalDownloaded + downloadSpeed,
          totalUploaded: prev.totalUploaded + uploadSpeed,
          pingMs: selectedServer?.pingMs || 32,
        }));
      }, 1000);
    } else if (status !== 'connected') {
      setStats({
        downloadSpeed: 0,
        uploadSpeed: 0,
        totalDownloaded: 0,
        totalUploaded: 0,
        pingMs: 0,
      });
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status, isWindowVisible, selectedServer]);

  return stats;
}
