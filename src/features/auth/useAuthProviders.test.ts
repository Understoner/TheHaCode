import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchEnabledProviders } from './useAuthProviders';

function antwortMit(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({ ok, status, json: async () => body });
}

describe('fetchEnabledProviders', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://projekt.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-schluessel');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('meldet genau die Anbieter, die Supabase als eingeschaltet ausweist', async () => {
    vi.stubGlobal('fetch', antwortMit({ external: { google: true, apple: false, email: true } }));

    await expect(fetchEnabledProviders()).resolves.toEqual(['google']);
  });

  // github kann in Supabase eingeschaltet sein, ohne dass die App eine
  // Beschriftung dafuer hat - ein Knopf dafuer waere eine Ueberraschung.
  it('bietet nichts an, was die App gar nicht kennt', async () => {
    vi.stubGlobal('fetch', antwortMit({ external: { github: true, twitch: true, email: true } }));

    await expect(fetchEnabledProviders()).resolves.toEqual([]);
  });

  it('haelt die Reihenfolge der App ein, nicht die der Antwort', async () => {
    vi.stubGlobal('fetch', antwortMit({ external: { apple: true, google: true } }));

    await expect(fetchEnabledProviders()).resolves.toEqual(['google', 'apple']);
  });

  it('fragt den richtigen Endpunkt mit dem oeffentlichen Schluessel', async () => {
    const fetchMock = antwortMit({ external: {} });
    vi.stubGlobal('fetch', fetchMock);

    await fetchEnabledProviders();

    expect(fetchMock).toHaveBeenCalledWith('https://projekt.supabase.co/auth/v1/settings', {
      headers: { apikey: 'anon-schluessel' },
    });
  });

  // Lieber gar kein Knopf als ein Knopf auf Verdacht: die Antwort ist die
  // einzige verlaessliche Auskunft darueber, ob der Weg funktioniert.
  it('scheitert laut, statt stillschweigend alles anzubieten', async () => {
    vi.stubGlobal('fetch', antwortMit({}, false, 503));

    await expect(fetchEnabledProviders()).rejects.toThrow('503');
  });

  it('fragt gar nicht erst, wenn die Konfiguration fehlt', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    const fetchMock = antwortMit({ external: { google: true } });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchEnabledProviders()).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('vertraegt eine Antwort ohne external-Block', async () => {
    vi.stubGlobal('fetch', antwortMit({}));

    await expect(fetchEnabledProviders()).resolves.toEqual([]);
  });
});
