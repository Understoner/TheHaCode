import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { PressableRing } from '@/components/PressableRing';
import { colors, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { AgbConsent } from '@/features/courses/AgbConsent';
import { availabilityOf, bookingErrorCode, formatPrice } from '@/features/courses/booking';
import { GuestBookingForm } from '@/features/courses/GuestBookingForm';
import { useCourseCheckout, useMyBookings } from '@/features/courses/useCourseBooking';
import { openExternalUrl } from '@/lib/externalLink';
import type { Course } from '@/features/courses/useCoursesList';

// Der Buchungsteil einer Kurskarte.
//
// WAS HIER NICHT ENTSCHIEDEN WIRD: der Preis, die Anzahlung und ob ueberhaupt
// noch ein Platz frei ist. Das steht alles in der Datenbank und wird von
// reserve_course_seat() unter Sperre entschieden (Migration 0011). Diese
// Komponente sagt dem Nutzer nur vorher, was er sonst erst im Checkout
// erfuehre - wer sie umgeht, bekommt vom Server dieselbe Absage.
//
// Der Haken bei den AGB ist keine Zierde: § 11 AGB macht die Anmeldung erst
// mit der Bestaetigung verbindlich, und das traegt nur, wenn die AGB
// einbezogen wurden. Der Zeitpunkt landet in course_bookings.agb_accepted_at.
//
// ZWEI WEGE ZUM SELBEN CHECKOUT (seit 06.09.2026)
// -----------------------------------------------
// Angemeldet: Haken setzen, buchen - die Adresse steht schon im Konto.
// Ohne Konto: Name und Adresse dazu, sonst derselbe Weg (GuestBookingForm).
// Frueher stand hier statt des zweiten Wegs ein Verweis auf die Anmeldung. Das
// war eine Huerde ohne Gegenwert: die App bietet einem Kursteilnehmer nichts,
// wofuer er ein Konto braeuchte. Der Verweis steht weiterhin darunter - wer
// eines hat, soll es benutzen, dann taucht die Buchung spaeter im Konto auf.
//
// ERST AUF KLICK (06.09.2026, nachgezogen)
// ----------------------------------------
// Das Formular stand zunaechst offen auf jeder Kurskarte. Bei einem einzelnen
// Kurs faellt das nicht auf; in der Uebersicht stehen siebzehn Termine
// untereinander, und jeder trug zwei Eingabefelder, einen Hinweis, einen Haken
// mit zwei Verweisen und einen Knopf. Die Liste war nicht mehr ueberblickbar -
// man scrollte an Kursen vorbei, statt sie zu vergleichen.
//
// Jetzt steht auf der Karte nur der Knopf. Wer ihn drueckt, bekommt darunter,
// was er zum Buchen braucht - und zwar bei genau diesem einen Kurs.
//
// Das gilt fuer BEIDE Wege, auch fuer Angemeldete: sonst haette die Karte je
// nach Anmeldezustand zwei verschiedene Bauformen, und der Haken bei den AGB
// nimmt mit seinen zwei Verweisen ebenfalls Platz. Rechtlich aendert sich
// nichts - der Haken kommt weiterhin vor der Buchung, nur einen Klick spaeter.
export function CourseBooking({ course, seatsLeft }: { course: Course; seatsLeft: number | null }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const bookings = useMyBookings();
  const checkout = useCourseCheckout();

  // Zugeklappt, bis jemand buchen will. Siehe den Kommentar bei der Anzeige.
  const [offen, setOffen] = useState(false);
  const [agb, setAgb] = useState(false);
  // Gesetzt, wenn jemand ohne Haken auf "Buchen" drueckt. Siehe start().
  const [hakenFehlt, setHakenFehlt] = useState(false);

  const availability = availabilityOf(seatsLeft);
  const price = course.price_cents;

  // Ohne Preis ist der Kurs nicht buchbar - die Datenbank laesst
  // booking_enabled dann gar nicht erst zu (chk_courses_booking_needs_price).
  if (!course.booking_enabled || price === null) return null;

  const existing = (bookings.data ?? []).find(
    (booking) =>
      booking.course_id === course.id &&
      (booking.status === 'confirmed' || booking.status === 'reserved'),
  );

  const deposit = course.deposit_cents;

  // WARUM DER KNOPF NICHT GESPERRT IST
  // ----------------------------------
  // Er war es, und das war ein Fehler: ohne Haken sah er aus wie ein Knopf,
  // liess sich druecken - und tat nichts. Wer den Haken uebersehen hatte,
  // bekam keinerlei Auskunft, warum die Buchung nicht losgeht. Genau das ist
  // beim Test auf dev passiert ("Buchungslink ist nicht auswaehlbar").
  //
  // Jetzt loest er aus und sagt, was fehlt - dieselbe Machart wie im
  // Registrierungsformular, wo die Pflichtangabe auch erst beim Absenden
  // gemeldet wird. Ein gesperrter Knopf ohne Begruendung ist keine
  // Handlungsoption (CLAUDE.md §Immer).
  const start = () => {
    if (!agb) {
      setHakenFehlt(true);
      return;
    }
    setHakenFehlt(false);
    checkout.mutate({ courseSlug: course.slug }, { onSuccess: (url) => openExternalUrl(url) });
  };

  // Derselbe Text auf beiden Wegen: "Buchen und 200,00 anzahlen", wenn der
  // Kurs eine Anzahlung verlangt, sonst "Verbindlich buchen".
  const aktion =
    deposit !== null
      ? t('kurse.buchung.anzahlenAktion', { betrag: formatPrice(deposit) })
      : t('kurse.buchung.buchenAktion');

  return (
    <View style={styles.container}>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatPrice(price)}</Text>
        {deposit !== null ? (
          <Text style={styles.hint}>{t('kurse.buchung.anzahlung', { betrag: formatPrice(deposit) })}</Text>
        ) : null}
      </View>

      {availability.seatsLeft !== null ? (
        <Text style={availability.scarce ? styles.scarce : styles.hint}>
          {availability.soldOut
            ? t('kurse.buchung.ausgebucht')
            : t('kurse.buchung.plaetze', { count: availability.seatsLeft })}
        </Text>
      ) : null}

      {existing?.status === 'confirmed' ? (
        <Text style={styles.confirmed}>{t('kurse.buchung.gebucht')}</Text>
      ) : availability.soldOut ? (
        <Text style={styles.hint}>{t('kurse.buchung.ausgebuchtHinweis')}</Text>
      ) : !offen ? (
        // Zugeklappt: nur der Knopf. Er verspricht nichts, was er nicht haelt -
        // "verbindlich" wird die Anmeldung erst mit der Bestaetigung im
        // naechsten Schritt (§ 11 AGB), und genau der kommt jetzt.
        <Button label={aktion} onPress={() => setOffen(true)} />
      ) : !session ? (
        <View style={styles.stack}>
          <GuestBookingForm courseSlug={course.slug} label={aktion} />

          <Text style={styles.hint}>
            {t('kurse.buchung.kontoText')}{' '}
            <Link href="/konto" style={styles.link}>
              {t('kurse.buchung.anmeldenLink')}
            </Link>
          </Text>

          <PressableRing onPress={() => setOffen(false)} style={styles.abbrechen}>
            <Text style={styles.abbrechenText}>{t('kurse.buchung.abbrechen')}</Text>
          </PressableRing>
        </View>
      ) : (
        <View style={styles.stack}>
          <AgbConsent
            checked={agb}
            onToggle={() => {
              setAgb((value) => !value);
              setHakenFehlt(false);
            }}
            error={hakenFehlt ? t('errors:buchung.agb_required') : undefined}
          />

          <Button
            label={checkout.isPending ? t('kurse.buchung.wirdGeoeffnet') : aktion}
            onPress={start}
            disabled={checkout.isPending}
          />

          {checkout.isError ? (
            <Text role="alert" style={styles.error}>
              {t(`errors:buchung.${bookingErrorCode(checkout.error)}`)}
            </Text>
          ) : null}

          <PressableRing onPress={() => setOffen(false)} style={styles.abbrechen}>
            <Text style={styles.abbrechenText}>{t('kurse.buchung.abbrechen')}</Text>
          </PressableRing>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  priceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  price: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink900,
  },
  stack: {
    gap: spacing.sm,
  },
  hint: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink700,
  },
  scarce: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.ink900,
  },
  confirmed: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.sage700,
  },
  error: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.danger,
  },
  link: {
    fontWeight: '600',
    color: colors.ocean700,
  },
  // Zurueck zur zugeklappten Karte. Bewusst zurueckhaltend: wer hier gelandet
  // ist, wollte buchen - der Weg heraus soll erreichbar sein, aber nicht mit
  // dem Knopf konkurrieren, der zum Ziel fuehrt.
  abbrechen: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  abbrechenText: {
    fontSize: 13,
    color: colors.ink700,
  },
});
