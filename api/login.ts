import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SlidingWindowRateLimiter, getClientIp } from './rateLimit.ts';

export const GENERIC_LOGIN_ERROR = 'Wrong username/email or password.';
export const USERNAME_REGEX = /^[a-z0-9._-]{3,24}$/;

const loginRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 15,
});

const MIN_AUTH_FAILURE_MS = 280;

export function isEmailIdentifier(identifier: string): boolean {
  return identifier.trim().includes('@');
}

export interface LoginDeps {
  findUserIdByUsername: (username: string) => Promise<string | null>;
  getEmailByUserId: (userId: string) => Promise<string | null>;
  signInWithPassword: (
    email: string,
    password: string
  ) => Promise<{
    session: { access_token: string; refresh_token: string } | null;
    error: { message?: string; status?: number } | null;
  }>;
}

export interface LoginResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Pure login execution logic shared between the Vercel/Express endpoint and unit tests.
 */
export async function executeLogin(rawBody: unknown, deps: LoginDeps): Promise<LoginResult> {
  const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as Record<string, unknown>;
  const rawIdentifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!rawIdentifier || !password) {
    return {
      status: 400,
      body: { error: 'Please enter your username or email and password.' },
    };
  }

  if (rawIdentifier.length > 320 || password.length > 200) {
    return {
      status: 400,
      body: { error: 'Input is too long.' },
    };
  }

  let email: string;
  if (isEmailIdentifier(rawIdentifier)) {
    email = rawIdentifier;
  } else {
    const normalizedUsername = rawIdentifier.toLowerCase();
    if (!USERNAME_REGEX.test(normalizedUsername)) {
      return { status: 401, body: { error: GENERIC_LOGIN_ERROR } };
    }

    const userId = await deps.findUserIdByUsername(normalizedUsername);
    if (!userId) {
      return { status: 401, body: { error: GENERIC_LOGIN_ERROR } };
    }

    const resolvedEmail = await deps.getEmailByUserId(userId);
    if (!resolvedEmail) {
      return { status: 401, body: { error: GENERIC_LOGIN_ERROR } };
    }
    email = resolvedEmail;
  }

  const { session, error } = await deps.signInWithPassword(email, password);

  if (error) {
    const msg = error.message || '';
    if (error.status === 429 || /rate limit|too many/i.test(msg)) {
      return {
        status: 429,
        body: { error: 'Too many login attempts. Please try again later.' },
      };
    }
    if (/email not confirmed/i.test(msg)) {
      return {
        status: 403,
        body: { error: 'Please confirm your email address before logging in.' },
      };
    }
    return { status: 401, body: { error: GENERIC_LOGIN_ERROR } };
  }

  if (!session) {
    return { status: 401, body: { error: GENERIC_LOGIN_ERROR } };
  }

  return {
    status: 200,
    body: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    },
  };
}

let cachedClients: {
  key: string;
  adminClient: SupabaseClient;
  anonClient: SupabaseClient;
} | null = null;

function getSupabaseClients(
  supabaseUrl: string,
  anonKey: string,
  serviceRoleKey: string
): { adminClient: SupabaseClient; anonClient: SupabaseClient } {
  const key = `${supabaseUrl}|${anonKey}|${serviceRoleKey}`;
  if (cachedClients && cachedClients.key === key) {
    return {
      adminClient: cachedClients.adminClient,
      anonClient: cachedClients.anonClient,
    };
  }
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  cachedClients = { key, adminClient, anonClient };
  return { adminClient, anonClient };
}

function buildSupabaseDeps(): LoginDeps | null {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return null;
  }

  const { adminClient, anonClient } = getSupabaseClients(supabaseUrl, anonKey, serviceRoleKey);

  return {
    async findUserIdByUsername(username: string) {
      const { data, error } = await adminClient
        .from('profiles')
        .select('user_id')
        .eq('username', username)
        .maybeSingle();
      if (error || !data?.user_id) return null;
      return data.user_id as string;
    },
    async getEmailByUserId(userId: string) {
      const { data, error } = await adminClient.auth.admin.getUserById(userId);
      if (error || !data?.user?.email) return null;
      return data.user.email;
    },
    async signInWithPassword(email: string, password: string) {
      const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
      return {
        session: data?.session
          ? {
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            }
          : null,
        error: error ? { message: error.message, status: error.status } : null,
      };
    },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const ip = getClientIp(req);
  const limit = loginRateLimiter.check(ip);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSeconds));
    return res.status(429).json({
      error: 'Too many login attempts. Please try again later.',
    });
  }

  const deps = buildSupabaseDeps();
  if (!deps) {
    return res.status(503).json({ error: 'Accounts are not configured on this server.' });
  }

  const startedAt = Date.now();
  try {
    const result = await executeLogin(req.body, deps);
    if (result.status === 401) {
      // Constant minimum duration + small jitter mitigates timing-based username enumeration
      const targetMs = MIN_AUTH_FAILURE_MS + Math.floor(Math.random() * 40);
      const remainingMs = targetMs - (Date.now() - startedAt);
      if (remainingMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingMs));
      }
    }
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('[api/login] Unexpected error:', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
}
