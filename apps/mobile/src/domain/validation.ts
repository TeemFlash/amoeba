import { districtIds, eventIds, serviceIds, slotIds } from './catalog';
import type { AppState, Entry, HelpDraft, Locale, Result } from './types';

const corrupt = (): Result<AppState> => ({ ok: false, error: { code: 'STORAGE_CORRUPT' } });
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
const isIsoDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

function parseDraft(value: unknown): HelpDraft | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || !isId(value.operationId) || !serviceIds.has(value.serviceId as never)) return undefined;
  if (!(value.districtId === null || districtIds.has(value.districtId as never))) return undefined;
  if (!(value.slotId === null || slotIds.has(value.slotId as never))) return undefined;
  if (value.step !== 'form' && value.step !== 'review') return undefined;
  if (value.step === 'review' && (!value.districtId || !value.slotId)) return undefined;
  return {
    operationId: value.operationId,
    serviceId: value.serviceId as HelpDraft['serviceId'],
    districtId: value.districtId as HelpDraft['districtId'],
    slotId: value.slotId as HelpDraft['slotId'],
    step: value.step,
  };
}

function parseEntry(value: unknown): Entry | undefined {
  if (!isRecord(value) || !isId(value.operationId) || value.id !== `DEMO-${value.operationId}` || !isIsoDate(value.createdAt)) return undefined;
  const status = value.status;
  const cancelledAt = value.cancelledAt;
  if (status === 'saved-demo' ? cancelledAt !== null : status === 'cancelled-demo' ? !isIsoDate(cancelledAt) : true) return undefined;
  const base = {
    id: value.id as string,
    operationId: value.operationId,
    status,
    createdAt: value.createdAt,
    cancelledAt: cancelledAt as string | null,
  };
  if (value.kind === 'help' && serviceIds.has(value.serviceId as never) && districtIds.has(value.districtId as never) && slotIds.has(value.slotId as never)) {
    return { ...base, kind: 'help', serviceId: value.serviceId as Entry & never, districtId: value.districtId as Entry & never, slotId: value.slotId as Entry & never } as Entry;
  }
  if (value.kind === 'event' && eventIds.has(value.eventId as never)) return { ...base, kind: 'event', eventId: value.eventId as Entry & never } as Entry;
  return undefined;
}

export function parseState(raw: string): Result<AppState> {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return corrupt(); }
  if (!isRecord(parsed) || parsed.schemaVersion !== 1 || (parsed.locale !== 'ru' && parsed.locale !== 'kz') || !Array.isArray(parsed.entries)) return corrupt();
  const draft = parseDraft(parsed.draft);
  if (draft === undefined) return corrupt();
  const entries: Entry[] = [];
  for (const rawEntry of parsed.entries) {
    const entry = parseEntry(rawEntry);
    if (!entry) return corrupt();
    entries.push(entry);
  }
  const ids = new Set<string>();
  const operationIds = new Set<string>();
  const activeEvents = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id) || operationIds.has(entry.operationId)) return corrupt();
    ids.add(entry.id);
    operationIds.add(entry.operationId);
    if (entry.kind === 'event' && entry.status === 'saved-demo') {
      if (activeEvents.has(entry.eventId)) return corrupt();
      activeEvents.add(entry.eventId);
    }
  }
  if (draft && operationIds.has(draft.operationId)) return corrupt();
  return { ok: true, value: { schemaVersion: 1, locale: parsed.locale as Locale, draft, entries } };
}
