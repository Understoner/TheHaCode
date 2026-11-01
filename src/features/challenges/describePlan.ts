import type { TFunction } from 'i18next';

import type { ChallengePlan } from './plan';

const WEEKDAY_KEYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'] as const;

/** Der Plan eines Habits in einem Satz: "Mo, Mi, Fr · 1 Block zu 3 Tagen". */
export function describePlan(plan: ChallengePlan, t: TFunction): string {
  const parts: string[] = [];
  if (plan.daily) parts.push(t('challenges.plan.daily'));
  else if (plan.weekdays?.length) {
    parts.push(plan.weekdays.map((d) => t(`challenges.weekday.${WEEKDAY_KEYS[d - 1]}`)).join(', '));
  }
  if (plan.dates?.length) parts.push(t('challenges.plan.dates', { count: plan.dates.length }));
  if (plan.blocks?.length) {
    const lengths = [...new Set(plan.blocks.map((b) => b.length))];
    parts.push(
      lengths.length === 1
        ? t('challenges.plan.blocks', {
            count: plan.blocks.length,
            days: lengths[0],
          })
        : t('challenges.plan.blocksMixed', { count: plan.blocks.length }),
    );
  }
  return parts.length ? parts.join(' · ') : t('challenges.plan.empty');
}
