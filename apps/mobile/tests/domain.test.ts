import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, transition } from '../src/domain/transitions';
import type { AppState, Command } from '../src/domain/types';

const now = '2026-11-09T00:00:00.000Z';
function apply(state: AppState, command: Command) {
  const result = transition(state, command, now);
  assert.equal(result.ok, true, result.ok ? '' : result.error.code);
  return result.ok ? result.value.state : state;
}
test('initial state has Russian locale and no saved items', () => {
  assert.deepEqual(initialState(), { schemaVersion: 1, locale: 'ru', draft: null, entries: [] });
});

test('help cannot be reviewed until district and time are selected', () => {
  const state = apply(initialState(), { type: 'startHelp', serviceId: 'groceries', operationId: 'op-help-1' });
  const result = transition(state, { type: 'setDraftStep', step: 'review' }, now);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'DISTRICT_REQUIRED');
});

test('help review requires time after district has been selected', () => {
  const state = apply(apply(initialState(), { type: 'startHelp', serviceId: 'groceries', operationId: 'op-help-2' }),
    { type: 'editHelp', patch: { districtId: 'demo-center' } });
  const result = transition(state, { type: 'setDraftStep', step: 'review' }, now);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'SLOT_REQUIRED');
});

test('direct help submission cannot bypass district and time validation', () => {
  const districtMissing = apply(initialState(), { type: 'startHelp', serviceId: 'groceries', operationId: 'op-direct-1' });
  const noDistrict = transition(districtMissing, { type: 'submitHelp', operationId: 'op-direct-1' }, now);
  assert.equal(noDistrict.ok, false);
  if (!noDistrict.ok) assert.equal(noDistrict.error.code, 'DISTRICT_REQUIRED');
  const noTime = apply(districtMissing, { type: 'editHelp', patch: { districtId: 'demo-center' } });
  const noSlot = transition(noTime, { type: 'submitHelp', operationId: 'op-direct-1' }, now);
  assert.equal(noSlot.ok, false);
  if (!noSlot.ok) assert.equal(noSlot.error.code, 'SLOT_REQUIRED');
});

test('help saves one demo entry and returns the same entry for a repeated operation id', () => {
  let state = apply(initialState(), { type: 'startHelp', serviceId: 'groceries', operationId: 'op-help-3' });
  state = apply(state, { type: 'editHelp', patch: { districtId: 'demo-left-bank', slotId: 'demo-afternoon' } });
  state = apply(state, { type: 'setDraftStep', step: 'review' });
  const first = transition(state, { type: 'submitHelp', operationId: 'op-help-3' }, now);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.value.entryId, 'DEMO-op-help-3');
  assert.equal(first.value.state.entries.length, 1);
  assert.equal(first.value.state.entries[0]?.status, 'saved-demo');
  const second = transition(first.value.state, { type: 'submitHelp', operationId: 'op-help-3' }, '2026-11-10T00:00:00.000Z');
  assert.equal(second.ok, true);
  if (second.ok) assert.equal(second.value.state.entries.length, 1);
});

test('replacing a saved operation id with another service is rejected', () => {
  let state = apply(initialState(), { type: 'startHelp', serviceId: 'groceries', operationId: 'op-help-4' });
  state = apply(state, { type: 'editHelp', patch: { districtId: 'demo-center', slotId: 'demo-morning' } });
  state = apply(state, { type: 'setDraftStep', step: 'review' });
  const saved = transition(state, { type: 'submitHelp', operationId: 'op-help-4' }, now);
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  const wrongIntent = transition(saved.value.state, { type: 'enrollEvent', eventId: 'tea', operationId: 'op-help-4' }, now);
  assert.equal(wrongIntent.ok, false);
  if (!wrongIntent.ok) assert.equal(wrongIntent.error.code, 'INVALID_SELECTION');
});

test('cancelling keeps the item in history and a repeated cancel preserves its timestamp', () => {
  const state = apply(initialState(), { type: 'enrollEvent', eventId: 'tea', operationId: 'op-event-1' });
  const cancelled = transition(state, { type: 'cancelEntry', entryId: 'DEMO-op-event-1' }, now);
  assert.equal(cancelled.ok, true);
  if (!cancelled.ok) return;
  assert.equal(cancelled.value.state.entries.length, 1);
  assert.equal(cancelled.value.state.entries[0]?.status, 'cancelled-demo');
  const again = transition(cancelled.value.state, { type: 'cancelEntry', entryId: 'DEMO-op-event-1' }, '2026-11-10T00:00:00.000Z');
  assert.equal(again.ok, true);
  if (again.ok) assert.equal(again.value.state.entries[0]?.cancelledAt, now);
});

test('full and cancelled event examples cannot be enrolled', () => {
  for (const [eventId, code] of [['walk-full', 'EVENT_FULL'], ['club-cancelled', 'EVENT_CANCELLED']] as const) {
    const result = transition(initialState(), { type: 'enrollEvent', eventId, operationId: `op-${eventId}` }, now);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, code);
  }
});

test('an active event duplicate points to the existing entry; a cancelled event can be added again', () => {
  const saved = apply(initialState(), { type: 'enrollEvent', eventId: 'tea', operationId: 'op-event-old' });
  const duplicate = transition(saved, { type: 'enrollEvent', eventId: 'tea', operationId: 'op-event-new' }, now);
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) {
    assert.equal(duplicate.error.code, 'ALREADY_ENROLLED');
    assert.equal(duplicate.error.existingEntryId, 'DEMO-op-event-old');
  }
  const cancelled = apply(saved, { type: 'cancelEntry', entryId: 'DEMO-op-event-old' });
  const next = transition(cancelled, { type: 'enrollEvent', eventId: 'tea', operationId: 'op-event-new' }, now);
  assert.equal(next.ok, true);
  if (next.ok) assert.equal(next.value.state.entries.length, 2);
});

test('repeating a saved operation after cancellation returns its cancelled entry without restoring it', () => {
  let help = apply(initialState(), { type: 'startHelp', serviceId: 'home-help', operationId: 'op-repeat-help' });
  help = apply(help, { type: 'editHelp', patch: { districtId: 'demo-center', slotId: 'demo-morning' } });
  help = apply(help, { type: 'setDraftStep', step: 'review' });
  const submittedHelp = transition(help, { type: 'submitHelp', operationId: 'op-repeat-help' }, now);
  assert.equal(submittedHelp.ok, true);
  if (!submittedHelp.ok) return;
  const cancelledHelp = apply(submittedHelp.value.state, { type: 'cancelEntry', entryId: 'DEMO-op-repeat-help' });
  const repeatedHelp = transition(cancelledHelp, { type: 'submitHelp', operationId: 'op-repeat-help' }, now);
  assert.equal(repeatedHelp.ok, true);
  if (repeatedHelp.ok) {
    assert.equal(repeatedHelp.value.state.entries.length, 1);
    assert.equal(repeatedHelp.value.state.entries[0]?.status, 'cancelled-demo');
  }
  const cancelledEvent = apply(apply(initialState(), { type: 'enrollEvent', eventId: 'tea', operationId: 'op-repeat-event' }),
    { type: 'cancelEntry', entryId: 'DEMO-op-repeat-event' });
  const repeatedEvent = transition(cancelledEvent, { type: 'enrollEvent', eventId: 'tea', operationId: 'op-repeat-event' }, now);
  assert.equal(repeatedEvent.ok, true);
  if (repeatedEvent.ok) {
    assert.equal(repeatedEvent.value.state.entries.length, 1);
    assert.equal(repeatedEvent.value.state.entries[0]?.status, 'cancelled-demo');
  }
});

test('changing locale leaves the draft and entries unchanged', () => {
  const before = apply(initialState(), { type: 'startHelp', serviceId: 'digital-help', operationId: 'op-lang' });
  const after = apply(before, { type: 'setLocale', locale: 'kz' });
  assert.equal(after.locale, 'kz');
  assert.deepEqual(after.draft, before.draft);
  assert.deepEqual(after.entries, before.entries);
});

test('changing selections from a review draft returns it to the form step', () => {
  let state = apply(initialState(), { type: 'startHelp', serviceId: 'home-help', operationId: 'op-review-edit' });
  state = apply(state, { type: 'editHelp', patch: { districtId: 'demo-center', slotId: 'demo-morning' } });
  state = apply(state, { type: 'setDraftStep', step: 'review' });
  const changed = transition(state, { type: 'editHelp', patch: { districtId: null } }, now);
  assert.equal(changed.ok, true);
  if (changed.ok) {
    assert.equal(changed.value.state.draft?.step, 'form');
    assert.equal(changed.value.state.draft?.districtId, null);
  }
});

test('an event intent cannot reuse the current help draft operation id', () => {
  const draft = apply(initialState(), { type: 'startHelp', serviceId: 'groceries', operationId: 'shared-intent' });
  const result = transition(draft, { type: 'enrollEvent', eventId: 'tea', operationId: 'shared-intent' }, now);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_SELECTION');
});

test('failed transitions do not mutate their input snapshot', () => {
  const before = initialState();
  const result = transition(before, { type: 'submitHelp', operationId: 'missing' }, now);
  assert.equal(result.ok, false);
  assert.deepEqual(before, { schemaVersion: 1, locale: 'ru', draft: null, entries: [] });
});
