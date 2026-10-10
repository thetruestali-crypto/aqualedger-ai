// Service-worker wiring for the prompt-mode update flow.
// Registers immediately (offline shell still precached) but only activates a
// waiting worker after the user taps "به‌روزرسانی" in the banner.
import React, { useCallback, useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { UpdateBanner } from './UpdateBanner';

export const PwaUpdatePrompt: React.FC = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<((reload: boolean) => void) | null>(null);

  useEffect(() => {
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
      },
    });
    setUpdateSW(() => update);
  }, []);

  const handleUpdate = useCallback(() => {
    updateSW?.(true);
  }, [updateSW]);

  return <UpdateBanner visible={needRefresh} onUpdate={handleUpdate} />;
};
