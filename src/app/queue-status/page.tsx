
'use client';

import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDoctorStatusAction, getPatientsAction, recalculateQueueWithETC } from '@/app/actions';
import type { DoctorStatus, Patient } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CheckCircle, Clock, FileClock, Hourglass, Shield, User, WifiOff, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { format, parseISO, isToday } from 'date-fns';

const anonymizeName = (name: string) => {
  const parts = name.split(' ');
  if (parts.length > 1) {
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
  }
  return parts[0];
};

function QueueStatusCard({ patient, title, subtitle, highlight = false }: { patient: Patient, title: string, subtitle: string, highlight?: boolean }) {
  const etcText = patient.bestCaseETC && patient.worstCaseETC
    ? `~${format(parseISO(patient.bestCaseETC), 'hh:mm a')}`
    : `~${patient.estimatedWaitTime} min`;

    const isPriority = patient.status === 'Priority';

  return (
    <Card className={cn(highlight && 'bg-primary/20 border-primary', isPriority && 'bg-red-100/70 border-red-400')}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
            {isPriority && <Shield className="h-5 w-5 text-red-600" />}
            {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-4">
          <div className={cn("p-3 rounded-full", highlight ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground", isPriority && "bg-red-200 text-red-800")}>
            <User className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">{anonymizeName(patient.name)}</p>
            <p className="text-muted-foreground flex items-center gap-1.5">
               <Timer className="h-4 w-4" /> Wait time: {etcText}
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
    if (patient && patient.slotTime) {
      setFormattedTime(format(parseISO(patient.slotTime), 'hh:mm a'));
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
              Token #{patient.tokenNo} | Appointment at {formattedTime}
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
      await recalculateQueueWithETC();
      const patientData: Patient[] = await getPatientsAction();
      const statusData = await getDoctorStatusAction();
      const todaysPatients = patientData.filter(p => isToday(parseISO(p.appointmentTime)));
      setPatients(todaysPatients);
      setDoctorStatus(statusData);
    };

    fetchData();
    setLastUpdated(new Date().toLocaleTimeString());

    const intervalId = setInterval(() => {
        fetchData();
        setLastUpdated(new Date().toLocaleTimeString());
    }, 15000); // Poll every 15 seconds

    return () => clearInterval(intervalId);
  }, []);

  const liveQueue = patients
    .filter(p => ['Waiting', 'Late', 'Priority'].includes(p.status))
    .sort((a, b) => (a.bestCaseETC && b.bestCaseETC) ? parseISO(a.bestCaseETC).getTime() - parseISO(b.bestCaseETC).getTime() : 0);
  
  const nowServing = patients.find(p => p.status === 'In-Consultation');
  const upNext = liveQueue[0];
  const nextInLine = liveQueue.slice(1, 4);
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
                <CardTitle className="text-lg">Queue is Empty</CardTitle>
                 <p className="text-sm text-muted-foreground">Please check back later.</p>
              </CardHeader>
              <CardContent>
                 <p>There are no patients currently waiting.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {nextInLine.length > 0 && (
          <div className="mt-12 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-6">Next in Line</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {nextInLine.map((patient, index) => (
                <Card key={patient.id}>
                  <CardContent className="p-4 flex items-center space-x-4">
                    <div className="flex-shrink-0 text-lg font-bold text-primary">#{index + 2}</div>
                    <div>
                      <p className="font-semibold">{anonymizeName(patient.name)}</p>
                       <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Timer className="h-4 w-4" /> ~{patient.bestCaseETC ? format(parseISO(patient.bestCaseETC), 'hh:mm a') : `${patient.estimatedWaitTime} min`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
        
        {waitingForReports.length > 0 && (
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

      </main>
    </div>
  );
}
