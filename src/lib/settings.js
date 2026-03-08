export const SETTINGS_KEYS = {
  url: 'supabase_url',
  anonKey: 'supabase_anon_key',
};

export function loadSettings() {
  return {
    url: localStorage.getItem(SETTINGS_KEYS.url) || '',
    anonKey: localStorage.getItem(SETTINGS_KEYS.anonKey) || '',
  };
}

export function saveSettings(url, anonKey) {
  localStorage.setItem(SETTINGS_KEYS.url, url.trim());
  localStorage.setItem(SETTINGS_KEYS.anonKey, anonKey.trim());
}

export function clearSettings() {
  localStorage.removeItem(SETTINGS_KEYS.url);
  localStorage.removeItem(SETTINGS_KEYS.anonKey);
}
