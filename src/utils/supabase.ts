import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import {
  type DrinkItem,
  sanitizeDrinkItem,
  deduplicateDrinksPerBar,
} from './calculator';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isAccountsEnabled = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isAccountsEnabled
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const USERNAME_REGEX = /^[a-z0-9._-]{3,24}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): string | null {
  const normalized = normalizeUsername(raw);
  if (normalized.length < 3 || normalized.length > 24) {
    return 'Username must be 3–24 characters.';
  }
  if (!USERNAME_REGEX.test(normalized)) {
    return 'Use only letters, numbers, dots (.), underscores (_), or hyphens (-).';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (password.length > 200) {
    return 'Password is too long (max 200 characters).';
  }
  return null;
}

export function mapAuthError(message: string): string {
  const msg = (message || '').trim();
  if (/already registered|user already exists/i.test(msg)) {
    return 'This email is already registered.';
  }
  if (/invalid login credentials/i.test(msg)) {
    return 'Wrong username/email or password.';
  }
  if (/email not confirmed/i.test(msg)) {
    return 'Please confirm your email address first.';
  }
  if (/rate limit|too many|429/i.test(msg)) {
    return 'Too many attempts. Please try again later.';
  }
  if (/password.*(short|least|characters)/i.test(msg)) {
    return 'Password must be at least 8 characters.';
  }
  if (/duplicate key|profiles_username_key|profiles_pkey/i.test(msg)) {
    return 'This username is already taken.';
  }
  if (/new password should be different/i.test(msg)) {
    return 'Please choose a different password from your current one.';
  }
  if (/expired|invalid.*token|otp_expired/i.test(msg)) {
    return 'This reset link has expired. Please request a new one.';
  }
  if (/unable to validate email|invalid email/i.test(msg)) {
    return 'Please enter a valid email address.';
  }
  if (/failed to fetch|networkerror|network request failed/i.test(msg)) {
    return 'Network error. Please check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}

function requireClient(): SupabaseClient {
  if (!supabase) {
    throw new Error('Accounts are not configured.');
  }
  return supabase;
}

export async function checkUsernameAvailable(username: string): Promise<boolean | null> {
  if (!supabase) return null;
  const normalized = normalizeUsername(username);
  if (!USERNAME_REGEX.test(normalized)) return null;

  const { data, error } = await supabase.rpc('is_username_available', {
    name: normalized,
  });
  if (error || typeof data !== 'boolean') {
    return null;
  }
  return data;
}

export async function signUpWithUsername(params: {
  username: string;
  email: string;
  password: string;
}): Promise<{ session: Session | null; needsEmailConfirmation: boolean }> {
  const client = requireClient();

  const usernameError = validateUsername(params.username);
  if (usernameError) throw new Error(usernameError);

  const email = params.email.trim();
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  const passwordError = validatePassword(params.password);
  if (passwordError) throw new Error(passwordError);

  const normalizedUsername = normalizeUsername(params.username);
  const available = await checkUsernameAvailable(normalizedUsername);
  if (available === false) {
    throw new Error('This username is already taken.');
  }

  const { data, error } = await client.auth.signUp({
    email,
    password: params.password,
    options: {
      data: { username: normalizedUsername },
      emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });

  if (error) {
    throw new Error(mapAuthError(error.message));
  }

  // When email confirmation is enabled and an email is already registered,
  // Supabase returns a user object with an empty identities array.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('This email is already registered.');
  }

  return {
    session: data.session ?? null,
    needsEmailConfirmation: !data.session,
  };
}

export async function logInWithIdentifier(
  identifier: string,
  password: string
): Promise<Session> {
  const client = requireClient();
  const trimmed = identifier.trim();
  if (!trimmed || !password) {
    throw new Error('Please enter your username or email and password.');
  }

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: trimmed, password }),
  });

  let payload: { access_token?: string; refresh_token?: string; error?: string } = {};
  try {
    payload = await res.json();
  } catch {
    // ignore malformed response
  }

  if (!res.ok || !payload.access_token || !payload.refresh_token) {
    throw new Error(payload.error || 'Wrong username/email or password.');
  }

  const { data, error } = await client.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });

  if (error || !data.session) {
    throw new Error(error ? mapAuthError(error.message) : 'Failed to start session.');
  }

  return data.session;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const client = requireClient();
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  const { error } = await client.auth.resetPasswordForEmail(trimmed, {
    redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
  });

  if (error) {
    throw new Error(mapAuthError(error.message));
  }
}

export async function updatePassword(newPassword: string): Promise<void> {
  const client = requireClient();
  const passwordError = validatePassword(newPassword);
  if (passwordError) throw new Error(passwordError);

  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) {
    throw new Error(mapAuthError(error.message));
  }
}

export async function logOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function deleteOwnAccount(): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc('delete_own_account');
  if (error) {
    throw new Error(mapAuthError(error.message));
  }
  await client.auth.signOut({ scope: 'local' }).catch(() => {});
}

export async function getUsername(userId: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data?.username) return null;
  return String(data.username);
}

export async function loadUserData(userId: string): Promise<{
  drinks: DrinkItem[];
  managedBars: string[];
  updatedAt: string | null;
}> {
  const client = requireClient();
  const { data, error } = await client
    .from('user_data')
    .select('drinks, managed_bars, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const rawDrinks = Array.isArray(data?.drinks) ? data.drinks : [];
  const sanitizedDrinks = deduplicateDrinksPerBar(
    rawDrinks.map((d) => sanitizeDrinkItem(d as Partial<DrinkItem>)),
    'first'
  ).drinks;

  const rawBars = Array.isArray(data?.managed_bars) ? data.managed_bars : [];
  const managedBars = rawBars.filter(
    (b): b is string => typeof b === 'string' && b.trim().length > 0
  );

  return {
    drinks: sanitizedDrinks,
    managedBars,
    updatedAt: typeof data?.updated_at === 'string' ? data.updated_at : null,
  };
}

export async function saveUserData(
  userId: string,
  drinks: DrinkItem[],
  managedBars: string[]
): Promise<string> {
  const client = requireClient();
  const updatedAt = new Date().toISOString();

  const { error } = await client
    .from('user_data')
    .upsert(
      {
        user_id: userId,
        drinks,
        managed_bars: managedBars,
        updated_at: updatedAt,
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    throw error;
  }

  return updatedAt;
}
