
'use client';

import { PatientPortalHeader } from '@/components/patient-portal-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getPatientsAction, getDoctorScheduleAction } from '@/app/actions';
import type { DoctorSchedule, DoctorStatus, Patient } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CheckCircle, Clock, FileClock, Hourglass, Shield, WifiOff, Timer, Ticket, ArrowRight, UserCheck, PartyPopper, Pause, AlertTriangle } from 'lucide-react';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { format, parseISO, isToday, differenceInMinutes, parse as parseDate } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';

const timeZone = "Asia/Kolkata";

function sessionLocalToUtc(dateStr: string, sessionTime: string) {
  let localDate: Date;
  if (/^\d{1,2}:\d{2}$/.test(sessionTime)) {
    localDate = parseDate(`${dateStr} ${sessionTime}`, 'yyyy-MM-dd HH:mm', new Date());
  } else {
    localDate = parseDate(`${dateStr} ${sessionTime}`, 'yyyy-MM-dd hh:mm a', new Date());
  }
  return fromZonedTime(localDate, timeZone);
}

function NowServingCard({ patient, doctorStatus, schedule }: { patient: Patient | undefined, doctorStatus: DoctorStatus | null, schedule: DoctorSchedule | null }) {
  if (!doctorStatus) return null;
  
  const todayStr = format(toZonedTime(new Date(), timeZone), 'yyyy-MM-dd');
  const dayName = format(toZonedTime(new Date(), timeZone), 'EEEE') as keyof DoctorSchedule['days'];

  let daySchedule;
  if (schedule) {
    const todayOverride = schedule.specialClosures.find(c => c.date === todayStr);
    daySchedule = todayOverride 
        ? {
            morning: todayOverride.morningOverride ?? schedule.days[dayName].morning,
            evening: todayOverride.eveningOverride ?? schedule.days[dayName].evening
          }
        : schedule.days[dayName];
  }
  
  const now = new Date();
  const currentHour = now.getHours();
  
  const sessionToCheck = (currentHour < 14 || !daySchedule?.evening.isOpen) ? daySchedule?.morning : daySchedule?.evening;
  const isSessionOver = sessionToCheck ? now > sessionLocalToUtc(todayStr, sessionToCheck.end) : false;

  if (!doctorStatus.isOnline && doctorStatus.startDelay > 0 && !isSessionOver) {
    return (
       <Card className="bg-orange-100/50 border-orange-300">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><AlertTriangle/>Doctor is Running Late</CardTitle>
            <CardDescription>The session will begin with a delay.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">Starts approx. {doctorStatus.startDelay} min late</p>
          </CardContent>
        </Card>
    )
  }
  
  if (!doctorStatus.isOnline) {
    return (
       <Card className="bg-slate-100/50 border-slate-300">
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
  
  if (doctorStatus.isPaused) {
    return (
       <Card className="bg-yellow-100/50 border-yellow-300">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Pause/>Queue Paused</CardTitle>
            <CardDescription>The queue is temporarily paused.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">Please wait for the queue to resume.</p>
          </CardContent>
        </Card>
    )
  }

  if (!patient) {
    return (
       <Card className="bg-green-100/50 border-green-300">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><UserCheck />Ready for Next</CardTitle>
            <CardDescription>The doctor is ready to see the next patient.</CardDescription>
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
          <p className="text-3xl font-bold">
            {patient.name}
            {patient.subStatus === 'Reports' && <span className="text-2xl ml-2 font-semibold text-purple-600">(Reports)</span>}
          </p>
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
                    <CardDescription>There are no patients waiting in this session.</CardDescription>
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

function CompletionSummary({ patient }: { patient: Patient }) {
    const waitTime = (patient.checkInTime && patient.consultationStartTime) ? differenceInMinutes(parseISO(patient.consultationStartTime), parseISO(patient.checkInTime)) : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
        >
            <PartyPopper className="h-16 w-16 mx-auto text-green-500" />
            <h2 className="text-3xl font-bold mt-4">Thank you for your trust in us!</h2>
            <p className="text-xl text-muted-foreground mt-2">
                We wish <span className="font-semibold text-primary">{patient.name}</span> a speedy recovery.
            </p>
            <div className="max-w-md mx-auto mt-8 grid grid-cols-2 gap-4 text-center">
                {waitTime !== null && waitTime >= 0 && (
                    <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">Your wait time was</p>
                        <p className="text-3xl font-bold">{waitTime} min</p>
                    </div>
                )}
                 {patient.consultationTime && (
                    <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">Consultation took</p>
                        <p className="text-3xl font-bold">{patient.consultationTime} min</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

function YourStatusCard({ patient, queuePosition, isUpNext, isNowServing }: { patient: Patient, queuePosition: number, isUpNext: boolean, isNowServing: boolean }) {

    if (patient.status === 'Completed') {
        return null;
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

function QueueStatusPageContent() {
  const [allSessionPatients, setAllSessionPatients] = useState<Patient[]>([]);
  const [userQueue, setUserQueue] = useState<Patient[]>([]);
  const [userTodaysPatients, setUserTodaysPatients] = useState<Patient[]>([]);
  const [doctorStatus, setDoctorStatus] = useState<DoctorStatus | null>(null);
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [completedAppointmentForDisplay, setCompletedAppointmentForDisplay] = useState<Patient | null>(null);
  const [currentSession, setCurrentSession] = useState<'morning' | 'evening' | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const getSessionForTime = useCallback((appointmentUtcDate: Date, localSchedule: DoctorSchedule | null): 'morning' | 'evening' | null => {
    if (!localSchedule) return null;
    
    const zonedAppt = toZonedTime(appointmentUtcDate, timeZone);
    const dayOfWeek = format(zonedAppt, 'EEEE') as keyof DoctorSchedule['days'];
    const dateStr = format(zonedAppt, 'yyyy-MM-dd');

    let daySchedule = localSchedule.days[dayOfWeek];
    const todayOverride = localSchedule.specialClosures.find(c => c.date === dateStr);
    if (todayOverride) {
      daySchedule = {
        morning: todayOverride.morningOverride ?? daySchedule.morning,
        evening: todayOverride.eveningOverride ?? daySchedule.evening,
      };
    }
    
    const checkSession = (sessionName: 'morning' | 'evening') => {
      const session = daySchedule[sessionName];
      if (!session.isOpen) return false;
      const startUtc = sessionLocalToUtc(dateStr, session.start);
      const endUtc = sessionLocalToUtc(dateStr, session.end);
      const apptMs = appointmentUtcDate.getTime();
      return apptMs >= startUtc.getTime() && apptMs < endUtc.getTime();
    };

    if (checkSession('morning')) return 'morning';
    if (checkSession('evening')) return 'evening';
    return null;
  }, []);

  useEffect(() => {
    const userPhone = localStorage.getItem('userPhone');
    if (!userPhone) {
      router.push('/login');
    } else {
      setPhone(userPhone);
    }
  }, [router]);
  
  const fetchData = useCallback(async () => {
    const userPhone = localStorage.getItem('userPhone');
    const patientIdParam = searchParams.get('id');
    if (!userPhone) return;

    const [allPatientData, statusRes, scheduleData] = await Promise.all([
      getPatientsAction(),
      fetch('/api/status'),
      getDoctorScheduleAction(),
    ]);

    const statusData = await statusRes.json();
    setSchedule(scheduleData);
    setDoctorStatus(statusData);

    const todaysPatients = allPatientData.filter((p: Patient) => isToday(new Date(p.appointmentTime)));
    setUserTodaysPatients(todaysPatients.filter((p: Patient) => p.phone === userPhone));
    
    let targetAppointment: Patient | null = null;
    
    if (patientIdParam) {
        const id = parseInt(patientIdParam, 10);
        targetAppointment = allPatientData.find((p: Patient) => p.id === id) || null;
    }
    
    if (!targetAppointment) {
        targetAppointment = todaysPatients.find(p => p.phone === userPhone && p.status !== 'Completed' && p.status !== 'Cancelled') || null;
    }
    
    const sessionToShow = targetAppointment 
      ? getSessionForTime(parseISO(targetAppointment.appointmentTime), scheduleData) 
      : (new Date().getHours() < 14 ? 'morning' : 'evening');
    
    setCurrentSession(sessionToShow);
    
    const filteredPatientsForSession = todaysPatients.filter((p: Patient) => getSessionForTime(parseISO(p.appointmentTime), scheduleData) === sessionToShow);
    setAllSessionPatients(filteredPatientsForSession);
    
    const currentUserQueue = filteredPatientsForSession
      .filter(p => p.phone === userPhone)
      .sort((a, b) => {
        const timeA = a.bestCaseETC ? parseISO(a.bestCaseETC).getTime() : Infinity;
        const timeB = b.bestCaseETC ? parseISO(b.bestCaseETC).getTime() : Infinity;
        if (timeA === Infinity && timeB === Infinity) {
            return (a.tokenNo || 0) - (b.tokenNo || 0);
        }
        return timeA - timeB;
      });
    setUserQueue(currentUserQueue);
    
    if (targetAppointment && targetAppointment.status === 'Completed') {
        const lastCompletedId = localStorage.getItem('completedAppointmentId');
        if (lastCompletedId !== String(targetAppointment.id)) {
            setCompletedAppointmentForDisplay(targetAppointment);
            localStorage.setItem('completedAppointmentId', String(targetAppointment.id));
        }
    } else {
        setCompletedAppointmentForDisplay(null);
    }
    setLastUpdated(new Date().toLocaleTimeString());
}, [getSessionForTime, searchParams]);


  useEffect(() => {
    if (phone) {
        fetchData();
        const intervalId = setInterval(() => fetchData(), 15000);
        return () => clearInterval(intervalId);
    }
  }, [fetchData, phone]);
  
  const nowServing = allSessionPatients.find(p => p.status === 'In-Consultation');
  const upNext = allSessionPatients.find(p => p.status === 'Up-Next');
  
  const waitingQueue = allSessionPatients
    .filter(p => ['Waiting', 'Late', 'Priority'].includes(p.status))
    .sort((a, b) => {
        const timeA = a.bestCaseETC ? parseISO(a.bestCaseETC).getTime() : Infinity;
        const timeB = b.bestCaseETC ? parseISO(b.bestCaseETC).getTime() : Infinity;
        if (timeA === Infinity && timeB === Infinity) {
            return (a.tokenNo || 0) - (b.tokenNo || 0);
        }
        return timeA - timeB;
    });

  if (!phone) {
      return (
          <div className="flex flex-col min-h-screen bg-muted/40">
              <PatientPortalHeader logoSrc={schedule?.clinicDetails?.clinicLogo} clinicName={schedule?.clinicDetails?.clinicName} />
              <div className="flex-1 flex items-center justify-center">
                  <p>Loading...</p>
              </div>
          </div>
      );
  }
  
  const hasActiveAppointments = userTodaysPatients.some(p => p.status !== 'Completed' && p.status !== 'Cancelled');

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <PatientPortalHeader logoSrc={schedule?.clinicDetails?.clinicLogo} clinicName={schedule?.clinicDetails?.clinicName} />
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
        
        {completedAppointmentForDisplay ? (
             <CompletionSummary patient={completedAppointmentForDisplay} />
        ) : !hasActiveAppointments ? (
             <div className="text-center mt-16">
                 <h1 className="text-3xl font-bold">No Active Appointment</h1>
                 <p className="text-lg text-muted-foreground mt-2">You do not have an active appointment scheduled for today.</p>
             </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold tracking-tight">Live Queue Status</h1>
              <p className="text-lg text-muted-foreground mt-2">
                Showing status for the {currentSession} session.
              </p>
              <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
            </div>
            
            <div className="mt-8 max-w-4xl mx-auto space-y-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                >
                    <h2 className="text-2xl font-bold text-center">Your Family's Status</h2>
                    <AnimatePresence>
                      {userQueue.map(patient => {
                          const queuePosition = waitingQueue.findIndex(p => p.id === patient.id) + (upNext ? 2 : 1);
                          const isNowServing = nowServing?.id === patient.id;
                          const isUpNext = upNext?.id === patient.id;
                          return (
                              <motion.div
                                key={patient.id}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                              >
                                <YourStatusCard 
                                    patient={patient}
                                    queuePosition={queuePosition}
                                    isUpNext={isUpNext}
                                    isNowServing={isNowServing}
                                />
                              </motion.div>
                          );
                      })}
                    </AnimatePresence>
                    {userQueue.length === 0 && hasActiveAppointments && (
                        <p className="text-center text-muted-foreground">Your active appointments are not in this session.</p>
                    )}
                </motion.div>

                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <NowServingCard patient={nowServing} doctorStatus={doctorStatus} schedule={schedule} />
                    <UpNextCard patient={upNext} />
                    </div>
                    
                    <div className="mt-8">
                        <h2 className="text-2xl font-bold text-center mb-6">Waiting for Reports</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {allSessionPatients.filter(p => isToday(new Date(p.appointmentTime)) && p.status === 'Waiting for Reports').map((patient) => (
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
                         {allSessionPatients.filter(p => isToday(new Date(p.appointmentTime)) && p.status === 'Waiting for Reports').length === 0 && (
                            <p className="text-center text-muted-foreground">No one is waiting for reports.</p>
                        )}
                    </div>
                </>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function QueueStatusPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <QueueStatusPageContent />
        </Suspense>
    )
}
