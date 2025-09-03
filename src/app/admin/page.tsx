import Header from '@/components/header';
import { ScheduleForm } from '@/components/admin/schedule-form';
import { getDoctorSchedule } from '@/lib/data';
import { SpecialClosures } from '@/components/admin/special-closures';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WeekView } from '@/components/admin/week-view';

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

          <Tabs defaultValue="schedule">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="schedule">Weekly Schedule</TabsTrigger>
              <TabsTrigger value="closures">Closures &amp; Overrides</TabsTrigger>
            </TabsList>
            <TabsContent value="schedule" className="pt-6">
               <ScheduleForm initialSchedule={schedule} />
            </TabsContent>
            <TabsContent value="closures" className="pt-6">
              <SpecialClosures initialSchedule={schedule} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
