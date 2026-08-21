import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { QueryBoundary } from '@/components/QueryBoundary';
import { colors, radius, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatAmount, subscriptionView, yearlySavingPercent } from '@/features/plus/plus';
import { usePlusCheckout, usePrices, useSubscription, type PlanPrice } from '@/features/plus/usePlus';
import { openExternalUrl } from '@/lib/externalLink';

// Die Preisseite.
//
// Sie verkauft eine Faehigkeit, keinen Inhalt (SAD §3.4): der Konfigurator ist
// auch ohne Konto sichtbar und bedienbar, gesperrt ist allein das Speichern.
// Deshalb steht hier kein "jetzt freischalten und endlich loslegen", sondern
// was tatsaechlich dazukommt.
//
// Es gibt keinen Testzeitraum (CLAUDE.md §Zugriff). Was es stattdessen gibt,
// steht als Satz auf der Seite - das ist ehrlicher als ein Sternchen.
export function PlusPricing() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const prices = usePrices();
  const subscription = useSubscription();
  const checkout = usePlusCheckout();

  const view = subscriptionView(subscription.data);
  const laeuft = view.state === 'active' || view.state === 'ending';

  return (
    <View style={styles.container}>
      <Text style={styles.lead}>{t('plus.lead')}</Text>

      <View style={styles.features}>
        {['konfigurator', 'unbegrenzt', 'bleibt'].map((key) => (
          <Text key={key} style={styles.feature}>
            {t(`plus.feature.${key}`)}
          </Text>
        ))}
      </View>

      {laeuft ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('plus.schonAktiv.titel')}</Text>
          <Text style={styles.body}>{t('plus.schonAktiv.text')}</Text>
          <Link href="/konto" style={styles.link}>
            {t('plus.schonAktiv.link')}
          </Link>
        </View>
      ) : (
        // Faellt get-prices aus, sagt QueryBoundary das - statt eine Seite mit
        // leeren Betraegen zu zeigen. Ein Preis, der fehlt, ist besser als
        // einer, der geraten ist.
        <QueryBoundary query={prices} empty={{ title: t('plus.keinePreise.titel'), hint: t('plus.keinePreise.hinweis') }}>
          {(liste) => {
            const sparen = yearlySavingPercent(liste);

            return (
              <View style={styles.plans}>
                {liste.map((price) => (
                  <PlanCard
                    key={price.plan}
                    price={price}
                    hervorgehoben={price.plan === 'yearly'}
                    sparen={price.plan === 'yearly' ? sparen : null}
                    angemeldet={Boolean(session)}
                    pending={checkout.isPending}
                    onStart={() =>
                      checkout.mutate(price.plan, { onSuccess: (url) => openExternalUrl(url) })
                    }
                  />
                ))}
              </View>
            );
          }}
        </QueryBoundary>
      )}

      {checkout.isError ? (
        <Text role="alert" style={styles.error}>
          {t('errors:plus.checkout')}
        </Text>
      ) : null}

      <Text style={styles.smallprint}>{t('plus.kleingedrucktes')}</Text>
      <Text style={styles.smallprint}>{t('plus.kleinunternehmer')}</Text>

      {/* Der Hinweis auf das erloeschende Ruecktrittsrecht steht VOR dem Kauf,
          nicht erst im Checkout: § 4 FAGG verlangt die Information vor
          Vertragsabschluss, der Haken bei Stripe ist die Bestaetigung danach.
          Zwei Stellen, zwei verschiedene Pflichten (T19a). */}
      <Text style={styles.smallprint}>{t('plus.widerruf')}</Text>
    </View>
  );
}

function PlanCard({
  price,
  hervorgehoben,
  sparen,
  angemeldet,
  pending,
  onStart,
}: {
  price: PlanPrice;
  hervorgehoben: boolean;
  sparen: number | null;
  angemeldet: boolean;
  pending: boolean;
  onStart: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={[styles.card, styles.plan, hervorgehoben && styles.planHighlight]}>
      <Text style={styles.planName}>{t(`plus.plan.${price.plan}`)}</Text>
      <Text style={styles.planPrice}>{formatAmount(price.amountCents, price.currency)}</Text>
      <Text style={styles.planInterval}>{t(`plus.interval.${price.plan}`)}</Text>

      {sparen !== null ? <Text style={styles.saving}>{t('plus.sparen', { prozent: sparen })}</Text> : null}

      {angemeldet ? (
        <Button
          label={pending ? t('plus.wirdGeoeffnet') : t('plus.waehlen')}
          onPress={onStart}
          disabled={pending}
          block
        />
      ) : (
        <>
          <Text style={styles.body}>{t('plus.anmeldenText')}</Text>
          <Link href="/konto" style={styles.link}>
            {t('plus.anmeldenLink')}
          </Link>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  lead: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.ink700,
  },
  features: {
    gap: spacing.sm,
  },
  feature: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink900,
  },
  plans: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  plan: {
    flexGrow: 1,
    flexBasis: 240,
  },
  planHighlight: {
    borderColor: colors.ocean700,
  },
  planName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink700,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
  },
  planInterval: {
    fontSize: 13,
    color: colors.ink700,
  },
  saving: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.sage700,
  },
  cardTitle: {
    fontSize: 18,
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
  smallprint: {
    fontSize: 12,
    lineHeight: 20,
    color: colors.ink700,
  },
});
