import { useCallback, useEffect, useState } from 'react';
import type { History, HistoryEntry, HistorySettings } from '../storage/history';

export interface HistoryData {
  entries: HistoryEntry[];
  settings: HistorySettings | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useHistoryData(history: History): HistoryData {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [settings, setSettings] = useState<HistorySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([history.list(), history.getSettings()]);
      setEntries(list);
      setSettings(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read history.');
    } finally {
      setLoading(false);
    }
  }, [history]);

  useEffect(() => {
    // Initial load from extension storage; state is only set after the awaited read completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  return { entries, settings, loading, error, reload };
}
