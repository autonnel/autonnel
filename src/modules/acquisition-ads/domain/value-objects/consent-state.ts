export type ConsentLevel = 'GRANTED' | 'DENIED' | 'UNKNOWN';

export class ConsentState {
  private constructor(readonly level: ConsentLevel) {}
  static granted(): ConsentState { return new ConsentState('GRANTED'); }
  static denied(): ConsentState { return new ConsentState('DENIED'); }
  static unknown(): ConsentState { return new ConsentState('UNKNOWN'); }
  static fromLevel(l: ConsentLevel): ConsentState { return new ConsentState(l); }
  allowsAdStorage(): boolean { return this.level === 'GRANTED'; }
  isDenied(): boolean { return this.level === 'DENIED'; }
}
