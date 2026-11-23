import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionGuard } from '../src/firebase/sessionGuard';

test('a delayed account A refresh cannot affect account B after logout and sign in', () => {
  const guard = createSessionGuard();
  const a = guard.begin('user-a');
  const delayedA = guard.beginRequest('user-a', a)!;
  guard.invalidate();
  const b = guard.begin('user-b');
  assert.equal(guard.isCurrent('user-a', a), false);
  assert.equal(guard.isCurrentRequest('user-a', a, delayedA), false);
  assert.equal(guard.isCurrent('user-b', b), true);
  assert.equal(guard.currentUid(), 'user-b');
});

test('a late same-account refresh cannot overwrite the result of a newer refresh', () => {
  const guard = createSessionGuard();
  const generation = guard.begin('user-a');
  const older = guard.beginRequest('user-a', generation)!;
  const newer = guard.beginRequest('user-a', generation)!;
  assert.equal(guard.isCurrentRequest('user-a', generation, older), false);
  assert.equal(guard.isCurrentRequest('user-a', generation, newer), true);
  assert.equal(guard.beginRequest('user-b', generation), null);
});

test('a same-UID role transition advances the session and rejects resident results', () => {
  const guard = createSessionGuard();
  const residentGeneration = guard.begin('user-a');
  const delayedResidentRead = guard.beginRequest('user-a', residentGeneration)!;
  const volunteerGeneration = guard.advance('user-a')!;
  assert.notEqual(volunteerGeneration, residentGeneration);
  assert.equal(guard.isCurrent('user-a', residentGeneration), false);
  assert.equal(guard.isCurrentRequest('user-a', residentGeneration, delayedResidentRead), false);
  assert.equal(guard.isCurrent('user-a', volunteerGeneration), true);
  assert.equal(guard.advance('other-user'), null);
});
