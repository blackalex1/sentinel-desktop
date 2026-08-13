import { useState, useEffect, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { LogEntry } from '../components/LogsView';
import { AppSettings } from '../types/vpn';
import { TauriBridge } from '../services/tauriBridge';

interface UseVpnLogsProps {
  settingsRef: React.MutableRefObject<AppSettings>;
  isWindowVisible: boolean;
}

export function useVpnLogs({ settingsRef, isWindowVisible }: UseVpnLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logBufferRef = useRef<LogEntry[]>([]);

  // Catch up on logs accumulated in background when window becomes visible
  useEffect(() => {
    if (!isWindowVisible) return;

    TauriBridge.getCoreLogs().then(lines => {
      if (lines && lines.length > 0) {
        const freshLogs: LogEntry[] = lines.map(line => {
          let level: LogEntry['level'] = 'info';
          const lower = line.toLowerCase();
          if (lower.includes('error') || lower.includes('fatal') || lower.includes('[error]')) level = 'error';
          else if (lower.includes('warn') || lower.includes('warning') || lower.includes('[warn]')) level = 'warn';
          else if (lower.includes('debug') || lower.includes('trace') || lower.includes('[debug]')) level = 'debug';
          return {
            id: `log_catchup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: new Date().toLocaleTimeString(),
            level,
            message: line,
            core: settingsRef.current?.activeCore ?? 'singbox',
          };
        });
        setLogs(freshLogs.slice(-1000));
      }
    });
  }, [isWindowVisible, settingsRef]);

  // Flush batched log entries to React state periodically ONLY when window is visible
  useEffect(() => {
    if (!isWindowVisible) return;

    const timer = setInterval(() => {
      if (logBufferRef.current.length > 0) {
        const batch = logBufferRef.current;
        logBufferRef.current = [];
        setLogs((prev) => {
          const combined = [...prev, ...batch];
          return combined.length > 1000 ? combined.slice(-1000) : combined;
        });
      }
    }, 250);
    return () => clearInterval(timer);
  }, [isWindowVisible]);

  // Global persistent core-log event listener
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let isMounted = true;

    const setupListener = async () => {
      try {
        unlisten = await listen<any>('core-log', (event) => {
          if (!isMounted) return;
          const timeStr = new Date().toLocaleTimeString();
          const rawPayload = typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload || '');
          if (!rawPayload.trim()) return;

          let level: LogEntry['level'] = 'info';
          const lower = rawPayload.toLowerCase();
          if (lower.includes('error') || lower.includes('fatal') || lower.includes('[error]')) level = 'error';
          else if (lower.includes('warn') || lower.includes('warning') || lower.includes('[warn]')) level = 'warn';
          else if (lower.includes('debug') || lower.includes('trace') || lower.includes('[debug]')) level = 'debug';

          const entry: LogEntry = {
            id: `log_native_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: timeStr,
            level,
            message: rawPayload,
            core: settingsRef.current?.activeCore ?? 'singbox',
          };
          logBufferRef.current.push(entry);
        });
      } catch (err) {
        console.warn('[Logs] Could not attach native core-log listener:', err);
      }
    };

    setupListener();
    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, [settingsRef]);

  const handleClearLogs = useCallback(async () => {
    logBufferRef.current = [];
    setLogs([]);
    await TauriBridge.clearCoreLogs();
  }, []);

  return {
    logs,
    handleClearLogs,
  };
}
