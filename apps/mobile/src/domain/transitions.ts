import { dateIds, districtIds, eventIds, events, serviceIds, slotIds } from './catalog';
import type { AppState, Command, Entry, Result, Transition } from './types';

const fail = <T>(code: Extract<Result<T>, { ok: false }>['error']['code'], existingEntryId?: string): Result<T> => ({
  ok: false, error: { code, ...(existingEntryId ? { existingEntryId } : {}) },
});
const success = (state: AppState, entryId?: string): Result<Transition> => ({
  ok: true, value: { state, ...(entryId ? { entryId } : {}) },
});
export function initialState(): AppState {
  return { schemaVersion: 1, locale: 'ru', draft: null, entries: [] };
}
function copy(state: AppState): AppState {
  return { ...state, draft: state.draft ? { ...state.draft } : null, entries: state.entries.map((entry) => ({ ...entry })) };
}
function isOperationId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
}
function knownEntry(state: AppState, operationId: string): Entry | undefined {
  return state.entries.find((entry) => entry.operationId === operationId);
}
function resultForEntry(state: AppState, entry: Entry): Result<Transition> {
  return success(copy(state), entry.id);
}

export function transition(state: AppState, command: Command, now: string): Result<Transition> {
  const next = copy(state);
  switch (command.type) {
    case 'setLocale':
      if (command.locale !== 'ru' && command.locale !== 'kz') return fail('INVALID_SELECTION');
      next.locale = command.locale;
      return success(next);
    case 'startHelp': {
      if (!serviceIds.has(command.serviceId) || !isOperationId(command.operationId)) return fail('INVALID_SELECTION');
      if (next.draft) {
        if (next.draft.operationId === command.operationId && next.draft.serviceId === command.serviceId) return success(next);
        if (!command.replace) return fail('DRAFT_EXISTS');
      }
      if (knownEntry(next, command.operationId)) return fail('INVALID_SELECTION');
      next.draft = { operationId: command.operationId, serviceId: command.serviceId, districtId: null, dateId: null, slotId: null, note: '', formStep: 'district', step: 'form' };
      return success(next);
    }
    case 'editHelp': {
      if (!next.draft) return fail('DRAFT_NOT_FOUND');
      const { serviceId, districtId, dateId, slotId, note } = command.patch;
      if (Object.keys(command.patch).some((key) => !['serviceId', 'districtId', 'dateId', 'slotId', 'note'].includes(key))) return fail('INVALID_SELECTION');
      if ('serviceId' in command.patch && serviceId === undefined) return fail('INVALID_SELECTION');
      if ('districtId' in command.patch && districtId === undefined) return fail('INVALID_SELECTION');
      if ('dateId' in command.patch && dateId === undefined) return fail('INVALID_SELECTION');
      if ('slotId' in command.patch && slotId === undefined) return fail('INVALID_SELECTION');
      if ('note' in command.patch && note === undefined) return fail('INVALID_SELECTION');
      if (serviceId !== undefined && !serviceIds.has(serviceId)) return fail('INVALID_SELECTION');
      if (districtId !== undefined && districtId !== null && !districtIds.has(districtId)) return fail('INVALID_SELECTION');
      if (dateId !== undefined && dateId !== null && !dateIds.has(dateId)) return fail('INVALID_SELECTION');
      if (slotId !== undefined && slotId !== null && !slotIds.has(slotId)) return fail('INVALID_SELECTION');
      if (note !== undefined && (typeof note !== 'string' || note.length > 280)) return fail('INVALID_SELECTION');
      const changed = ('serviceId' in command.patch && serviceId !== next.draft.serviceId)
        || ('districtId' in command.patch && districtId !== next.draft.districtId)
        || ('dateId' in command.patch && dateId !== next.draft.dateId)
        || ('slotId' in command.patch && slotId !== next.draft.slotId)
        || ('note' in command.patch && note !== next.draft.note);
      next.draft = {
        ...next.draft,
        dateId: next.draft.dateId ?? null,
        note: next.draft.note ?? '',
        formStep: next.draft.formStep ?? 'district',
        ...('serviceId' in command.patch ? { serviceId } : {}),
        ...('districtId' in command.patch ? { districtId } : {}),
        ...('dateId' in command.patch ? { dateId } : {}),
        ...('slotId' in command.patch ? { slotId } : {}),
        ...('note' in command.patch ? { note } : {}),
        step: changed ? 'form' : next.draft.step,
      };
      return success(next);
    }
    case 'setDraftStep': {
      if (!next.draft) return fail('DRAFT_NOT_FOUND');
      if (command.step !== 'form' && command.step !== 'review') return fail('INVALID_SELECTION');
      if (command.step === 'review') {
        if (!next.draft.districtId) return fail('DISTRICT_REQUIRED');
        if (!next.draft.dateId) return fail('DATE_REQUIRED');
        if (!next.draft.slotId) return fail('SLOT_REQUIRED');
      }
      next.draft = { ...next.draft, step: command.step };
      return success(next);
    }
    case 'setHelpFormStep': {
      if (!next.draft) return fail('DRAFT_NOT_FOUND');
      if (!['district', 'date', 'time', 'note'].includes(command.formStep)) return fail('INVALID_SELECTION');
      next.draft = { ...next.draft, dateId: next.draft.dateId ?? null, note: next.draft.note ?? '', formStep: command.formStep, step: 'form' };
      return success(next);
    }
    case 'discardDraft':
      if (!next.draft) return fail('DRAFT_NOT_FOUND');
      next.draft = null;
      return success(next);
    case 'submitHelp': {
      if (!isOperationId(command.operationId)) return fail('INVALID_SELECTION');
      const prior = knownEntry(next, command.operationId);
      if (prior) return prior.kind === 'help' ? resultForEntry(next, prior) : fail('INVALID_SELECTION');
      const draft = next.draft;
      if (!draft) return fail('DRAFT_NOT_FOUND');
      if (draft.operationId !== command.operationId) return fail('INVALID_SELECTION');
      if (!serviceIds.has(draft.serviceId) || (draft.districtId && !districtIds.has(draft.districtId)) || (draft.dateId && !dateIds.has(draft.dateId)) || (draft.slotId && !slotIds.has(draft.slotId)) || draft.note !== undefined && (typeof draft.note !== 'string' || draft.note.length > 280)) return fail('INVALID_SELECTION');
      if (!draft.districtId) return fail('DISTRICT_REQUIRED');
      if (!draft.dateId) return fail('DATE_REQUIRED');
      if (!draft.slotId) return fail('SLOT_REQUIRED');
      const entry: Entry = { id: `DEMO-${draft.operationId}`, operationId: draft.operationId, kind: 'help', serviceId: draft.serviceId, districtId: draft.districtId, dateId: draft.dateId, slotId: draft.slotId, note: draft.note ?? '', status: 'saved-demo', createdAt: now, cancelledAt: null };
      next.entries.unshift(entry);
      next.draft = null;
      return success(next, entry.id);
    }
    case 'enrollEvent': {
      if (!isOperationId(command.operationId)) return fail('INVALID_SELECTION');
      const prior = knownEntry(next, command.operationId);
      if (prior) return prior.kind === 'event' && prior.eventId === command.eventId ? resultForEntry(next, prior) : fail('INVALID_SELECTION');
      if (next.draft?.operationId === command.operationId) return fail('INVALID_SELECTION');
      if (!eventIds.has(command.eventId)) return fail('INVALID_SELECTION');
      const existing = next.entries.find((entry) => entry.kind === 'event' && entry.eventId === command.eventId && entry.status === 'saved-demo');
      if (existing) return fail('ALREADY_ENROLLED', existing.id);
      const item = events.find((event) => event.id === command.eventId);
      if (!item) return fail('INVALID_SELECTION');
      if (item.availability === 'full') return fail('EVENT_FULL');
      if (item.availability === 'cancelled') return fail('EVENT_CANCELLED');
      const entry: Entry = { id: `DEMO-${command.operationId}`, operationId: command.operationId, kind: 'event', eventId: command.eventId, status: 'saved-demo', createdAt: now, cancelledAt: null };
      next.entries.unshift(entry);
      return success(next, entry.id);
    }
    case 'cancelEntry': {
      const entry = next.entries.find((item) => item.id === command.entryId);
      if (!entry) return fail('ENTRY_NOT_FOUND');
      if (entry.status === 'cancelled-demo') return success(next, entry.id);
      next.entries = next.entries.map((item) => item.id === command.entryId ? { ...item, status: 'cancelled-demo', cancelledAt: now } : item);
      return success(next, command.entryId);
    }
  }
}
