
'use client';

import { PatientPortalHeader } from '@/components/patient-portal-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getPatientsAction, getDoctorScheduleAction, getDoctorStatusAction } from '@/app/actions';
import type { DoctorSchedule, DoctorStatus, Patient, Session } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CheckCircle, Clock, FileClock, Hourglass, Shield, WifiOff, Timer, Ticket, ArrowRight, UserCheck, PartyPopper, Pause, AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import { format, parseISO, isToday, differenceInMinutes, parse as parseDate } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

const timeZone = "Asia/Kolkata";

function sessionLocalToUtc(dateStr: string, sessionTime: string) {
  let localDate: Date;
  if (/^\\d{1,2}:\\d{2}$/.test(sessionTime)) {
    localDate = parseDate(`${dateStr} ${sessionTime}`, 'yyyy-MM-dd HH:mm', new Date());
  } else {
    localDate = parseDate(`${dateStr} ${sessionTime}`, 'yyyy-MM-dd hh:mm a', new Date());
  }
  return fromZonedTime(localDate, timeZone);
}

const StatusTags = ({ patient }: { patient: Patient }) => (
    <span className="flex gap-1.5 items-center">
        {patient.subType === 'Booked Walk-in' && (
            <sup className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold" title="Booked Walk-in">B</sup>
        )}
        {patient.status === 'Late' && (
            <sup className="inline-flex items-center justify-center rounded-md bg-red-500 px-1.5 py-0.5 text-white text-[10px] font-bold" title="Late">L</sup>
        )}
        {patient.status === 'Waiting for Reports' && (
            <sup className="inline-flex items-center justify-center rounded-md bg-purple-500 px-1.5 py-0.5 text-white text-[10px] font-bold" title="Waiting for Reports">R</sup>
        )}
        {patient.status === 'Priority' && (
            <sup className="inline-flex items-center justify-center rounded-md bg-red-700 px-1.5 py-0.5 text-white text-[10px] font-bold" title="Priority">P</sup>
        )}
    </span>
);


function NowServingCard({ patient, doctorStatus, schedule }: { patient: Patient | undefined, doctorStatus: DoctorStatus | null, schedule: DoctorSchedule | null }) {
  const timeZone = "Asia/Kolkata";
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

  const isOffline = !doctorStatus.isOnline;

  const cardClasses = cn(
    "border-2 w-full text-center p-4 rounded-xl shadow-lg",
    isOffline ? "bg-red-100/50 border-red-300" : "bg-green-100/50 border-green-300"
  );
  
  let TitleIcon = isOffline ? WifiOff : Hourglass;
  let titleText = isOffline ? 'Doctor Offline' : 'Now Serving';
  let descriptionText: string | React.ReactNode = isOffline ? 'The doctor is currently unavailable.' : 'Currently in consultation';

  if (doctorStatus.startDelay && doctorStatus.startDelay > 0 && isOffline && !isSessionOver) {
    TitleIcon = AlertTriangle;
    titleText = 'Doctor is Running Late';
    descriptionText = `The session will begin with a delay of approx. ${doctorStatus.startDelay} min.`;
  } else if (doctorStatus.isPaused) {
    TitleIcon = Pause;
    titleText = 'Queue Paused';
    descriptionText = 'The queue is temporarily paused.';
  } else if (!patient && !isOffline) {
    TitleIcon = UserCheck;
    titleText = 'Ready for Next';
    descriptionText = 'The doctor is ready to see the next patient.';
  }

  return (
    <Card className={cardClasses}>
      <CardHeader className="p-4">
        <CardTitle className="text-base flex items-center justify-center gap-2">
            <TitleIcon className={cn(patient && !isOffline && !doctorStatus.isPaused && 'animate-spin')} />
            {titleText}
        </CardTitle>
        <CardDescription className="text-xs">{descriptionText}</CardDescription>
      </CardHeader>
      {patient && (
        <CardContent className="p-4 pt-0">
          <p className="text-3xl font-bold flex items-center justify-center gap-2 relative">
            <span className="text-sky-700">Token #{patient.tokenNo}</span>
            <StatusTags patient={patient} />
          </p>
        </CardContent>
      )}
    </Card>
  )
}

function UpNextCard({ patient }: { patient: Patient | undefined}) {
    if (!patient) {
        return (
            <Card>
                <CardHeader className="p-4">
                    <CardTitle className="text-base">Queue is Empty</CardTitle>
                    <CardDescription className="text-xs">There are no patients waiting in this session.</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    const isPriority = patient.status === 'Priority';

    return (
         <Card className={cn('bg-primary/20 border-primary', isPriority && 'bg-red-100/70 border-red-400')}>
            <CardHeader className="p-4">
                 <CardTitle className="text-base flex items-center gap-2">
                    {isPriority ? <Shield className="text-red-600" /> : <ArrowRight />}
                    Up Next
                 </CardTitle>
                <CardDescription className="text-xs">Please proceed to the waiting area.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <p className="text-3xl font-bold flex items-center justify-center gap-2 relative">
                  <span className="text-sky-700">Token #{patient.tokenNo}</span>
                  <StatusTags patient={patient} />
                </p>
                <div className="text-muted-foreground flex items-center justify-center gap-2 mt-1 text-xs">
                    <Timer className="h-4 w-4"/> ETC: ~{patient.bestCaseETC ? format(parseISO(patient.bestCaseETC), 'hh:mm a') : '-'}
                </div>
            </CardContent>
        </Card>
    )
}

function CompletionSummary({ patient }: { patient: Patient }) {
    const router = useRouter();
    const waitTime = (patient.checkInTime && patient.consultationStartTime) ? differenceInMinutes(parseISO(patient.consultationStartTime), parseISO(patient.checkInTime)) : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
        >
            <PartyPopper className="h-16 w-16 mx-auto text-green-500" />
            <h2 className="text-2xl font-bold mt-4">Thank you for your trust in us!</h2>
            <p className="text-lg text-muted-foreground mt-2">
                We wish <span className="font-semibold text-primary">{patient.name}</span> a speedy recovery.
            </p>
            <div className="max-w-md mx-auto mt-6 grid grid-cols-2 gap-4 text-center">
                {waitTime !== null && waitTime >= 0 && (
                    <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground">Your wait time was</p>
                        <p className="text-2xl font-bold">{waitTime} min</p>
                    </div>
                )}
                 {patient.consultationTime && (
                    <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground">Consultation took</p>
                        <p className="text-2xl font-bold">{patient.consultationTime} min</p>
                    </div>
                )}
            </div>
            <Button className="mt-8" onClick={() => router.push('/booking')}>
                Back to Home
            </Button>
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
                <CardHeader className="p-4">
                    <CardTitle className="text-lg flex items-center gap-2"><Hourglass className="animate-spin" /> You Are Being Served</CardTitle>
                    <CardDescription className="text-sm">Please proceed to the consultation room.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold flex items-center gap-2">
                      Token <span className="text-sky-700">#{patient.tokenNo}</span>
                      <StatusTags patient={patient} />
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (isUpNext) {
         return (
            <Card className="bg-amber-100 border-amber-400">
                <CardHeader className="p-4">
                    <CardTitle className="text-lg flex items-center gap-2"><UserCheck /> You Are Up Next!</CardTitle>
                    <CardDescription className="text-sm">Please be ready, your turn is about to begin.</CardDescription>
                </CardHeader>
                 <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold flex items-center gap-2">
                      Token <span className="text-sky-700">#{patient.tokenNo}</span>
                      <StatusTags patient={patient} />
                    </div>
                </CardContent>
            </Card>
        )
    }
    
    if (patient.status === 'Booked' || patient.status === 'Confirmed') {
         return (
            <Card className="bg-blue-100 border-blue-400">
                <CardHeader className="p-4">
                    <CardTitle className="text-lg flex items-center gap-2"><Clock /> Appointment Booked</CardTitle>
                    <CardDescription className="text-sm">You have not checked in yet. Please check in at the reception upon arrival.</CardDescription>
                </CardHeader>
                 <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold flex items-center gap-2">
                      Token <span className="text-sky-700">#{patient.tokenNo}</span>
                      <StatusTags patient={patient} />
                    </div>
                    <p className="text-muted-foreground flex items-center gap-2 mt-1 text-sm">
                        Appointment at {format(parseISO(patient.appointmentTime), 'hh:mm a')}
                    </p>
                </CardContent>
            </Card>
        )
    }
    
    return (
        <Card>
            <CardHeader className="p-4 text-center">
                <CardTitle className="text-lg">Your Position in Queue</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 flex flex-col items-center gap-3">
                <div className="h-20 w-20 bg-blue-100 border-2 border-blue-300 rounded-full flex items-center justify-center">
                    <span className="text-3xl font-bold text-blue-800">{queuePosition}</span>
                </div>
                <div className="text-muted-foreground mt-2 space-y-1 text-center">
                     <div className="text-2xl font-bold flex items-center gap-2">
                        Token <span className="text-sky-700">#{patient.tokenNo}</span>
                        <StatusTags patient={patient} />
                    </div>
                    <div className="flex items-center gap-4 text-xs pt-2">
                        <div className="flex-1 space-y-1">
                            <p className="flex items-center gap-2 font-semibold text-green-600">
                                <Timer className="h-4 w-4" /> Best ETC:
                                <span className="font-bold">{patient.bestCaseETC ? format(parseISO(patient.bestCaseETC), 'hh:mm a') : '-'}</span>
                            </p>
                        </div>
                         <div className="flex-1 space-y-1">
                            <p className="flex items-center gap-2 font-semibold text-orange-600">
                                <Timer className="h-4 w-4" /> Worst ETC:
                                 <span className="font-bold">{patient.worstCaseETC ? format(parseISO(patient.worstCaseETC), 'hh:mm a') : '-'}</span>
                            </p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )

}

function QueueStatusPageContent() {
  const [allSessionPatients, setAllSessionPatients] = useState<Patient[]>([]);
  const [targetPatient, setTargetPatient] = useState<Patient | null>(null);
  const [doctorStatus, setDoctorStatus] = useState<DoctorStatus | null>(null);
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [completedAppointmentForDisplay, setCompletedAppointmentForDisplay] = useState<Patient | null>(null);
  const [currentSession, setCurrentSession] = useState<'morning' | 'evening' | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialLoadRef = useRef(true);
  
  const getSessionForTime = useCallback((appointmentUtcDate: Date, localSchedule: DoctorSchedule | null): 'morning' | 'evening' | null => {
    if (!localSchedule || !localSchedule.days) return null;
    
    const zonedAppt = toZonedTime(appointmentUtcDate, timeZone);
    const dayOfWeek = format(zonedAppt, 'EEEE') as keyof DoctorSchedule['days'];
    const dateStr = format(zonedAppt, 'yyyy-MM-dd');

    let daySchedule = localSchedule.days[dayOfWeek];
    if (!daySchedule) return null;
    
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

  const fetchData = useCallback(async (isInitial: boolean) => {
    if (isInitial) setIsLoading(true);
    else setIsRefreshing(true);

    try {
        const [allPatientData, statusData, scheduleData] = await Promise.all([
            getPatientsAction(),
            getDoctorStatusAction(),
            getDoctorScheduleAction(),
        ]);

        setSchedule(scheduleData);
        setDoctorStatus(statusData);

        let patientToTrack = targetPatient;

        if (initialLoadRef.current) {
            const userPhone = localStorage.getItem('userPhone');
            const patientIdParam = searchParams.get('id');
            
            if (!patientIdParam) {
              setAuthError("No appointment specified.");
              setIsLoading(false);
              return;
            }
            
            if (!userPhone) {
              router.push('/login');
              return;
            }

            const foundPatient = allPatientData.find((p: Patient) => p.id === patientIdParam) || null;
        
            if (!foundPatient) {
                setAuthError("This appointment could not be found.");
                setIsLoading(false);
                return;
            }

            if (foundPatient.phone !== userPhone) {
                setAuthError("You are not authorized to view this appointment's status.");
                setIsLoading(false);
                return;
            }
            
            patientToTrack = foundPatient;
            setAuthError(null);
            setTargetPatient(foundPatient);
            initialLoadRef.current = false;
        }

        if (!patientToTrack) {
            setIsLoading(false);
            setIsRefreshing(false);
            return;
        }
        
        const updatedPatient = allPatientData.find((p: Patient) => p.id === patientToTrack?.id) || null;
        setTargetPatient(updatedPatient);

        if (updatedPatient?.status === 'Completed') {
            setCompletedAppointmentForDisplay(updatedPatient);
            setIsLoading(false);
            setIsRefreshing(false);
            return;
        }

        if (updatedPatient) {
            let sessionToShow = getSessionForTime(parseISO(updatedPatient.appointmentTime), scheduleData);

            if (!sessionToShow && scheduleData) {
                const now = new Date();
                const todayStr = format(toZonedTime(now, timeZone), 'yyyy-MM-dd');
                const dayName = format(toZonedTime(now, timeZone), 'EEEE') as keyof DoctorSchedule['days'];
                const daySchedule = scheduleData.days[dayName];
                
                if (daySchedule) {
                    const morningStartUtc = daySchedule.morning.isOpen ? sessionLocalToUtc(todayStr, daySchedule.morning.start) : null;
                    const morningEndUtc = daySchedule.morning.isOpen ? sessionLocalToUtc(todayStr, daySchedule.morning.end) : null;
                    const eveningStartUtc = daySchedule.evening.isOpen ? sessionLocalToUtc(todayStr, daySchedule.evening.start) : null;
                    
                    if (morningStartUtc && now < morningStartUtc) {
                        sessionToShow = 'morning';
                    } else if (morningEndUtc && eveningStartUtc && now >= morningEndUtc && now < eveningStartUtc) {
                        sessionToShow = 'evening';
                    } else {
                        sessionToShow = now.getHours() < 14 ? 'morning' : 'evening';
                    }
                }
            }
            setCurrentSession(sessionToShow);

            if (scheduleData) {
                const todaysPatients = allPatientData.filter((p: Patient) => isToday(new Date(p.appointmentTime)));
                const filteredPatientsForSession = todaysPatients.filter((p: Patient) => getSessionForTime(parseISO(p.appointmentTime), scheduleData) === sessionToShow);
                setAllSessionPatients(filteredPatientsForSession);
            }
        }
      
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        if(isInitial) setIsLoading(false);
        setIsRefreshing(false);
    } catch(e) {
        console.error("Fetch data error:", e);
        if (isInitial) setIsLoading(false);
        setIsRefreshing(false);
    }
  }, [searchParams, getSessionForTime, router, targetPatient]);


  useEffect(() => {
    fetchData(true); // Initial fetch only
  }, []); // Empty dependency array ensures it runs only once on mount
  
  const nowServing = allSessionPatients.find(p => p.status === 'In-Consultation');
  const upNext = allSessionPatients.find(p => p.status === 'Up-Next');
  
  const waitingQueue = allSessionPatients
    .filter(p => ['Waiting', 'Late', 'Priority'].includes(p.status) && p.id !== upNext?.id)
    .sort((a, b) => {
        const timeA = a.bestCaseETC ? parseISO(a.bestCaseETC).getTime() : Infinity;
        const timeB = b.bestCaseETC ? parseISO(b.bestCaseETC).getTime() : Infinity;
        if (timeA === Infinity && timeB === Infinity) {
            return (a.tokenNo || 0) - (b.tokenNo || 0);
        }
        return timeA - timeB;
    });

  if (isLoading) {
      return (
          <div className="flex flex-col min-h-screen bg-muted/40">
              <PatientPortalHeader logoSrc={schedule?.clinicDetails?.clinicLogo} clinicName={schedule?.clinicDetails?.clinicName} />
              <div className="flex-1 flex items-center justify-center">
                  <p className="animate-pulse">Loading and verifying...</p>
              </div>
          </div>
      );
  }
  
  if (authError) {
      return (
         <div className="flex flex-col min-h-screen bg-muted/40">
              <PatientPortalHeader logoSrc={schedule?.clinicDetails?.clinicLogo} clinicName={schedule?.clinicDetails?.clinicName} />
              <main className="flex-1 flex flex-col items-center justify-center p-4">
                 <div className="text-center text-destructive font-semibold">{authError}</div>
              </main>
          </div>
      );
  }

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <PatientPortalHeader logoSrc={schedule?.clinicDetails?.clinicLogo} clinicName={schedule?.clinicDetails?.clinicName} />
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4">
            {completedAppointmentForDisplay ? (
                <CompletionSummary patient={completedAppointmentForDisplay} />
            ) : !targetPatient ? (
                <div className="text-center">
                    <h1 className="text-2xl font-bold">No Active Appointment</h1>
                    <p className="text-muted-foreground mt-1">This appointment may be over, or is not scheduled for today.</p>
                </div>
            ) : (
            <>
                <div className="text-center">
                    <h1 className="text-2xl font-bold tracking-tight">Live Queue Status</h1>
                    <div className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                        <span>{currentSession} session | Last updated: {lastUpdated}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => fetchData(false)} disabled={isRefreshing}>
                            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                        </Button>
                    </div>
                </div>
                
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                >
                    <AnimatePresence>
                        {(() => {
                          const isNowServing = nowServing?.id === targetPatient.id;
                          const isUpNext = upNext?.id === targetPatient.id;
                          let queuePosition = 0;
                          
                          if (['Waiting', 'Late', 'Priority'].includes(targetPatient.status)) {
                            // Find the position in the combined waiting list (which includes the 'up next')
                            const fullWaitingList = upNext ? [upNext, ...waitingQueue] : waitingQueue;
                            const waitingIndex = fullWaitingList.findIndex(p => p.id === targetPatient.id);
                            if (waitingIndex !== -1) {
                                // Add 1 because queuePosition is 1-based, and add 1 more if someone is being served
                                queuePosition = waitingIndex + (nowServing ? 1 : 0) + 1;
                            }
                          }
                          
                          return (
                              <motion.div
                                  key={targetPatient.id}
                                  layout
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.9 }}
                              >
                                  <YourStatusCard 
                                      patient={targetPatient}
                                      queuePosition={queuePosition}
                                      isUpNext={isUpNext}
                                      isNowServing={isNowServing}
                                  />
                              </motion.div>
                          );
                        })()}
                    </AnimatePresence>
                </motion.div>

                <>
                    <div className="grid grid-cols-2 gap-4">
                        <NowServingCard patient={nowServing} doctorStatus={doctorStatus} schedule={schedule} />
                        <UpNextCard patient={upNext} />
                    </div>
                </>
            </>
            )}
        </div>
      </main>
    </div>
  );
}

export default function QueueStatusPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading...</div>}>
            <QueueStatusPageContent />
        </Suspense>
    )
}
