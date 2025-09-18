

'use client';

import { PatientPortalHeader } from '@/components/patient-portal-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getDoctorScheduleAction, getDoctorStatusAction, getPatientsAction } from '@/app/actions';
import type { DoctorSchedule, DoctorStatus, Patient, Session } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CheckCircle, Clock, FileClock, Hourglass, Shield, WifiOff, Timer, Ticket, ArrowRight, UserCheck, PartyPopper, Pause, AlertTriangle } from 'lucide-react';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { format, parseISO, isToday, differenceInMinutes, parse as parseDateFn } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

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
    if (doctorStatus?.startDelay && doctorStatus.startDelay > 0) {
      return (
        <Card className="bg-orange-100/50 border-orange-300">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><AlertTriangle />Doctor is Running Late</CardTitle>
            <CardDescription>We apologize for the inconvenience.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">The doctor is late by {doctorStatus.startDelay} minutes.</p>
          </CardContent>
        </Card>
      );
    }
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
  
  if (doctorStatus?.isPaused) {
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
                        Appointment at {format(parseISO(patient.appointmentTime || patient.slotTime), 'hh:mm a')}
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
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [doctorStatus, setDoctorStatus] = useState<DoctorStatus | null>(null);
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [foundAppointment, setFoundAppointment] = useState<Patient | null>(null);
  const [completedAppointmentForDisplay, setCompletedAppointmentForDisplay] = useState<Patient | null>(null);
  const [currentSession, setCurrentSession] = useState<'morning' | 'evening' | null>(null);
  const [hasTodaysAppointment, setHasTodaysAppointment] = useState<boolean | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('id');

  const getSessionForTime = useCallback((appointmentUtcDate: Date, localSchedule: DoctorSchedule | null): 'morning' | 'evening' | null => {
    if (!localSchedule) return null;
    const timeZone = "Asia/Kolkata";
    
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

    const sessionLocalToUtc = (sessionTime: string) => {
        let localDate: Date;
        // The time is stored as 'HH:mm' format in the schedule
        localDate = parseDateFn(`${dateStr} ${sessionTime}`, 'yyyy-MM-dd HH:mm', new Date());
        return fromZonedTime(localDate, timeZone);
    }

    const checkSession = (session: Session) => {
      if (!session.isOpen) return false;
      const startUtc = sessionLocalToUtc(session.start);
      const endUtc = sessionLocalToUtc(session.end);
      const apptMs = appointmentUtcDate.getTime();
      return apptMs >= startUtc.getTime() && apptMs < endUtc.getTime();
    };

    if (checkSession(daySchedule.morning)) return 'morning';
    if (checkSession(daySchedule.evening)) return 'evening';
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
    if (!userPhone) return;

    const [patientData, statusData, scheduleData] = await Promise.all([
      getPatientsAction(),
      getDoctorStatusAction(),
      getDoctorScheduleAction(),
    ]);

    setSchedule(scheduleData);
    setDoctorStatus(statusData);

    const now = new Date();
    const realTimeSession = getSessionForTime(now, scheduleData);
    
    let sessionToShow: 'morning' | 'evening' | null = realTimeSession;
    
    // If we're outside session hours, determine which session to show
    if (!sessionToShow) {
      const timeZone = "Asia/Kolkata";
      const dayOfWeek = format(toZonedTime(now, timeZone), 'EEEE') as keyof DoctorSchedule['days'];
      const dateStr = format(toZonedTime(now, timeZone), 'yyyy-MM-dd');
      let daySchedule = scheduleData.days[dayOfWeek];
      const todayOverride = scheduleData.specialClosures.find(c => c.date === dateStr);
      if(todayOverride) {
          daySchedule = {
              morning: todayOverride.morningOverride ?? daySchedule.morning,
              evening: todayOverride.eveningOverride ?? daySchedule.evening
          };
      }
      
      // If doctor is online, it must be for an upcoming session
      if (statusData.isOnline && statusData.onlineTime) {
          sessionToShow = getSessionForTime(parseISO(statusData.onlineTime), scheduleData);
      } else {
        // If doctor is offline, show morning if we are before morning end, otherwise show evening
        const morningSession = daySchedule.morning;
        if (morningSession.isOpen) {
            const morningEndLocal = parseDateFn(`${dateStr} ${morningSession.end}`, 'yyyy-MM-dd HH:mm', new Date());
            const morningEndUtc = fromZonedTime(morningEndLocal, timeZone);
            if(now > morningEndUtc) {
                sessionToShow = 'evening'; // Show evening queue after morning is done
            } else {
                sessionToShow = 'morning'; // Show morning queue before it starts
            }
        } else {
           sessionToShow = 'evening'; // If morning is closed, default to evening
        }
      }
    }
    
    setCurrentSession(sessionToShow);
    
    const todayFilteredPatients = patientData.filter((p: Patient) => isToday(parseISO(p.appointmentTime)));
    
    const userHasTodaysAppointment = todayFilteredPatients.some((p: Patient) => p.phone === userPhone && p.status !== 'Cancelled');
    setHasTodaysAppointment(userHasTodaysAppointment);
    
    if (!userHasTodaysAppointment) {
        setAllPatients([]);
        setFoundAppointment(null);
        setCompletedAppointmentForDisplay(null);
        return;
    }

    const sessionFilteredPatients = todayFilteredPatients.filter((p: Patient) => getSessionForTime(parseISO(p.appointmentTime), scheduleData) === sessionToShow);
    
    setAllPatients(sessionFilteredPatients);
    setLastUpdated(new Date().toLocaleTimeString());

    if (patientId) {
      const id = parseInt(patientId, 10);
      const userAppointment = patientData.find((p: Patient) => p.id === id && p.phone === userPhone);

      if (userAppointment) {
          const isSameSession = getSessionForTime(parseISO(userAppointment.appointmentTime), scheduleData) === sessionToShow;

          if (userAppointment.status === 'Completed' && isSameSession) {
              const lastCompletedId = localStorage.getItem('completedAppointmentId');
              if (lastCompletedId !== patientId) {
                  setCompletedAppointmentForDisplay(userAppointment);
                  setFoundAppointment(null);
                  localStorage.setItem('completedAppointmentId', patientId);
              }
          } else if (isSameSession) {
              setFoundAppointment(userAppointment);
              setCompletedAppointmentForDisplay(null);
              localStorage.removeItem('completedAppointmentId');
          } else {
              setFoundAppointment(null);
              setCompletedAppointmentForDisplay(null);
          }
      } else {
          setFoundAppointment(null);
          setCompletedAppointmentForDisplay(null);
      }
    } else {
        setFoundAppointment(null);
        setCompletedAppointmentForDisplay(null);
        localStorage.removeItem('completedAppointmentId');
    }
  }, [getSessionForTime, patientId]);


  useEffect(() => {
    if (phone) {
        fetchData();
        const intervalId = setInterval(() => fetchData(), 15000);
        return () => clearInterval(intervalId);
    }
  }, [fetchData, phone]);
  
  const liveQueue = allPatients
    .filter(p => ['Waiting', 'Late', 'Priority', 'Up-Next'].includes(p.status))
    .sort((a, b) => {
        const timeA = a.bestCaseETC ? parseISO(a.bestCaseETC).getTime() : Infinity;
        const timeB = b.bestCaseETC ? parseISO(b.bestCaseETC).getTime() : Infinity;
        if (timeA === Infinity && timeB === Infinity) {
            return (a.tokenNo || 0) - (b.tokenNo || 0);
        }
        return timeA - timeB;
    });
  
  const nowServing = allPatients.find(p => p.status === 'In-Consultation');
  const upNext = liveQueue.find(p => p.status === 'Up-Next');
  const waitingQueue = liveQueue.filter(p => p.id !== upNext?.id);


  if (hasTodaysAppointment === null || !phone) {
      return (
          <div className="flex flex-col min-h-screen bg-muted/40">
              <PatientPortalHeader logoSrc={schedule?.clinicDetails?.clinicLogo} clinicName={schedule?.clinicDetails?.clinicName} />
              <div className="flex-1 flex items-center justify-center">
                  <p>Loading...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <PatientPortalHeader logoSrc={schedule?.clinicDetails?.clinicLogo} clinicName={schedule?.clinicDetails?.clinicName} />
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
        
        {completedAppointmentForDisplay ? (
             <CompletionSummary patient={completedAppointmentForDisplay} />
        ) : !hasTodaysAppointment ? (
             <div className="text-center mt-16">
                 <h1 className="text-3xl font-bold">No Active Appointment</h1>
                 <p className="text-lg text-muted-foreground mt-2">You do not have an appointment scheduled for today.</p>
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
                <AnimatePresence>
                {foundAppointment && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        <h2 className="text-2xl font-bold text-center">Your Status</h2>
                        {(() => {
                            const queuePosition = waitingQueue.findIndex(p => p.id === foundAppointment.id) + 1;
                            const isNowServing = nowServing?.id === foundAppointment.id;
                            const isUpNext = upNext?.id === foundAppointment.id;
                            return (
                              <YourStatusCard 
                                  key={foundAppointment.id}
                                  patient={foundAppointment}
                                  queuePosition={queuePosition}
                                  isUpNext={isUpNext}
                                  isNowServing={isNowServing}
                              />
                            )
                        })()}
                    </motion.div>
                )}
                </AnimatePresence>

                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <NowServingCard patient={nowServing} doctorStatus={doctorStatus} />
                    <UpNextCard patient={upNext} />
                    </div>
                    
                    <div className="mt-8">
                        <h2 className="text-2xl font-bold text-center mb-6">Waiting for Reports</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {allPatients.filter(p => isToday(parseISO(p.appointmentTime || p.slotTime)) && p.status === 'Waiting for Reports').map((patient) => (
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
                         {allPatients.filter(p => isToday(parseISO(p.appointmentTime || p.slotTime)) && p.status === 'Waiting for Reports').length === 0 && (
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

    

