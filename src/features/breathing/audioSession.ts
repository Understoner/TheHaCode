// Die Audio-Sitzungskategorie - die Stellschraube, die auf dem iPhone darueber
// entscheidet, ob unsere Toene ueberhaupt zu hoeren sind.
//
// DAS PROBLEM, GEMESSEN AM 06.09.2026 AUF EINEM ECHTEN GERAET
// -----------------------------------------------------------
// Auf dem iPhone blieben Phasenton und Ansage stumm - aber nur, solange die
// Hintergrundmusik AUS war. Mit Musik lief beides. Der Grund liegt nicht im
// Klanggraphen, sondern eine Ebene darunter:
//
// Safari stellt die Sitzung einer Seite standardmaessig auf 'auto', und das
// bedeutet zunaechst 'ambient'. Ambient mischt sich freundlich mit fremder
// Wiedergabe - und wird vom Klingelschalter an der Gehaeusekante
// stummgeschaltet. Reines Web Audio faellt damit aus, sobald das Telefon auf
// lautlos steht. Laeuft dagegen ein <audio>-Element, hebt Safari die Kategorie
// von selbst an, und plotzlich ist auch Web Audio hoerbar. Genau dieser
// Unterschied war zu hoeren.
//
// WARUM 'transient' UND NICHT 'playback'
// --------------------------------------
// 'playback' waere das sichere Mittel gegen die Stummschaltung - es pausiert
// aber fremde Wiedergabe. Damit stuende die Musik still, die der Nutzer in
// seiner eigenen App laufen hat, und genau das verbietet SAD §7.5.
//
// 'transient' ist die Kategorie fuer kurze Signaltoene: sie legen sich ueber
// anderes und daempfen es hoechstens. Fachlich ist ein Phasenton genau das.
//
// EHRLICH GESAGT: ob 'transient' den Klingelschalter ueberstimmt, steht in
// keiner Dokumentation, die sich finden liess - weder bei MDN noch im
// W3C-Entwurf. Es ist die semantisch richtige Angabe und der Versuch wert; die
// Antwort gibt nur ein Geraet. Hilft es nicht, bleibt die Wahl zwischen
// 'playback' (Ton gewinnt, fremde Musik verliert) und einem Hinweis an den
// Nutzer - und das ist eine Produktentscheidung, keine technische.
//
// WARUM DIE KATEGORIE DER MUSIK FOLGT
// -----------------------------------
// Laeuft unsere eigene Hintergrundmusik, richtet Safari die Sitzung ohnehin
// passend ein, und die Toene sind hoerbar. Ein 'transient' waere dort nicht
// nur ueberfluessig, sondern falsch: ein Stueck von einer Viertelstunde ist
// kein Signalton. Deshalb 'auto', sobald Musik laeuft, und 'transient' nur,
// wenn wir allein mit Web Audio dastehen.
//
// Nur Safari kennt die API (Stand September 2026); ueberall sonst passiert
// hier nichts, und das ist auch nicht noetig - kein anderes System schaltet
// Web Audio per Hardwareschalter stumm.

/** Die beiden Kategorien, die diese App braucht. */
export type AudioSessionType = 'auto' | 'transient';

type NavigatorMitSitzung = Navigator & {
  audioSession?: { type: string };
};

/**
 * Setzt die Kategorie, falls der Browser sie kennt. Gibt zurueck, ob es
 * geschehen ist - nur fuer den Test, im Betrieb interessiert es niemanden.
 */
export function setAudioSessionType(type: AudioSessionType): boolean {
  if (typeof navigator === 'undefined') return false;

  const session = (navigator as NavigatorMitSitzung).audioSession;
  if (!session) return false;

  try {
    session.type = type;
    return true;
  } catch {
    // Eine aeltere Fassung der API oder ein abgelehnter Wert. Der Ton laeuft
    // dann wie bisher: bei gesetztem Klingelschalter stumm, sonst hoerbar.
    return false;
  }
}
