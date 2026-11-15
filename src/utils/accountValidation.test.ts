import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUsername,
  validateUsername,
  validatePassword,
  mapAuthError,
} from './accountValidation.ts';

test('normalizeUsername trims and lowercases input', () => {
  assert.equal(normalizeUsername('  Jan.Kroeg-1  '), 'jan.kroeg-1');
});

test('validateUsername enforces length and allowed characters', () => {
  assert.equal(validateUsername('jan.kroeg_1-2'), null);
  assert.match(validateUsername('ab') || '', /3–24/);
  assert.match(validateUsername('a'.repeat(25)) || '', /3–24/);
  assert.match(validateUsername('jan kroeg') || '', /letters, numbers/);
  assert.match(validateUsername('jan@kroeg') || '', /letters, numbers/);
});

test('validatePassword enforces minimum and maximum length', () => {
  assert.equal(validatePassword('secret12'), null);
  assert.match(validatePassword('short') || '', /at least 8/);
  assert.match(validatePassword('a'.repeat(201)) || '', /too long/);
});

test('mapAuthError maps RPC and Supabase auth errors cleanly', () => {
  assert.equal(mapAuthError('username_taken'), 'This username is already taken.');
  assert.match(mapAuthError('invalid_username'), /3–24/);
  assert.match(mapAuthError('not_authenticated'), /expired/i);
  assert.equal(
    mapAuthError('New password should be different from the old password.'),
    'Please choose a different password from your current one.'
  );
  assert.equal(mapAuthError('Invalid login credentials'), 'Wrong username/email or password.');
  assert.equal(mapAuthError('unexpected internal error'), 'Something went wrong. Please try again.');
});
