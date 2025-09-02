'use client';

import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPatients } from '@/lib/data';
import type { Patient } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CheckCircle, Clock, Hourglass, User } from 'lucide-react';
import { useEffect, useState } from 'react';

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

function NowServingCard({ patient }: { patient: Patient | undefined }) {
  const [formattedTime, setFormattedTime] = useState('');
  
  useEffect(() => {
    if (patient) {
      setFormattedTime(new Date(patient.appointmentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  }, [patient]);

  if (!patient) {
    return (
       <Card className="bg-green-100/50 border-green-300">
          <CardHeader>
          <CardTitle className="text-lg">Ready for Next</CardTitle>
            <p className="text-sm text-muted-foreground">The doctor is available.</p>
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
         <p className="text-sm text-muted-foreground">Currently in consultation</p>
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
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    const fetchPatients = async () => {
      const patientData = await getPatients();
      setPatients(patientData);
    };

    fetchPatients();
    setLastUpdated(new Date().toLocaleTimeString());

    const intervalId = setInterval(() => {
        fetchPatients();
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
          <NowServingCard patient={nowServing} />

          {upNext ? (
            <QueueStatusCard patient={upNext} title="You're Up Next!" subtitle="Please proceed to the waiting area" highlight />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Queue is Empty</CardTitle>
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
                      <p className="text-sm text-muted-foreground">~{patient.estimatedWaitTime} min wait</p>
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
