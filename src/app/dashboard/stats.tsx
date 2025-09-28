
'use client';
import type { Patient } from "@/lib/types";
import { Users, CalendarCheck, BookCheck, Activity, CalendarX, Stethoscope, Icon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type StatsProps = {
  patients: Patient[];
  averageConsultationTime: number;
  averageWaitTime: number;
};

const StatCard = ({ title, value, Icon, description, className }: { title: string, value: string | number, Icon: Icon, description?: string, className?: string }) => (
    <div className={cn("flex items-center gap-4 p-4 bg-card rounded-lg border", className)}>
        <div className="p-2 bg-muted rounded-md">
            <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
            <div className="text-sm font-medium text-muted-foreground">{title}</div>
            <div className="text-2xl font-bold">{value}</div>
        </div>
    </div>
);

const CompactStatCard = ({ title, value, Icon, className }: { title: string, value: string | number, Icon: Icon, className?: string }) => (
    <div className={cn("flex items-center gap-3 p-3 bg-card rounded-lg border flex-1 justify-center", className)}>
         <Icon className="h-5 w-5 text-muted-foreground" />
         <div className="text-sm text-muted-foreground">{title}:</div>
         <div className="text-lg font-bold">{value}</div>
    </div>
);


export default function Stats({ patients, averageConsultationTime, averageWaitTime }: StatsProps) {
  const waitingPatients = patients.filter(p => p.status === 'Waiting' || p.status === 'Late' || p.status === 'Up-Next' || p.status === 'Priority');
  const completedPatients = patients.filter(p => p.status === 'Completed');
  const yetToArrive = patients.filter(p => p.status === 'Booked' || p.status === 'Confirmed');
  
  const totalAppointments = patients.filter(p => p.status !== 'Cancelled').length;

  const purposeCounts = patients.reduce((acc, patient) => {
    if (patient.purpose) {
      acc[patient.purpose] = (acc[patient.purpose] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const orderedPurposes = ['Consultation', 'Follow-up visit', 'Vaccination', 'Others'];

  return (
    <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <CompactStatCard title="In Queue" value={waitingPatients.length} Icon={Users} />
            <CompactStatCard title="Total" value={totalAppointments} Icon={CalendarCheck} />
            <CompactStatCard title="Yet to Arrive" value={yetToArrive.length} Icon={CalendarX} />
            <CompactStatCard title="Completed" value={completedPatients.length} Icon={BookCheck} />
            <CompactStatCard title="Avg. Consult" value={`${averageConsultationTime}m`} Icon={Activity} />
            <CompactStatCard title="Avg. Wait" value={`${averageWaitTime}m`} Icon={Clock} />
        </div>
        <div className="flex justify-center">
            <div className="flex items-center gap-3 p-3 bg-card rounded-lg border justify-center">
                <Stethoscope className="h-5 w-5 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">Purpose:</div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    {orderedPurposes.map((purpose) => {
                        const count = purposeCounts[purpose];
                        if (!count) return null;
                        return (
                            <div key={purpose} className="flex items-center gap-1.5">
                                <span className="font-bold">{count}</span>
                                <span className="text-muted-foreground">{purpose}</span>
                            </div>
                        )
                    })}
                    {Object.keys(purposeCounts).length === 0 && (
                        <p className="text-xs text-muted-foreground">N/A</p>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
}
