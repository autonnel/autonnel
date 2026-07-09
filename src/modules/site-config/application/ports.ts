import type { Domain } from '../domain/domain';
import type { GlobalScript } from '../domain/global-script';

export interface DomainRepository {
  list(): Promise<Domain[]>;
  findById(id: string): Promise<Domain | null>;
  findByHost(host: string): Promise<Domain | null>;
  create(domain: Domain): Promise<Domain>;
  /** Atomically clear every other primary flag and set this id as primary. */
  setPrimary(id: string): Promise<Domain>;
  delete(id: string): Promise<void>;
}

export interface GlobalScriptRepository {
  list(): Promise<GlobalScript[]>;
  findById(id: string): Promise<GlobalScript | null>;
  create(script: GlobalScript): Promise<GlobalScript>;
  update(script: GlobalScript): Promise<GlobalScript>;
  delete(id: string): Promise<void>;
}
