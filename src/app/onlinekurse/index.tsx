import { OnlineCourseCatalog } from '@/features/onlinecourses/OnlineCourseCatalog';
import { OnlineCoursesGate } from '@/features/onlinecourses/OnlineCoursesGate';

// Onlinekurse on demand (V1.2, SAD §11.2).
export default function OnlinekurseScreen() {
  return (
    <OnlineCoursesGate>
      <OnlineCourseCatalog />
    </OnlineCoursesGate>
  );
}
