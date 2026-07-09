import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Copy, Trophy } from 'lucide-react';
import FormSelect from '../primitives/FormSelect';
import Button from '../primitives/ds/Button';
import Card from '../primitives/ds/Card';
import Badge from '../primitives/ds/Badge';
import { Input } from '../primitives';
import { apiCall, ApiCallError } from '@/lib/api/client';
import type { ExperimentDto, ExperimentGoalDto, ExperimentResultsDto } from '@/contracts/funnel';
import {
  ARM_COLORS,
  STATUS_TONE,
  goalLabel,
  pct,
  liftLabel,
  type Option,
  type PageOption,
} from './experiment-helpers';
import ExperimentCreateForm from './experiment-create-form';
import ExperimentAddArmModal from './experiment-add-arm-modal';

interface FunnelExperimentProps {
  funnelId: string;
  initialExperiment: ExperimentDto | null;
  availableFunnels: Option[];
  availablePages: PageOption[];
}

export default function FunnelExperiment({
  funnelId,
  initialExperiment,
  availableFunnels,
  availablePages,
}: FunnelExperimentProps) {
  const [experiment, setExperiment] = useState<ExperimentDto | null>(initialExperiment);
  const [results, setResults] = useState<ExperimentResultsDto | null>(null);
  const [allFunnels, setAllFunnels] = useState<Option[]>(availableFunnels);
  const [error, setError] = useState('');

  const [newName, setNewName] = useState('');
  const [newGoalKind, setNewGoalKind] = useState<'order' | 'step_reached'>('order');
  const [newStepId, setNewStepId] = useState('');
  const [creating, setCreating] = useState(false);

  const [showAddArm, setShowAddArm] = useState(false);
  const [armName, setArmName] = useState('');
  const [armWeight, setArmWeight] = useState(50);
  const [armTargetFunnelId, setArmTargetFunnelId] = useState('');
  const [armTargetPageId, setArmTargetPageId] = useState('');
  const [addingArm, setAddingArm] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const [winnerArmId, setWinnerArmId] = useState('');

  const status = experiment?.status ?? 'draft';
  const readOnly = status === 'concluded';

  const armColor = useMemo(() => {
    const map = new Map<string, string>();
    experiment?.arms.forEach((a, i) => map.set(a.id, ARM_COLORS[i % ARM_COLORS.length]));
    return map;
  }, [experiment]);

  const loadResults = useCallback(async () => {
    try {
      const data = await apiCall('GET /api/funnel/:funnelId/experiment/results', null, { params: { funnelId } });
      setResults(data);
    } catch {
      setResults(null);
    }
  }, [funnelId]);

  useEffect(() => {
    if (experiment && experiment.status !== 'draft') void loadResults();
    else setResults(null);
  }, [experiment?.status, loadResults]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const goal: ExperimentGoalDto =
        newGoalKind === 'order' ? { kind: 'order' } : { kind: 'step_reached', stepId: newStepId.trim() };
      const created = await apiCall(
        'POST /api/funnel/:funnelId/experiment',
        { name: newName.trim(), goal },
        { params: { funnelId } },
      );
      setExperiment(created);
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : 'Failed to create experiment');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteExperiment() {
    if (!confirm('Delete this experiment? Arms are removed; bound funnels and pages are kept.')) return;
    try {
      await apiCall('DELETE /api/funnel/:funnelId/experiment', null, { params: { funnelId } });
      setExperiment(null);
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : 'Failed to delete experiment');
    }
  }

  async function handleStart() {
    try {
      const updated = await apiCall(
        'PUT /api/funnel/:funnelId/experiment',
        { action: 'start' },
        { params: { funnelId } },
      );
      setExperiment(updated);
      void loadResults();
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : 'Failed to start experiment');
    }
  }

  async function handleConclude(armId?: string) {
    const winner = armId ?? winnerArmId;
    if (!winner) {
      setError('Pick a winning arm first');
      return;
    }
    try {
      const updated = await apiCall(
        'PUT /api/funnel/:funnelId/experiment',
        { action: 'conclude', winnerArmId: winner },
        { params: { funnelId } },
      );
      setExperiment(updated);
      void loadResults();
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : 'Failed to conclude experiment');
    }
  }

  async function handleWeightBlur(armId: string, weight: number) {
    try {
      const updated = await apiCall(
        'PUT /api/funnel/:funnelId/experiment/arm',
        { armId, weight },
        { params: { funnelId } },
      );
      setExperiment(updated);
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : 'Failed to update weight');
    }
  }

  function handleWeightChange(armId: string, weight: number) {
    setExperiment((prev) =>
      prev ? { ...prev, arms: prev.arms.map((a) => (a.id === armId ? { ...a, weight } : a)) } : prev,
    );
  }

  async function handleRemoveArm(armId: string) {
    if (!confirm('Remove this arm?')) return;
    try {
      const updated = await apiCall(
        'DELETE /api/funnel/:funnelId/experiment/arm',
        null,
        { params: { funnelId }, query: { armId } },
      );
      setExperiment(updated);
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : 'Failed to remove arm');
    }
  }

  async function handleAddArm() {
    if (!armName.trim() || (!armTargetFunnelId && !armTargetPageId)) return;
    setAddingArm(true);
    setError('');
    try {
      const updated = await apiCall(
        'POST /api/funnel/:funnelId/experiment/arm',
        {
          name: armName.trim(),
          weight: armWeight,
          targetFunnelId: armTargetFunnelId || undefined,
          targetPageId: armTargetPageId || undefined,
        },
        { params: { funnelId } },
      );
      setExperiment(updated);
      setShowAddArm(false);
      setArmName('');
      setArmWeight(50);
      setArmTargetFunnelId('');
      setArmTargetPageId('');
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : 'Failed to add arm');
    } finally {
      setAddingArm(false);
    }
  }

  async function handleDuplicateAsArm() {
    setDuplicating(true);
    setError('');
    try {
      const copy = await apiCall('POST /api/funnel/:funnelId/duplicate', { asArm: true }, { params: { funnelId } });
      setAllFunnels((prev) => [...prev, { id: copy.id, name: copy.name }]);
      const updated = await apiCall(
        'POST /api/funnel/:funnelId/experiment/arm',
        { name: copy.name, weight: 50, targetFunnelId: copy.id },
        { params: { funnelId } },
      );
      setExperiment(updated);
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : 'Failed to duplicate funnel as arm');
    } finally {
      setDuplicating(false);
    }
  }

  if (!experiment) {
    return (
      <ExperimentCreateForm
        newName={newName}
        setNewName={setNewName}
        newGoalKind={newGoalKind}
        setNewGoalKind={setNewGoalKind}
        newStepId={newStepId}
        setNewStepId={setNewStepId}
        creating={creating}
        error={error}
        onCreate={handleCreate}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="text-[15px] font-semibold text-ds-ink truncate">{experiment.name}</div>
            <Badge tone={STATUS_TONE[status]}>{status}</Badge>
          </div>
          <div className="text-[12.5px] text-ds-muted mt-1">Goal: {goalLabel(experiment.goal)}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status === 'draft' && (
            <Button variant="primary" onClick={handleStart}>
              Start
            </Button>
          )}
          <button
            type="button"
            aria-label="Delete experiment"
            className="inline-flex items-center justify-center rounded-[7px] h-8 w-8 bg-ds-card border border-ds-badBorder text-ds-bad hover:bg-[#FEF2F2]"
            onClick={handleDeleteExperiment}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <div className="text-[12px] text-ds-bad">{error}</div>}

      <Card title="Traffic distribution" subtitle="Relative weights, normalized to a percentage split.">
        <div className="flex h-7 rounded-md overflow-hidden border border-ds-line">
          {experiment.arms
            .filter((a) => a.pct > 0)
            .map((arm) => (
              <div
                key={arm.id}
                className="flex items-center justify-center text-[11px] font-bold text-white transition-all"
                style={{ width: `${arm.pct}%`, minWidth: '30px', backgroundColor: armColor.get(arm.id) }}
                title={`${arm.name}: ${arm.pct}%`}
              >
                {arm.pct > 5 && `${arm.pct}%`}
              </div>
            ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[11.5px] text-ds-slate flex-wrap">
          {experiment.arms.map((arm) => (
            <span key={arm.id} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: armColor.get(arm.id) }} />
              {arm.name} ({arm.pct}%)
            </span>
          ))}
        </div>
      </Card>

      {results && (
        <Card title="Results" subtitle={`Per-arm performance since the experiment started. Goal: ${goalLabel(results.goal)}.`}>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr className="text-ds-muted text-left border-b border-ds-line">
                  <th className="py-2 pr-3 font-medium">Arm</th>
                  <th className="py-2 px-3 font-medium text-right">Visitors</th>
                  <th className="py-2 px-3 font-medium text-right">Conversions</th>
                  <th className="py-2 px-3 font-medium text-right">Conv. rate</th>
                  <th className="py-2 px-3 font-medium text-right">Lift</th>
                  {results.status === 'running' && <th className="py-2 pl-3" />}
                </tr>
              </thead>
              <tbody>
                {results.arms.map((row) => {
                  const isWinner = results.status === 'concluded' && results.winnerArmId === row.armId;
                  return (
                    <tr
                      key={row.armId}
                      className={`border-b border-ds-line last:border-0 ${isWinner ? 'bg-ds-okBg' : ''}`}
                    >
                      <td className="py-2 pr-3">
                        <span className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded inline-block shrink-0"
                            style={{ backgroundColor: armColor.get(row.armId) }}
                          />
                          <span className="font-medium text-ds-ink">{row.name}</span>
                          {row.isControl && <Badge tone="muted">Control</Badge>}
                          {isWinner && (
                            <Badge tone="ok">
                              <Trophy className="w-3 h-3" /> Winner
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-ds-mono tabular text-ds-ink">{row.entered}</td>
                      <td className="py-2 px-3 text-right font-ds-mono tabular text-ds-ink">{row.converted}</td>
                      <td className="py-2 px-3 text-right font-ds-mono tabular text-ds-ink">{pct(row.conversionRate)}</td>
                      <td className="py-2 px-3 text-right font-ds-mono tabular text-ds-slate">{liftLabel(row.lift)}</td>
                      {results.status === 'running' && (
                        <td className="py-2 pl-3 text-right">
                          <Button variant="default" leftIcon={<Trophy className="w-3.5 h-3.5" />} onClick={() => handleConclude(row.armId)}>
                            Declare winner
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {status === 'running' && (
        <Card title="Conclude experiment" subtitle="Pick the winning arm; the experiment is then frozen.">
          <div className="flex items-end gap-3 max-w-[480px]">
            <div className="flex-1">
              <FormSelect label="Winning arm" value={winnerArmId} onChange={(e) => setWinnerArmId(e.target.value)}>
                <option value="">Select an arm…</option>
                {experiment.arms.map((arm) => (
                  <option key={arm.id} value={arm.id}>
                    {arm.name}
                  </option>
                ))}
              </FormSelect>
            </div>
            <Button variant="primary" disabled={!winnerArmId} onClick={() => handleConclude()}>
              Conclude
            </Button>
          </div>
        </Card>
      )}

      {readOnly && experiment.winnerArmId && (
        <Card>
          <div className="text-[13px] text-ds-ink">
            Winner:{' '}
            <span className="font-semibold">
              {experiment.arms.find((a) => a.id === experiment.winnerArmId)?.name ?? experiment.winnerArmId}
            </span>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="text-[13.5px] font-semibold text-ds-ink">Arms</div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              leftIcon={<Copy className="w-3.5 h-3.5" />}
              disabled={duplicating}
              onClick={handleDuplicateAsArm}
            >
              Duplicate current funnel as arm
            </Button>
            <Button variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowAddArm(true)}>
              Add arm
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {experiment.arms.map((arm) => (
          <Card key={arm.id}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-3 h-3 rounded inline-block shrink-0"
                  style={{ backgroundColor: armColor.get(arm.id) }}
                />
                <span className="font-semibold text-[13.5px] text-ds-ink truncate">{arm.name}</span>
                {arm.isControl && <Badge tone="muted">Control</Badge>}
                <Badge tone="muted">
                  <span className="font-ds-mono tabular">
                    {arm.targetPageId ? 'Page' : 'Funnel'}: {arm.targetLabel || '—'}
                  </span>
                </Badge>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    disabled={readOnly}
                    className="w-20 text-center font-ds-mono tabular"
                    value={arm.weight}
                    onChange={(e) => handleWeightChange(arm.id, Math.max(0, parseInt(e.target.value, 10) || 0))}
                    onBlur={(e) => handleWeightBlur(arm.id, Math.max(0, parseInt(e.target.value, 10) || 0))}
                  />
                  <span className="text-[12px] text-ds-muted tabular">{arm.pct}%</span>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    aria-label="Remove arm"
                    className="inline-flex items-center justify-center rounded-[7px] h-8 w-8 bg-ds-card border border-ds-badBorder text-ds-bad hover:bg-[#FEF2F2]"
                    onClick={() => handleRemoveArm(arm.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <ExperimentAddArmModal
        isOpen={showAddArm}
        onClose={() => setShowAddArm(false)}
        armName={armName}
        setArmName={setArmName}
        armWeight={armWeight}
        setArmWeight={setArmWeight}
        armTargetFunnelId={armTargetFunnelId}
        setArmTargetFunnelId={setArmTargetFunnelId}
        armTargetPageId={armTargetPageId}
        setArmTargetPageId={setArmTargetPageId}
        allFunnels={allFunnels}
        availablePages={availablePages}
        error={error}
        addingArm={addingArm}
        onAddArm={handleAddArm}
      />
    </div>
  );
}
