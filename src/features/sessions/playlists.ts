import { safeExternalUrl } from '@/lib/externalLink';

// Musik bringt der Nutzer in seiner eigenen App mit (CLAUDE.md §Verboten).
// Was hier steht, ist deshalb kein Abspieler, sondern eine Adresse: ein
// Verweis auf eine Playlist, die in Spotify oder Apple Music laeuft, waehrend
// die Sequenz hier atmen laesst. Die App startet sie nicht, haelt sie nicht an
// und weiss auch nicht, ob sie laeuft - sie oeffnet den Link, mehr nicht.
//
// WARUM DIE HOSTS HIER NOCH EINMAL STEHEN
// ---------------------------------------
// Dieselbe Liste steht als CHECK-Constraint in Migration 0017. Sie steht
// doppelt, weil beide Orte verschiedene Aufgaben haben - dieselbe Ueberlegung
// wie bei den Grenzwerten des Konfigurators (features/configurator/schema.ts):
// die Datenbank laesst nichts Falsches herein, das Formular sagt es einem VOR
// dem Absenden. Und die Anzeige verlaesst sich auf keines von beiden: eine
// Adresse, die aelter ist als der Constraint oder per service_role
// vorbeigeschrieben wurde, faellt hier trotzdem durch.
//
// Aendert sich die Liste, muessen beide Orte angefasst werden;
// 017_favoriten_und_playlists.test.sql ist die Absicherung dagegen, dass man
// die Datenbankseite vergisst.

export const PLAYLIST_PROVIDERS = ['spotify', 'apple_music'] as const;

export type PlaylistProvider = (typeof PLAYLIST_PROVIDERS)[number];

const HOSTS: Record<PlaylistProvider, readonly string[]> = {
  // spotify.link sind die kurzen Adressen aus dem Teilen-Menue der App - ohne
  // sie muesste jeder erst die Langfassung heraussuchen.
  spotify: ['open.spotify.com', 'spotify.link'],
  apple_music: ['music.apple.com'],
};

/**
 * Die geprüfte Adresse - oder null, wenn sie nicht zu diesem Dienst gehoert.
 *
 * Bewusst kein "irgendeine https-Adresse ist gut genug": der Knopf heisst
 * Spotify, also soll er auch nach Spotify fuehren. safeExternalUrl davor faengt
 * ab, was gar keine gewoehnliche Web-Adresse ist (javascript:, data: und so
 * weiter) - der Grund dafuer steht in lib/externalLink.ts.
 */
export function playlistUrl(
  provider: PlaylistProvider,
  value: string | null | undefined
): string | null {
  const safe = safeExternalUrl(value);
  if (!safe) return null;

  try {
    const url = new URL(safe);
    // Nur https: eine Playlist ueber eine ungesicherte Verbindung zu oeffnen
    // gaebe es bei beiden Diensten ohnehin nicht.
    if (url.protocol !== 'https:') return null;
    return HOSTS[provider].includes(url.hostname) ? safe : null;
  } catch {
    return null;
  }
}

/** Beide Adressen einer Sequenz, geprueft und in Anzeigereihenfolge. */
export function playlistLinks(source: {
  spotify_url: string | null;
  apple_music_url: string | null;
}): { provider: PlaylistProvider; url: string }[] {
  const paare: [PlaylistProvider, string | null][] = [
    ['spotify', source.spotify_url],
    ['apple_music', source.apple_music_url],
  ];

  return paare.flatMap(([provider, value]) => {
    const url = playlistUrl(provider, value);
    return url ? [{ provider, url }] : [];
  });
}
