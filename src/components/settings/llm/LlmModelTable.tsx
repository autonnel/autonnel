import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button as DsButton, Card as DsCard, Table, Thead, Tbody, Tr, Th, Td } from '../../primitives/ds';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Radio,
} from '../../primitives';
import type { LlmModel, LlmModelType } from '@/lib/config/llm-models-types';

interface Props {
  type: LlmModelType;
  models: LlmModel[];
  onAdd: () => void;
  onEdit: (m: LlmModel) => void;
  onDelete: (m: LlmModel) => void;
  onTest: (m: LlmModel) => void;
  onSetDefault: (m: LlmModel) => void;
}

const LABELS: Record<LlmModelType, string> = {
  text: 'Text Models',
  image: 'Image Models',
  video: 'Video Models',
};

export default function LlmModelTable({
  type, models, onAdd, onEdit, onDelete, onTest, onSetDefault,
}: Props) {
  const rows = models.filter((m) => m.type === type);
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const canTest = true;

  return (
    <DsCard>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[14px] font-semibold text-ds-ink">{LABELS[type]}</div>
        <DsButton variant="primary" onClick={onAdd}>
          + Add {typeLabel} Model
        </DsButton>
      </div>

      {rows.length === 0 ? (
        <div className="text-[12.5px] text-ds-muted py-6 text-center">
          No {type} models configured. Click Add to create one.
        </div>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Provider</Th>
              <Th>Model ID</Th>
              <Th>Base URL</Th>
              <Th>Default</Th>
              <Th align="right"><span className="sr-only">Actions</span></Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((m) => (
              <Tr key={`${m.type}:${m.name}`}>
                <Td>{m.name}</Td>
                <Td className="text-ds-muted">{m.provider}</Td>
                <Td className="text-ds-muted">{m.modelId}</Td>
                <Td className="text-ds-muted">{m.baseUrl}</Td>
                <Td>
                  <Radio
                    name={`default-${type}`}
                    checked={m.isDefault === true}
                    onChange={() => onSetDefault(m)}
                    aria-label={`Set ${m.name} as default ${type} model`}
                  />
                </Td>
                <Td align="right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="w-7 h-7 rounded hover:bg-ds-surface2 inline-flex items-center justify-center"
                        aria-label={`Actions for ${m.name}`}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(m)}>Edit</DropdownMenuItem>
                      {canTest && (
                        <DropdownMenuItem onClick={() => onTest(m)}>Test</DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onDelete(m)} className="text-red-600">
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </DsCard>
  );
}
