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
import { supabase } from './supabase';

export type { MyPublicBar, PublicBarSummary };

function requireSupabase() {
  if (!supabase) {
    throw new Error('Accounts are not configured.');
  }
  return supabase;
}

export async function fetchMyPublicBars(userId: string): Promise<MyPublicBar[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
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
  const client = requireSupabase();
  const cleanBarName = params.barName.trim().slice(0, 80);
  const barKey = normalizeBarKey(cleanBarName);
  const cleanCity = sanitizeCity(params.city);
  const payloadDrinks = preparePublicDrinks(params.drinks, cleanBarName);
  const now = new Date().toISOString();

  const { data, error } = await client
    .from('public_bars')
    .upsert(
      {
        user_id: params.userId,
        bar_key: barKey,
        bar_name: cleanBarName,
        city: cleanCity,
        drinks: payloadDrinks,
        updated_at: now,
      },
      { onConflict: 'user_id,bar_key' }
    )
    .select('id, bar_key, bar_name, city')
    .single();

  if (error) {
    if (/public_bar_limit/i.test(error.message)) {
      throw new Error('You can share up to 50 bars.');
    }
    throw new Error('Could not share this bar. Please try again.');
  }

  return {
    id: String(data.id),
    barKey: String(data.bar_key),
    barName: String(data.bar_name),
    city: typeof data.city === 'string' && data.city.trim() ? data.city.trim() : null,
    hash: hashBarDrinks(payloadDrinks),
  };
}

export async function unpublishBar(userId: string, barKey: string): Promise<void> {
  const client = requireSupabase();
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
  const client = requireSupabase();
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
  const client = requireSupabase();
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
