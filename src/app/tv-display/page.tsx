'use client';
import { getDoctorStatus, getPatients } from '@/lib/data';
import { StethoscopeIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Hourglass, LogIn, LogOut, User } from 'lucide-react';
import type { DoctorStatus, Patient } from '@/lib/types';
import { useEffect, useState } from 'react';

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
      const patientData = await getPatients();
      const statusData = await getDoctorStatus();
      setPatients(patientData);
      setDoctorStatus(statusData);
      if (statusData?.isOnline && statusData.onlineTime) {
        setDoctorOnlineTime(new Date(statusData.onlineTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
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

  const nowServing = patients.find((p) => p.status === 'In-Consultation');
  const waitingList = patients
    .filter((p) => p.status === 'Waiting' || p.status === 'Late')
    .sort((a, b) => new Date(a.appointmentTime).getTime() - new Date(b.appointmentTime).getTime())
    .slice(0, 5);

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
                <p className="text-3xl text-slate-400 mt-2">
                  Please proceed to consultation room
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
            {waitingList.length > 0 && doctorStatus?.isOnline ? (
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
                  <User className={cn("h-10 w-10 flex-shrink-0", index === 0 ? "text-amber-300" : "text-slate-400")} />
                  <div>
                    <p className={cn("text-5xl font-medium", index === 0 && "font-bold text-white")}>
                      {anonymizeName(patient.name)}
                    </p>
                    <p className={cn("text-2xl", index === 0 ? "text-amber-200": "text-slate-400")}>
                      Wait Time: ~{patient.estimatedWaitTime} min
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-3xl text-center text-slate-400 pt-16">
                {doctorStatus?.isOnline ? 'The waiting queue is empty.' : 'Doctor is Offline'}
              </p>
            )}
          </div>
        </div>
      </main>

       <footer className="text-center text-slate-500 text-xl pt-4">
        Thank you for your patience.
      </footer>
    </div>
  );
}
