// No `run` field: keeps this catalog free of backend imports so the dashboard can read schedules without pulling in job logic.
export interface CronJobMeta {
  cron: string;
  name: string;
  intervalMs: number;
  lockTtlSeconds: number;
}

export const CRON_JOBS: CronJobMeta[] = [
  { cron: '*/5 * * * *', name: 'ads.postback', intervalMs: 5 * 60_000, lockTtlSeconds: 300 },
  { cron: '*/5 * * * *', name: 'orders.auto-capture', intervalMs: 5 * 60_000, lockTtlSeconds: 300 },
  { cron: '*/5 * * * *', name: 'email.dispatch', intervalMs: 5 * 60_000, lockTtlSeconds: 300 },
  { cron: '*/5 * * * *', name: 'payment.event-compensation', intervalMs: 5 * 60_000, lockTtlSeconds: 300 },
  { cron: '*/5 * * * *', name: 'ecommerce.push-retry', intervalMs: 5 * 60_000, lockTtlSeconds: 300 },
  { cron: '*/5 * * * *', name: 'commerce.catalog-sync', intervalMs: 5 * 60_000, lockTtlSeconds: 600 },
  { cron: '*/10 * * * *', name: 'fulfillment.sync', intervalMs: 10 * 60_000, lockTtlSeconds: 7200 },
  { cron: '*/30 * * * *', name: 'recall.dispatch', intervalMs: 30 * 60_000, lockTtlSeconds: 600 },
  { cron: '*/30 * * * *', name: 'analytics.conversion', intervalMs: 30 * 60_000, lockTtlSeconds: 3600 },
  { cron: '0 3 * * *', name: 'maintenance.notification-logs', intervalMs: 24 * 60 * 60_000, lockTtlSeconds: 600 },
  { cron: '0 3 * * *', name: 'maintenance.jobs', intervalMs: 24 * 60 * 60_000, lockTtlSeconds: 600 },
];
