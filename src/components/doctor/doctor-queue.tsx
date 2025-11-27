

'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Patient, Fee, VisitPurpose } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChevronsRight,
  CircleCheck,
  FileClock,
  Shield,
  Trash2,
  Calendar,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTransition } from 'react';
import {
  consultNextAction,
  cancelAppointmentAction,
  updatePatientStatusAction,
} from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { SplitButton } from '@/components/ui/split-button';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

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


const PatientNameWithBadges = ({ patient, feeRecord, visitPurposes, onFeeClick }: { patient: Patient, feeRecord?: Fee, visitPurposes: VisitPurpose[], onFeeClick: () => void }) => {
  const purposeDetails = visitPurposes.find(p => p.name === patient.purpose);
  const isZeroFee = purposeDetails?.fee === 0;

  let feeStatusClass = 'bg-red-500 border-red-600'; // Default: Pending
  let feeTooltip = 'Fee Pending';
  
  if (isZeroFee) {
      feeStatusClass = 'bg-[#F97A00] border-[#F97A00]';
      feeTooltip = patient.purpose || 'Zero Fee Visit';
  } else if (feeRecord?.status === 'Paid') {
      if (feeRecord.mode === 'Cash') {
          feeStatusClass = 'bg-[#31694E] border-[#31694E]';
          feeTooltip = 'Paid (Cash)';
      } else {
          feeStatusClass = 'bg-[#B0CE88] border-[#B0CE88]';
          feeTooltip = `Paid (Online - ${feeRecord.onlineType || 'N/A'})`;
      }
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={onFeeClick}>
              <div className={cn("w-3 h-3 rounded-full border", feeStatusClass)} style={{ backgroundColor: feeStatusClass.startsWith('bg-[') ? feeStatusClass.split('[')[1].split(']')[0] : ''}}/>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{feeTooltip}</p>
          </TooltipContent>
        </Tooltip>
        <span>{patient.name}</span>
        <span className="flex gap-1">
            {patient.subType === 'Booked Walk-in' && (
              <sup className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold" title="Booked Walk-in">B</sup>
            )}
            {patient.status === 'Late' && (
              <sup className="inline-flex items-center justify-center rounded-md bg-red-500 px-1.5 py-0.5 text-white text-[10px] font-bold" title="Late">L</sup>
            )}
            {patient.status === 'Waiting for Reports' && (
              <sup className="inline-flex items-center justify-center rounded-md bg-purple-500 px-1.5 py-0.5 text-white text-[10px] font-bold" title="Waiting for Reports">R</sup>
            )}
            {patient.status === 'Priority' && (
               <sup className="inline-flex items-center justify-center rounded-md bg-red-700 px-1.5 py-0.5 text-white text-[10px] font-bold" title="Priority">P</sup>
            )}
        </span>
      </div>
    </TooltipProvider>
);
}


export function DoctorQueue({
  patients,
  fees,
  visitPurposes,
  onUpdate,
  onReschedule,
  onUpdateFamily,
  onOpenFeeDialog,
}: {
  patients: Patient[];
  fees: Fee[];
  visitPurposes: VisitPurpose[];
  onUpdate: () => void;
  onReschedule: (patient: Patient) => void;
  onUpdateFamily: (phone: string) => void;
  onOpenFeeDialog: (patient: Patient) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const handleAction = (action: () => Promise<any>, successMessage: string) => {
    startTransition(async () => {
      const result = await action();
      if ("success" in result) {
        toast({ title: 'Success', description: successMessage });
        onUpdate();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    });
  };

  const handleConsultNext = () => handleAction(consultNextAction, 'Queue advanced.');
  const handleMarkComplete = (id: string) => handleAction(() => updatePatientStatusAction(id, 'Completed'), 'Consultation completed.');
  const handleWaitForReports = (id: string) => handleAction(() => updatePatientStatusAction(id, 'Waiting for Reports'), 'Patient moved to Waiting for Reports.');
  const handleReConsultReports = (id: string) => handleAction(() => updatePatientStatusAction(id, 'In-Consultation'), 'Patient moved back to consultation.');
  const handleCancel = (id: string) => handleAction(() => cancelAppointmentAction(id), 'Appointment cancelled.');

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
                <TableHead className="text-right w-[200px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {queue.length > 0 ? (
                  queue.map(p => {
                    const feeRecord = fees.find(f => f.patientId === p.id);
                    return (
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
                        <PatientNameWithBadges patient={p} feeRecord={feeRecord} visitPurposes={visitPurposes} onFeeClick={() => onOpenFeeDialog(p)} />
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
                              label: <><CircleCheck className="mr-2 h-4 w-4" /> Mark Complete</>,
                              onClick: () => handleMarkComplete(p.id),
                            }}
                            dropdownActions={[
                              { label: <><FileClock className="mr-2 h-4 w-4" /> Waiting for Reports</>, onClick: () => handleWaitForReports(p.id) },
                              { label: <><Users className="mr-2 h-4 w-4" /> Update Family</>, onClick: () => onUpdateFamily(p.phone) },
                              { label: <><Calendar className="mr-2 h-4 w-4" /> Reschedule</>, onClick: () => onReschedule(p) },
                              { label: <><Trash2 className="mr-2 h-4 w-4" /> Cancel Appointment</>, onClick: () => handleCancel(p.id) },
                            ]}
                          />
                        ) : p.status === 'Up-Next' ? (
                          <Button size="sm" onClick={handleConsultNext} disabled={isPending}>
                            <ChevronsRight className="mr-2 h-4 w-4"/>Consult Next
                          </Button>
                        ) : p.status === 'Waiting for Reports' ? (
                          <Button size="sm" onClick={() => handleReConsultReports(p.id)} disabled={isPending}>
                             <ChevronsRight className="mr-2 h-4 w-4"/>Re-Consult
                          </Button>
                        ) : null}
                      </TableCell>
                    </motion.tr>
                  )})
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
