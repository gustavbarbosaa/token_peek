import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from '@tauri-apps/plugin-autostart';
import {
  isRegistered as isGlobalShortcutRegistered,
  register as registerGlobalShortcut,
  unregister as unregisterGlobalShortcut,
} from '@tauri-apps/plugin-global-shortcut';
import {
  readPreferences,
  saveStoredPreferences,
  type Preferences,
} from '../preferences';

function shortcutErrorMessage(shortcut: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  if (detail.startsWith('HotKey already registered:')) {
    return `O atalho ${shortcut} já está em uso. Escolha outra combinação ou encerre uma segunda instância do Token Peek pela bandeja.`;
  }
  return `Não foi possível registrar ${shortcut}: ${detail}`;
}

export function usePreferences(
  onStartupNotice: (notice: { text: string; error: boolean }) => void,
) {
  const [preferences, setPreferences] = useState(readPreferences);
  const [draft, setDraft] = useState<Preferences | null>(null);
  const [systemShortcut, setSystemShortcut] = useState(false);
  const systemShortcutRef = useRef(false);
  const [shortcutError, setShortcutError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const saveInProgress = useRef(false);
  const shortcutRef = useRef<string | null>(null);
  const initialShortcut = useRef(preferences.shortcut);
  const shortcutInitialization = useRef<Promise<void> | null>(null);
  const applyShortcut = useCallback(async (shortcut: string | null) => {
    if (
      !isTauri() ||
      systemShortcutRef.current ||
      shortcutRef.current === shortcut
    )
      return;

    const previousShortcut = shortcutRef.current;
    if (shortcut) {
      // O registro nativo sobrevive ao recarregamento da interface.
      if (await isGlobalShortcutRegistered(shortcut)) {
        shortcutRef.current = shortcut;
        return;
      }

      try {
        // O plugin trata a abertura do painel no Rust.
        await registerGlobalShortcut(shortcut, () => {});
      } catch (error) {
        // Outro pedido da própria interface pode ter registrado a tecla.
        const owned = await isGlobalShortcutRegistered(shortcut).catch(
          () => false,
        );
        if (!owned) throw error;
        shortcutRef.current = shortcut;
        return;
      }
    }

    if (previousShortcut) {
      try {
        await unregisterGlobalShortcut(previousShortcut);
      } catch (error) {
        if (shortcut) await unregisterGlobalShortcut(shortcut).catch(() => {});
        throw error;
      }
    }

    shortcutRef.current = shortcut;
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === 'system') {
      root.removeAttribute('data-theme');
      return;
    }
    root.dataset.theme = preferences.theme;
  }, [preferences.theme]);

  useEffect(() => {
    if (!isTauri() || shortcutInitialization.current) return;
    shortcutInitialization.current = invoke<boolean>('uses_system_shortcut')
      .then((managedBySystem) => {
        systemShortcutRef.current = managedBySystem;
        setSystemShortcut(managedBySystem);
        return applyShortcut(initialShortcut.current);
      })
      .catch((error: unknown) => {
        setShortcutError(shortcutErrorMessage(initialShortcut.current, error));
        onStartupNotice({
          text: 'Confira o atalho global nas preferências.',
          error: true,
        });
      });
  }, [applyShortcut, onStartupNotice]);

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    void isAutostartEnabled()
      .then((enabled) => {
        if (active) {
          setPreferences((current) => ({
            ...current,
            startOnSystemStartup: enabled,
          }));
        }
      })
      .catch(() => {
        if (active) {
          onStartupNotice({
            text: 'Não foi possível consultar a inicialização automática.',
            error: true,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [onStartupNotice]);

  async function savePreferences() {
    if (saveInProgress.current) return false;
    const next = draft ?? preferences;
    saveInProgress.current = true;
    setSaving(true);
    setSaveError('');

    try {
      await shortcutInitialization.current;
      const previousShortcut = shortcutRef.current;
      setShortcutError('');
      try {
        await applyShortcut(next.shortcut);
      } catch (error) {
        setShortcutError(shortcutErrorMessage(next.shortcut, error));
        return false;
      }

      let previousAutostart: boolean | undefined;
      try {
        if (isTauri()) {
          previousAutostart = await isAutostartEnabled();
          if (previousAutostart !== next.startOnSystemStartup) {
            if (next.startOnSystemStartup) await enableAutostart();
            else await disableAutostart();
          }
        }
        saveStoredPreferences(next);
      } catch {
        const restores: Promise<void>[] = [];
        if (shortcutRef.current !== previousShortcut) {
          restores.push(applyShortcut(previousShortcut));
        }
        if (
          previousAutostart !== undefined &&
          previousAutostart !== next.startOnSystemStartup
        ) {
          restores.push(
            previousAutostart ? enableAutostart() : disableAutostart(),
          );
        }
        const results = await Promise.allSettled(restores);
        setSaveError(
          results.some((result) => result.status === 'rejected')
            ? 'Não foi possível salvar nem restaurar todas as opções. Revise as preferências.'
            : 'Não foi possível salvar as preferências. Tente novamente.',
        );
        return false;
      }

      setPreferences(next);
      setDraft(null);
      return true;
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  }

  function updateDraft(next: Preferences) {
    if (next.shortcut !== (draft ?? preferences).shortcut) setShortcutError('');
    setDraft(next);
  }

  return {
    preferences,
    draft: draft ?? preferences,
    shortcutError,
    systemShortcut,
    saveError,
    saving,
    updateDraft,
    savePreferences,
  };
}
