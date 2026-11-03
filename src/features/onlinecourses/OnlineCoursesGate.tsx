import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { StateMessage } from '@/components/StateMessage';
import { ONLINE_COURSES_ENABLED } from './flag';

/** Solange Onlinekurse im Livesystem noch nicht freigegeben sind: ein ruhiger Hinweis statt der Seite. */
export function OnlineCoursesGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  if (!ONLINE_COURSES_ENABLED) {
    return <StateMessage title={t('onlineCourses.soon.title')} body={t('onlineCourses.soon.hint')} />;
  }
  return <>{children}</>;
}
