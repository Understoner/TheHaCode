// Setzt die gewaehlte Darstellung, bevor die Seite das erste Mal gezeichnet
// wird (src/design/theme.ts). Eine eigene Datei statt eines Inline-Skripts:
// die Content Security Policy laesst nur Skripte von 'self' und gehashte
// Inline-Skripte zu (src/lib/contentSecurityPolicy.ts). Eingebunden nur im
// Testsystem (+html.tsx). Schluessel wie THEME_STORAGE_KEY.
//
// Seit 01.11.2026 ist Mondlicht die Grundeinstellung und steht schon im
// HTML; umgeschaltet wird nur, wer ausdruecklich "Klar" gewaehlt hat.
// Farbe wie palettes.klar.background.
(function () {
  try {
    if (window.localStorage.getItem('thehacode.theme') === 'klar') {
      document.documentElement.dataset.theme = 'klar';
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', '#EFF3F4');
    }
  } catch (e) {
    // Kein Speicher: es bleibt bei der Grundeinstellung.
  }
})();
