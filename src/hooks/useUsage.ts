import { useEffect, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { AccountStatus } from '../types/auth';
import type { UsageSnapshot } from '../usage';

const REFRESH_INTERVAL_MS = 30_000;

type UsageState = {
  session: AccountStatus;
  snapshot: UsageSnapshot | null;
  error: string;
};

export function useUsage(account: AccountStatus | null) {
  const session = account?.connected ? account : null;
  const [state, setState] = useState<UsageState | null>(null);

  useEffect(() => {
    if (!session || !isTauri()) return;
    const currentSession = session;
    let active = true;
    let inFlight = false;
    let refreshPending = false;
    let timer: number | undefined;
    let unlisten: (() => void) | undefined;

    async function refresh() {
      if (!active) return;
      if (inFlight) {
        refreshPending = true;
        return;
      }
      window.clearTimeout(timer);
      inFlight = true;

      try {
        const snapshot = await invoke<UsageSnapshot>('usage_read');
        if (active) {
          setState({
            session: currentSession,
            snapshot: { ...snapshot, updatedAt: snapshot.updatedAt * 1000 },
            error: '',
          });
        }
      } catch (error) {
        if (active) {
          setState((previous) => ({
            session: currentSession,
            snapshot:
              previous?.session === currentSession ? previous.snapshot : null,
            error: String(error),
          }));
        }
      } finally {
        inFlight = false;
        if (refreshPending) {
          refreshPending = false;
          void refresh();
        } else if (active) {
          timer = window.setTimeout(refresh, REFRESH_INTERVAL_MS);
        }
      }
    }

    function refreshOnResume() {
      if (!inFlight) void refresh();
    }

    window.addEventListener('focus', refreshOnResume);
    window.addEventListener('online', refreshOnResume);

    void listen('usage-changed', refresh)
      .then((stopListening) => {
        if (active) unlisten = stopListening;
        else stopListening();
      })
      .catch((error: unknown) =>
        console.warn('Falha ao acompanhar o consumo:', error),
      )
      .then(refresh);

    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener('focus', refreshOnResume);
      window.removeEventListener('online', refreshOnResume);
      unlisten?.();
    };
  }, [session]);

  const current = state?.session === session ? state : null;
  return {
    usage: current?.snapshot ?? null,
    loading: Boolean(isTauri() && session && !current),
    error: current?.error ?? '',
  };
}
