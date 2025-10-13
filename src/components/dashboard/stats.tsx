
'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Patient } from "@/lib/types";
import { Stethoscope } from "lucide-react";

type StatsProps = {
  patients: Patient[];
  averageConsultationTime: number;
  averageWaitTime: number;
};

export default function Stats({ patients }: StatsProps) {
  const purposeCounts = patients.reduce((acc, patient) => {
    if (patient.purpose) {
      acc[patient.purpose] = (acc[patient.purpose] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Visit Purpose Breakdown</CardTitle>
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
  );
}
