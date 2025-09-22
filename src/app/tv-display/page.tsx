
'use client';
import { recalculateQueueWithETC, getPatientsAction, getDoctorScheduleAction } from '@/app/actions';
import { StethoscopeIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { FileClock, Hourglass, LogIn, LogOut, User, Timer, Ticket, ChevronRight, Activity, Users, Calendar, Footprints, ClockIcon, Repeat, Syringe, HelpCircle, Stethoscope, Clock, Shield, Pause, AlertTriangle, QrCode } from 'lucide-react';
import type { DoctorSchedule, DoctorStatus, Patient, Session } from '@/lib/types';
import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { parseISO, format, isToday, differenceInMinutes, parse as parseDateFn } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';


const anonymizeName = (name: string) => {
  if (!name) return '';
  const parts = name.split(' ');
  if (parts.length > 1) {
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
  }
  return parts[0];
};

const formatSessionTime = (session: Session) => {
    if (!session.isOpen) return 'Closed';
    const timeZone = "Asia/Kolkata";
    const formatTime = (time: string) => {
        if (!time) return '';
        try {
            const date = parseDateFn(time, 'HH:mm', new Date());
            return format(toZonedTime(date, timeZone), 'hh:mm a');
        } catch {
            return time; // Fallback for already formatted times
        }
    }
    return `${formatTime(session.start)} - ${formatTime(session.end)}`;
}

const purposeIcons: { [key: string]: React.ElementType } = {
    'Consultation': Stethoscope,
    'Follow-up visit': Repeat,
    'Vaccination': Syringe,
    'Others': HelpCircle,
};


const getPatientNameColorClass = (status: Patient['status'], type: Patient['type']) => {
    switch (status) {
        case 'Completed':
            return 'text-green-600';
        case 'Waiting':
        case 'Late':
        case 'Priority':
        case 'In-Consultation':
        case 'Up-Next':
            return 'text-blue-600';
        case 'Booked':
        case 'Confirmed':
            if (type === 'Walk-in') {
                return 'text-amber-800'; // Brown for walk-in not checked-in
            }
            return 'text-slate-800'; // Black for portal bookings not checked-in
        default:
            return 'text-slate-800';
    }
}


function TVDisplayPageContent() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctorStatus, setDoctorStatus] = useState<DoctorStatus | null>(null);
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [time, setTime] = useState('');
  const [averageWait, setAverageWait] = useState(0);
  const [currentSessionName, setCurrentSessionName] = useState<'morning' | 'evening' | null>(null);

  const searchParams = useSearchParams();
  const layout = searchParams.get('layout') || '1';


  const listRef = useRef<HTMLDivElement>(null);
  const timeZone = "Asia/Kolkata";

  const getSessionForTime = useCallback((appointmentUtcDate: Date, localSchedule: DoctorSchedule | null): 'morning' | 'evening' | null => {
    if (!localSchedule) return null;
    
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

    const sessionLocalToUtc = (sessionTime: string) => {
        let localDate: Date;
        localDate = parseDateFn(`${dateStr} ${sessionTime}`, 'yyyy-MM-dd HH:mm', new Date());
        return fromZonedTime(localDate, timeZone);
    }
    
    const checkSession = (sessionName: 'morning' | 'evening') => {
        const session = daySchedule[sessionName];
        if (!session.isOpen) return false;

        const isClosedByOverride = sessionName === 'morning' ? todayOverride?.isMorningClosed : todayOverride?.isEveningClosed;
        if(isClosedByOverride) return false;
        
        const effectiveSession = sessionName === 'morning' ? todayOverride?.morningOverride ?? session : todayOverride?.eveningOverride ?? session;

        const startUtc = sessionLocalToUtc(effectiveSession.start);
        const endUtc = sessionLocalToUtc(effectiveSession.end);

        const apptMs = appointmentUtcDate.getTime();
        return apptMs >= startUtc.getTime() && apptMs < endUtc.getTime();
    };

    if (checkSession('morning')) return 'morning';
    if (checkSession('evening')) return 'evening';
    return null;
  }, [timeZone]);

  const fetchData = useCallback(async () => {
    const [patientData, statusRes, scheduleData] = await Promise.all([
        getPatientsAction(),
        fetch('/api/status'),
        getDoctorScheduleAction()
    ]);
    
    const statusData = await statusRes.json();
    setSchedule(scheduleData);
    setDoctorStatus(statusData);

    const now = new Date();
    let sessionToShow: 'morning' | 'evening' | null = null;
    
    if (scheduleData) {
        sessionToShow = getSessionForTime(now, scheduleData);

        if (!sessionToShow) {
            const todayStr = format(toZonedTime(now, timeZone), 'yyyy-MM-dd');
            const dayName = format(toZonedTime(now, timeZone), 'EEEE') as keyof DoctorSchedule['days'];

            let daySchedule = scheduleData.days[dayName];
            if (daySchedule) {
                const todayOverride = scheduleData.specialClosures.find(c => c.date === todayStr);
                if (todayOverride) {
                    daySchedule = {
                        morning: todayOverride.morningOverride ?? daySchedule.morning,
                        evening: todayOverride.eveningOverride ?? daySchedule.evening,
                    };
                }
                
                const morningSession = daySchedule.morning;
                if (morningSession.isOpen) {
                    const morningEndLocal = parseDateFn(`${todayStr} ${morningSession.end}`, 'yyyy-MM-dd HH:mm', new Date());
                    const morningEndUtc = fromZonedTime(morningEndLocal, timeZone);
                    if (now > morningEndUtc) {
                        sessionToShow = 'evening';
                    } else {
                        sessionToShow = 'morning';
                    }
                } else {
                    sessionToShow = 'evening';
                }
            }
        }
    }
    
    setCurrentSessionName(sessionToShow);
    const todaysPatients = patientData.filter((p: Patient) => isToday(parseISO(p.appointmentTime)));
    const sessionPatients = todaysPatients.filter((p: Patient) => getSessionForTime(parseISO(p.appointmentTime), scheduleData) === sessionToShow);

    setPatients(sessionPatients);
    
    const currentlyWaiting = sessionPatients.filter(p => 
        ['Waiting', 'Late', 'Priority', 'Up-Next'].includes(p.status) && p.checkInTime
    );

    if (currentlyWaiting.length > 0) {
        const now = new Date();
        const totalWaitMinutes = currentlyWaiting.reduce((acc, p) => {
            const wait = differenceInMinutes(now, parseISO(p.checkInTime!));
            return acc + (wait > 0 ? wait : 0);
        }, 0);
        setAverageWait(Math.round(totalWaitMinutes / currentlyWaiting.length));
    } else if (scheduleData) {
        setAverageWait(scheduleData.slotDuration); // Default if no one is waiting
    }
  }, [getSessionForTime, timeZone]);

  useEffect(() => {
    fetchData(); // Initial fetch
    const dataIntervalId = setInterval(fetchData, 15000); // Poll every 15 seconds

    const updateClock = () => {
        setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    };
    updateClock();
    const clockIntervalId = setInterval(updateClock, 1000); 

    return () => {
        clearInterval(dataIntervalId);
        clearInterval(clockIntervalId);
    };
}, [fetchData]);

  // Scrolling logic
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    
    const isScrollingNeeded = list.scrollHeight > list.clientHeight;
    
    if (!isScrollingNeeded) {
        // If no scroll needed, ensure it's at the top.
        list.scrollTo({ top: 0, behavior: 'auto' });
        return;
    }

    let scrollTop = 0;
    
    const scrollInterval = setInterval(() => {
      list.scrollTo({ top: scrollTop, behavior: 'smooth' });
      scrollTop += 1;
      
      // Check if we've reached the bottom
      if (scrollTop >= list.scrollHeight - list.clientHeight) {
          // Pause at the bottom then reset
          setTimeout(() => {
              scrollTop = 0;
              list.scrollTo({ top: 0, behavior: 'smooth' });
          }, 5000); 
      }
    }, 200);

    return () => clearInterval(scrollInterval);
}, [patients, layout]); // Re-evaluate when patients or layout change

  if (!schedule || !doctorStatus) {
    return (
      <div className="bg-slate-50 text-slate-800 min-h-screen flex justify-center items-center">
        <p className="text-2xl font-semibold animate-pulse">Loading Clinic Display...</p>
      </div>
    );
  }

  const nowServing = patients.find((p) => p.status === 'In-Consultation');
  
  const waitingList = patients
    .filter(p => ['Waiting', 'Late', 'Priority', 'Up-Next'].includes(p.status))
    .sort((a, b) => {
        const timeA = a.bestCaseETC ? parseISO(a.bestCaseETC).getTime() : parseISO(a.slotTime).getTime();
        const timeB = b.bestCaseETC ? parseISO(b.bestCaseETC).getTime() : parseISO(a.slotTime).getTime();
        return timeA - timeB;
    });

  const waitingForReports = patients.filter(p => p.status === 'Waiting for Reports');
  const yetToArrive = patients.filter(p => p.status === 'Booked' || p.status === 'Confirmed');

  const upNext = waitingList.find(p => p.status === 'Up-Next');
  const queue = waitingList.filter(p => p.id !== upNext?.id);
  
  const clinicLogo = schedule.clinicDetails.clinicLogo;
  const doctorName = schedule.clinicDetails.doctorName || 'Doctor';
  const qualifications = schedule.clinicDetails.qualifications || '';
  const clinicName = schedule.clinicDetails.clinicName || 'Clinic';
  
  const todayStr = format(toZonedTime(new Date(), timeZone), 'yyyy-MM-dd');
  const dayName = format(toZonedTime(new Date(), timeZone), 'EEEE') as keyof DoctorSchedule['days'];

  let todaySchedule = schedule.days[dayName];
  if (!todaySchedule) {
      return (
        <div className="bg-slate-50 text-slate-800 min-h-screen flex justify-center items-center">
            <p className="text-2xl font-semibold text-red-500">Schedule not configured for today.</p>
        </div>
      );
  }
  const todayOverride = schedule.specialClosures.find(c => c.date === todayStr);
  if(todayOverride) {
    todaySchedule = {
        morning: todayOverride.morningOverride ?? schedule.days[dayName].morning,
        evening: todayOverride.eveningOverride ?? schedule.days[dayName].evening
    };
  }

  const now = new Date();
  
  let isSessionOver = false;
  if (currentSessionName && todaySchedule[currentSessionName]?.isOpen) {
      const sessionEndUTC = fromZonedTime(parseDateFn(`${todayStr} ${todaySchedule[currentSessionName].end}`, 'yyyy-MM-dd HH:mm', new Date()), timeZone);
      isSessionOver = now > sessionEndUTC;
  }
  
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';
  const qrCodeUrl = currentSessionName ? `${baseUrl}/walk-in?session=${currentSessionName}` : '';
  const showQrCode = doctorStatus.isQrCodeActive && qrCodeUrl;


  const PatientNameWithBadges = ({ patient }: { patient: Patient }) => (
    <span className="font-medium text-3xl flex items-center gap-2 relative">
      {anonymizeName(patient.name)}
      <span className="absolute -top-2 -right-4 flex gap-1">
        {patient.subType === 'Booked Walk-in' && (
          <sup className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold">B</sup>
        )}
        {patient.lateBy && patient.lateBy > 0 && patient.status !== 'In-Consultation' && (
          <sup className="inline-flex items-center justify-center rounded-md bg-red-500 px-1.5 py-0.5 text-white text-xs font-bold">LATE</sup>
        )}
        {(patient.status === 'Waiting for Reports' || patient.subStatus === 'Reports') && (
          <sup className="inline-flex items-center justify-center rounded-md bg-purple-500 px-1.5 py-0.5 text-white text-xs font-bold">REPORT</sup>
        )}
        {patient.status === 'Priority' && (
            <Shield className="h-6 w-6 text-red-600" title="Priority" />
        )}
      </span>
    </span>
  );
  
  if (layout === '2') {
    return (
      <div className="bg-slate-50 text-slate-800 min-h-screen flex flex-col font-body p-4 gap-4">
        <header className="grid grid-cols-3 items-center pb-4 border-b-2 border-slate-200">
          <div className="flex items-center space-x-4">
            {clinicLogo ? (
                <div className="relative h-16 w-16">
                  <Image src={clinicLogo} alt="Clinic Logo" fill className="object-contain" />
                </div>
            ) : (
              <StethoscopeIcon className="h-12 w-12 text-sky-500" />
            )}
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{clinicName}</h1>
               {todaySchedule && (
                  <div className="text-sm mt-2 bg-sky-100/50 p-2 rounded-md border border-sky-200 inline-block">
                      <p className="font-semibold text-sky-800"><span className="font-bold">Morning:</span> {formatSessionTime(todaySchedule.morning)}</p>
                      <p className="font-semibold text-sky-800"><span className="font-bold">Evening:</span> {formatSessionTime(todaySchedule.evening)}</p>
                  </div>
              )}
            </div>
          </div>

          <div className="text-center">
              <h2 className="text-4xl font-bold text-slate-900">{doctorName}</h2>
              <p className="text-lg text-slate-500">{qualifications}</p>
              
              <div className={cn("text-md px-3 py-0.5 mt-1 rounded-full inline-flex items-center gap-2", doctorStatus.isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                  {doctorStatus.isOnline ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                  {doctorStatus.isOnline ? 'Online' : 'Offline'}
              </div>
              {doctorStatus && !doctorStatus.isOnline && doctorStatus.startDelay > 0 && !isSessionOver && (
                  <div className="text-md px-3 py-0.5 mt-1 rounded-full inline-flex items-center gap-2 bg-orange-100 text-orange-700 font-semibold">
                      <AlertTriangle className="h-4 w-4" />
                      Doctor is running late by {doctorStatus.startDelay} minutes.
                  </div>
              )}
          </div>

          <div className="text-right flex flex-col items-center justify-center gap-2">
            <div className="text-5xl font-semibold text-slate-900">{time}</div>
              <div className="text-lg p-2 rounded-md bg-amber-100/50 border border-amber-200">
                  <div className="flex items-center gap-2 font-semibold text-amber-800">
                      <Activity className="h-6 w-6" />
                      Avg. Wait: <span className="font-bold">{averageWait} min</span>
                  </div>
              </div>
          </div>
        </header>

        <main className="flex-1 flex gap-4 overflow-hidden">
            {/* Left Column (25%) */}
            <div className="w-1/4 flex flex-col gap-4">
                <div className="bg-green-100 rounded-2xl p-4 flex flex-col justify-center items-center shadow-lg border-2 border-green-300">
                    <h2 className="text-2xl text-green-800 font-semibold">NOW SERVING</h2>
                    <AnimatePresence mode="wait">
                    {doctorStatus.isPaused ? (
                        <motion.div key="paused" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="text-center py-4">
                            <Pause className="h-12 w-12 text-yellow-500 mx-auto mb-2" />
                            <p className="text-4xl font-bold tracking-wider text-slate-900">Queue Paused</p>
                        </motion.div>
                    ) : nowServing ? (
                        <motion.div key={nowServing.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="text-center py-4">
                            <Hourglass className="h-12 w-12 text-green-700 mx-auto animate-pulse mb-2" />
                            <div className={cn("text-5xl font-bold tracking-wider", getPatientNameColorClass(nowServing.status, nowServing.type))}>
                               <PatientNameWithBadges patient={nowServing} />
                            </div>
                            <p className="text-2xl text-slate-500 mt-2 flex items-center justify-center gap-3"><Ticket className="h-7 w-7"/>#{nowServing.tokenNo}</p>
                        </motion.div>
                    ) : (
                        <motion.div key="no-one" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="text-center py-4">
                            <p className="text-3xl font-semibold text-green-700">{doctorStatus.isOnline ? (waitingList.length > 0 ? 'Ready for next' : 'Queue is empty') : 'Doctor is Offline'}</p>
                        </motion.div>
                    )}
                    </AnimatePresence>
                </div>

                {showQrCode ? (
                    <div className="bg-white rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-800">Scan for Walk-in</h3>
                        <p className="text-xs text-muted-foreground mb-2">Join the queue directly</p>
                        <Image
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrCodeUrl)}`}
                            alt="Walk-in QR Code"
                            width={150}
                            height={150}
                        />
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl p-4 flex flex-col shadow-lg border border-slate-200 overflow-hidden flex-1">
                        <h2 className="text-lg text-purple-600 font-semibold mb-2 text-center">WAITING FOR REPORTS</h2>
                        <div className="w-full space-y-2 overflow-y-auto text-sm flex-1">
                            {waitingForReports.length > 0 ? (
                                waitingForReports.map(patient => (
                                    <div key={patient.id} className="bg-purple-100 text-purple-800 p-2 rounded-lg flex items-center gap-2">
                                        <FileClock className="h-5 w-5 flex-shrink-0" />
                                        <span className="font-medium">{anonymizeName(patient.name)}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="flex-1 flex items-center justify-center h-full"><p className="text-slate-400">None</p></div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {/* Right Column (75%) */}
            <div className="w-3/4 flex-1 bg-white rounded-2xl p-6 shadow-lg border border-slate-200 flex flex-col overflow-hidden">
                {upNext && (
                    <div className={cn("rounded-xl p-4 mb-4 flex items-center justify-between shadow-md", upNext.status === 'Priority' ? 'bg-red-200 border-2 border-red-500' : 'bg-amber-100 border-2 border-amber-400')}>
                        <div className="flex items-center gap-4">
                            <h2 className={cn("text-2xl font-bold flex items-center gap-3", upNext.status === 'Priority' ? 'text-red-800' : 'text-amber-700')}>
                                {upNext.status === 'Priority' ? <Shield /> : <ChevronRight />}
                                {upNext.status === 'Priority' ? 'PRIORITY' : 'UP NEXT'}
                            </h2>
                            <div className="flex items-center gap-3">
                                <Ticket className={cn("h-7 w-7", upNext.status === 'Priority' ? 'text-red-700' : 'text-amber-600')}/>
                                <span className="text-3xl font-bold text-slate-800">#{upNext.tokenNo}</span>
                            </div>
                            <div className={cn("text-3xl font-bold", getPatientNameColorClass(upNext.status, upNext.type))}>
                                <PatientNameWithBadges patient={upNext} />
                            </div>
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-[80px_1fr_80px_150px_150px_300px] gap-4 pb-3 border-b-2 mb-2 text-slate-500 font-bold text-lg">
                    <h3 className="text-center">Token</h3>
                    <h3>Name</h3>
                    <h3 className="text-center">Purpose</h3>
                    <h3>Type</h3>
                    <h3 className="text-center">Wait Time</h3>
                    <h3 className="text-center">Estimated Consultation Time</h3>
                </div>
                <div ref={listRef} className="flex-1 overflow-y-scroll no-scrollbar">
                    <AnimatePresence>
                    {queue.length > 0 ? (
                        queue.map((patient) => {
                            const waitTime = patient.checkInTime ? differenceInMinutes(new Date(), parseISO(patient.checkInTime)) : null;
                            const PurposeIcon = patient.purpose && purposeIcons[patient.purpose] ? purposeIcons[patient.purpose] : HelpCircle;

                            return (
                            <motion.div
                                key={patient.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                className="grid grid-cols-[80px_1fr_80px_150px_150px_300px] gap-4 items-center py-3 text-2xl border-b border-slate-100"
                            >
                                <div className="font-bold text-3xl text-center text-sky-600">#{patient.tokenNo}</div>
                                <div className={cn("font-medium text-3xl flex items-center gap-2", getPatientNameColorClass(patient.status, patient.type))}>
                                    <PatientNameWithBadges patient={patient} />
                                </div>
                                <div className="text-center text-slate-600 flex justify-center"><PurposeIcon className="h-7 w-7" title={patient.purpose}/></div>
                                <div className="text-center font-medium text-slate-600">{patient.type}</div>
                                <div className="text-center font-semibold text-slate-600">{waitTime !== null && waitTime >= 0 ? `${waitTime} min` : '-'}</div>
                                <div className="text-center font-semibold text-slate-600 flex items-center justify-center gap-1">
                                    <span className="font-bold text-green-600">{patient.bestCaseETC ? format(parseISO(patient.bestCaseETC), 'hh:mm') : '-'}</span>
                                    <span>-</span>
                                    <span className="font-bold text-orange-600">{patient.worstCaseETC ? format(parseISO(patient.worstCaseETC), 'hh:mm a') : '-'}</span>
                                </div>
                            </motion.div>
                            )
                        })
                    ) : (
                        !upNext && <p className="text-center text-slate-400 text-2xl pt-16">The waiting queue is empty.</p>
                    )}
                    </AnimatePresence>
                </div>
            </div>
        </main>
      </div>
    );
  }

  // Default Layout 1
  return (
    <div className="bg-slate-50 text-slate-800 min-h-screen flex flex-col p-6 font-body">
      <header className="grid grid-cols-3 items-center pb-4 border-b-2 border-slate-200">
        <div className="flex items-center space-x-4">
          {clinicLogo ? (
              <div className="relative h-16 w-16">
                <Image src={clinicLogo} alt="Clinic Logo" fill className="object-contain" />
              </div>
          ) : (
             <StethoscopeIcon className="h-12 w-12 text-sky-500" />
          )}
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{clinicName}</h1>
            {todaySchedule && (
                <div className="text-sm mt-2 bg-sky-100/50 p-2 rounded-md border border-sky-200 inline-block">
                    <p className="font-semibold text-sky-800"><span className="font-bold">Morning:</span> {formatSessionTime(todaySchedule.morning)}</p>
                    <p className="font-semibold text-sky-800"><span className="font-bold">Evening:</span> {formatSessionTime(todaySchedule.evening)}</p>
                </div>
            )}
          </div>
        </div>

        <div className="text-center">
            <h2 className="text-4xl font-bold text-slate-900">{doctorName}</h2>
            <p className="text-lg text-slate-500">{qualifications}</p>
            <div className={cn("text-md px-3 py-0.5 mt-1 rounded-full inline-flex items-center gap-2", doctorStatus.isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                {doctorStatus.isOnline ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                {doctorStatus.isOnline ? 'Online' : 'Offline'}
            </div>
             {doctorStatus && !doctorStatus.isOnline && doctorStatus.startDelay > 0 && !isSessionOver && (
                <div className="text-md px-3 py-0.5 mt-1 rounded-full inline-flex items-center gap-2 bg-orange-100 text-orange-700 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Doctor is running late by {doctorStatus.startDelay} minutes.
                </div>
            )}
        </div>

        <div className="text-right flex flex-col items-center justify-center gap-2">
           <div className="text-5xl font-semibold text-slate-900">{time}</div>
            <div className="text-lg p-2 rounded-md bg-amber-100/50 border border-amber-200">
                <div className="flex items-center gap-2 font-semibold text-amber-800">
                    <Activity className="h-6 w-6" />
                    Avg. Wait: <span className="font-bold">{averageWait} min</span>
                </div>
            </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-4 pt-4">
        {/* Top Row: Now Serving, Reports, Yet to Arrive */}
        <div className="grid grid-cols-3 gap-4 h-[220px]">
            <div className="bg-white rounded-2xl p-6 flex flex-col justify-center items-center shadow-lg border-2 border-sky-500 col-span-1">
                <h2 className="text-3xl text-sky-600 font-semibold">NOW SERVING</h2>
                <AnimatePresence mode="wait">
                {doctorStatus.isPaused ? (
                     <motion.div
                        key="paused"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="text-center"
                    >
                        <Pause className="h-16 w-16 text-yellow-500 mx-auto mb-2" />
                        <p className="text-5xl font-bold tracking-wider text-slate-900">
                           Queue Paused
                        </p>
                    </motion.div>
                ) : nowServing ? (
                    <motion.div
                        key={nowServing.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="text-center"
                    >
                        <Hourglass className="h-16 w-16 text-sky-500 mx-auto animate-pulse mb-2" />
                        <div className={cn(
                           "text-6xl font-bold tracking-wider",
                           getPatientNameColorClass(nowServing.status, nowServing.type)
                         )}>
                            <PatientNameWithBadges patient={nowServing} />
                        </div>
                        <p className="text-3xl text-slate-500 mt-2 flex items-center justify-center gap-3">
                           <Ticket className="h-8 w-8"/>#{nowServing.tokenNo}
                        </p>
                    </motion.div>
                ) : (
                    <motion.div
                        key="no-one"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="text-center"
                    >
                        <p className="text-4xl font-semibold text-slate-400">
                           {doctorStatus.isOnline ? (waitingList.length > 0 ? 'Ready for next patient' : 'The queue is empty') : 'Doctor is Offline'}
                        </p>
                    </motion.div>
                )}
                </AnimatePresence>
            </div>
            
             <div className="bg-white rounded-2xl p-6 flex flex-col justify-center items-center shadow-lg border-2 border-amber-400 col-span-1">
                 <h2 className="text-3xl text-amber-600 font-semibold">UP NEXT</h2>
                 {upNext ? (
                    <motion.div
                        key={upNext.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="text-center"
                    >
                        {upNext.status === 'Priority' ? <Shield className="h-16 w-16 text-red-500 mx-auto mb-2"/> : <ChevronRight className="h-16 w-16 text-amber-500 mx-auto mb-2" />}
                        <div className={cn(
                           "text-6xl font-bold tracking-wider",
                           getPatientNameColorClass(upNext.status, upNext.type)
                         )}>
                          <PatientNameWithBadges patient={upNext} />
                        </div>
                         <p className="text-3xl text-slate-500 mt-2 flex items-center justify-center gap-3">
                           <Ticket className="h-8 w-8"/>#{upNext.tokenNo}
                        </p>
                    </motion.div>
                ) : (
                     <motion.div
                        key="no-one-next"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="text-center"
                    >
                        <p className="text-4xl font-semibold text-slate-400">
                           Queue is empty
                        </p>
                    </motion.div>
                )}
            </div>

            {showQrCode ? (
                <div className="bg-white rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg border border-slate-200">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><QrCode /> Scan for Walk-in</h3>
                    <p className="text-xs text-muted-foreground mb-1">Join the queue directly</p>
                    <Image
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrCodeUrl)}`}
                        alt="Walk-in QR Code"
                        width={150}
                        height={150}
                    />
                </div>
            ) : (
                <div className="bg-white rounded-2xl p-4 flex flex-col shadow-lg border border-slate-200 overflow-hidden col-span-1">
                    <div className="grid grid-rows-2 h-full">
                        <div className="row-span-1 border-b flex flex-col items-center justify-center">
                            <h3 className="text-center text-gray-600 font-semibold">In Queue</h3>
                            <div className="text-6xl font-bold text-slate-800 flex items-center gap-2">
                                <Users className="h-12 w-12 text-gray-400" />
                                {waitingList.length}
                            </div>
                        </div>
                        <div className="row-span-1 flex flex-col items-center justify-center">
                        <h3 className="text-center text-gray-600 font-semibold">Booked patients yet to arrive</h3>
                            <div className="text-6xl font-bold text-slate-800 flex items-center gap-2">
                            <Calendar className="h-12 w-12 text-gray-400" />
                            {yetToArrive.length}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Waiting List */}
        <div className="flex-1 bg-white rounded-2xl p-6 shadow-lg border border-slate-200 flex flex-col overflow-hidden">
            <div className="grid grid-cols-[80px_1fr_80px_150px_150px_300px] gap-4 pb-3 border-b-2 mb-2 text-slate-500 font-bold text-lg">
                <h3 className="text-center">Token</h3>
                <h3>Name</h3>
                <h3 className="text-center">Purpose</h3>
                <h3>Type</h3>
                <h3 className="text-center">Wait Time</h3>
                <h3 className="text-center">Estimated Consultation Time</h3>
            </div>
            <div ref={listRef} className="flex-1 overflow-y-scroll no-scrollbar">
                <AnimatePresence>
                {queue.length > 0 ? (
                    queue.map((patient, index) => {
                        const waitTime = patient.checkInTime ? differenceInMinutes(new Date(), parseISO(patient.checkInTime)) : null;
                        const PurposeIcon = patient.purpose && purposeIcons[patient.purpose] ? purposeIcons[patient.purpose] : HelpCircle;

                        return (
                        <motion.div
                            key={patient.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            className="grid grid-cols-[80px_1fr_80px_150px_150px_300px] gap-4 items-center py-3 text-2xl border-b border-slate-100"
                        >
                            <div className="font-bold text-3xl text-center text-sky-600">#{patient.tokenNo}</div>
                            <div className={cn(
                                "font-medium text-3xl flex items-center gap-2",
                                getPatientNameColorClass(patient.status, patient.type)
                            )}>
                               <PatientNameWithBadges patient={patient} />
                            </div>
                            <div className="text-center text-slate-600 flex justify-center">
                                <PurposeIcon className="h-7 w-7" title={patient.purpose}/>
                            </div>
                             <div className="text-center font-medium text-slate-600">
                                {patient.type}
                            </div>
                            <div className="text-center font-semibold text-slate-600">
                                {waitTime !== null && waitTime >= 0 ? `${waitTime} min` : '-'}
                            </div>
                            <div className="text-center font-semibold text-slate-600 flex items-center justify-center gap-1">
                                <span className="font-bold text-green-600">{patient.bestCaseETC ? format(parseISO(patient.bestCaseETC), 'hh:mm') : '-'}</span>
                                <span>-</span>
                                <span className="font-bold text-orange-600">{patient.worstCaseETC ? format(parseISO(patient.worstCaseETC), 'hh:mm a') : '-'}</span>
                            </div>
                        </motion.div>
                        )
                    })
                ) : (
                    !upNext && <p className="text-center text-slate-400 text-2xl pt-16">The waiting queue is empty.</p>
                )}
                </AnimatePresence>
            </div>
        </div>
      </main>
    </div>
  );
}

export default function TVDisplayPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <TVDisplayPageContent />
        </Suspense>
    )
}
