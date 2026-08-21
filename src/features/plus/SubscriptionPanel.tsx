import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { SkeletonList } from '@/components/SkeletonList';
import { colors, radius, spacing } from '@/design/tokens';
import { formatDate, portalErrorCode, subscriptionView } from '@/features/plus/plus';
import { usePortal, useSubscription } from '@/features/plus/usePlus';
import { openExternalUrl } from '@/lib/externalLink';

// Der Vertrag, wie ihn der Nutzer sieht: Tarif, bis wann, und ein Weg ins
// Kundenportal.
//
// Gekuendigt wird NICHT hier, sondern bei Stripe (SAD §4.6). Das ist keine
// Bequemlichkeit: was im Portal passiert, kommt als Ereignis ueber den Webhook
// zurueck und schreibt dieselbe Tabelle wie jede andere Aenderung. Ein eigener
// Kuendigen-Knopf waere ein zweiter Weg zu demselben Zustand - und damit die
// naechste Stelle, an der Stripe und wir auseinanderlaufen koennen.
export function SubscriptionPanel() {
  const { t } = useTranslation();
  const subscription = useSubscription();
  const portal = usePortal();

  if (subscription.isPending) return <SkeletonList />;

  // Ein Fehler beim Lesen ist keine Aussage ueber den Vertrag - also wird auch
  // keine getroffen. "Kein Abo" waere hier die falsche Auskunft.
  if (subscription.isError) {
    return (
      <View style={styles.section}>
        <Text style={styles.heading}>{t('konto.abo.titel')}</Text>
        <Text role="alert" style={styles.error}>
          {t('errors:konto.aboUnbekannt')}
        </Text>
      </View>
    );
  }

  const view = subscriptionView(subscription.data);
  const zumPortal = () => portal.mutate(undefined, { onSuccess: (url) => openExternalUrl(url) });

  // Das Kundenportal gehoert Stripe. Ein Abo, das nie durch einen Checkout
  // gelaufen ist - von Hand im Studio angelegt, provider = 'manual' (SAD §4.6)
  // -, hat dort keinen Kunden und damit kein Portal. Frueher stand der Knopf
  // trotzdem da und lieferte verlaesslich einen Fehler; jetzt steht an seiner
  // Stelle die Erklaerung.
  const hatStripeKunden = Boolean(subscription.data?.stripe_customer_id);

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t('konto.abo.titel')}</Text>

      <View style={styles.card}>
        {view.state === 'none' ? (
          <>
            <Text style={styles.status}>{t('konto.abo.keins')}</Text>
            <Text style={styles.body}>{t('konto.abo.keinsText')}</Text>
            <Link href="/plus" style={styles.link}>
              {t('konto.abo.zuPlus')}
            </Link>
          </>
        ) : (
          <>
            <Text style={styles.status}>{t(`konto.abo.plan.${view.plan}`)}</Text>

            {view.state === 'active' ? (
              <Text style={styles.body}>
                {t('konto.abo.laeuft', { datum: formatDate(view.until) })}
              </Text>
            ) : null}

            {view.state === 'ending' ? (
              <Text style={styles.body}>
                {t('konto.abo.endet', { datum: formatDate(view.until) })}
              </Text>
            ) : null}

            {view.state === 'ended' ? (
              <Text style={styles.body}>
                {t('konto.abo.beendet', { datum: formatDate(view.until) })}
              </Text>
            ) : null}

            {view.state === 'problem' ? (
              <Text style={styles.body}>{t('konto.abo.zahlungsproblem')}</Text>
            ) : null}

            <Text style={styles.body}>{t('konto.abo.sequenzenBleiben')}</Text>

            {hatStripeKunden ? (
              <Button
                label={portal.isPending ? t('konto.abo.portalPending') : t('konto.abo.portal')}
                onPress={zumPortal}
                disabled={portal.isPending}
              />
            ) : (
              <Text style={styles.body}>{t('konto.abo.ohneStripe')}</Text>
            )}

            {view.state === 'ended' ? (
              <Link href="/plus" style={styles.link}>
                {t('konto.abo.zuPlus')}
              </Link>
            ) : null}
          </>
        )}

        {portal.isError ? (
          <Text role="alert" style={styles.error}>
            {t(`errors:konto.portal.${portalErrorCode(portal.error)}`)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink900,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  status: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink900,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink700,
  },
  link: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ocean700,
  },
  error: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.danger,
  },
});
