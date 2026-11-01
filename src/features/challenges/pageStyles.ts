import { StyleSheet } from 'react-native';

import { colors, radius, spacing } from '@/design/tokens';

// Gemeinsame Stile der Challenge-Seiten - dieselben Masse wie die
// Unterseiten des Tagebuchs (auswertung.tsx, eigenes-habit.tsx).
export const page = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  back: {
    fontSize: 14,
    color: colors.ink700,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink900,
    marginTop: spacing.sm,
  },
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink900,
  },
  text: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink700,
  },
  meta: {
    fontSize: 13,
    color: colors.ink700,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.ocean700,
    borderColor: colors.ocean700,
  },
  chipText: {
    fontSize: 13,
    color: colors.ink700,
  },
  chipTextActive: {
    color: colors.surface,
    fontWeight: '600',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.focusRing,
    fontSize: 11,
    fontWeight: '600',
    color: colors.ocean700,
  },
  bar: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.sage500,
  },
  secondary: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  secondaryText: {
    fontSize: 14,
    color: colors.ink700,
  },
  danger: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.full,
    backgroundColor: colors.danger,
  },
  dangerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.surface,
  },
});
