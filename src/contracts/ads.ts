export interface AdAccountOptionDto {
  id: string;
  name: string;
  accountId: string;
  customerId?: string;
}

export interface AdAccountsResponseDto {
  platform: string | null;
  adAccounts: AdAccountOptionDto[];
  pluginRequired?: boolean;
}

export interface AdTestEventResponseDto {
  accepted: boolean;
  reason?: string;
}

export interface AdsContracts {
  'GET /api/marketing/:id/accounts': { input: null; output: AdAccountsResponseDto };
  'POST /api/marketing/:id/test-event': { input: { testEventCode?: string } | null; output: AdTestEventResponseDto };
}
