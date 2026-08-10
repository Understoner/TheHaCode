import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { SkeletonList } from '@/components/SkeletonList';
import { StateMessage } from '@/components/StateMessage';

type Props<T> = {
  query: UseQueryResult<T>;
  empty?: { title: string; hint?: string };
  children: (data: T) => ReactNode;
};

// Vier Zustaende jeder Datenkomponente, keine Ausnahme (CLAUDE.md, SAD §6.2).
export function QueryBoundary<T>({ query, empty, children }: Props<T>) {
  const { t } = useTranslation('errors');

  if (query.isPending) return <SkeletonList />;

  if (query.isError)
    return (
      <StateMessage
        title={t('loadFailed.title')}
        body={t('loadFailed.body')}
        actionLabel={t('retry')}
        onAction={() => query.refetch()}
      />
    );

  const isEmpty = Array.isArray(query.data) && query.data.length === 0;
  if (isEmpty && empty) return <StateMessage title={empty.title} body={empty.hint} />;

  return <>{children(query.data)}</>;
}
