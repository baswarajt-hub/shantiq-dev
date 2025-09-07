
'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Patient } from "@/lib/types";
import { Users, Clock, UserCheck, CalendarCheck, CalendarX, BookCheck, Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";

type StatsProps = {
  patients: Patient[];
};

export default function Stats({ patients }: StatsProps) {
  const waitingPatients = patients.filter(p => p.status === 'Waiting' || p.status === 'Late');
  const completedPatients = patients.filter(p => p.status === 'Completed');
  const yetToArrive = patients.filter(p => p.status === 'Confirmed');
  
  const totalAppointments = patients.filter(p => p.status !== 'Cancelled').length;

  const purposeCounts = patients.reduce((acc, patient) => {
    if (patient.purpose) {
      acc[patient.purpose] = (acc[patient.purpose] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">In Queue</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{waitingPatients.length}</div>
          <p className="text-xs text-muted-foreground">Patients currently waiting</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
          <CalendarCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalAppointments}</div>
          <p className="text-xs text-muted-foreground">For the selected day</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed</CardTitle>
          <BookCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{completedPatients.length}</div>
          <p className="text-xs text-muted-foreground">Consultations finished</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Yet to Arrive</CardTitle>
          <CalendarX className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{yetToArrive.length}</div>
          <p className="text-xs text-muted-foreground">Confirmed but not checked in</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Visit Purpose</CardTitle>
          <Stethoscope className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
           <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {Object.entries(purposeCounts).map(([purpose, count]) => (
                <div key={purpose} className="flex items-center gap-1">
                    <span className="font-semibold">{count}</span>
                    <span className="text-muted-foreground">{purpose}</span>
                </div>
            ))}
            {Object.keys(purposeCounts).length === 0 && (
                <p className="text-xs text-muted-foreground">No purposes specified yet.</p>
            )}
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
