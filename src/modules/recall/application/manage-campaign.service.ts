import { RecallCampaign, type RecallCampaignCreateInput } from '../domain/recall-campaign';
import type { RecallCampaignRepository } from './ports';

export class ManageCampaignService {
  constructor(private readonly campaigns: RecallCampaignRepository) {}

  async get(): Promise<RecallCampaign | null> {
    return this.campaigns.findActive();
  }

  async put(input: RecallCampaignCreateInput): Promise<RecallCampaign> {
    const existing = await this.campaigns.findActive();
    if (!existing) {
      const created = RecallCampaign.create(input);
      created.activate();
      return this.campaigns.save(created);
    }
    existing.replaceSteps(input.steps); // structural edit bumps campaignVersion
    return this.campaigns.save(existing);
  }
}
