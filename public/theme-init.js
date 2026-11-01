// Setzt die gewaehlte Darstellung, bevor die Seite das erste Mal gezeichnet
// wird (src/design/theme.ts). Eine eigene Datei statt eines Inline-Skripts:
// die Content Security Policy laesst nur Skripte von 'self' und gehashte
// Inline-Skripte zu (src/lib/contentSecurityPolicy.ts). Eingebunden nur im
// Testsystem (+html.tsx). Schluessel wie THEME_STORAGE_KEY.
(function () {
  try {
    if (window.localStorage.getItem('thehacode.theme') === 'mondlicht') {
      document.documentElement.dataset.theme = 'mondlicht';
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', '#1D1938');
    }
  } catch (e) {
    // Kein Speicher: es bleibt bei "Klar".
  }
})();
