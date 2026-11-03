// Das Zertifikat eines Onlinekurses als PDF (V1.2, SAD §11.2, Schritt 8).
//
// WAS DIESE FUNKTION ENTSCHEIDET - UND WAS NICHT
// -----------------------------------------------
// Nichts. Ob jemand ein Zertifikat hat, steht in public.certificates und
// wurde von issue_certificate() geprueft (Migration 0046). Hier wird die
// eigene Zeile - gelesen mit dem Token des Anrufers, also unter RLS - nur
// noch gesetzt. Wer kein Zertifikat hat, bekommt 404.
//
// pdf-lib (MIT) ist am 03.11.2026 vom Team freigegeben, nur fuer diese
// Funktion. Standardschriften (WinAnsi) decken Umlaute und ß ab; eine
// eingebettete Schrift braucht es nicht.

import { createClient } from 'jsr:@supabase/supabase-js@2.118.0';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';

import { json, preflight, corsHeaders } from '../_shared/http.ts';

type CertificateRequest = { courseId?: unknown };

// Farben des Zertifikats: Mondlicht auf Papier (Creme, Nachtblau, Gold).
const PAPER = rgb(0.961, 0.937, 0.89);
const INK = rgb(0.165, 0.145, 0.314);
const SOFT = rgb(0.29, 0.263, 0.502);
const GOLD = rgb(0.788, 0.651, 0.369);

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');

  const options = preflight(request);
  if (options) return options;
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401, origin);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const appUrl = Deno.env.get('APP_URL');
  if (!url || !anonKey || !appUrl) {
    console.error('certificate-pdf ist nicht vollstaendig konfiguriert');
    return json({ error: 'not_configured' }, 500, origin);
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return json({ error: 'login_required' }, 401, origin);

  let body: CertificateRequest;
  try {
    body = (await request.json()) as CertificateRequest;
  } catch {
    return json({ error: 'bad_request' }, 400, origin);
  }
  if (typeof body.courseId !== 'string' || body.courseId.length === 0) {
    return json({ error: 'bad_request' }, 400, origin);
  }

  // Unter RLS: nur das eigene Zertifikat ist sichtbar (0046).
  const { data: cert, error } = await userClient
    .from('certificates')
    .select('code, full_name, score, total, issued_at, online_courses(title, subtitle)')
    .eq('course_id', body.courseId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    console.error('Zertifikat nicht gelesen', error.message);
    return json({ error: 'lookup_failed' }, 500, origin);
  }
  if (!cert) return json({ error: 'not_found' }, 404, origin);

  const course = (cert as unknown as { online_courses: { title: string; subtitle: string | null } | null })
    .online_courses;
  const pdf = await renderCertificate({
    name: cert.full_name,
    courseTitle: course?.title ?? '',
    courseSubtitle: course?.subtitle ?? null,
    score: cert.score,
    total: cert.total,
    issuedAt: new Date(cert.issued_at),
    code: cert.code,
    verifyUrl: `${appUrl}/zertifikat/${cert.code}`,
  });

  return new Response(pdf, {
    status: 200,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="zertifikat-${cert.code}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
});

type CertificateData = {
  name: string;
  courseTitle: string;
  courseSubtitle: string | null;
  score: number;
  total: number;
  issuedAt: Date;
  code: string;
  verifyUrl: string;
};

async function renderCertificate(d: CertificateData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Zertifikat ${d.courseTitle}`);
  doc.setAuthor('TheHaCode - DER ATEMCODE');
  doc.setSubject('Zertifikat Onlinekurs');

  // A4 quer.
  const page = doc.addPage([841.89, 595.28]);
  const { width, height } = page.getSize();
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  page.drawRectangle({ x: 0, y: 0, width, height, color: PAPER });
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: GOLD, borderWidth: 1.2 });
  page.drawRectangle({ x: 30, y: 30, width: width - 60, height: height - 60, borderColor: GOLD, borderWidth: 0.4 });

  const center = (text: string, y: number, font: typeof sans, size: number, color = INK) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - w) / 2, y, size, font, color });
  };

  // Siegel: Mond mit Welle.
  page.drawCircle({ x: width / 2, y: height - 105, size: 30, borderColor: GOLD, borderWidth: 1.5 });
  page.drawCircle({ x: width / 2, y: height - 105, size: 22, color: GOLD });
  page.drawSvgPath('M -10 0 Q -5 -8 0 0 T 10 0', { x: width / 2, y: height - 105, borderColor: INK, borderWidth: 1.8 });

  center('ZERTIFIKAT · ONLINEKURS', height - 168, sansBold, 11, SOFT);
  center(d.courseTitle, height - 215, serif, 34);
  if (d.courseSubtitle) center(d.courseSubtitle, height - 240, sans, 13, SOFT);

  center(d.name, height - 305, serifItalic, 30);
  const lineW = Math.min(420, Math.max(220, serifItalic.widthOfTextAtSize(d.name, 30) + 60));
  page.drawLine({
    start: { x: (width - lineW) / 2, y: height - 315 },
    end: { x: (width + lineW) / 2, y: height - 315 },
    thickness: 0.8,
    color: GOLD,
  });

  center('hat alle Inhalte des Onlinekurses bearbeitet und das Wissensquiz', height - 350, sans, 12, SOFT);
  center(`mit ${d.score} von ${d.total} richtigen Antworten bestanden.`, height - 368, sans, 12, SOFT);

  const date = d.issuedAt.toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' });
  const cols: [string, string][] = [
    [date, 'Ausgestellt'],
    [d.code, 'Prüfcode'],
    ['DER ATEMCODE', 'TheHaCode'],
  ];
  cols.forEach(([value, label], i) => {
    const x = width / 2 + (i - 1) * 190;
    const vw = sansBold.widthOfTextAtSize(value, 12);
    const lw = sans.widthOfTextAtSize(label, 10);
    page.drawText(value, { x: x - vw / 2, y: 128, size: 12, font: sansBold, color: INK });
    page.drawText(label, { x: x - lw / 2, y: 112, size: 10, font: sans, color: SOFT });
  });

  center(`Prüfen: ${d.verifyUrl}`, 70, sans, 9, SOFT);
  center('Teilnahmezertifikat, keine staatlich anerkannte Qualifikation.', 56, sans, 8, SOFT);

  return await doc.save();
}
