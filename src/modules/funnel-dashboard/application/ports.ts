import type { FunnelScript } from '../domain/funnel-script';
import type { Experiment, ExperimentArm, ExperimentGoal } from '../domain/experiment';

export interface FunnelSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FunnelRepository {
  list(): Promise<FunnelSummary[]>;
  findById(id: string): Promise<FunnelSummary | null>;
  create(input: { name: string; description: string | null }): Promise<FunnelSummary>;
  update(id: string, patch: { name?: string; description?: string | null }): Promise<FunnelSummary | null>;
  delete(id: string): Promise<boolean>;
  duplicate(id: string, name: string, opts?: { clonePages?: boolean }): Promise<FunnelSummary | null>;
}

export interface FunnelScriptRepository {
  listByFunnel(funnelId: string): Promise<FunnelScript[]>;
  findById(id: string): Promise<FunnelScript | null>;
  create(script: FunnelScript): Promise<FunnelScript>;
  update(script: FunnelScript): Promise<FunnelScript>;
  delete(id: string): Promise<void>;
}

export interface ExperimentWithArms {
  experiment: Experiment;
  arms: ExperimentArm[];
  labels: Record<string, string>;
}

export interface ExperimentRepository {
  findByFunnel(funnelId: string): Promise<ExperimentWithArms | null>;
  findExperimentIdByFunnel(funnelId: string): Promise<string | null>;
  findStartedAt(experimentId: string): Promise<Date | null>;
  create(input: { funnelId: string; name: string; goal: ExperimentGoal }): Promise<ExperimentWithArms>;
  updateExperiment(
    exp: Experiment,
    opts?: { justStarted?: boolean; justConcluded?: boolean },
  ): Promise<ExperimentWithArms>;
  deleteExperiment(experimentId: string): Promise<void>;
  addArm(arm: ExperimentArm): Promise<ExperimentWithArms>;
  updateArm(arm: ExperimentArm): Promise<ExperimentWithArms>;
  deleteArm(armId: string): Promise<ExperimentWithArms>;
}

export interface AbTestAssignmentRepository {
  find(experimentId: string, trackingId: string): Promise<string | null>;
  assign(experimentId: string, trackingId: string, armId: string): Promise<void>;
}

export interface ArmCounts {
  armId: string;
  entered: number;
  converted: number;
}

export interface ExperimentResultsReadPort {
  countByArm(input: {
    experimentId: string;
    armIds: string[];
    since: Date | null;
    goal: { kind: 'order' } | { kind: 'step_reached'; stepId: string };
  }): Promise<ArmCounts[]>;
}
