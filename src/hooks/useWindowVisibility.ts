import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

export function useWindowVisibility() {
  const [isWindowVisible, setIsWindowVisible] = useState(true);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const handleVisibility = (visible: boolean) => {
      setIsWindowVisible(visible);
    };

    listen<boolean>('window-visibility', (event) => {
      handleVisibility(event.payload);
    }).then(fn => { unlisten = fn; });

    const handleDocVisibility = () => {
      if (document.hidden) {
        handleVisibility(false);
      } else {
        handleVisibility(true);
      }
    };

    document.addEventListener('visibilitychange', handleDocVisibility);

    return () => {
      if (unlisten) unlisten();
      document.removeEventListener('visibilitychange', handleDocVisibility);
    };
  }, []);

  return isWindowVisible;
}
