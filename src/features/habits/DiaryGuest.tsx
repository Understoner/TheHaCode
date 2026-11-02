import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { QueryBoundary } from '@/components/QueryBoundary';
import { moonPath } from '@/design/moon';
import { displayFont, responsive } from '@/design/responsive';
import { useThemePalette } from '@/design/theme';
import { colors, radius, spacing } from '@/design/tokens';
import { PlanTiers } from '@/features/plus/PlanTiers';

import { BOLT_SLUG } from './HabitDay';
import { AreaGlyph } from './HabitPicker';
import { useHabitCatalog } from './useHabits';

// Das Tagebuch fuer Gaeste (02.11.2026, nur Testsystem): statt einer Liste
// aller Vorlagen kleine Vorschauen auf das, was man mit Konto bekommt - ein
// Tag, die Auswertung, der BOLT-Wert, die Bibliothek - und am Ende der
// Vergleich ohne Konto / Konto / Plus.
//
// Die Bilder sind ausdruecklich Beispiele ("Beispiel"-Etikett) und keine
// Daten. Die Zahlen der Bibliothek kommen aus habit_templates.

const REGISTER = '/konto?modus=registrieren';

// Ein erfundener, aber plausibler Monat: wachsende Regelmaessigkeit.
const SAMPLE_MOONS = [
  0.2, 0, 0.4, 0.6, 0.3, 0, 0.5, 0.6, 0.8, 0.4, 1, 0.6, 0.3, 0.8, 0.6, 1, 0.8, 1, 0.4, 0.8, 1, 1, 0.8, 1, 0.6, 1, 1, 0.8,
];
const SAMPLE_WEEK = [0.5, 0.8, 0.6, 0.9, 0.55, 0.35, 0.7];
const SAMPLE_BLOOM = [1, 0.7, 0.85, 0.5, 0.65];
const SAMPLE_BOLT = [14, 15, 15, 17, 16, 18, 19, 18, 21, 22, 21, 24];

export function DiaryGuest() {
  const { t } = useTranslation();

  return (
    <View style={styles.stack}>
      <Hero />

      <View {...responsive('m-feature')} style={styles.split}>
        <Section title={t('guest.diary.day.title')} text={t('guest.diary.day.text')} />
        <DayPreview />
      </View>

      <Section title={t('guest.diary.insights.title')} text={t('guest.diary.insights.text')}>
        <View {...responsive('m-grid')} style={styles.grid}>
          <Tile title={t('guest.diary.insights.moons')} text={t('guest.diary.insights.moonsText')}>
            <MoonGrid />
          </Tile>
          <Tile title={t('guest.diary.insights.rhythm')} text={t('guest.diary.insights.rhythmText')}>
            <Wave />
          </Tile>
          <Tile title={t('guest.diary.insights.areas')} text={t('guest.diary.insights.areasText')}>
            <MiniBloom />
          </Tile>
        </View>
      </Section>

      <BoltTeaser />

      <Library />

      <View {...responsive('m-grid')} style={styles.grid}>
        <PlusCard title={t('guest.diary.paths.title')} text={t('guest.diary.paths.text')} icon="path" />
        <PlusCard title={t('guest.diary.own.title')} text={t('guest.diary.own.text')} icon="own" />
        <PlusCard title={t('guest.diary.auto.title')} text={t('guest.diary.auto.text')} icon="auto" />
      </View>

      <PlanTiers />
    </View>
  );
}

function Hero() {
  const { t } = useTranslation();
  const palette = useThemePalette();
  return (
    <View style={styles.hero}>
      {/* Mond und Sterne fest oben rechts - skaliert nicht mit der Breite mit. */}
      <Svg width={200} height={170} viewBox="0 0 200 170" style={styles.heroArt} aria-hidden>
        <Circle cx={130} cy={66} r={66} fill={palette.glow} opacity={0.06} />
        <G transform="translate(130 66)">
          <Circle r={26} fill={palette.line} />
          <Path d={moonPath(0.7, 26)} fill={palette.glow} />
        </G>
        {[
          [24, 30, 1.2],
          [60, 120, 1],
          [186, 140, 1.1],
          [40, 76, 0.8],
        ].map(([x, y, r]) => (
          <Circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={palette.ink900} opacity={0.6} />
        ))}
      </Svg>
      <Text style={styles.kicker}>{t('guest.diary.hero.kicker')}</Text>
      <Text role="heading" aria-level={2} {...displayFont} style={styles.heroTitle}>
        {t('guest.diary.hero.title')}
      </Text>
      <Text style={styles.heroText}>{t('guest.diary.hero.text')}</Text>
      <View style={styles.actions}>
        <Link href={REGISTER as never} style={styles.primary}>
          {t('guest.diary.hero.register')}
        </Link>
        <Link href="/konto" style={styles.secondary}>
          {t('guest.diary.hero.signIn')}
        </Link>
      </View>
    </View>
  );
}

function Section({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text role="heading" aria-level={2} {...displayFont} style={styles.sectionTitle}>
        {title}
      </Text>
      <Text style={styles.sectionText}>{text}</Text>
      {children}
    </View>
  );
}

function Sample() {
  const { t } = useTranslation();
  return <Text style={styles.sample}>{t('guest.diary.sample')}</Text>;
}

function Tile({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileHead}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Sample />
      </View>
      <View style={styles.tileArt} aria-hidden>
        {children}
      </View>
      <Text style={styles.tileText}>{text}</Text>
    </View>
  );
}

/** Ein Tag im Tagebuch, wie er mit Konto aussieht - nur zum Ansehen. */
function DayPreview() {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <View style={styles.day} aria-label={t('guest.diary.day.label')}>
      <View style={styles.dayHead}>
        <Svg width={76} height={76} viewBox="-38 -38 76 76" aria-hidden>
          <Circle r={r} fill="none" stroke={palette.line} strokeWidth={6} />
          <Circle r={r} fill="none" stroke={palette.glow} strokeWidth={6} strokeDasharray={`${c * 0.66} ${c}`} strokeLinecap="round" transform="rotate(-90)" />
        </Svg>
        <View style={styles.dayRingText}>
          <Text {...displayFont} style={styles.dayPoints}>
            13
          </Text>
          <Text style={styles.dayPointsLabel}>{t('diary.today.points')}</Text>
        </View>
        <View style={styles.grow} />
        <Sample />
      </View>
      <DayRow title={t('guest.diary.day.row1')} checked points="+3" />
      <DayRow title={t('guest.diary.day.row2')} points="+10" action={`▸ ${t('diary.entry.start')}`} />
      <DayRow title={t('guest.diary.day.row3')} value={t('guest.diary.day.row3Value')} />
    </View>
  );
}

function DayRow({ title, checked, points, action, value }: { title: string; checked?: boolean; points?: string; action?: string; value?: string }) {
  const palette = useThemePalette();
  return (
    <View style={[styles.dayRow, checked && styles.dayRowOn]}>
      <View style={[styles.tick, checked && styles.tickOn]}>
        {checked ? (
          <Svg width={14} height={14} viewBox="0 0 24 24" aria-hidden>
            <Path d={CHECK} fill="none" stroke={palette.surface} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        ) : null}
      </View>
      <Text style={styles.dayTitle} numberOfLines={2}>
        {title}
      </Text>
      {action ? <Text style={styles.pill}>{action}</Text> : null}
      {value ? <Text style={styles.dayValue}>{value}</Text> : null}
      {points ? <Text style={styles.points}>{points}</Text> : null}
    </View>
  );
}

const CHECK = 'M5 12.5l4.5 4.5L19 7.5';

function MoonGrid() {
  const palette = useThemePalette();
  const size = 26;
  return (
    <Svg width={7 * size} height={4 * size} viewBox={`0 0 ${7 * size} ${4 * size}`}>
      {SAMPLE_MOONS.map((p, i) => (
        <G key={i} transform={`translate(${(i % 7) * size + size / 2} ${Math.floor(i / 7) * size + size / 2})`}>
          <Circle r={9} fill={palette.line} />
          <Path d={moonPath(p, 9)} fill={palette.glow} />
        </G>
      ))}
    </Svg>
  );
}

function Wave() {
  const palette = useThemePalette();
  const W = 200;
  const H = 90;
  const pts = SAMPLE_WEEK.map((v, i) => ({ x: 10 + (i * (W - 20)) / 6, y: H - 12 - v * (H - 30) }));
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  const best = pts[3];
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Path d={`${d} L ${pts[6].x} ${H} L ${pts[0].x} ${H} Z`} fill={palette.sage700} opacity={0.15} />
      <Path d={d} fill="none" stroke={palette.sage700} strokeWidth={2.5} strokeLinecap="round" />
      <Circle cx={best.x} cy={best.y} r={8} fill={palette.glow} opacity={0.25} />
      <Circle cx={best.x} cy={best.y} r={4.5} fill={palette.glow} />
    </Svg>
  );
}

function MiniBloom() {
  const palette = useThemePalette();
  const tones = [palette.glow, palette.sage700, palette.blossom, palette.ink700, palette.glow];
  const n = SAMPLE_BLOOM.length;
  return (
    <Svg width={110} height={110} viewBox="-55 -55 110 110">
      {SAMPLE_BLOOM.map((share, i) => {
        const len = 18 + share * 32;
        const w = 14;
        return (
          <Path
            key={i}
            d={`M0 0 C ${-w} ${-len * 0.35}, ${-w * 0.6} ${-len * 0.85}, 0 ${-len} C ${w * 0.6} ${-len * 0.85}, ${w} ${-len * 0.35}, 0 0 Z`}
            transform={`rotate(${(360 / n) * i})`}
            fill={tones[i]}
            opacity={0.35 + share * 0.55}
          />
        );
      })}
      <Circle r={5} fill={palette.glow} />
    </Svg>
  );
}

function BoltTeaser() {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const W = 260;
  const H = 90;
  const min = Math.min(...SAMPLE_BOLT) - 2;
  const max = Math.max(...SAMPLE_BOLT) + 2;
  const pts = SAMPLE_BOLT.map((v, i) => [10 + (i * (W - 20)) / (SAMPLE_BOLT.length - 1), H - 10 - ((v - min) / (max - min)) * (H - 20)]);
  const last = pts[pts.length - 1];
  return (
    <View style={styles.bolt}>
      <View style={styles.boltText}>
        <Text style={styles.free}>{t('guest.diary.bolt.badge')}</Text>
        <Text role="heading" aria-level={2} {...displayFont} style={styles.sectionTitle}>
          {t('guest.diary.bolt.title')}
        </Text>
        <Text style={styles.sectionText}>{t('guest.diary.bolt.text')}</Text>
        <Link href={REGISTER as never} style={styles.secondary}>
          {t('guest.diary.bolt.action')}
        </Link>
      </View>
      <View style={styles.boltArt} aria-hidden>
        <Sample />
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <Path d={pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')} fill="none" stroke={palette.sage700} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {pts.map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={2.6} fill={palette.glow} />
          ))}
          <Circle cx={last[0]} cy={last[1]} r={9} fill={palette.glow} opacity={0.25} />
        </Svg>
        <Text style={styles.boltValue}>{t('guest.diary.bolt.value', { seconds: SAMPLE_BOLT[SAMPLE_BOLT.length - 1] })}</Text>
      </View>
    </View>
  );
}

/** Die Bibliothek der Vorlagen: Bereiche mit Anzahl und ein paar Namen. */
function Library() {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const catalog = useHabitCatalog();

  return (
    <QueryBoundary query={catalog}>
      {({ categories, templates }) => {
        const shared = templates.filter((tpl) => tpl.owner_id === null && tpl.is_published);
        const areas = categories
          .map((c) => ({ category: c, items: shared.filter((tpl) => tpl.category_id === c.id) }))
          .filter((a) => a.items.length > 0);
        return (
          <Section
            title={t('guest.diary.library.title', { count: shared.length })}
            text={t('guest.diary.library.text', { areas: areas.length })}
          >
            <View {...responsive('m-grid')} style={styles.grid}>
              {areas.map(({ category, items }) => (
                <View key={category.id} style={styles.area}>
                  <View style={styles.areaHead}>
                    <AreaGlyph slug={category.slug} color={palette.ocean700} />
                    <Text style={styles.areaTitle}>{category.title}</Text>
                    <Text style={styles.areaCount}>{items.length}</Text>
                  </View>
                  {items.slice(0, 3).map((tpl) => (
                    <View key={tpl.id} style={styles.areaRow}>
                      <Text style={styles.areaItem} numberOfLines={1}>
                        {tpl.title}
                      </Text>
                      {tpl.slug === BOLT_SLUG || tpl.is_preview ? <Text style={styles.freeSmall}>{t('guest.diary.library.free')}</Text> : null}
                    </View>
                  ))}
                  {items.length > 3 ? <Text style={styles.areaMore}>{t('guest.diary.library.more', { count: items.length - 3 })}</Text> : null}
                </View>
              ))}
            </View>
          </Section>
        );
      }}
    </QueryBoundary>
  );
}

const PLUS_ICON: Record<string, string> = {
  path: 'M5 19c3-1 4-4 7-4s4 2 7 0M5 12c3-1 4-4 7-4s4 2 7 0M12 4v.01',
  own: 'M12 5v14M5 12h14',
  auto: 'M8 5.5v13l10-6.5z',
};

function PlusCard({ title, text, icon }: { title: string; text: string; icon: keyof typeof PLUS_ICON }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  return (
    <View style={styles.plusCard}>
      <View style={styles.areaHead}>
        <Svg width={22} height={22} viewBox="0 0 24 24" aria-hidden>
          <Path d={PLUS_ICON[icon]} fill="none" stroke={palette.ocean700} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={styles.grow} />
        <Text style={styles.plusBadge}>{t('guest.diary.plusBadge')}</Text>
      </View>
      <Text {...displayFont} style={styles.plusTitle}>
        {title}
      </Text>
      <Text style={styles.tileText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  heroArt: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  grow: {
    flex: 1,
  },
  grid: {
    gap: spacing.sm,
  },
  split: {
    gap: spacing.md,
  },
  hero: {
    gap: spacing.sm,
    paddingTop: 28,
    paddingBottom: 26,
    paddingHorizontal: 20,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.ocean700,
    backgroundColor: colors.oceanImageBg,
    overflow: 'hidden',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.ocean700,
  },
  heroTitle: {
    maxWidth: 520,
    paddingRight: 60,
    fontSize: 32,
    lineHeight: 37,
    color: colors.ink900,
  },
  heroText: {
    maxWidth: 560,
    fontSize: 15,
    lineHeight: 23,
    color: colors.ink700,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  primary: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radius.full,
    backgroundColor: colors.ocean700,
    fontSize: 15,
    fontWeight: '800',
    color: colors.background,
    textDecorationLine: 'none',
  },
  secondary: {
    alignSelf: 'flex-start',
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.ocean700,
    fontSize: 14,
    fontWeight: '800',
    color: colors.ocean700,
    textDecorationLine: 'none',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 24,
    lineHeight: 29,
    color: colors.ink900,
  },
  sectionText: {
    maxWidth: 620,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink700,
  },
  sample: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.ink700,
  },
  tile: {
    gap: spacing.sm,
    padding: 16,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  tileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  tileTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink900,
  },
  tileArt: {
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink700,
  },
  day: {
    gap: spacing.sm,
    padding: 14,
    borderRadius: 24,
    backgroundColor: colors.surface,
    maxWidth: 560,
    width: '100%',
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dayRingText: {
    position: 'absolute',
    left: 0,
    width: 76,
    alignItems: 'center',
  },
  dayPoints: {
    fontSize: 22,
    lineHeight: 24,
    color: colors.ink900,
  },
  dayPointsLabel: {
    fontSize: 10,
    color: colors.ink700,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  dayRowOn: {
    borderColor: colors.ocean700,
    backgroundColor: colors.oceanTint,
  },
  tick: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickOn: {
    borderColor: colors.ocean700,
    backgroundColor: colors.ocean700,
  },
  dayTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink900,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.ocean700,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ocean700,
  },
  dayValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink900,
  },
  points: {
    minWidth: 24,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '800',
    color: colors.sage700,
  },
  bolt: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.sage700,
    backgroundColor: colors.surface,
  },
  boltText: {
    flex: 1,
    minWidth: 240,
    gap: spacing.sm,
  },
  boltArt: {
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
  },
  boltValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.sage700,
  },
  free: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.sage700,
  },
  freeSmall: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: colors.sage700,
  },
  area: {
    gap: 6,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  areaHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  areaTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink900,
  },
  areaCount: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ocean700,
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  areaItem: {
    flex: 1,
    fontSize: 13,
    color: colors.ink700,
  },
  areaMore: {
    fontSize: 12,
    color: colors.ink700,
    fontStyle: 'italic',
  },
  plusCard: {
    gap: 6,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.ocean700,
    backgroundColor: colors.oceanImageBg,
  },
  plusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    backgroundColor: colors.ocean700,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.background,
  },
  plusTitle: {
    fontSize: 19,
    lineHeight: 24,
    color: colors.ink900,
  },
});
