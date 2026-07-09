import type { ClockPort } from '../domain/ports';

export class WorkersClockAdapter implements ClockPort {
  now(): Date {
    return new Date();
  }
}
