import Header from '@/components/header';
import { ScheduleForm } from '@/components/admin/schedule-form';
import { getDoctorSchedule } from '@/lib/data';

export default async function AdminPage() {
  const schedule = await getDoctorSchedule();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
          <h1 className="text-3xl font-bold text-foreground">Admin Settings</h1>
          <ScheduleForm initialSchedule={schedule} />
        </div>
      </main>
    </div>
  );
}
