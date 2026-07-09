export interface DomainDto {
  id: string;
  domain: string;
  isPrimary: boolean;
}

export interface ScriptDto {
  id: string;
  name: string;
  position: 'HEAD' | 'BODY_START' | 'BODY_END';
  content: string;
  enabled: boolean;
  order: number;
}

export interface ScriptCreateInput {
  name: string;
  position: 'HEAD' | 'BODY_START' | 'BODY_END';
  content: string;
  enabled?: boolean;
  order?: number;
}

export interface ScriptUpdateInput {
  name?: string;
  position?: 'HEAD' | 'BODY_START' | 'BODY_END';
  content?: string;
  enabled?: boolean;
  order?: number;
}

export interface SiteConfigContracts {
  'GET /api/settings/domains': { input: null; output: DomainDto[] };
  'POST /api/settings/domains': {
    input: { domain: string; isPrimary?: boolean };
    output: DomainDto;
  };
  'PUT /api/settings/domains/:id': { input: { isPrimary?: boolean }; output: DomainDto };
  'DELETE /api/settings/domains/:id': { input: null; output: { success: true } };

  'GET /api/settings/custom-code': { input: null; output: ScriptDto[] };
  'POST /api/settings/custom-code': { input: ScriptCreateInput; output: ScriptDto };
  'PUT /api/settings/custom-code/:id': { input: ScriptUpdateInput; output: ScriptDto };
  'DELETE /api/settings/custom-code/:id': { input: null; output: { success: true } };
}
