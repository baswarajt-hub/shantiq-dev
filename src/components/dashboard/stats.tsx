import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Patient } from "@/lib/types";
import { Users, Clock, UserCheck } from "lucide-react";

type StatsProps = {
  patients: Patient[];
};

export default function Stats({ patients }: StatsProps) {
  const waitingPatients = patients.filter(p => p.status === 'Waiting' || p.status === 'Late');
  const nowServing = patients.find(p => p.status === 'In-Consultation');
  
  const totalWaitTime = waitingPatients.reduce((acc, p) => acc + p.estimatedWaitTime, 0);
  const avgWaitTime = waitingPatients.length > 0 ? Math.round(totalWaitTime / waitingPatients.length) : 0;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Patients in Queue</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{waitingPatients.length}</div>
          <p className="text-xs text-muted-foreground">Total patients waiting</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg. Wait Time</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgWaitTime} min</div>
          <p className="text-xs text-muted-foreground">Estimated average wait time</p>
        </CardContent>
      </Card>
      <Card className="bg-primary/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Now Serving</CardTitle>
          <UserCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold truncate">{nowServing?.name ?? 'None'}</div>
          <p className="text-xs text-muted-foreground">{nowServing ? `Checked in at ${new Date(nowServing.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Ready for next patient'}</p>
        </CardContent>
      </Card>
    </div>
  );
}
