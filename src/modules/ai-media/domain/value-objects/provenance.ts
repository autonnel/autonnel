export interface ProvenanceInput {
  jobId: string;
  provider: string;
  modelId: string;
  promptHash: string;
}

export class Provenance {
  private constructor(
    readonly jobId: string,
    readonly provider: string,
    readonly modelId: string,
    readonly promptHash: string,
  ) {
    Object.freeze(this);
  }

  static create(input: ProvenanceInput): Provenance {
    if (!input.jobId) throw new Error('Provenance requires jobId');
    if (!input.provider) throw new Error('Provenance requires provider');
    if (!input.modelId) throw new Error('Provenance requires modelId');
    if (!input.promptHash) throw new Error('Provenance requires promptHash');
    return new Provenance(input.jobId, input.provider, input.modelId, input.promptHash);
  }
}
