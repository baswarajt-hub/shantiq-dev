
'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Patient } from "@/lib/types";
import { Users, Clock, UserCheck, CalendarCheck, CalendarX, BookCheck, Stethoscope, Activity } from "lucide-react";
import { Separator } from "../ui/separator";

type StatsProps = {
  patients: Patient[];
  averageConsultationTime: number;
};

export function DoctorStats({ patients, averageConsultationTime }: StatsProps) {
  const waitingPatients = patients.filter(p => ['Waiting', 'Late', 'Priority', 'Up-Next'].includes(p.status));
  const completedPatients = patients.filter(p => p.status === 'Completed');
  const yetToArrive = patients.filter(p => ['Booked', 'Confirmed'].includes(p.status));
  
  const totalAppointments = patients.filter(p => p.status !== 'Cancelled').length;

  const purposeCounts = patients.reduce((acc, patient) => {
    if (patient.purpose) {
      acc[patient.purpose] = (acc[patient.purpose] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex flex-col items-center">
                <span className="text-2xl font-bold">{totalAppointments}</span>
                <span className="text-muted-foreground">Total</span>
            </div>
             <div className="flex flex-col items-center">
                <span className="text-2xl font-bold">{waitingPatients.length}</span>
                <span className="text-muted-foreground">Waiting</span>
            </div>
             <div className="flex flex-col items-center">
                <span className="text-2xl font-bold">{completedPatients.length}</span>
                <span className="text-muted-foreground">Completed</span>
            </div>
             <div className="flex flex-col items-center">
                <span className="text-2xl font-bold">{yetToArrive.length}</span>
                <span className="text-muted-foreground">Yet to Arrive</span>
            </div>
        </div>
        <Separator />
         <div className="text-sm space-y-1">
            <div className="font-semibold">Visit Purpose Breakdown:</div>
             <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {Object.entries(purposeCounts).map(([purpose, count]) => (
                    <div key={purpose} className="flex items-center gap-1.5">
                        <span className="font-bold text-base">{count}</span>
                        <span className="text-muted-foreground">{purpose}</span>
                    </div>
                ))}
                {Object.keys(purposeCounts).length === 0 && (
                    <p className="text-xs text-muted-foreground">No purposes specified yet.</p>
                )}
           </div>
         </div>
      </CardContent>
    </Card>
  );
}
