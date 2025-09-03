import Header from '@/components/header';
import { ScheduleForm } from '@/components/admin/schedule-form';
import { getDoctorSchedule } from '@/lib/data';
import { SpecialClosures } from '@/components/admin/special-closures';
import { Separator } from '@/components/ui/separator';

export default async function AdminPage() {
  const schedule = await getDoctorSchedule();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Settings</h1>
            <p className="text-muted-foreground">Manage doctor's schedule and special closures.</p>
          </div>

          <div className="space-y-8">
            <ScheduleForm initialSchedule={schedule} />
            <Separator />
            <SpecialClosures initialSchedule={schedule} />
          </div>
        </div>
      </main>
    </div>
  );
}
