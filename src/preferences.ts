const STORAGE_KEY = 'token-peek:preferences';
export const ALERT_THRESHOLDS = [10, 20, 30] as const;

export interface Preferences {
  alerts: boolean;
  threshold: number;
  theme: 'system' | 'light' | 'dark';
  shortcut: string;
  startOnSystemStartup: boolean;
}

export const DEFAULT_SHORTCUT = 'Ctrl+Alt+X';

const defaults: Preferences = {
  alerts: true,
  threshold: 20,
  theme: 'system',
  shortcut: DEFAULT_SHORTCUT,
  startOnSystemStartup: false,
};

function isValidShortcut(shortcut: unknown): shortcut is string {
  if (typeof shortcut !== 'string') return false;
  const parts = shortcut.split('+');
  const modifiers = ['Ctrl', 'Alt', 'Shift', 'Super'];
  return (
    parts.length >= 2 &&
    parts.length <= 5 &&
    parts.slice(0, -1).every((part) => modifiers.includes(part)) &&
    /^[A-Za-z0-9]+$/.test(parts[parts.length - 1])
  );
}

export function readPreferences(): Preferences {
  try {
    const data: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || 'null',
    );
    if (
      data &&
      typeof data === 'object' &&
      'alerts' in data &&
      typeof data.alerts === 'boolean' &&
      'threshold' in data &&
      typeof data.threshold === 'number' &&
      ALERT_THRESHOLDS.some((value) => value === data.threshold)
    ) {
      const theme =
        'theme' in data &&
        (data.theme === 'system' ||
          data.theme === 'light' ||
          data.theme === 'dark')
          ? data.theme
          : 'system';
      const savedShortcut =
        'shortcut' in data && isValidShortcut(data.shortcut)
          ? data.shortcut
          : defaults.shortcut;
      const shortcut =
        savedShortcut === 'Ctrl+Alt+L' ? defaults.shortcut : savedShortcut;
      const startOnSystemStartup =
        'startOnSystemStartup' in data &&
        typeof data.startOnSystemStartup === 'boolean'
          ? data.startOnSystemStartup
          : defaults.startOnSystemStartup;
      return {
        alerts: data.alerts,
        threshold: data.threshold,
        theme,
        shortcut,
        startOnSystemStartup,
      };
    }
  } catch {
    // Use the default preferences when local storage is unavailable.
  }
  return { ...defaults };
}

export function saveStoredPreferences(preferences: Preferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}
