import test from 'node:test';
import assert from 'node:assert/strict';
import {
  executeLogin,
  GENERIC_LOGIN_ERROR,
  isEmailIdentifier,
  type LoginDeps,
} from './login.ts';

function createMockDeps(overrides: Partial<LoginDeps> = {}): LoginDeps {
  return {
    findUserIdByUsername: async (username) => (username === 'jan.klaassen' ? 'user-1' : null),
    getEmailByUserId: async (id) => (id === 'user-1' ? 'jan@krentprocent.nl' : null),
    signInWithPassword: async (email, password) => {
      if (email === 'jan@krentprocent.nl' && password === 'secret1234') {
        return {
          session: { access_token: 'acc-tok', refresh_token: 'ref-tok' },
          error: null,
        };
      }
      return {
        session: null,
        error: { message: 'Invalid login credentials', status: 400 },
      };
    },
    ...overrides,
  };
}

test('isEmailIdentifier distinguishes emails from usernames', () => {
  assert.equal(isEmailIdentifier('jan@krentprocent.nl'), true);
  assert.equal(isEmailIdentifier('  jan@krentprocent.nl  '), true);
  assert.equal(isEmailIdentifier('jan.klaassen'), false);
  assert.equal(isEmailIdentifier('Jan_Klaassen-99'), false);
});

test('executeLogin allows login with username (case-insensitive) and email', async () => {
  const deps = createMockDeps();

  const byUsername = await executeLogin(
    { identifier: '  Jan.Klaassen ', password: 'secret1234' },
    deps
  );
  assert.equal(byUsername.status, 200);
  assert.equal(byUsername.body.access_token, 'acc-tok');
  assert.equal(byUsername.body.refresh_token, 'ref-tok');

  const byEmail = await executeLogin(
    { identifier: 'jan@krentprocent.nl', password: 'secret1234' },
    deps
  );
  assert.equal(byEmail.status, 200);
  assert.equal(byEmail.body.access_token, 'acc-tok');
});

test('unknown username and wrong password return identical 401 error to prevent enumeration', async () => {
  const deps = createMockDeps();

  const unknownUser = await executeLogin(
    { identifier: 'nonexistent', password: 'secret1234' },
    deps
  );
  const invalidFormatUser = await executeLogin(
    { identifier: 'a!', password: 'secret1234' },
    deps
  );
  const wrongPassword = await executeLogin(
    { identifier: 'jan.klaassen', password: 'wrongpassword' },
    deps
  );
  const wrongEmail = await executeLogin(
    { identifier: 'nobody@krentprocent.nl', password: 'secret1234' },
    deps
  );

  for (const res of [unknownUser, invalidFormatUser, wrongPassword, wrongEmail]) {
    assert.equal(res.status, 401);
    assert.equal(res.body.error, GENERIC_LOGIN_ERROR);
  }
});

test('executeLogin forwards rate limits (429) and unconfirmed emails (403) and rejects empty input (400)', async () => {
  const emptyRes = await executeLogin({ identifier: '', password: '' }, createMockDeps());
  assert.equal(emptyRes.status, 400);

  const rateLimited = await executeLogin(
    { identifier: 'jan@krentprocent.nl', password: 'secret1234' },
    createMockDeps({
      signInWithPassword: async () => ({
        session: null,
        error: { message: 'Request rate limit reached', status: 429 },
      }),
    })
  );
  assert.equal(rateLimited.status, 429);

  const unconfirmed = await executeLogin(
    { identifier: 'jan@krentprocent.nl', password: 'secret1234' },
    createMockDeps({
      signInWithPassword: async () => ({
        session: null,
        error: { message: 'Email not confirmed', status: 400 },
      }),
    })
  );
  assert.equal(unconfirmed.status, 403);
});
