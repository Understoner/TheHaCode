import { Linking } from 'react-native';

// Ziel-URLs aus der Datenbank (heute courses.signup_url) werden in Supabase
// Studio von Hand gepflegt. react-native-web reicht sie ungeprueft an
// window.open durch - ein dort eingetragenes "javascript:..." liefe damit im
// Kontext der eigenen Seite. Die Redaktion ist zwar vertrauenswuerdig, aber ein
// verlorener Studio-Zugang soll nicht gleich Code im Browser der Besucher
// ausfuehren duerfen. Deshalb: nur http und https, alles andere gilt als nicht
// vorhanden (der Button erscheint dann gar nicht erst).
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

// Dazu mailto, seit "Atmung nach Maß" keine Anmeldeseite hat, sondern eine
// Anfrage per E-Mail. mailto fuehrt keinen Code aus, es oeffnet nur das
// Mailprogramm. Trotzdem eng gefasst wie im Markdown-Leser: kein Leerzeichen,
// keine Anfuehrungszeichen, keine spitzen Klammern - Betreff und Text muessen
// kodiert (%20) drinstehen.
const MAILTO = /^mailto:[^\s"'<>]+$/;

export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (MAILTO.test(value)) return value;
  try {
    // Ohne Basis-URL: relative Angaben sind hier ohnehin keine gueltigen Ziele
    // und werfen - der catch-Zweig faengt sie mit ab.
    return ALLOWED_PROTOCOLS.includes(new URL(value).protocol) ? value : null;
  } catch {
    return null;
  }
}

export function openExternalUrl(url: string): void {
  const safe = safeExternalUrl(url);
  if (!safe) return;
  void Linking.openURL(safe);
}
