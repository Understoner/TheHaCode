import { useLocalSearchParams } from 'expo-router';

import { QueryBoundary } from '@/components/QueryBoundary';
import { CourseNotFound } from '@/features/onlinecourses/CourseNotFound';
import { OnlineCoursesGate } from '@/features/onlinecourses/OnlineCoursesGate';
import { PlanCourse } from '@/features/onlinecourses/PlanCourse';
import { useOnlineCourse } from '@/features/onlinecourses/useOnlineCourses';

// Einen Onlinekurs im Tagebuch einplanen (V1.2, Schritt 6).
export default function OnlinekursPlanenScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const query = useOnlineCourse(slug);

  return (
    <OnlineCoursesGate>
      <QueryBoundary query={query}>{(data) => (data ? <PlanCourse data={data} /> : <CourseNotFound />)}</QueryBoundary>
    </OnlineCoursesGate>
  );
}
