import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { QueryBoundary } from '@/components/QueryBoundary';
import { colors, radius, spacing } from '@/design/tokens';
import { usePlusAccess } from '@/features/configurator/useSequences';
import { useConsents } from '@/features/consents/useConsents';
import { formatShort } from '@/features/habits/format';
import { toIsoDate } from '@/features/habits/dates';
import { useHabitCatalog, useMyHabits } from '@/features/habits/useHabits';

import { METRICS, type WearableProvider } from './series';
import {
  useConnectWearable,
  useDisconnectWearable,
  useFinishWearable,
  useGarminPersonalImport,
  useSyncWearables,
  useWearableConnections,
  wearableErrorKey,
  WearableActionError,
  type WearableConnection,
} from './useWearables';

const PROVIDERS: WearableProvider[] = ['oura', 'garmin'];

/**
 * Geraete verbinden und trennen (0053, nur Testsystem). Hierher springt auch
 * der Anbieter nach der Freigabe zurueck - mit ?code=&state= in der Adresse,
 * die diese Seite mit der Sitzung der Person einloest.
 */
export function WearableDevices() {
  const { t } = useTranslation();
  const consents = useConsents();

  return (
    <View style={styles.stack}>
      <Text style={styles.text}>{t('wearables.devices.intro')}</Text>
      <QueryBoundary query={consents}>
        {(list) =>
          list.find((c) => c.definition.kind === 'health_data')?.granted ? (
            <WithConsent />
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('wearables.devices.consentTitle')}</Text>
              <Text style={styles.text}>{t('wearables.devices.consentText')}</Text>
              <Link href="/habit-tracker" style={styles.link}>
                {t('wearables.devices.consentAction')}
              </Link>
            </View>
          )
        }
      </QueryBoundary>
    </View>
  );
}

function WithConsent() {
  const { t } = useTranslation();
  const connections = useWearableConnections();
  const returned = useReturnFromProvider();

  return (
    <>
      {returned.message ? (
        <View style={[styles.notice, returned.failed && styles.noticeError]}>
          <Text style={styles.text}>{returned.message}</Text>
        </View>
      ) : null}
      <QueryBoundary query={connections}>
        {(list) => (
          <>
            {PROVIDERS.map((provider) => (
              <ProviderCard
                key={provider}
                provider={provider}
                connection={list.find((c) => c.provider === provider) ?? null}
              />
            ))}
          </>
        )}
      </QueryBoundary>
      <FilledHabits />
      <Text style={styles.meta}>{t('wearables.devices.privacy')}</Text>
    </>
  );
}

/** Den Code vom Anbieter genau einmal einloesen und die Adresse aufraeumen. */
function useReturnFromProvider(): { message: string | null; failed: boolean } {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; state?: string; error?: string }>();
  const finish = useFinishWearable();
  const handled = useRef(false);
  // Abgelehnt beim Anbieter: nur beim ersten Aufruf der Seite aus der Adresse lesen.
  const [denied] = useState(() => Boolean(params.error));

  useEffect(() => {
    if (handled.current) return;
    if (params.code && params.state) {
      handled.current = true;
      finish.mutate({ code: params.code, state: params.state });
    } else if (!params.error) {
      return;
    }
    handled.current = true;
    // Code und state nicht in der Adresse stehen lassen (Verlauf, Teilen).
    router.setParams({ code: '', state: '', error: '' });
  }, [params.code, params.state, params.error, finish, router]);

  if (finish.isPending) return { message: t('wearables.devices.finishing'), failed: false };
  if (finish.isError) return { message: t(wearableErrorKey(finish.error)), failed: true };
  if (finish.data) {
    return {
      message: t('wearables.devices.connected', { provider: t(`wearables.provider.${finish.data.connected}`) }),
      failed: false,
    };
  }
  if (denied) return { message: t(wearableErrorKey(new WearableActionError('denied'))), failed: true };
  return { message: null, failed: false };
}

function ProviderCard({ provider, connection }: { provider: WearableProvider; connection: WearableConnection | null }) {
  const { t } = useTranslation();
  const connect = useConnectWearable();
  const sync = useSyncWearables();
  const disconnect = useDisconnectWearable();
  const [confirming, setConfirming] = useState(false);
  const name = t(`wearables.provider.${provider}`);
  const error = connect.error ?? sync.error ?? disconnect.error;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.cardTitle}>{name}</Text>
        <Text style={connection ? styles.statusOn : styles.status}>
          {connection ? t('wearables.devices.statusOn') : t('wearables.devices.statusOff')}
        </Text>
      </View>
      <Text style={styles.text}>{t(`wearables.devices.about.${provider}`)}</Text>

      {connection ? (
        <>
          <Text style={styles.meta}>
            {[
              t('wearables.devices.since', { date: formatShort(toIsoDate(new Date(connection.connected_at))) }),
              connection.last_synced_at
                ? t('wearables.devices.lastSync', { date: formatShort(toIsoDate(new Date(connection.last_synced_at))) })
                : t('wearables.devices.neverSynced'),
            ].join(' · ')}
          </Text>
          {connection.last_error ? (
            <Text style={styles.errorText}>
              {t(wearableErrorKey(new WearableActionError(connection.last_error)))}
            </Text>
          ) : null}
          <View style={styles.actions}>
            {provider === 'oura' ? (
              <Button
                label={sync.isPending ? t('wearables.devices.syncing') : t('wearables.devices.sync')}
                disabled={sync.isPending}
                onPress={() => sync.mutate()}
              />
            ) : null}
            {confirming ? (
              <>
                <Button
                  label={t('wearables.devices.disconnectConfirm')}
                  danger
                  disabled={disconnect.isPending}
                  onPress={() => disconnect.mutate(provider, { onSettled: () => setConfirming(false) })}
                />
                <Button label={t('wearables.devices.cancel')} quiet onPress={() => setConfirming(false)} />
              </>
            ) : (
              <Button label={t('wearables.devices.disconnect')} quiet onPress={() => setConfirming(true)} />
            )}
          </View>
          {confirming ? <Text style={styles.meta}>{t('wearables.devices.disconnectHint', { provider: name })}</Text> : null}
        </>
      ) : (
        <View style={styles.actions}>
          <Button
            label={t('wearables.devices.connect', { provider: name })}
            disabled={connect.isPending}
            onPress={() => connect.mutate(provider)}
          />
        </View>
      )}
      {error ? <Text style={styles.errorText}>{t(wearableErrorKey(error))}</Text> : null}
      {provider === 'garmin' ? <GarminPersonalImport /> : null}
    </View>
  );
}

/**
 * Letzte 30 Tage mit dem persoenlichen Garmin-Schluessel (Test, erster
 * Import). Der Schluessel bleibt nur im Feld und wird nach dem Laden geleert.
 */
function GarminPersonalImport() {
  const { t } = useTranslation();
  const load = useGarminPersonalImport();
  const [apiKey, setApiKey] = useState('');
  const trimmed = apiKey.trim();

  const done = load.data
    ? METRICS.filter((m) => (load.data.imported[m] ?? 0) > 0)
        .map((m) => t('wearables.devices.personal.item', { metric: t(`wearables.metric.${m}`), count: load.data.imported[m] }))
        .join(', ')
    : null;

  return (
    <View style={styles.personal}>
      <Text style={styles.subTitle}>{t('wearables.devices.personal.title')}</Text>
      <Text style={styles.meta}>{t('wearables.devices.personal.text')}</Text>
      <TextInput
        value={apiKey}
        onChangeText={setApiKey}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        aria-label={t('wearables.devices.personal.label')}
        placeholder={t('wearables.devices.personal.placeholder')}
        placeholderTextColor={colors.ink500}
        style={styles.input}
      />
      <View style={styles.actions}>
        <Button
          label={load.isPending ? t('wearables.devices.personal.loading') : t('wearables.devices.personal.action')}
          disabled={load.isPending || trimmed.length < 8}
          onPress={() => load.mutate(trimmed, { onSettled: () => setApiKey('') })}
        />
      </View>
      {done ? <Text style={styles.text}>{t('wearables.devices.personal.done', { list: done })}</Text> : null}
      {load.error ? <Text style={styles.errorText}>{t(wearableErrorKey(load.error))}</Text> : null}
    </View>
  );
}

/** Welche Habits automatisch gefuellt werden - und ob sie gewaehlt sind. */
function FilledHabits() {
  const { t } = useTranslation();
  const catalog = useHabitCatalog();
  const myHabits = useMyHabits();
  const plus = usePlusAccess();

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('wearables.devices.habitsTitle')}</Text>
      <Text style={styles.text}>{t('wearables.devices.habitsText')}</Text>
      <QueryBoundary query={catalog}>
        {({ templates }) => (
          <QueryBoundary query={myHabits}>
            {(habits) => {
              const filled = templates.filter((tpl) => tpl.wearable_metric !== null && tpl.owner_id === null);
              return (
                <View style={styles.list}>
                  {filled.map((tpl) => {
                    const chosen = habits.some((h) => h.is_active && h.template_id === tpl.id);
                    return (
                      <View key={tpl.id} style={styles.head}>
                        <Text style={styles.text}>{tpl.title}</Text>
                        <Text style={chosen ? styles.statusOn : styles.status}>
                          {chosen ? t('wearables.devices.habitChosen') : t('wearables.devices.habitNotChosen')}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            }}
          </QueryBoundary>
        )}
      </QueryBoundary>
      <QueryBoundary query={plus}>
        {(hasPlus) => (hasPlus ? null : <Text style={styles.meta}>{t('wearables.devices.plusHint')}</Text>)}
      </QueryBoundary>
      <Link href="/habit-tracker/auswahl" style={styles.link}>
        {t('wearables.devices.toPicker')}
      </Link>
      <Text style={styles.meta}>{t('wearables.devices.manualWins')}</Text>
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled,
  danger,
  quiet,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  quiet?: boolean;
}) {
  return (
    <PressableRing
      onPress={onPress}
      disabled={disabled}
      role="button"
      style={[styles.button, quiet && styles.buttonQuiet, danger && styles.buttonDanger, disabled && styles.buttonDisabled]}
    >
      <Text style={[styles.buttonText, quiet && styles.buttonTextQuiet]}>{label}</Text>
    </PressableRing>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  list: {
    gap: 6,
  },
  personal: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink900,
  },
  input: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    fontSize: 14,
    color: colors.ink900,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink900,
  },
  text: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink700,
  },
  meta: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.ink700,
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink700,
  },
  statusOn: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.sage700,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
  notice: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.oceanTint,
  },
  noticeError: {
    borderColor: colors.danger,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    backgroundColor: colors.ocean700,
  },
  buttonQuiet: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  buttonDanger: {
    backgroundColor: colors.danger,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.surface,
  },
  buttonTextQuiet: {
    color: colors.ink900,
  },
});
