import { useLocalSearchParams } from 'expo-router';

import { QueryBoundary } from '@/components/QueryBoundary';
import { OnlineBlockView } from '@/features/onlinecourses/OnlineBlockView';
import { OnlineCoursesGate } from '@/features/onlinecourses/OnlineCoursesGate';
import { useOnlineCourse } from '@/features/onlinecourses/useOnlineCourses';
import { CourseNotFound } from '@/features/onlinecourses/CourseNotFound';

// Ein Block eines Onlinekurses (V1.2, SAD §11.2).
export default function OnlinekursBlockScreen() {
  const { slug, block } = useLocalSearchParams<{ slug: string; block: string }>();
  const query = useOnlineCourse(slug);

  return (
    <OnlineCoursesGate>
      <QueryBoundary query={query}>
        {(data) => (data ? <OnlineBlockView data={data} blockId={block} /> : <CourseNotFound />)}
      </QueryBoundary>
    </OnlineCoursesGate>
  );
}
