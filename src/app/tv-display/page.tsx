
'use client';
import { getDoctorStatusAction, getPatientsAction, recalculateQueueWithETC } from '@/app/actions';
import { StethoscopeIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { FileClock, Hourglass, LogIn, LogOut, User, Timer, Ticket } from 'lucide-react';
import type { DoctorStatus, Patient } from '@/lib/types';
import { useEffect, useState } from 'react';
import { parseISO, format, isToday } from 'date-fns';

const anonymizeName = (name: string) => {
  const parts = name.split(' ');
  if (parts.length > 1) {
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
  }
  return parts[0];
};

export default function TVDisplayPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctorStatus, setDoctorStatus] = useState<DoctorStatus | null>(null);
  const [time, setTime] = useState('');
  const [doctorOnlineTime, setDoctorOnlineTime] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      await recalculateQueueWithETC();
      const patientData: Patient[] = await getPatientsAction();
      const statusData = await getDoctorStatusAction();
      const todaysPatients = patientData.filter(p => isToday(parseISO(p.appointmentTime)));
      setPatients(todaysPatients);
      setDoctorStatus(statusData);
    };

    const updateClock = () => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
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

  useEffect(() => {
    if (doctorStatus?.isOnline && doctorStatus.onlineTime) {
      setDoctorOnlineTime(new Date(doctorStatus.onlineTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } else {
      setDoctorOnlineTime('');
    }
  }, [doctorStatus]);

  const nowServing = patients.find((p) => p.status === 'In-Consultation');
  const waitingList = patients
    .filter((p) => p.status === 'Waiting' || p.status === 'Late')
    .sort((a, b) => (a.bestCaseETC && b.bestCaseETC) ? parseISO(a.bestCaseETC).getTime() - parseISO(b.bestCaseETC).getTime() : 0)
    .slice(0, 5);
  const waitingForReports = patients.filter(p => p.status === 'Waiting for Reports');

  return (
    <div className="bg-slate-900 text-white min-h-screen flex flex-col p-8 font-body">
      <header className="flex justify-between items-center pb-4 border-b-2 border-slate-700">
        <div className="flex items-center space-x-4">
          <StethoscopeIcon className="h-12 w-12 text-sky-400" />
          <h1 className="text-5xl font-bold">QueueWise Clinic</h1>
        </div>
        <div className="text-right">
            <div className="text-5xl font-semibold">{time}</div>
            {doctorStatus && (
                <div className={cn("flex items-center justify-end text-2xl mt-2", doctorStatus.isOnline ? 'text-green-400' : 'text-red-400')}>
                {doctorStatus.isOnline ? <LogIn className="h-6 w-6 mr-2" /> : <LogOut className="h-6 w-6 mr-2" />}
                Doctor is {doctorStatus.isOnline ? `Online (since ${doctorOnlineTime})` : 'Offline'}
                </div>
            )}
        </div>
      </header>

      <main className="flex-1 grid grid-cols-2 gap-8 pt-8">
        <div className="bg-slate-800 rounded-2xl p-8 flex flex-col justify-center items-center shadow-2xl">
          <h2 className="text-4xl text-sky-300 font-semibold mb-6">NOW SERVING</h2>
          <div className="text-center">
            {nowServing && doctorStatus?.isOnline ? (
              <>
                <Hourglass className="h-24 w-24 text-sky-400 mx-auto animate-pulse mb-4" />
                <p className="text-8xl font-bold tracking-wider">
                  {anonymizeName(nowServing.name)}
                </p>
                <p className="text-4xl text-slate-300 mt-4 flex items-center justify-center gap-3">
                  <Ticket className="h-8 w-8"/> Token #{nowServing.tokenNo}
                </p>
              </>
            ) : (
              <p className="text-6xl font-semibold text-slate-400">
                {doctorStatus?.isOnline ? 'Ready for next patient' : 'Doctor is Offline'}
              </p>
            )}
          </div>
        </div>
        <div className="bg-slate-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-4xl text-amber-300 font-semibold mb-6 text-center">UP NEXT</h2>
          <div className="space-y-5">
            {waitingList.length > 0 ? (
              waitingList.map((patient, index) => (
                <div
                  key={patient.id}
                  className={cn(
                    'p-5 rounded-lg flex items-center space-x-6 transition-all duration-300',
                    index === 0
                      ? 'bg-amber-400/20 border-2 border-amber-400'
                      : 'bg-slate-700'
                  )}
                >
                  <div className="flex-shrink-0 flex flex-col items-center gap-1">
                     <Ticket className={cn("h-8 w-8", index === 0 ? "text-amber-300" : "text-slate-400")} />
                     <span className={cn("font-bold text-xl", index === 0 ? "text-white" : "text-slate-300")}>#{patient.tokenNo}</span>
                  </div>
                  <div>
                    <p className={cn("text-5xl font-medium", index === 0 && "font-bold text-white")}>
                      {anonymizeName(patient.name)}
                    </p>
                    <p className={cn("text-2xl flex items-center gap-2", index === 0 ? "text-amber-200": "text-slate-400")}>
                      <Timer className="h-6 w-6"/> Wait Time: ~{patient.bestCaseETC ? format(parseISO(patient.bestCaseETC), 'hh:mm a') : `${patient.estimatedWaitTime} min`}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-3xl text-center text-slate-400 pt-16">
                The waiting queue is empty.
              </p>
            )}
          </div>
        </div>
      </main>

      {waitingForReports.length > 0 && (
         <footer className="pt-8 mt-8 border-t-2 border-slate-700">
            <h2 className="text-4xl text-purple-300 font-semibold mb-6 text-center">WAITING FOR REPORTS</h2>
             <div className="grid grid-cols-3 gap-6">
                {waitingForReports.map(patient => (
                     <div key={patient.id} className="bg-purple-500/20 border-2 border-purple-400 p-5 rounded-lg flex items-center space-x-6 transition-all duration-300">
                        <FileClock className="h-10 w-10 flex-shrink-0 text-purple-300" />
                        <div>
                             <p className="text-4xl font-medium text-white">
                                {anonymizeName(patient.name)}
                            </p>
                        </div>
                     </div>
                ))}
            </div>
         </footer>
      )}

    </div>
  );
}
