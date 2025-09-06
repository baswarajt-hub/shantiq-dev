
'use client';

import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDoctorStatusAction, getPatientsAction } from '@/app/actions';
import type { DoctorStatus, Patient } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CheckCircle, Clock, FileClock, Hourglass, User, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';

const anonymizeName = (name: string) => {
  const parts = name.split(' ');
  if (parts.length > 1) {
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
  }
  return parts[0];
};

function QueueStatusCard({ patient, title, subtitle, highlight = false }: { patient: Patient, title: string, subtitle: string, highlight?: boolean }) {
  return (
    <Card className={cn(highlight && 'bg-primary/20 border-primary')}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-4">
          <div className={cn("p-3 rounded-full", highlight ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground")}>
            <User className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">{anonymizeName(patient.name)}</p>
            <p className="text-muted-foreground">
              Wait time: ~{patient.estimatedWaitTime} min
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function NowServingCard({ patient, doctorStatus }: { patient: Patient | undefined, doctorStatus: DoctorStatus | null }) {
  const [formattedTime, setFormattedTime] = useState('');
  const [doctorOnlineTime, setDoctorOnlineTime] = useState('');
  
  useEffect(() => {
    if (patient) {
      setFormattedTime(format(parseISO(patient.appointmentTime), 'hh:mm a'));
    }
  }, [patient]);

  useEffect(() => {
    if (doctorStatus?.isOnline && doctorStatus.onlineTime) {
      setDoctorOnlineTime(new Date(doctorStatus.onlineTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } else {
      setDoctorOnlineTime('');
    }
  }, [doctorStatus]);


  if (!doctorStatus?.isOnline) {
    return (
       <Card className="bg-orange-100/50 border-orange-300">
          <CardHeader>
            <CardTitle className="text-lg">Doctor Offline</CardTitle>
            <p className="text-sm text-muted-foreground">The doctor is currently unavailable.</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
             <div className="p-3 rounded-full bg-orange-200 text-orange-800">
               <WifiOff className="h-6 w-6" />
             </div>
              <p className="text-2xl font-bold">Please check back later.</p>
            </div>
          </CardContent>
        </Card>
    )
  }

  if (!patient) {
    return (
       <Card className="bg-green-100/50 border-green-300">
          <CardHeader>
          <CardTitle className="text-lg">Ready for Next</CardTitle>
            <p className="text-sm text-muted-foreground">The doctor is available (since {doctorOnlineTime}).</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
             <div className="p-3 rounded-full bg-green-200 text-green-800">
               <CheckCircle className="h-6 w-6" />
             </div>
              <p className="text-2xl font-bold">No one is currently being served.</p>
            </div>
          </CardContent>
        </Card>
    )
  }
  
  return (
       <Card className="bg-green-100/50 border-green-300">
       <CardHeader>
         <CardTitle className="text-lg">Now Serving</CardTitle>
         <p className="text-sm text-muted-foreground">Currently in consultation (since {doctorOnlineTime})</p>
       </CardHeader>
       <CardContent>
         <div className="flex items-center space-x-4">
           <div className="p-3 rounded-full bg-green-200 text-green-800">
             <Hourglass className="h-6 w-6" />
           </div>
           <div>
             <p className="text-2xl font-bold">{anonymizeName(patient.name)}</p>
             <p className="text-muted-foreground">
              Appointment at {formattedTime}
             </p>
           </div>
         </div>
       </CardContent>
     </Card>
  )
}

export default function QueueStatusPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctorStatus, setDoctorStatus] = useState<DoctorStatus | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const patientData: Patient[] = await getPatientsAction();
      const statusData = await getDoctorStatusAction();
      const todayString = new Date().toDateString();
      const todaysPatients = patientData.filter(p => new Date(p.appointmentTime).toDateString() === todayString);
      setPatients(todaysPatients);
      setDoctorStatus(statusData);
    };

    fetchData();
    setLastUpdated(new Date().toLocaleTimeString());

    const intervalId = setInterval(() => {
        fetchData();
        setLastUpdated(new Date().toLocaleTimeString());
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  const waitingPatients = patients
    .filter(p => p.status === 'Waiting' || p.status === 'Late')
    .sort((a, b) => new Date(a.appointmentTime).getTime() - new Date(b.appointmentTime).getTime());
  
  const nowServing = patients.find(p => p.status === 'In-Consultation');
  const upNext = waitingPatients[0];
  const nextInLine = waitingPatients.slice(1, 4);
  const waitingForReports = patients.filter(p => p.status === 'Waiting for Reports');

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Live Queue Status</h1>
          <p className="text-lg text-muted-foreground mt-2">
            Time your visit perfectly. Last updated: {lastUpdated}.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <NowServingCard patient={nowServing} doctorStatus={doctorStatus} />

          {upNext ? (
            <QueueStatusCard patient={upNext} title="You're Up Next!" subtitle="Please proceed to the waiting area" highlight />
          ) : (
             <Card>
              <CardHeader>
                <CardTitle className="text-lg">{!doctorStatus?.isOnline ? 'Doctor is Offline' : 'Queue is Empty'}</CardTitle>
                <p className="text-sm text-muted-foreground">Please check back later.</p>
              </CardHeader>
              <CardContent>
                 <p>{doctorStatus?.isOnline ? "There are no patients currently waiting." : "The waiting queue will be displayed once the doctor is online."}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {(doctorStatus?.isOnline || waitingPatients.length > 0) && nextInLine.length > 0 && (
          <div className="mt-12 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-6">Next in Line</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {nextInLine.map((patient, index) => (
                <Card key={patient.id}>
                  <CardContent className="p-4 flex items-center space-x-4">
                    <div className="flex-shrink-0 text-lg font-bold text-primary">#{index + 2}</div>
                    <div>
                      <p className="font-semibold">{anonymizeName(patient.name)}</p>
                      <p className="text-sm text-muted-foreground">~{patient.estimatedWaitTime} min wait</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
        
        {(doctorStatus?.isOnline || waitingForReports.length > 0) && waitingForReports.length > 0 && (
          <div className="mt-12 max-w-4xl mx-auto">
             <h2 className="text-2xl font-bold text-center mb-6">Waiting for Reports</h2>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
               {waitingForReports.map((patient) => (
                 <Card key={patient.id} className="bg-purple-100/50 border-purple-300">
                   <CardContent className="p-4 flex items-center space-x-4">
                     <div className="flex-shrink-0 text-purple-700"><FileClock className="h-5 w-5" /></div>
                     <div>
                       <p className="font-semibold">{anonymizeName(patient.name)}</p>
                       <p className="text-sm text-muted-foreground">Please wait to be called</p>
                     </div>
                   </CardContent>
                 </Card>
               ))}
             </div>
          </div>
        )}

        {!doctorStatus?.isOnline && waitingPatients.length === 0 && (
            <div className="mt-12 max-w-4xl mx-auto text-center">
                 <p className="text-muted-foreground">The doctor is currently offline. You can still see your position in the queue once patients have checked in.</p>
            </div>
        )}
      </main>
    </div>
  );
}
