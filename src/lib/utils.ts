import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type DayBoundary = 'start' | 'end';

function utcDateForDay(dateStr: string, boundary: DayBoundary): Date {
  const clock = boundary === 'start' ? '00:00:00.000' : '23:59:59.999';
  return new Date(`${dateStr}T${clock}Z`);
}

function timezoneOffsetMs(dateStr: string, timezone: string): number {
  const noonUtc = new Date(`${dateStr}T12:00:00Z`);
  const utcWallTime = noonUtc.toLocaleString('en-US', { timeZone: 'UTC' });
  const localWallTime = noonUtc.toLocaleString('en-US', { timeZone: timezone });

  return new Date(localWallTime).getTime() - new Date(utcWallTime).getTime();
}

export function convertDateRangeToUtc(
  startDateStr: string,
  endDateStr: string,
  timezone: string
): { startDate: Date; endDate: Date } {
  if (timezone === 'UTC') {
    return {
      startDate: utcDateForDay(startDateStr, 'start'),
      endDate: utcDateForDay(endDateStr, 'end'),
    };
  }

  const startOffsetMs = timezoneOffsetMs(startDateStr, timezone);
  const endOffsetMs = timezoneOffsetMs(endDateStr, timezone);

  return {
    startDate: new Date(utcDateForDay(startDateStr, 'start').getTime() - startOffsetMs),
    endDate: new Date(utcDateForDay(endDateStr, 'end').getTime() - endOffsetMs),
  };
}
