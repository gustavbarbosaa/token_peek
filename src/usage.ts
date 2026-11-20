export interface UsageLimit {
  window: 'primary' | 'secondary';
  usedPercent: number;
  windowDurationMins: number | null;
  resetsAt: number | null;
}

export interface UsageSnapshot {
  limits: UsageLimit[];
  updatedAt: number;
}

export function countdown(resetsAt: number, now: number): string {
  const minutes = Math.max(0, Math.ceil((resetsAt - now) / 60_000));
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}min`;
}

export function formatWindowDuration(minutes: number | null): string {
  if (!minutes) return 'Duração indisponível';
  if (minutes % (60 * 24 * 7) === 0) {
    const weeks = minutes / (60 * 24 * 7);
    return weeks === 1 ? '7 dias' : `${weeks} semanas`;
  }
  if (minutes % (60 * 24) === 0) {
    const days = minutes / (60 * 24);
    return days === 1 ? '24 horas' : `${days} dias`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? '1 hora' : `${hours} horas`;
  }
  return `${minutes} min`;
}
