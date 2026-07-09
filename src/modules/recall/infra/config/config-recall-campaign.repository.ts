import type { PrismaClient } from '@prisma/client';
import { getRecallKvConfig, type RecallConfigPublic } from '@/lib/config/recall';
import { messagingKeyForType } from '@/lib/email-templates/template-key-map';
import type { EmailTemplateType } from '@/lib/email-templates/types';
import { createLogger } from '@/lib/logger';
import { RecallCampaign, type RecallStepInput } from '../../domain/recall-campaign';
import type { RecallCampaignRepository } from '../../application/ports';

const logger = createLogger('Recall:ConfigCampaignRepo');
const CAMPAIGN_NAME = 'default';
const LEGACY_TEMPLATE_KEY = 'recall.abandoned_checkout';

// Pure: turn the Settings → Recall intervals into a domain campaign (one email touch per interval).
// Returns null when recall is disabled, unconfigured, or has no usable interval.
export function deriveCampaignFromConfig(config: RecallConfigPublic | null): RecallCampaign | null {
  if (!config || !config.isEnabled) return null;

  const byHour = new Map<number, { emailTemplateType: string; couponId?: string | null }>();
  for (const iv of config.intervals) {
    if (typeof iv.hours !== 'number' || !Number.isInteger(iv.hours) || iv.hours < 1) continue;
    if (!byHour.has(iv.hours)) byHour.set(iv.hours, iv);
  }
  const hours = [...byHour.keys()].sort((a, b) => a - b);
  if (hours.length === 0) return null;

  const recallWindowHours = hours[hours.length - 1];
  const steps: RecallStepInput[] = hours.map((h, i) => {
    const iv = byHour.get(h)!;
    return {
      stepIndex: i,
      channel: 'email',
      delayOffsetMinutes: h * 60,
      templateKey: messagingKeyForType(iv.emailTemplateType as EmailTemplateType) ?? LEGACY_TEMPLATE_KEY,
      incentiveRef: iv.couponId ?? undefined,
    };
  });

  try {
    const campaign = RecallCampaign.create({
      name: CAMPAIGN_NAME,
      enabledChannels: ['email'],
      recallWindowHours,
      steps,
      frequencyCap: { maxTouches: steps.length, perWindowHours: recallWindowHours },
      eligibility: { requireContactHandle: true },
      stopConditions: { stopOnOptout: true, stopOnBounce: true },
    });
    campaign.activate();
    return campaign;
  } catch (err) {
    logger.warn('failed to derive recall campaign from config; treating as inactive', { error: err });
    return null;
  }
}

// Derives the active campaign from `recall.config` KV (the single source the user edits in Settings).
// A canonical campaign row is materialized so RecallAttempt.campaignRef (a FK) resolves; the row is a
// one-way mirror of the KV, never authored directly.
export class ConfigRecallCampaignRepository implements RecallCampaignRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findActive(): Promise<RecallCampaign | null> {
    const campaign = deriveCampaignFromConfig(await getRecallKvConfig());
    if (!campaign) return null;

    const data = {
      name: campaign.name,
      status: 'active',
      recallWindowHours: campaign.recallWindowHours,
      enabledChannels: campaign.enabledChannels,
      frequencyCap: { maxTouches: campaign.frequencyCap.maxTouches, perWindowHours: campaign.frequencyCap.perWindowHours },
      eligibility: campaign.eligibility,
      stopConditions: { stopOnOptout: campaign.stopConditions.stopOnOptout, stopOnBounce: campaign.stopConditions.stopOnBounce },
      steps: campaign.steps,
    };
    const db = this.prisma as any;
    const existing = await db.recallCampaign.findFirst({ where: { name: CAMPAIGN_NAME } });
    const row = existing
      ? await db.recallCampaign.update({ where: { id: existing.id }, data })
      : await db.recallCampaign.create({ data: { ...data, campaignVersion: 1 } });

    campaign.id = row.id;
    (campaign as unknown as { campaignVersion: number }).campaignVersion = row.campaignVersion;
    return campaign;
  }

  // Recall is configured via Settings → Recall (recall.config KV); the campaign is derived, not authored.
  async save(campaign: RecallCampaign): Promise<RecallCampaign> {
    return campaign;
  }
}
