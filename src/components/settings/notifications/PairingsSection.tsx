import { useMemo, useState } from 'react';
import { Loader2, Trash2, Pencil } from 'lucide-react';
import {
  Button as DsButton,
  Badge as DsBadge,
  Drawer as DsDrawer,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from '@/components/primitives/ds';
import { FormInput, Checkbox, dsSelectClass } from '@/components/primitives';
import { cn } from '@/lib/utils';
import {
  EVENT_CATALOG,
  EVENT_GROUP_LABELS,
  type EventGroup,
} from '@/lib/notifications/events-catalog';
import {
  emptyMaskedPairing,
  type MaskedPairing,
  parseRecipients,
  joinRecipients,
} from './types';

interface Props {
  pairings: MaskedPairing[];
  onPersist: (next: MaskedPairing[]) => Promise<void>;
  onTest: (pairing: MaskedPairing) => Promise<void>;
  testingId: string | null;
}

function channelLabel(type: MaskedPairing['channel']['type']): string {
  return type === 'email' ? 'Email' : type === 'slack' ? 'Slack' : 'Webhook';
}

function maskPlaceholder(masked: string | undefined): string {
  return masked && masked.length > 0 ? `Stored: ${masked} (leave blank to keep)` : '';
}

interface EditorProps {
  draft: MaskedPairing;
  onDraftChange: (next: MaskedPairing) => void;
  onTest: (pairing: MaskedPairing) => Promise<void>;
  testingId: string | null;
}

function PairingEditor({ draft, onDraftChange, onTest, testingId }: EditorProps) {
  const grouped = useMemo(() => {
    const map = new Map<EventGroup, typeof EVENT_CATALOG>();
    for (const e of EVENT_CATALOG) {
      const arr = map.get(e.group) ?? [];
      arr.push(e);
      map.set(e.group, arr);
    }
    return map;
  }, []);

  const toggleEvent = (id: string, checked: boolean) => {
    onDraftChange({
      ...draft,
      events: checked ? [...draft.events, id] : draft.events.filter((e) => e !== id),
    });
  };

  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      <FormInput
        label="Name"
        value={draft.name}
        onChange={(e) => onDraftChange({ ...draft, name: e.target.value })}
        placeholder="Slack #orders"
      />

      <label className="inline-flex items-center cursor-pointer gap-2 select-none">
        <Checkbox
          checked={draft.enabled}
          onChange={(e) => onDraftChange({ ...draft, enabled: e.target.checked })}
        />
        <span className="text-[12.5px] text-ds-muted">{draft.enabled ? 'Enabled' : 'Disabled'}</span>
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ds-ink">Channel type</label>
        <select
          value={draft.channel.type}
          onChange={(e) => {
            const t = e.target.value as 'email' | 'slack' | 'webhook';
            if (t === 'email') onDraftChange({ ...draft, channel: { type: 'email', recipients: [] } });
            else if (t === 'slack')
              onDraftChange({ ...draft, channel: { type: 'slack', webhookUrl: '', webhookUrlHasStored: false } });
            else
              onDraftChange({
                ...draft,
                channel: { type: 'webhook', url: '', urlHasStored: false, secret: '', secretHasStored: false },
              });
          }}
          className={cn(dsSelectClass)}
        >
          <option value="email">Email</option>
          <option value="slack">Slack</option>
          <option value="webhook">Webhook</option>
        </select>
      </div>

      {draft.channel.type === 'email' && (
        <FormInput
          label="Recipients"
          value={joinRecipients(draft.channel.recipients)}
          onChange={(e) =>
            onDraftChange({
              ...draft,
              channel: { type: 'email', recipients: parseRecipients(e.target.value) },
            })
          }
          placeholder="alerts@example.com, ops@example.com"
          hint="Separated by commas or newlines"
        />
      )}

      {draft.channel.type === 'slack' && (
        <FormInput
          label="Webhook URL"
          type="password"
          value={draft.channel.webhookUrl.startsWith('••••') ? '' : draft.channel.webhookUrl}
          onChange={(e) =>
            onDraftChange({
              ...draft,
              channel: {
                ...(draft.channel as Extract<MaskedPairing['channel'], { type: 'slack' }>),
                webhookUrl: e.target.value,
              },
            })
          }
          placeholder={maskPlaceholder(draft.channel.webhookUrl) || 'https://hooks.slack.com/services/...'}
        />
      )}

      {draft.channel.type === 'webhook' && (
        <>
          <FormInput
            label="URL"
            type="password"
            value={draft.channel.url.startsWith('••••') ? '' : draft.channel.url}
            onChange={(e) =>
              onDraftChange({
                ...draft,
                channel: {
                  ...(draft.channel as Extract<MaskedPairing['channel'], { type: 'webhook' }>),
                  url: e.target.value,
                },
              })
            }
            placeholder={maskPlaceholder(draft.channel.url) || 'https://example.com/webhook'}
          />
          <FormInput
            label="Secret (optional)"
            type="password"
            value={draft.channel.secret.startsWith('••••') ? '' : draft.channel.secret}
            onChange={(e) =>
              onDraftChange({
                ...draft,
                channel: {
                  ...(draft.channel as Extract<MaskedPairing['channel'], { type: 'webhook' }>),
                  secret: e.target.value,
                },
              })
            }
            placeholder={maskPlaceholder(draft.channel.secret) || 'Optional HMAC secret'}
          />
        </>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ds-ink">Events</label>
        <div className="border border-ds-line rounded-md p-2 max-h-72 overflow-auto flex flex-col gap-2">
          {Array.from(grouped.entries()).map(([group, entries]) => (
            <div key={group} className="flex flex-col gap-1">
              <div className="text-[11.5px] font-semibold text-ds-muted">{EVENT_GROUP_LABELS[group]}</div>
              {entries.map((ev) => (
                <label key={ev.id} className="inline-flex items-center gap-2 text-[12.5px] cursor-pointer">
                  <Checkbox
                    checked={draft.events.includes(ev.id)}
                    onChange={(e) => toggleEvent(ev.id, e.target.checked)}
                  />
                  <span>{ev.label}</span>
                  <span className="text-ds-muted text-[11px]">{ev.id}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div>
        <DsButton variant="default" onClick={() => onTest(draft)} disabled={testingId === draft.id}>
          {testingId === draft.id && <Loader2 className="h-4 w-4 animate-spin" />}
          Test
        </DsButton>
      </div>
    </div>
  );
}

export default function PairingsSection({ pairings, onPersist, onTest, testingId }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<MaskedPairing | null>(null);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setDraft(emptyMaskedPairing());
    setEditingIndex(null);
    setDrawerOpen(true);
  };

  const openEdit = (idx: number) => {
    setDraft({ ...pairings[idx] });
    setEditingIndex(idx);
    setDrawerOpen(true);
  };

  const handleDelete = async (idx: number) => {
    const next = pairings.filter((_, i) => i !== idx);
    await onPersist(next).catch(() => {});
  };

  const handleToggleEnabled = async (idx: number, enabled: boolean) => {
    const next = pairings.map((p, i) => (i === idx ? { ...p, enabled } : p));
    await onPersist(next).catch(() => {});
  };

  const handleSaveDraft = async () => {
    if (!draft) return;
    const next =
      editingIndex === null
        ? [...pairings, draft]
        : pairings.map((p, i) => (i === editingIndex ? draft : p));
    setSaving(true);
    try {
      await onPersist(next);
      setDrawerOpen(false);
      setDraft(null);
      setEditingIndex(null);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDrawerOpen(false);
    setDraft(null);
    setEditingIndex(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-ds-ink">Notification channels</div>
          <div className="text-[12px] text-ds-muted mt-0.5">
            Pair one or more MQ events with a channel. Each pairing is dispatched independently.
          </div>
        </div>
        <DsButton variant="primary" onClick={openNew}>+ Add pairing</DsButton>
      </div>

      {pairings.length === 0 ? (
        <div className="text-[12.5px] text-ds-muted py-2">No pairings yet. Add one to start receiving notifications.</div>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Channel</Th>
              <Th>Events</Th>
              <Th>Enabled</Th>
              <Th align="right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {pairings.map((p, idx) => (
              <Tr key={p.id}>
                <Td>{p.name || <span className="text-ds-muted">Unnamed</span>}</Td>
                <Td><DsBadge>{channelLabel(p.channel.type)}</DsBadge></Td>
                <Td>
                  <span className="text-[12.5px] text-ds-muted">{p.events.length} event{p.events.length === 1 ? '' : 's'}</span>
                </Td>
                <Td>
                  <label className="inline-flex items-center cursor-pointer">
                    <Checkbox
                      checked={p.enabled}
                      onChange={(e) => handleToggleEnabled(idx, e.target.checked)}
                    />
                  </label>
                </Td>
                <Td align="right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      title="Edit"
                      onClick={() => openEdit(idx)}
                      className="w-7 h-7 rounded-md text-ds-slate hover:text-ds-ink hover:bg-ds-surface2 inline-flex items-center justify-center"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => handleDelete(idx)}
                      className="w-7 h-7 rounded-md text-ds-slate hover:text-red-600 hover:bg-ds-surface2 inline-flex items-center justify-center"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <DsDrawer
        open={drawerOpen}
        onClose={handleCancel}
        title={editingIndex === null ? 'Add pairing' : 'Edit pairing'}
        subtitle="Bind MQ events to a channel"
        footer={
          <>
            <DsButton variant="default" onClick={handleCancel} disabled={saving}>Cancel</DsButton>
            <DsButton variant="primary" onClick={handleSaveDraft} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </DsButton>
          </>
        }
      >
        {draft && (
          <PairingEditor
            draft={draft}
            onDraftChange={setDraft}
            onTest={onTest}
            testingId={testingId}
          />
        )}
      </DsDrawer>
    </div>
  );
}
