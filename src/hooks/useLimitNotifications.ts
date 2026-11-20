import { useEffect, useRef } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { requestPermission } from '@tauri-apps/plugin-notification';
import { countdown, type UsageSnapshot } from '../usage';

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  }
  return (result >>> 0).toString(36);
}

export function useLimitNotifications(
  usage: UsageSnapshot | null,
  accountKey: string,
  connected: boolean,
  enabled: boolean,
  threshold: number,
) {
  const pendingNotifications = useRef(new Set<string>());
  const permissionRequested = useRef(false);

  useEffect(() => {
    if (!isTauri() || !connected || !enabled || !usage) return;
    const snapshot = usage;
    let active = true;

    async function notifyReachedLimits() {
      for (const limit of snapshot.limits) {
        if (!active) return;
        if (!Number.isFinite(limit.usedPercent)) continue;
        const remaining = Math.max(0, Math.min(100, 100 - limit.usedPercent));
        const period = limit.resetsAt ?? 'unknown-period';
        const notificationKey = `token-peek:limit-alert:${hash(
          `${accountKey}:${limit.window}:${period}:${threshold}`,
        )}`;

        if (remaining > threshold) {
          if (!limit.resetsAt) localStorage.removeItem(notificationKey);
          continue;
        }

        const previous = localStorage.getItem(notificationKey);
        if (
          (previous && previous !== 'permission-denied') ||
          pendingNotifications.current.has(notificationKey)
        ) {
          continue;
        }

        pendingNotifications.current.add(notificationKey);
        try {
          // O wrapper JS mantém a permissão em cache. Consulte o estado nativo.
          let granted = await invoke<boolean | null>(
            'plugin:notification|is_permission_granted',
          );
          if (!active) return;
          if (granted === null && !permissionRequested.current) {
            permissionRequested.current = true;
            granted = (await requestPermission()) === 'granted';
          }
          if (!active || !granted) continue;

          const windowName =
            limit.window === 'primary'
              ? 'Janela principal'
              : 'Janela secundária';
          const resetMessage = limit.resetsAt
            ? `Renova em ${countdown(limit.resetsAt * 1000, Date.now())}.`
            : '';
          const reached = remaining === 0;

          await invoke('plugin:notification|notify', {
            options: {
              title: reached
                ? 'Limite do Codex atingido'
                : 'Limite do Codex próximo',
              body: `${windowName}: restam ${remaining}% do limite. ${resetMessage}`.trim(),
            },
          });
          localStorage.setItem(notificationKey, String(Date.now()));
        } catch (error) {
          console.warn('Falha ao enviar aviso de limite:', error);
        } finally {
          pendingNotifications.current.delete(notificationKey);
        }
      }
    }

    const checkLimits = () => {
      void notifyReachedLimits().catch((error: unknown) =>
        console.warn('Falha ao preparar avisos de limite:', error),
      );
    };
    checkLimits();
    window.addEventListener('focus', checkLimits);
    return () => {
      active = false;
      window.removeEventListener('focus', checkLimits);
    };
  }, [accountKey, connected, enabled, threshold, usage]);
}
