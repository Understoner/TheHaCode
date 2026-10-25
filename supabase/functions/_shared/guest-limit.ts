// Absenderkennung fuer die Begrenzung von Gastreservierungen (Migration 0022).
//
// Rein, ohne Netz: Web Crypto gibt es in Deno wie in Node, also laeuft das
// hier auch unter Vitest.
//
// WELCHE IP
// ---------
// Vor der Edge Function stehen Cloudflare und das Supabase-Gateway. Die erste
// Adresse in x-forwarded-for kann der Aufrufer selbst hineinschreiben - die
// Proxys haengen nur an. cf-connecting-ip setzt Cloudflare dagegen neu, und
// x-real-ip setzt das Gateway. Deshalb diese Reihenfolge, und aus
// x-forwarded-for nur die LETZTE Adresse, die ein Proxy eingetragen hat.
//
// Faellt keine Adresse ab, gibt es keine Kennung, und die Begrenzung pro
// Absender entfaellt. Die Grenze pro Kurs (PT006) gilt trotzdem - sie ist die
// eigentliche Sicherung, diese hier bremst nur den einfachen Fall.
//
// WARUM HMAC STATT DER IP
// -----------------------
// In der Datenbank soll keine IP-Adresse stehen. Ein einfacher Hash hilft
// dabei wenig: es gibt nur rund vier Milliarden IPv4-Adressen, die rechnet
// jeder in Minuten durch. Mit einem geheimen Schluessel geht das nicht.

export function clientIp(headers: Headers): string | null {
  const direct = headers.get('cf-connecting-ip') ?? headers.get('x-real-ip');
  if (direct && direct.trim()) return direct.trim();

  const forwarded = headers.get('x-forwarded-for');
  if (!forwarded) return null;
  const parts = forwarded
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

export async function guestKey(secret: string, ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`guest-booking:${ip}`));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
