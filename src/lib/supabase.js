import { createClient } from '@supabase/supabase-js';

let cached = { key: '', client: null };

export function getSupabaseClient(url, anonKey) {
  const cleanUrl = (url || '').trim();
  const cleanKey = (anonKey || '').trim();
  if (!cleanUrl || !cleanKey) {
    return null;
  }

  const cacheKey = `${cleanUrl}::${cleanKey}`;
  if (cached.client && cached.key === cacheKey) {
    return cached.client;
  }

  cached = {
    key: cacheKey,
    client: createClient(cleanUrl, cleanKey),
  };

  return cached.client;
}
