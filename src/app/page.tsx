import Header from '@/components/header';
import Stats from '@/components/dashboard/stats';
import PatientQueue from '@/components/dashboard/patient-queue';
import { getPatients } from '@/lib/data';

export default async function DashboardPage() {
  const patients = await getPatients();
  const aipatients = {
    patientFlowData: 'Average consultation time is 15 minutes. Peak hours are 10 AM to 1 PM.',
    lateArrivals: '3 patients arrived late today, with an average delay of 10 minutes.',
    doctorDelays: 'Dr. Smith is running 20 minutes behind schedule.',
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <Stats patients={patients} />
          <PatientQueue initialPatients={patients} aipatients={aipatients} />
        </div>
      </main>
    </div>
  );
}
