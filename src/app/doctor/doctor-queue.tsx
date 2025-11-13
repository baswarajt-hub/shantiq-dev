

'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Patient } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronsRight,
  CircleCheck,
  FileClock,
  MoreVertical,
  Shield,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTransition } from 'react';
import {
  cancelAppointmentAction,
  updatePatientStatusAction,
} from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { SplitButton } from '@/components/ui/split-button';

const statusConfig: Record<Patient['status'], { color: string, label: string }> = {
  Waiting: { color: 'text-blue-600', label: 'Waiting' },
  'Up-Next': { color: 'text-yellow-600', label: 'Up Next' },
  'In-Consultation': { color: 'text-green-600', label: 'In Consultation' },
  Late: { color: 'text-orange-600', label: 'Late' },
  Priority: { color: 'text-red-700', label: 'Priority' },
  'Waiting for Reports': { color: 'text-purple-600', label: 'Reports' },
  Completed: { color: 'text-green-600', label: 'Completed' },
  Cancelled: { color: 'text-red-600', label: 'Cancelled' },
  Confirmed: { color: 'text-indigo-800', label: 'Confirmed' },
  Booked: { color: 'text-teal-800', label: 'Booked' },
  Missed: { color: 'text-gray-800', label: 'Missed' },
};


const PatientNameWithBadges = ({ patient }: { patient: Patient }) => (
    <span className="flex items-center gap-2">
      {patient.name}
        <span className="flex gap-1">
            {patient.subType === 'Booked Walk-in' && (
              <sup className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold" title="Booked Walk-in">B</sup>
            )}
            {patient.lateBy && patient.lateBy > 0 && patient.status !== 'Completed' && patient.status !== 'Cancelled' && (
              <sup className="inline-flex items-center justify-center rounded-md bg-red-500 px-1.5 py-0.5 text-white text-[10px] font-bold" title="Late">L</sup>
            )}
            {patient.subStatus === 'Reports' && (
              <sup className="inline-flex items-center justify-center rounded-md bg-purple-500 px-1.5 py-0.5 text-white text-[10px] font-bold" title="Waiting for Reports">R</sup>
            )}
            {patient.status === 'Priority' && (
               <sup className="inline-flex items-center justify-center rounded-md bg-red-700 px-1.5 py-0.5 text-white text-[10px] font-bold" title="Priority">P</sup>
            )}
        </span>
    </span>
);


export function DoctorQueue({
  patients,
  onUpdate,
}: {
  patients: Patient[];
  onUpdate: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleUpdateStatus = (patientId: string, status: Patient['status']) => {
    startTransition(async () => {
      const result = await updatePatientStatusAction(patientId, status);
      if ("success" in result) {
        toast({ title: 'Success', description: result.success });
        onUpdate();
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };



  const handleCancel = (patientId: string) => {
    startTransition(async () => {
      const result = await cancelAppointmentAction(patientId);
      if ("success" in result) {
        toast({ title: 'Success', description: result.success });
        onUpdate();
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };

  const nowServing = patients.find(p => p.status === 'In-Consultation');
  const upNext = patients.find(p => p.status === 'Up-Next');
  const waitingList = patients
    .filter(p => ['Waiting', 'Late', 'Priority'].includes(p.status) && p.id !== upNext?.id)
    .sort((a, b) => (a.tokenNo || 0) - (b.tokenNo || 0));

  const queue = [
    ...(nowServing ? [nowServing] : []),
    ...(upNext ? [upNext] : []),
    ...waitingList,
  ].filter(p => p.status !== 'Completed' && p.status !== 'Cancelled');

  const isLastInQueue = upNext && waitingList.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Queue</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Token</TableHead>
                <TableHead>Patient Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {queue.length > 0 ? (
                  queue.map(p => (
                    <motion.tr
                      key={p.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, x: -50 }}
                      className={cn(
                        'font-medium',
                        p.status === 'In-Consultation' &&
                          'bg-green-100/50 hover:bg-green-100/70',
                        p.status === 'Up-Next' &&
                          'bg-yellow-100/50 hover:bg-yellow-100/70'
                      )}
                    >
                      <TableCell className="font-bold text-lg">
                        #{p.tokenNo}
                      </TableCell>
                      <TableCell>
                        <PatientNameWithBadges patient={p} />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'border-2',
                            statusConfig[p.status as keyof typeof statusConfig]
                              ?.color
                          )}
                        >
                          {
                            statusConfig[p.status as keyof typeof statusConfig]
                              ?.label
                          }
                          {p.subStatus && ` (${p.subStatus})`}
                          {p.status === 'Priority' && <Shield className="ml-1.5 h-3.5 w-3.5" />}
                        </Badge>
                      </TableCell>
                      <TableCell>{p.purpose}</TableCell>
                      <TableCell className="text-right">
                        {p.status === 'In-Consultation' ? (
                          <SplitButton
                            size="sm"
                            variant="secondary"
                            disabled={isPending}
                            mainAction={{
                              label: <><CircleCheck className="mr-2 h-4 w-4" /> Mark as Completed</>,
                              onClick: () => handleUpdateStatus(p.id, 'Completed'),
                            }}
                            dropdownActions={[
                              {
                                label: <><FileClock className="mr-2 h-4 w-4" /> Waiting for Reports</>,
                                onClick: () => handleUpdateStatus(p.id, 'Waiting for Reports'),
                              },
                            ]}
                          />
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isPending}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {p.status === 'Up-Next' && isLastInQueue && (
                                  <DropdownMenuItem onClick={() => handleStartLastConsultation(p.id)}>
                                      <CircleCheck className="mr-2 h-4 w-4" />
                                      Start Final Consultation
                                  </DropdownMenuItem>
                              )}
                              {p.status === 'Waiting for Reports' && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleUpdateStatus(p.id, 'In-Consultation')
                                  }
                                >
                                  <ChevronsRight className="mr-2 h-4 w-4" />
                                  Re-Consult (Reports)
                                </DropdownMenuItem>
                              )}
                              {['Waiting', 'Late'].includes(p.status) && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleAdvanceQueue(p.id)}
                                  >
                                    <ChevronsRight className="mr-2 h-4 w-4" />
                                    Move to Up Next
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleUpdateStatus(p.id, 'Priority')
                                    }
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Shield className="mr-2 h-4 w-4" />
                                    Consult Now (Priority)
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleCancel(p.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Cancel Appointment
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </motion.tr>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No patients in the queue for this session.
                    </TableCell>
                  </TableRow>
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

