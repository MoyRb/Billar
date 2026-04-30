import type { TableSession } from './types';

const toSeconds = (date: string) => Math.floor(new Date(date).getTime() / 1000);

export function calculateSessionElapsedSeconds(session: TableSession, now = new Date()): number {
  const start = toSeconds(session.started_at);
  const endReference = session.ended_at ?? (session.status === 'paused' && session.paused_at ? session.paused_at : now.toISOString());
  return Math.max(0, toSeconds(endReference) - start);
}

export function calculateChargeableSeconds(session: TableSession, now = new Date()): number {
  const elapsed = calculateSessionElapsedSeconds(session, now);
  return Math.max(0, elapsed - session.total_paused_seconds);
}

export function calculateChargedMinutes(seconds: number): number {
  return Math.ceil(Math.max(0, seconds) / 60);
}

export function calculateTableTotal(minutes: number, hourlyRate: number): number {
  return Number(((minutes / 60) * hourlyRate).toFixed(2));
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map((u) => String(u).padStart(2, '0')).join(':');
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
}
