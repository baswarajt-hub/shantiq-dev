

'use client';
import { getDoctorScheduleAction, getDoctorStatusAction, getPatientsAction, recalculateQueueWithETC } from '@/app/actions';
import { StethoscopeIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { FileClock, Hourglass, LogIn, LogOut, User, Timer, Ticket, ChevronRight, Activity, Users, Calendar, Footprints, ClockIcon, Repeat, Syringe, HelpCircle, Stethoscope, Clock } from 'lucide-react';
import type { DoctorSchedule, DoctorStatus, Patient, Session } from '@/lib/types';
import { useEffect, useState, useRef } from 'react';
import { parseISO, format, isToday, differenceInMinutes } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';

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
    const formatTime = (time: string) => {
        if (!time) return '';
        const [h, m] = time.split(':');
        const d = new Date();
        d.setHours(parseInt(h, 10), parseInt(m, 10));
        return format(d, 'hh:mm a');
    }
    return `${formatTime(session.start)} - ${formatTime(session.end)}`;
}

const purposeIcons: { [key: string]: React.ElementType } = {
    'Consultation': Stethoscope,
    'Follow-up visit': Repeat,
    'Vaccination': Syringe,
    'Others': HelpCircle,
};


export default function TVDisplayPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctorStatus, setDoctorStatus] = useState<DoctorStatus | null>(null);
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [time, setTime] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [averageWait, setAverageWait] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
      await recalculateQueueWithETC();
      const [patientData, statusData, scheduleData] = await Promise.all([
          getPatientsAction(),
          getDoctorStatusAction(),
          getDoctorScheduleAction()
      ]);
      const todaysPatients = patientData.filter((p: Patient) => isToday(parseISO(p.appointmentTime)));
      setPatients(todaysPatients);
      setDoctorStatus(statusData);
      setSchedule(scheduleData);
      
      const completedWithTime = todaysPatients.filter(p => p.status === 'Completed' && p.consultationTime);
      if (completedWithTime.length > 0) {
        const totalWait = completedWithTime.reduce((acc, p) => acc + (p.consultationTime || 0), 0);
        setAverageWait(Math.round(totalWait / completedWithTime.length));
      } else {
        setAverageWait(scheduleData.slotDuration); // Default to slot duration if no data
      }
  };

  useEffect(() => {
    const updateClock = () => {
      setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      setCurrentTime(new Date());
    };

    fetchData();
    updateClock();

    const dataIntervalId = setInterval(fetchData, 15000);
    const clockIntervalId = setInterval(updateClock, 1000); 

    return () => {
      clearInterval(dataIntervalId);
      clearInterval(clockIntervalId);
    };
  }, []);

  // Scrolling logic
  useEffect(() => {
    const list = listRef.current;
    if (!list || list.scrollHeight <= list.clientHeight) return;

    let scrollTop = 0;
    const scrollHeight = list.scrollHeight;
    const clientHeight = list.clientHeight;
    
    const scrollInterval = setInterval(() => {
        scrollTop += 1;
        if (scrollTop >= scrollHeight - clientHeight) {
            // Spend more time at the top
            setTimeout(() => {
                list.scrollTo({ top: 0, behavior: 'smooth' });
                scrollTop = 0;
            }, 5000); // 5s pause at the bottom before resetting
        } else {
            list.scrollTo({ top: scrollTop, behavior: 'smooth' });
        }
    }, 200); // Adjust speed of scroll

    return () => clearInterval(scrollInterval);
  }, [patients]);


  const nowServing = patients.find((p) => p.status === 'In-Consultation');
  const waitingList = patients
    .filter((p) => p.status === 'Waiting' || p.status === 'Late')
    .sort((a, b) => (a.bestCaseETC && b.bestCaseETC) ? parseISO(a.bestCaseETC).getTime() - parseISO(b.bestCaseETC).getTime() : 0);
  const waitingForReports = patients.filter(p => p.status === 'Waiting for Reports');

  const upNext = waitingList[0];
  const queue = waitingList.slice(1);
  const doctorName = schedule?.clinicDetails.doctorName || 'Doctor';
  const qualifications = schedule?.clinicDetails.qualifications || '';
  const clinicName = schedule?.clinicDetails.clinicName || 'Clinic';
  
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const dayName = format(new Date(), 'EEEE') as keyof DoctorSchedule['days'];
  let todaySchedule = schedule?.days[dayName];
  const todayOverride = schedule?.specialClosures.find(c => c.date === todayStr);
  if(todayOverride) {
    todaySchedule = {
        morning: todayOverride.morningOverride ?? schedule!.days[dayName].morning,
        evening: todayOverride.eveningOverride ?? schedule!.days[dayName].evening
    };
  }
  
  return (
    <div className="bg-slate-50 text-slate-800 min-h-screen flex flex-col p-6 font-body">
      <header className="grid grid-cols-3 items-center pb-4 border-b-2 border-slate-200">
        <div className="flex items-center space-x-4">
          <StethoscopeIcon className="h-12 w-12 text-sky-500" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{clinicName}</h1>
            {todaySchedule && (
                <div className="text-sm mt-2 bg-sky-100/50 p-2 rounded-md border border-sky-200">
                    <p className="font-semibold text-sky-800"><span className="font-bold">Morning:</span> {formatSessionTime(todaySchedule.morning)}</p>
                    <p className="font-semibold text-sky-800"><span className="font-bold">Evening:</span> {formatSessionTime(todaySchedule.evening)}</p>
                </div>
            )}
          </div>
        </div>

        <div className="text-center">
            <h2 className="text-4xl font-bold text-slate-900">{doctorName}</h2>
            <p className="text-lg text-slate-500">{qualifications}</p>
            <div className={cn("text-md px-3 py-0.5 mt-1 rounded-full inline-flex items-center gap-2", doctorStatus?.isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                {doctorStatus?.isOnline ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                {doctorStatus?.isOnline ? `Online since ${doctorStatus.onlineTime ? format(parseISO(doctorStatus.onlineTime), 'hh:mm a') : ''}` : 'Doctor is Offline'}
            </div>
        </div>

        <div className="text-right flex flex-col items-end gap-2">
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
        {/* Top Row: Now Serving & Reports */}
        <div className="grid grid-cols-2 gap-4 h-[250px]">
            <div className="bg-white rounded-2xl p-6 flex flex-col justify-between items-center shadow-lg border-2 border-sky-500">
                <h2 className="text-3xl text-sky-600 font-semibold">NOW SERVING</h2>
                <AnimatePresence mode="wait">
                {nowServing ? (
                    <motion.div
                        key={nowServing.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="text-center"
                    >
                        <Hourglass className="h-16 w-16 text-sky-500 mx-auto animate-pulse mb-2" />
                        <p className="text-6xl font-bold tracking-wider text-slate-900">
                        {anonymizeName(nowServing.name)}
                        </p>
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
                           {doctorStatus?.isOnline ? 'Ready for next patient' : 'Doctor is Offline'}
                        </p>
                    </motion.div>
                )}
                </AnimatePresence>
                 <div></div>
            </div>
            <div className="bg-white rounded-2xl p-6 flex flex-col items-center shadow-lg border border-slate-200">
                <h2 className="text-3xl text-purple-600 font-semibold mb-4">WAITING FOR REPORTS</h2>
                <div className="w-full space-y-3 overflow-y-auto">
                    {waitingForReports.length > 0 ? (
                        waitingForReports.map(patient => (
                            <div key={patient.id} className="bg-purple-100 text-purple-800 p-3 rounded-lg flex items-center gap-4">
                                <FileClock className="h-8 w-8 flex-shrink-0" />
                                <span className="text-3xl font-medium">{anonymizeName(patient.name)}</span>
                            </div>
                        ))
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-2xl text-slate-400">No one is waiting for reports</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Up Next */}
        {upNext && (
            <div className="bg-amber-100 border-2 border-amber-400 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-6">
                    <h2 className="text-3xl text-amber-700 font-bold flex items-center gap-3"><ChevronRight /> UP NEXT</h2>
                    <div className="flex items-center gap-3">
                         <Ticket className="h-8 w-8 text-amber-600"/>
                         <span className="text-4xl font-bold text-slate-800">#{upNext.tokenNo}</span>
                    </div>
                    <span className="text-4xl font-bold text-slate-800">{anonymizeName(upNext.name)}</span>
                </div>
                <div className="text-2xl font-semibold flex items-center gap-2">
                    <Timer className="h-7 w-7 text-slate-600" />
                    <span className="text-slate-600">ETC:</span>
                    <span className="font-bold text-green-600">{upNext.bestCaseETC ? format(parseISO(upNext.bestCaseETC), 'hh:mm a') : '-'}</span>
                    <span className="text-slate-600">-</span>
                    <span className="font-bold text-orange-600">{upNext.worstCaseETC ? format(parseISO(upNext.worstCaseETC), 'hh:mm a') : '-'}</span>
                </div>
            </div>
        )}

        {/* Waiting List */}
        <div className="flex-1 bg-white rounded-2xl p-6 shadow-lg border border-slate-200 flex flex-col overflow-hidden">
            <div className="grid grid-cols-[80px_1fr_80px_150px_150px_300px] gap-4 pb-3 border-b-2 mb-2 text-slate-500 font-bold text-lg">
                <h3 className="text-center">Token</h3>
                <h3>Name</h3>
                <h3 className="text-center">Purpose</h3>
                <h3 className="text-center">Type</h3>
                <h3 className="text-center">Wait Time</h3>
                <h3 className="text-center">Estimated Consultation Time</h3>
            </div>
            <div ref={listRef} className="flex-1 overflow-y-scroll no-scrollbar">
                <AnimatePresence>
                {queue.length > 0 ? (
                    queue.map((patient, index) => {
                        const waitTime = patient.checkInTime ? differenceInMinutes(currentTime, parseISO(patient.checkInTime)) : 0;
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
                            <div className="font-medium text-3xl">{anonymizeName(patient.name)}</div>
                            <div className="text-center text-slate-600 flex justify-center">
                                <PurposeIcon className="h-7 w-7" title={patient.purpose}/>
                            </div>
                             <div className="text-center font-medium text-slate-600">
                                {patient.type}
                            </div>
                            <div className="text-center font-semibold text-slate-600">
                                {waitTime > 0 ? `${waitTime} min` : '-'}
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
