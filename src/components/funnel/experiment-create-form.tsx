import * as React from 'react';
import FormSelect from '../primitives/FormSelect';
import Button from '../primitives/ds/Button';
import Card from '../primitives/ds/Card';
import { Input } from '../primitives';

interface ExperimentCreateFormProps {
  newName: string;
  setNewName: (v: string) => void;
  newGoalKind: 'order' | 'step_reached';
  setNewGoalKind: (v: 'order' | 'step_reached') => void;
  newStepId: string;
  setNewStepId: (v: string) => void;
  creating: boolean;
  error: string;
  onCreate: () => void;
}

export default function ExperimentCreateForm({
  newName,
  setNewName,
  newGoalKind,
  setNewGoalKind,
  newStepId,
  setNewStepId,
  creating,
  error,
  onCreate,
}: ExperimentCreateFormProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-[14px] font-semibold text-ds-ink">Experiment</div>
        <div className="text-[12.5px] text-ds-muted mt-0.5">
          Run an experiment at this funnel's entry. Each arm targets a funnel or a page; traffic splits by relative weight.
        </div>
      </div>
      <Card title="Create experiment" subtitle="Start with a control arm and one variant.">
        <div className="flex flex-col gap-4 max-w-[480px]">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-medium text-ds-ink">Name</label>
            <Input
              type="text"
              className="w-full"
              placeholder="Headline test"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <FormSelect
            label="Goal"
            value={newGoalKind}
            onChange={(e) => setNewGoalKind(e.target.value as 'order' | 'step_reached')}
          >
            <option value="order">Order placed</option>
            <option value="step_reached">Step reached</option>
          </FormSelect>
          {newGoalKind === 'step_reached' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-medium text-ds-ink">Step id</label>
              <Input
                type="text"
                className="w-full"
                placeholder="checkout"
                value={newStepId}
                onChange={(e) => setNewStepId(e.target.value)}
              />
            </div>
          )}
          {error && <div className="text-[12px] text-ds-bad">{error}</div>}
          <div>
            <Button
              variant="primary"
              disabled={creating || !newName.trim() || (newGoalKind === 'step_reached' && !newStepId.trim())}
              onClick={onCreate}
            >
              Create experiment
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
