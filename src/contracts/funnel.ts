export interface FunnelDto {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FunnelListDto {
  funnels: FunnelDto[];
}

export type ScriptPosition = 'HEAD' | 'BODY_START' | 'BODY_END';

export interface FunnelScriptDto {
  id: string;
  name: string;
  position: ScriptPosition;
  content: string;
  isActive: boolean;
  order: number;
}

export interface FunnelScriptCreateInput {
  name: string;
  position: ScriptPosition;
  content: string;
  isActive?: boolean;
  order?: number;
}

export interface FunnelScriptUpdateInput {
  scriptId: string;
  name?: string;
  position?: ScriptPosition;
  content?: string;
  isActive?: boolean;
  order?: number;
}

export type ExperimentGoalDto = { kind: 'order' } | { kind: 'step_reached'; stepId: string };

export interface ExperimentArmDto {
  id: string;
  name: string;
  isControl: boolean;
  weight: number;
  pct: number;
  targetFunnelId: string | null;
  targetPageId: string | null;
  targetLabel: string;
  order: number;
}

export interface ExperimentDto {
  id: string;
  funnelId: string;
  name: string;
  status: 'draft' | 'running' | 'concluded';
  goal: ExperimentGoalDto;
  winnerArmId: string | null;
  arms: ExperimentArmDto[];
}

export interface ExperimentArmResultDto {
  armId: string;
  name: string;
  isControl: boolean;
  entered: number;
  converted: number;
  conversionRate: number;
  lift: number | null;
}

export interface ExperimentResultsDto {
  experimentId: string;
  status: 'running' | 'concluded';
  goal: ExperimentGoalDto;
  winnerArmId: string | null;
  arms: ExperimentArmResultDto[];
}

export interface FunnelContracts {
  'GET /api/funnel': { input: null; output: FunnelListDto };
  'POST /api/funnel': { input: { name: string; description?: string }; output: FunnelDto };
  'GET /api/funnel/:funnelId': { input: null; output: FunnelDto };
  'PUT /api/funnel/:funnelId': {
    input: { name?: string; description?: string | null };
    output: FunnelDto;
  };
  'DELETE /api/funnel/:funnelId': { input: null; output: { success: true } };
  'POST /api/funnel/:funnelId/duplicate': { input: { asArm?: boolean } | null; output: FunnelDto };
  'GET /api/funnel/:funnelId/custom-code': { input: null; output: FunnelScriptDto[] };
  'POST /api/funnel/:funnelId/custom-code': { input: FunnelScriptCreateInput; output: FunnelScriptDto };
  'PUT /api/funnel/:funnelId/custom-code': { input: FunnelScriptUpdateInput; output: FunnelScriptDto };
  // scriptId passed via ?scriptId= (defineRoute/apiCall do not send a DELETE body).
  'DELETE /api/funnel/:funnelId/custom-code': { input: null; output: { success: true } };
  'GET /api/funnel/:funnelId/experiment': { input: null; output: ExperimentDto | null };
  'POST /api/funnel/:funnelId/experiment': {
    input: { name: string; goal: ExperimentGoalDto };
    output: ExperimentDto;
  };
  'PUT /api/funnel/:funnelId/experiment': {
    input: { name?: string; goal?: ExperimentGoalDto; action?: 'start' | 'conclude'; winnerArmId?: string };
    output: ExperimentDto;
  };
  'DELETE /api/funnel/:funnelId/experiment': { input: null; output: { success: true } };
  'GET /api/funnel/:funnelId/experiment/results': { input: null; output: ExperimentResultsDto | null };
  'POST /api/funnel/:funnelId/experiment/arm': {
    input: { name: string; weight: number; targetFunnelId?: string; targetPageId?: string };
    output: ExperimentDto;
  };
  'PUT /api/funnel/:funnelId/experiment/arm': {
    input: { armId: string; name?: string; weight?: number };
    output: ExperimentDto;
  };
  // armId passed via ?armId= (defineRoute/apiCall do not send a DELETE body).
  'DELETE /api/funnel/:funnelId/experiment/arm': { input: null; output: ExperimentDto };
}
