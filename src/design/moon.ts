/**
 * Mond in der Phase p (0..1, 1 = voll) als SVG-Pfad um den Mittelpunkt 0/0
 * mit Radius r - der beleuchtete Teil, zunehmend von rechts. Darunter gehoert
 * ein dunkler Kreis gleicher Groesse. Fuer Kursabende, Konto und Auswertung
 * im Vorschlag "Mondlicht Mobile" (02.11.2026).
 */
export function moonPath(p: number, r: number): string {
  if (p <= 0.01) return '';
  if (p >= 0.99) return `M0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r} Z`;
  const rx = r * Math.abs(1 - 2 * p);
  return `M0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${rx.toFixed(2)} ${r} 0 0 ${p < 0.5 ? 0 : 1} 0 ${-r} Z`;
}
