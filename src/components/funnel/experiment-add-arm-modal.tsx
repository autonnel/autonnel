import * as React from 'react';
import Modal from '../primitives/Modal';
import FormSelect from '../primitives/FormSelect';
import Button from '../primitives/ds/Button';
import { Input } from '../primitives';
import type { Option, PageOption } from './experiment-helpers';

interface ExperimentAddArmModalProps {
  isOpen: boolean;
  onClose: () => void;
  armName: string;
  setArmName: (v: string) => void;
  armWeight: number;
  setArmWeight: (v: number) => void;
  armTargetFunnelId: string;
  setArmTargetFunnelId: (v: string) => void;
  armTargetPageId: string;
  setArmTargetPageId: (v: string) => void;
  allFunnels: Option[];
  availablePages: PageOption[];
  error: string;
  addingArm: boolean;
  onAddArm: () => void;
}

export default function ExperimentAddArmModal({
  isOpen,
  onClose,
  armName,
  setArmName,
  armWeight,
  setArmWeight,
  armTargetFunnelId,
  setArmTargetFunnelId,
  armTargetPageId,
  setArmTargetPageId,
  allFunnels,
  availablePages,
  error,
  addingArm,
  onAddArm,
}: ExperimentAddArmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add arm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-medium text-ds-ink">Name</label>
          <Input
            type="text"
            className="w-full"
            placeholder="Variant C"
            value={armName}
            onChange={(e) => setArmName(e.target.value)}
          />
        </div>

        <FormSelect
          label="Bind a funnel"
          value={armTargetFunnelId}
          onChange={(e) => {
            setArmTargetFunnelId(e.target.value);
            if (e.target.value) setArmTargetPageId('');
          }}
        >
          <option value="">Select a funnel…</option>
          {allFunnels.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </FormSelect>

        <FormSelect
          label="Or bind a page"
          value={armTargetPageId}
          onChange={(e) => {
            setArmTargetPageId(e.target.value);
            if (e.target.value) setArmTargetFunnelId('');
          }}
        >
          <option value="">Select a page…</option>
          {availablePages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </FormSelect>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-medium text-ds-ink">Weight</label>
          <Input
            type="number"
            min="0"
            className="w-28 text-center font-ds-mono tabular"
            value={armWeight}
            onChange={(e) => setArmWeight(Math.max(0, parseInt(e.target.value, 10) || 0))}
          />
        </div>

        {error && <div className="text-[12px] text-ds-bad">{error}</div>}

        <div className="flex items-center justify-end gap-2">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={addingArm || !armName.trim() || (!armTargetFunnelId && !armTargetPageId)}
            onClick={onAddArm}
          >
            Add arm
          </Button>
        </div>
      </div>
    </Modal>
  );
}
