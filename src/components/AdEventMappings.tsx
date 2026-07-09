import { useEffect, useMemo, useState } from "react";
import { Loader2, Trash2, Plus, ArrowRight, Pencil } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "./primitives/Card";
import { Button } from "./primitives/Button";
import AlertBox from "./primitives/AlertBox";
import { Input, dsSelectClass } from "./primitives";
import { cn } from "@/lib/utils";

const CUSTOM_EVENT_REGEX = /^[A-Za-z][A-Za-z0-9_]{0,49}$/;
const CUSTOM_SENTINEL = "__CUSTOM__";

interface EventMapping {
  internalEvent: string;
  platformEvent: string;
}

interface InternalEventDef {
  id: string;
  label: string;
  description: string;
}

interface PlatformEventDef {
  id: string;
  label: string;
}

interface MappingsData {
  supported: boolean;
  mappings: EventMapping[];
  customMappings: EventMapping[];
  defaults: EventMapping[];
  internalEvents: InternalEventDef[];
  platformEvents: PlatformEventDef[];
}

interface RowState {
  internalEvent: string;
  platformEvent: string;
  customMode: boolean;
}

interface AdEventMappingsProps {
  adPlatformId: string;
  platform: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
};

function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

function buildRows(
  customMappings: EventMapping[],
  defaults: EventMapping[],
  platformEvents: PlatformEventDef[],
): RowState[] {
  const standardIds = new Set(platformEvents.map((e) => e.id));
  const source = customMappings.length > 0 ? customMappings : defaults;
  return source.map((m) => ({
    internalEvent: m.internalEvent,
    platformEvent: m.platformEvent,
    customMode: !standardIds.has(m.platformEvent),
  }));
}

export default function AdEventMappings({ adPlatformId, platform }: AdEventMappingsProps) {
  const [data, setData] = useState<MappingsData | null>(null);
  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const standardEventIds = useMemo(
    () => new Set((data?.platformEvents ?? []).map((e) => e.id)),
    [data],
  );

  const usedInternalIds = useMemo(() => new Set(rows.map((r) => r.internalEvent)), [rows]);

  const availableInternalEvents = useMemo(
    () => (data?.internalEvents ?? []).filter((e) => !usedInternalIds.has(e.id)),
    [data, usedInternalIds],
  );

  useEffect(() => {
    let active = true;
    async function fetchMappings() {
      setLoading(true);
      try {
        const res = await fetch(`/api/marketing/${adPlatformId}/event-mappings`);
        if (!res.ok) return;
        const result: MappingsData = await res.json();
        if (!active) return;
        setData(result);
        setRows(buildRows(result.customMappings, result.defaults, result.platformEvents));
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchMappings();
    return () => {
      active = false;
    };
  }, [adPlatformId]);

  function getAvailableInternalForRow(currentValue: string): InternalEventDef[] {
    const internalEvents = data?.internalEvents ?? [];
    return internalEvents.filter(
      (e) => e.id === currentValue || !rows.some((r) => r.internalEvent === e.id),
    );
  }

  function updateRow(index: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    setHasChanges(true);
  }

  function handleAdd() {
    if (availableInternalEvents.length === 0) return;
    const platformEvents = data?.platformEvents ?? [];
    setRows((prev) => [
      ...prev,
      {
        internalEvent: availableInternalEvents[0].id,
        platformEvent: platformEvents[0]?.id ?? "",
        customMode: false,
      },
    ]);
    setHasChanges(true);
  }

  function handleRemove(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  }

  function handleChangeInternal(index: number, value: string) {
    updateRow(index, { internalEvent: value });
  }

  function handleChangePlatformSelect(index: number, value: string) {
    if (value === CUSTOM_SENTINEL) {
      updateRow(index, { customMode: true, platformEvent: "" });
    } else {
      updateRow(index, { customMode: false, platformEvent: value });
    }
  }

  function handleChangeCustom(index: number, value: string) {
    updateRow(index, { platformEvent: value });
  }

  function handleRevertToList(index: number) {
    const platformEvents = data?.platformEvents ?? [];
    updateRow(index, { customMode: false, platformEvent: platformEvents[0]?.id ?? "" });
  }

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/marketing/${adPlatformId}/event-mappings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mappings: rows.map((r) => ({
            internalEvent: r.internalEvent,
            platformEvent: r.platformEvent,
          })),
        }),
      });
      const result: { mappings?: EventMapping[]; error?: string } = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Event mappings saved successfully" });
        setHasChanges(false);
        if (result.mappings) {
          setRows(buildRows(result.mappings, data.defaults, data.platformEvents));
        }
      } else {
        setMessage({ type: "error", text: result.error || "Failed to save event mappings" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save event mappings" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data?.supported) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversion Event Mappings</CardTitle>
        <p className="text-sm text-ds-muted mt-1">
          Configure which internal events trigger postbacks to {platformLabel(platform)}. Choose a
          standard event or enter a custom event name.
        </p>
      </CardHeader>
      <CardContent>
        {message && (
          <div className="mb-4">
            <AlertBox type={message.type}>{message.text}</AlertBox>
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-3 items-center mb-3 px-1">
          <span className="text-xs font-medium text-ds-muted uppercase tracking-wider">
            Internal Event
          </span>
          <span />
          <span className="text-xs font-medium text-ds-muted uppercase tracking-wider">
            Platform Event
          </span>
          <span className="w-9" />
        </div>

        {rows.map((row, index) => {
          const customInvalid =
            row.customMode &&
            row.platformEvent.length > 0 &&
            !CUSTOM_EVENT_REGEX.test(row.platformEvent);
          const selectValue = standardEventIds.has(row.platformEvent) ? row.platformEvent : "";
          return (
            <div
              key={index}
              className="grid grid-cols-[1fr_auto_1fr_auto] gap-3 items-center mb-2"
            >
              <select
                className={cn(dsSelectClass, "w-full")}
                value={row.internalEvent}
                onChange={(e) => handleChangeInternal(index, e.target.value)}
              >
                {getAvailableInternalForRow(row.internalEvent).map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.label}
                  </option>
                ))}
              </select>

              <ArrowRight className="h-4 w-4 text-muted-foreground" />

              {row.customMode ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="text"
                    className={cn("w-full", customInvalid && "border-ds-bad")}
                    placeholder="custom_event_name"
                    maxLength={50}
                    value={row.platformEvent}
                    onChange={(e) => handleChangeCustom(index, e.target.value)}
                  />
                  <button
                    type="button"
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-ds-muted hover:text-ds-ink hover:bg-ds-surface2 transition-colors flex-shrink-0"
                    title="Back to standard event list"
                    onClick={() => handleRevertToList(index)}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <select
                  className={cn(dsSelectClass, "w-full")}
                  value={selectValue}
                  onChange={(e) => handleChangePlatformSelect(index, e.target.value)}
                >
                  {(data?.platformEvents ?? []).map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.label}
                    </option>
                  ))}
                  <option disabled>──────────</option>
                  <option value={CUSTOM_SENTINEL}>Custom event name…</option>
                </select>
              )}

              <button
                type="button"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-ds-muted hover:text-ds-bad hover:bg-ds-badBg transition-colors"
                title="Remove mapping"
                onClick={() => handleRemove(index)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}

        <div className="mt-4 flex items-center gap-3">
          {availableInternalEvents.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
              <Plus className="h-4 w-4" />
              Add Mapping
            </Button>
          )}
          {hasChanges && (
            <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
