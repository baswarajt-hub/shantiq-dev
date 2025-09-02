'use client';

import { useEffect, useState } from 'react';
import type { AIPatientData, Patient } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QueueControls } from './queue-controls';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  CheckCircle,
  Clock,
  Hourglass,
  Phone,
  User,
  UserX,
  XCircle,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { PatientCardActions } from './patient-card-actions';

function PatientCard({ patient }: { patient: Patient }) {
  const [formattedTime, setFormattedTime] = useState('');

  useEffect(() => {
    setFormattedTime(
      new Date(patient.appointmentTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  }, [patient.appointmentTime]);

  const statusConfig = {
    Waiting: {
      icon: Clock,
      color: 'bg-blue-100 text-blue-800 border-blue-300',
    },
    'In-Consultation': {
      icon: Hourglass,
      color: 'bg-yellow-100 text-yellow-800 border-yellow-300 animate-pulse',
    },
    Completed: {
      icon: CheckCircle,
      color: 'bg-green-100 text-green-800 border-green-300',
    },
    Late: { icon: UserX, color: 'bg-orange-100 text-orange-800 border-orange-300' },
    Cancelled: { icon: XCircle, color: 'bg-red-100 text-red-800 border-red-300' },
  };
  const currentStatus = statusConfig[patient.status];
  const StatusIcon = currentStatus.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="bg-card rounded-lg border shadow-sm"
    >
      <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-full ${currentStatus.color}`}>
            <StatusIcon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground">{patient.name}</h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> {patient.type}
              </span>
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> {patient.phone}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formattedTime}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <div className="text-right">
             <Badge variant={patient.status === "In-Consultation" ? "default" : "secondary" } className={`text-xs ${currentStatus.color}`}>
              {patient.status}
             </Badge>
            {patient.status === 'Waiting' && (
              <p className="text-xs text-muted-foreground mt-1">
                Wait: ~{patient.estimatedWaitTime} min
              </p>
            )}
          </div>
          <PatientCardActions patient={patient} />
        </div>
      </div>
    </motion.div>
  );
}

export default function PatientQueue({ initialPatients, aipatients }: { initialPatients: Patient[], aipatients: AIPatientData }) {
  const [patients] = useState<Patient[]>(initialPatients);

  const filterAndSortPatients = (status?: Patient['status']) => {
    let filtered = status ? patients.filter((p) => p.status === status) : patients;
    if (status === 'Waiting') {
      filtered = patients.filter((p) => p.status === 'Waiting' || p.status === 'Late');
    }
    
    // Sort by appointment time
    return filtered.sort((a,b) => new Date(a.appointmentTime).getTime() - new Date(b.appointmentTime).getTime());
  };

  const waitingPatients = filterAndSortPatients('Waiting');
  const completedPatients = filterAndSortPatients('Completed');
  const allPatients = filterAndSortPatients();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle>Patient Queue</CardTitle>
          <QueueControls aipatients={aipatients} />
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="waiting">
          <TabsList>
            <TabsTrigger value="waiting">Waiting ({waitingPatients.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedPatients.length})</TabsTrigger>
            <TabsTrigger value="all">All ({allPatients.length})</TabsTrigger>
          </TabsList>
          <div className="mt-4">
            <AnimatePresence>
               <TabsContent key="waiting" value="waiting">
                  <div className="space-y-3">
                    {waitingPatients.length > 0 ? (
                      waitingPatients.map((p) => <PatientCard key={p.id} patient={p} />)
                    ) : (
                      <p className="text-muted-foreground text-center py-8">No patients waiting.</p>
                    )}
                  </div>
               </TabsContent>
               <TabsContent key="completed" value="completed">
                  <div className="space-y-3">
                    {completedPatients.length > 0 ? (
                      completedPatients.map((p) => <PatientCard key={p.id} patient={p} />)
                    ) : (
                      <p className="text-muted-foreground text-center py-8">No completed patients today.</p>
                    )}
                  </div>
               </TabsContent>
               <TabsContent key="all" value="all">
                  <div className="space-y-3">
                    {allPatients.length > 0 ? (
                      allPatients.map((p) => <PatientCard key={p.id} patient={p} />)
                    ) : (
                      <p className="text-muted-foreground text-center py-8">No patients in the system.</p>
                    )}
                  </div>
               </TabsContent>
            </AnimatePresence>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
