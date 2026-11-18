import {
  type DrinkItem,
  normalizeBarKey,
} from './calculator';
import {
  type MyPublicBar,
  type PublicBarSummary,
  hashBarDrinks,
  normalizeSearchQuery,
  prepareAdoptedDrinks,
  preparePublicDrinks,
  sanitizeCity,
} from './publicBarsCore';
import { getSupabaseClient } from './supabase';

export type { MyPublicBar, PublicBarSummary };

async function requireSupabase() {
  const client = await getSupabaseClient();
  if (!client) {
    throw new Error('Accounts are not configured.');
  }
  return client;
}

function isMissingDrinksHashColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42703' || /drinks_hash/i.test(error.message || '');
}

export async function fetchMyPublicBars(userId: string): Promise<MyPublicBar[]> {
  const client = await getSupabaseClient();
  if (!client) return [];

  // Fast path (post-migration 0004): avoid downloading full drinks JSONB blobs on startup
  const light = await client
    .from('public_bars')
    .select('id, bar_key, bar_name, city, drinks_hash')
    .eq('user_id', userId);

  if (!light.error && Array.isArray(light.data)) {
    const allHaveHash = light.data.every(
      (row) => typeof row.drinks_hash === 'string' && row.drinks_hash.length > 0
    );
    if (allHaveHash) {
      return light.data.map((row) => ({
        id: String(row.id),
        barKey: String(row.bar_key),
        barName: String(row.bar_name),
        city: typeof row.city === 'string' && row.city.trim() ? row.city.trim() : null,
        hash: String(row.drinks_hash),
      }));
    }
  } else if (!isMissingDrinksHashColumnError(light.error)) {
    throw light.error || new Error('Failed to load shared bars.');
  }

  // Backwards-compatible fallback before migration 0004 or for legacy rows without drinks_hash
  const { data, error } = await client
    .from('public_bars')
    .select('id, bar_key, bar_name, city, drinks')
    .eq('user_id', userId);

  if (error || !Array.isArray(data)) {
    throw error || new Error('Failed to load shared bars.');
  }

  return data.map((row) => {
    const rawDrinks = Array.isArray(row.drinks) ? (row.drinks as DrinkItem[]) : [];
    return {
      id: String(row.id),
      barKey: String(row.bar_key),
      barName: String(row.bar_name),
      city: typeof row.city === 'string' && row.city.trim() ? row.city.trim() : null,
      hash: hashBarDrinks(rawDrinks),
    };
  });
}

export async function publishBar(params: {
  userId: string;
  barName: string;
  city: string | null;
  drinks: DrinkItem[];
}): Promise<MyPublicBar> {
  const client = await requireSupabase();
  const cleanBarName = params.barName.trim().slice(0, 80);
  const barKey = normalizeBarKey(cleanBarName);
  const cleanCity = sanitizeCity(params.city);
  const payloadDrinks = preparePublicDrinks(params.drinks, cleanBarName);
  const drinksHash = hashBarDrinks(payloadDrinks);
  const now = new Date().toISOString();

  const baseRecord = {
    user_id: params.userId,
    bar_key: barKey,
    bar_name: cleanBarName,
    city: cleanCity,
    drinks: payloadDrinks,
    updated_at: now,
  };

  let { data, error } = await client
    .from('public_bars')
    .upsert({ ...baseRecord, drinks_hash: drinksHash }, { onConflict: 'user_id,bar_key' })
    .select('id, bar_key, bar_name, city')
    .single();

  // Backwards-compatible retry if migration 0004 has not been applied yet
  if (isMissingDrinksHashColumnError(error)) {
    const retry = await client
      .from('public_bars')
      .upsert(baseRecord, { onConflict: 'user_id,bar_key' })
      .select('id, bar_key, bar_name, city')
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) {
    if (error && /public_bar_limit/i.test(error.message)) {
      throw new Error('You can share up to 50 bars.');
    }
    throw new Error('Could not share this bar. Please try again.');
  }

  return {
    id: String(data.id),
    barKey: String(data.bar_key),
    barName: String(data.bar_name),
    city: typeof data.city === 'string' && data.city.trim() ? data.city.trim() : null,
    hash: drinksHash,
  };
}

export async function unpublishBar(userId: string, barKey: string): Promise<void> {
  const client = await requireSupabase();
  const { error } = await client
    .from('public_bars')
    .delete()
    .eq('user_id', userId)
    .eq('bar_key', barKey);

  if (error) {
    throw new Error('Could not make this bar private. Please try again.');
  }
}

export async function searchPublicBars(query: string, limit = 30): Promise<PublicBarSummary[]> {
  const client = await requireSupabase();
  const cleanQuery = normalizeSearchQuery(query);
  const { data, error } = await client.rpc('search_public_bars', {
    q: cleanQuery,
    lim: limit,
  });

  if (error || !Array.isArray(data)) {
    throw new Error('Could not load public bars. Please try again.');
  }

  return data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    username: String(row.username || ''),
    barName: String(row.bar_name || 'Shared Bar'),
    city: typeof row.city === 'string' && row.city.trim() ? row.city.trim() : null,
    drinkCount: Number(row.drink_count) || 0,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date().toISOString(),
  }));
}

export async function getPublicBarDrinks(
  publicBarId: string,
  fallbackBarName: string
): Promise<DrinkItem[]> {
  const client = await requireSupabase();
  const { data, error } = await client
    .from('public_bars')
    .select('bar_name, drinks')
    .eq('id', publicBarId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Could not load drinks for this bar.');
  }

  const barName =
    typeof data.bar_name === 'string' && data.bar_name.trim()
      ? data.bar_name.trim()
      : fallbackBarName;

  return prepareAdoptedDrinks(data.drinks, barName);
}
