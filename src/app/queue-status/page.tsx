
'use client';

import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { findPatientsByPhoneAction, getDoctorStatusAction, getPatientsAction, recalculateQueueWithETC } from '@/app/actions';
import type { DoctorStatus, Patient } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CheckCircle, Clock, FileClock, Hourglass, Shield, User, WifiOff, Timer, Search, Ticket, ArrowRight, UserCheck, AlertTriangle, PartyPopper } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { format, parseISO, isToday, differenceInMinutes } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AnimatePresence, motion } from 'framer-motion';

function NowServingCard({ patient, doctorStatus }: { patient: Patient | undefined, doctorStatus: DoctorStatus | null }) {
  const [doctorOnlineTime, setDoctorOnlineTime] = useState('');
  
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
            <CardTitle className="text-lg flex items-center gap-2"><WifiOff/>Doctor Offline</CardTitle>
            <CardDescription>The doctor is currently unavailable.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">Please check back later.</p>
          </CardContent>
        </Card>
    )
  }

  if (!patient) {
    return (
       <Card className="bg-green-100/50 border-green-300">
          <CardHeader>
             <CardTitle className="text-lg flex items-center gap-2"><UserCheck />Ready for Next</CardTitle>
            <CardDescription>The doctor is available (since {doctorOnlineTime}).</CardDescription>
          </CardHeader>
          <CardContent>
             <p className="text-xl font-bold">No one is currently being served.</p>
          </CardContent>
        </Card>
    )
  }
  
  return (
       <Card className="bg-green-100/50 border-green-300">
       <CardHeader>
         <CardTitle className="text-lg flex items-center gap-2"><Hourglass className="animate-spin" />Now Serving</CardTitle>
         <CardDescription>Currently in consultation</CardDescription>
       </CardHeader>
       <CardContent>
          <p className="text-3xl font-bold">{patient.name}</p>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <Ticket className="h-4 w-4"/> Token #{patient.tokenNo}
          </p>
       </CardContent>
     </Card>
  )
}

function UpNextCard({ patient }: { patient: Patient | undefined}) {
    if (!patient) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Queue is Empty</CardTitle>
                    <CardDescription>There are no patients waiting.</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    const isPriority = patient.status === 'Priority';

    return (
         <Card className={cn('bg-primary/20 border-primary', isPriority && 'bg-red-100/70 border-red-400')}>
            <CardHeader>
                 <CardTitle className="text-lg flex items-center gap-2">
                    {isPriority ? <Shield className="text-red-600" /> : <ArrowRight />}
                    Up Next
                 </CardTitle>
                <CardDescription>Please proceed to the waiting area.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-3xl font-bold">{patient.name}</p>
                <div className="text-muted-foreground flex items-center gap-4 mt-1">
                    <span className="flex items-center gap-1.5"><Ticket className="h-4 w-4"/> Token #{patient.tokenNo}</span>
                    <span className="flex items-center gap-1.5"><Timer className="h-4 w-4"/> ETC: ~{patient.bestCaseETC ? format(parseISO(patient.bestCaseETC), 'hh:mm a') : '-'}</span>
                </div>
            </CardContent>
        </Card>
    )
}

function YourStatusCard({ patient, queuePosition, isUpNext, isNowServing }: { patient: Patient, queuePosition: number, isUpNext: boolean, isNowServing: boolean }) {

    if (patient.status === 'Completed') {
        const waitTime = (patient.checkInTime && patient.consultationStartTime) ? differenceInMinutes(parseISO(patient.consultationStartTime), parseISO(patient.checkInTime)) : null;
        return (
             <Card className="bg-green-100 border-green-400">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><PartyPopper /> Consultation Completed!</CardTitle>
                    <CardDescription>We wish you a speedy recovery.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-4xl font-bold">{patient.name}</p>
                    <div className="text-muted-foreground mt-2 grid grid-cols-2 gap-4">
                        {waitTime !== null && waitTime >= 0 && (
                            <div className="font-semibold">
                                <p>Your wait time:</p>
                                <p className="text-2xl text-foreground">{waitTime} minutes</p>
                            </div>
                        )}
                        {patient.consultationTime && (
                            <div className="font-semibold">
                                <p>Consultation took:</p>
                                <p className="text-2xl text-foreground">{patient.consultationTime} minutes</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (isNowServing) {
        return (
            <Card className="bg-green-200 border-green-400">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><Hourglass className="animate-spin" /> You Are Being Served</CardTitle>
                    <CardDescription>Please proceed to the consultation room.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-4xl font-bold">{patient.name}</p>
                    <p className="text-muted-foreground flex items-center gap-2 mt-1"><Ticket className="h-4 w-4"/> Token #{patient.tokenNo}</p>
                </CardContent>
            </Card>
        )
    }

    if (isUpNext) {
         return (
            <Card className="bg-amber-100 border-amber-400">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><UserCheck /> You Are Up Next!</CardTitle>
                    <CardDescription>Please be ready, your turn is about to begin.</CardDescription>
                </CardHeader>
                 <CardContent>
                    <p className="text-4xl font-bold">{patient.name}</p>
                    <p className="text-muted-foreground flex items-center gap-2 mt-1"><Ticket className="h-4 w-4"/> Token #{patient.tokenNo}</p>
                </CardContent>
            </Card>
        )
    }
    
    if (patient.status === 'Waiting for Reports') {
         return (
            <Card className="bg-purple-100 border-purple-400">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><FileClock /> Waiting for Reports</CardTitle>
                    <CardDescription>Your reports are being processed. Please wait to be called again.</CardDescription>
                </CardHeader>
                 <CardContent>
                    <p className="text-4xl font-bold">{patient.name}</p>
                </CardContent>
            </Card>
        )
    }
    
    if (patient.status === 'Booked') {
         return (
            <Card className="bg-blue-100 border-blue-400">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><Clock /> Appointment Booked</CardTitle>
                    <CardDescription>You have not checked in yet. Please check in at the reception upon arrival.</CardDescription>
                </CardHeader>
                 <CardContent>
                    <p className="text-4xl font-bold">{patient.name}</p>
                    <p className="text-muted-foreground flex items-center gap-2 mt-1">
                        Appointment at {format(parseISO(patient.appointmentTime), 'hh:mm a')}
                    </p>
                </CardContent>
            </Card>
        )
    }

    if (queuePosition <= 0) {
        return (
            <Card className="bg-gray-100 border-gray-300">
                <CardHeader>
                    <CardTitle className="text-xl">Calculating your position...</CardTitle>
                    <CardDescription>Your status is being updated. Please wait a moment.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-4xl font-bold">{patient.name}</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-xl">Your Position in Queue</CardTitle>
                <CardDescription>You are #{queuePosition} in the waiting list.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-4xl font-bold">{patient.name}</p>
                <div className="text-muted-foreground mt-2 space-y-2">
                    <p className="flex items-center gap-2"><Ticket className="h-4 w-4"/> Token #{patient.tokenNo}</p>
                    <div className="flex items-start gap-4 text-sm">
                        <div className="flex-1 space-y-1">
                            <p className="flex items-center gap-2 font-semibold text-green-600">
                                <Timer className="h-4 w-4" /> Best ETC:
                            </p>
                            <p className="pl-6">{patient.bestCaseETC ? format(parseISO(patient.bestCaseETC), 'hh:mm a') : '-'}</p>
                            <p className="text-xs pl-6">(If prior booked appointments don't check-in)</p>
                        </div>
                         <div className="flex-1 space-y-1">
                            <p className="flex items-center gap-2 font-semibold text-orange-600">
                                <Timer className="h-4 w-4" /> Worst ETC:
                            </p>
                            <p className="pl-6">{patient.worstCaseETC ? format(parseISO(patient.worstCaseETC), 'hh:mm a') : '-'}</p>
                            <p className="text-xs pl-6">(If all booked appointments check-in on time)</p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )

}

export default function QueueStatusPage() {
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [doctorStatus, setDoctorStatus] = useState<DoctorStatus | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [phone, setPhone] = useState('');
  const [foundAppointments, setFoundAppointments] = useState<Patient[]>([]);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const fetchData = async () => {
      await recalculateQueueWithETC();
      const [patientData, statusData] = await Promise.all([
        getPatientsAction(),
        getDoctorStatusAction()
      ]);
      setAllPatients(patientData);
      setDoctorStatus(statusData);
      setLastUpdated(new Date().toLocaleTimeString());
    };

  useEffect(() => {
    fetchData(); // Initial fetch
    const intervalId = setInterval(fetchData, 30000); // Poll every 30 seconds
    return () => clearInterval(intervalId);
  }, []);

  const handleSearch = () => {
    if (!phone) {
        toast({ title: 'Phone number is required', variant: 'destructive'});
        return;
    }
    startTransition(async () => {
        const appointments = await findPatientsByPhoneAction(phone);
        const todaysAppointments = appointments.filter((p: Patient) => isToday(parseISO(p.appointmentTime || p.slotTime)) && p.status !== 'Cancelled');

        if (todaysAppointments.length === 0) {
            toast({ title: 'No active appointments found', description: 'No appointments for today were found for this phone number.'});
        }
        setFoundAppointments(todaysAppointments);
    })
  }
  
  const todaysPatients = allPatients.filter((p: Patient) => isToday(parseISO(p.appointmentTime || p.slotTime)));
  
  const liveQueue = allPatients
    .filter(p => p.status !== 'Completed' && p.status !== 'Cancelled')
    .sort((a, b) => {
        const timeA = a.bestCaseETC ? parseISO(a.bestCaseETC).getTime() : Infinity;
        const timeB = b.bestCaseETC ? parseISO(b.bestCaseETC).getTime() : Infinity;
        return timeA - timeB;
    });
  
  const nowServing = allPatients.find(p => p.status === 'In-Consultation');
  const upNext = liveQueue.find(p => p.status !== 'In-Consultation');

  const isPatientViewCompleted = foundAppointments.length > 0 && foundAppointments.every(p => p.status === 'Completed');

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Live Queue Status</h1>
          <p className="text-lg text-muted-foreground mt-2">
            Enter your phone number to see your personalized status.
          </p>
           <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>
        
        <div className="max-w-md mx-auto space-y-4">
            <div className="flex gap-2">
                <Input 
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="Enter your 10-digit phone number"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={isPending}>
                    {isPending ? 'Searching...' : <Search className="h-4 w-4" />}
                </Button>
            </div>
        </div>

        <div className="mt-8 max-w-4xl mx-auto space-y-8">
            <AnimatePresence>
            {foundAppointments.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                >
                    <h2 className="text-2xl font-bold text-center">Your Status</h2>
                    {foundAppointments.map(patient => {
                         const queuePosition = liveQueue.findIndex(p => p.id === patient.id) + 1;
                         const isNowServing = nowServing?.id === patient.id;
                         const isUpNext = upNext?.id === patient.id;
                         return (
                            <YourStatusCard 
                                key={patient.id}
                                patient={patient}
                                queuePosition={queuePosition}
                                isUpNext={isUpNext}
                                isNowServing={isNowServing}
                            />
                         )
                    })}
                </motion.div>
            )}
            </AnimatePresence>

            {!isPatientViewCompleted && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <NowServingCard patient={nowServing} doctorStatus={doctorStatus} />
                  <UpNextCard patient={upNext} />
                </div>

                {todaysPatients.some(p => p.status === 'Waiting for Reports') && (
                  <div className="mt-8">
                     <h2 className="text-2xl font-bold text-center mb-6">Waiting for Reports</h2>
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                       {todaysPatients.filter(p => p.status === 'Waiting for Reports').map((patient) => (
                         <Card key={patient.id} className="bg-purple-100/50 border-purple-300">
                           <CardContent className="p-4 flex items-center space-x-4">
                             <div className="flex-shrink-0 text-purple-700"><FileClock className="h-5 w-5" /></div>
                             <div>
                               <p className="font-semibold">{patient.name}</p>
                               <p className="text-sm text-muted-foreground">Please wait to be called</p>
                             </div>
                           </CardContent>
                         </Card>
                       ))}
                     </div>
                  </div>
                )}
              </>
            )}
        </div>
      </main>
    </div>
  );
}
