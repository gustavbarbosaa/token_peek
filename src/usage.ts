export type Scenario = 'normal' | 'low' | 'exhausted';
export interface UsageWindow {
  remaining: number;
  resetsAt: number;
}
export interface UsageSnapshot {
  current: UsageWindow;
  weekly: UsageWindow;
  updatedAt: number;
}

export function getDemoUsage(scenario: Scenario): UsageSnapshot {
  const now = Date.now();
  const values = { normal: [72, 46], low: [12, 18], exhausted: [0, 8] }[
    scenario
  ];
  return {
    current: { remaining: values[0], resetsAt: now + 138 * 60_000 },
    weekly: { remaining: values[1], resetsAt: now + 3 * 86_400_000 },
    updatedAt: now,
  };
}
export function countdown(resetsAt: number, now: number): string {
  const minutes = Math.max(0, Math.ceil((resetsAt - now) / 60_000));
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}min`;
}
export interface Preferences {
  alerts: boolean;
  threshold: number;
}
const defaults: Preferences = { alerts: true, threshold: 20 };
export function readPreferences(): Preferences {
  try {
    const data: unknown = JSON.parse(
      localStorage.getItem('token-peek:preferences') || 'null',
    );
    if (
      data &&
      typeof data === 'object' &&
      'alerts' in data &&
      typeof data.alerts === 'boolean' &&
      'threshold' in data &&
      typeof data.threshold === 'number' &&
      [10, 20, 30].includes(data.threshold)
    )
      return { alerts: data.alerts, threshold: data.threshold };
  } catch {}
  return { ...defaults };
}
