import type { ClockPort } from '../application/ports/outbound';

export class WorkersClock implements ClockPort {
  now(): Date {
    return new Date();
  }
}
