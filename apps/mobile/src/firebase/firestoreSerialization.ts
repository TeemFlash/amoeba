import { dateIds } from '../domain/catalog';
import { parseState } from '../domain/validation';
import type { Entry } from '../domain/types';

type TimestampLike = { toDate: () => Date };
function isoTimestamp(value: unknown): string | null {
  try {
    const date = value instanceof Date ? value : (value as TimestampLike)?.toDate?.();
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return null;
    return date.toISOString();
  } catch { return null; }
}

const commonKeys = ['schemaVersion', 'id', 'operationId', 'kind', 'status', 'createdAt', 'cancelledAt'];
function exactKeys(data: Record<string, unknown>, extra: string[], optional: string[] = []) {
  const allowed = new Set([...commonKeys, ...extra, ...optional]);
  const required = new Set([...commonKeys, ...extra]);
  return Object.keys(data).every((key) => allowed.has(key)) && [...required].every((key) => Object.hasOwn(data, key));
}

export function parseCloudApplication(documentId: string, input: unknown): Entry | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const data = input as Record<string, unknown>;
  if (data.operationId !== documentId || data.id !== `DEMO-${documentId}` || data.schemaVersion !== 1) return null;
  const createdAt = isoTimestamp(data.createdAt);
  const cancelledAt = data.cancelledAt === null ? null : isoTimestamp(data.cancelledAt);
  if (!createdAt || data.cancelledAt !== null && !cancelledAt) return null;
  let entry: Record<string, unknown>;
  if (data.kind === 'help') {
    const hasDate = Object.hasOwn(data, 'dateId');
    const hasNote = Object.hasOwn(data, 'note');
    if (hasDate !== hasNote || !exactKeys(data, ['serviceId', 'districtId', 'slotId'], ['dateId', 'note'])) return null;
    if (hasDate && (!dateIds.has(data.dateId as never) || typeof data.note !== 'string' || data.note.length > 280)) return null;
    entry = { id: data.id, operationId: data.operationId, kind: data.kind, status: data.status, serviceId: data.serviceId, districtId: data.districtId, slotId: data.slotId,
      ...(hasDate ? { dateId: data.dateId, note: data.note } : {}), createdAt, cancelledAt };
  } else if (data.kind === 'event') {
    if (!exactKeys(data, ['eventId'])) return null;
    entry = { id: data.id, operationId: data.operationId, kind: data.kind, status: data.status, eventId: data.eventId, createdAt, cancelledAt };
  } else return null;
  const parsed = parseState(JSON.stringify({ schemaVersion: 1, locale: 'ru', draft: null, entries: [entry] }));
  return parsed.ok ? parsed.value.entries[0] ?? null : null;
}

export function applicationToFirestore(entry: Entry, serverTimestamp: unknown) {
  let helpFields: Record<string, unknown> | undefined;
  if (entry.kind === 'help') {
    const hasDate = Object.hasOwn(entry, 'dateId');
    const hasNote = Object.hasOwn(entry, 'note');
    if (hasDate !== hasNote || hasDate && (!dateIds.has(entry.dateId as never) || typeof entry.note !== 'string' || entry.note.length > 280)) {
      throw new Error('INVALID_HELP_DATE_NOTE_PAIR');
    }
    helpFields = {
      serviceId: entry.serviceId, districtId: entry.districtId, slotId: entry.slotId,
      ...(hasDate ? { dateId: entry.dateId, note: entry.note } : {}),
    };
  }
  return {
    schemaVersion: 1,
    id: entry.id,
    operationId: entry.operationId,
    kind: entry.kind,
    status: entry.status,
    ...(entry.kind === 'help' ? helpFields : { eventId: entry.eventId }),
    createdAt: serverTimestamp,
    cancelledAt: entry.status === 'cancelled-demo' ? serverTimestamp : null,
  };
}
