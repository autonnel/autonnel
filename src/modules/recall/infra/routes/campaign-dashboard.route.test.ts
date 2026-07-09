import { describe, it, expect, vi } from 'vitest';
import { handleCampaignDashboard } from './campaign-dashboard.route';

const recall = () => ({
  manageCampaign: { get: vi.fn().mockResolvedValue(null), put: vi.fn().mockResolvedValue({ campaignVersion: 1, steps: [], name: 'x' }) },
  manageSuppression: { list: vi.fn().mockResolvedValue([]), block: vi.fn(), unblock: vi.fn() },
});

const principal = { requireFeature: vi.fn() };

describe('handleCampaignDashboard', () => {
  it('GET /campaign returns the active campaign and gates on SETTINGS_RECALL', async () => {
    const r = recall();
    const res = await handleCampaignDashboard({ method: 'GET', segments: ['campaign'], body: null, principal } as any, r as any);
    expect(principal.requireFeature).toHaveBeenCalledWith('SETTINGS_RECALL');
    expect(res.status).toBe(200);
  });

  it('PUT /campaign upserts a campaign', async () => {
    const r = recall();
    const res = await handleCampaignDashboard({ method: 'PUT', segments: ['campaign'], body: { name: 'x', steps: [] }, principal } as any, r as any);
    expect(r.manageCampaign.put).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('GET /suppression lists suppression entries', async () => {
    const r = recall();
    const res = await handleCampaignDashboard({ method: 'GET', segments: ['suppression'], body: null, principal } as any, r as any);
    expect(r.manageSuppression.list).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('returns 404 for an unknown segment', async () => {
    const r = recall();
    const res = await handleCampaignDashboard({ method: 'GET', segments: ['nope'], body: null, principal } as any, r as any);
    expect(res.status).toBe(404);
  });
});
