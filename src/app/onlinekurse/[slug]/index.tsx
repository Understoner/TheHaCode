import { useLocalSearchParams } from 'expo-router';

import { QueryBoundary } from '@/components/QueryBoundary';
import { CourseNotFound } from '@/features/onlinecourses/CourseNotFound';
import { OnlineCourseView } from '@/features/onlinecourses/OnlineCourseView';
import { OnlineCoursesGate } from '@/features/onlinecourses/OnlineCoursesGate';
import { useOnlineCourse } from '@/features/onlinecourses/useOnlineCourses';

// Die Kursseite eines Onlinekurses (V1.2, SAD §11.2).
export default function OnlinekursScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const query = useOnlineCourse(slug);

  return (
    <OnlineCoursesGate>
      <QueryBoundary query={query}>{(data) => (data ? <OnlineCourseView data={data} /> : <CourseNotFound />)}</QueryBoundary>
    </OnlineCoursesGate>
  );
}
