import { describe, expect, it } from 'vitest';

import { playlistLinks, playlistUrl } from './playlists';

// Die Gegenstuecke in der Datenbank stehen in
// supabase/tests/017_favoriten_und_playlists.test.sql - beide Orte pruefen
// dieselbe Regel, weil beide sie durchsetzen (Begruendung in playlists.ts).
describe('playlistUrl', () => {
  it('laesst die Adressen aus dem Teilen-Menue durch', () => {
    const spotify = 'https://open.spotify.com/playlist/37i9dQZF1DX3Ogo9pFvBkY?si=abc';
    expect(playlistUrl('spotify', spotify)).toBe(spotify);
    expect(playlistUrl('spotify', 'https://spotify.link/abc123')).toBe('https://spotify.link/abc123');

    const apple = 'https://music.apple.com/at/playlist/entspannung/pl.u-abc123';
    expect(playlistUrl('apple_music', apple)).toBe(apple);
  });

  it('behandelt fehlende Angaben als nicht vorhanden', () => {
    expect(playlistUrl('spotify', null)).toBeNull();
    expect(playlistUrl('apple_music', undefined)).toBeNull();
    expect(playlistUrl('spotify', '')).toBeNull();
  });

  // Der Knopf heisst Spotify, also soll er auch nach Spotify fuehren.
  it('ordnet keine Adresse dem falschen Dienst zu', () => {
    expect(playlistUrl('apple_music', 'https://open.spotify.com/playlist/abc')).toBeNull();
    expect(playlistUrl('spotify', 'https://music.apple.com/at/playlist/abc')).toBeNull();
  });

  // Der eigentliche Grund fuer die Pruefung: die Adresse landet in
  // Linking.openURL, und redaktionelle Sequenzen werden im Studio ohne
  // Formularvalidierung gepflegt.
  it('weist ab, was gar nicht zu den beiden Diensten gehoert', () => {
    expect(playlistUrl('spotify', 'javascript:alert(1)')).toBeNull();
    expect(playlistUrl('spotify', 'http://open.spotify.com/playlist/abc')).toBeNull();
    expect(playlistUrl('spotify', 'https://boese.example/playlist')).toBeNull();
    expect(playlistUrl('apple_music', 'https://music.apple.com.boese.example/x')).toBeNull();
    expect(playlistUrl('spotify', 'open.spotify.com/playlist/abc')).toBeNull();
  });
});

describe('playlistLinks', () => {
  it('liefert beide Adressen in Anzeigereihenfolge', () => {
    expect(
      playlistLinks({
        spotify_url: 'https://open.spotify.com/playlist/abc',
        apple_music_url: 'https://music.apple.com/at/playlist/abc',
      })
    ).toEqual([
      { provider: 'spotify', url: 'https://open.spotify.com/playlist/abc' },
      { provider: 'apple_music', url: 'https://music.apple.com/at/playlist/abc' },
    ]);
  });

  it('laesst weg, was fehlt oder nicht durchkommt', () => {
    expect(
      playlistLinks({ spotify_url: null, apple_music_url: 'https://music.apple.com/at/playlist/abc' })
    ).toEqual([{ provider: 'apple_music', url: 'https://music.apple.com/at/playlist/abc' }]);

    // Eine Sequenz ohne Musik: der ganze Abschnitt im Player entfaellt.
    expect(playlistLinks({ spotify_url: null, apple_music_url: null })).toEqual([]);
    expect(
      playlistLinks({ spotify_url: 'https://boese.example/x', apple_music_url: null })
    ).toEqual([]);
  });
});
