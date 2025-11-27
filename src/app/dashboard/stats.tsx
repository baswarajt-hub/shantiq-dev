'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Patient } from "@/lib/types";
import { Stethoscope, Clock, Activity, Users, CalendarCheck, CheckCircle } from "lucide-react";

type StatsProps = {
  patients: Patient[];
  averageConsultationTime: number;
  averageWaitTime: number;
};

export default function Stats({ patients, averageConsultationTime, averageWaitTime }: StatsProps) {
  const purposeCounts = patients.reduce((acc, patient) => {
    if (patient.purpose) {
      acc[patient.purpose] = (acc[patient.purpose] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const totalAppointments = patients.filter(p => p.status !== 'Cancelled').length;
  const completedCount = patients.filter(p => p.status === 'Completed').length;
  const waitingCount = patients.filter(p => ['Waiting', 'Late', 'Priority', 'Up-Next'].includes(p.status)).length;


  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
                <CalendarCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{totalAppointments}</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Queue</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{waitingCount}</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Wait Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{averageWaitTime} min</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Consult Time</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{averageConsultationTime} min</div>
            </CardContent>
        </Card>
    </div>
  );
}
