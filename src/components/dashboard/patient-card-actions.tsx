
'use client';

import {
  sendReminderAction,
  updatePatientStatusAction,
} from '@/app/actions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import type { Patient } from '@/lib/types';
import {
  ChevronsRight,
  CircleCheck,
  Hourglass,
  MoreVertical,
  Send,
  Trash2,
} from 'lucide-react';
import { useTransition } from 'react';

export function PatientCardActions({ patient }: { patient: Patient }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleUpdateStatus = (status: Patient['status']) => {
    startTransition(async () => {
      const result = await updatePatientStatusAction(patient.id, status);
      if ("success" in result) {
        toast({ title: 'Success', description: result.success });
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    });
  };

  const handleSendReminder = () => {
    startTransition(async () => {
      const result = await sendReminderAction(patient.id);
      if ("success" in result) {
        toast({ title: 'Success', description: result.success });
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    });
  };

  const isActionable = patient.status === 'Waiting' || patient.status === 'Late' || patient.status === 'In-Consultation';

  if (!isActionable) {
    return <div className="w-10 h-10" />; // Placeholder for alignment
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isPending}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        { (patient.status === 'Waiting' || patient.status === 'Late') &&
          <DropdownMenuItem
            onClick={() => handleUpdateStatus('In-Consultation')}
          >
            <ChevronsRight className="mr-2 h-4 w-4" />
            Start Consultation
          </DropdownMenuItem>
        }
        { patient.status === 'In-Consultation' &&
          <DropdownMenuItem onClick={() => handleUpdateStatus('Completed')}>
            <CircleCheck className="mr-2 h-4 w-4" />
            Mark as Completed
          </DropdownMenuItem>
        }
        { patient.status === 'Waiting' &&
          <DropdownMenuItem onClick={() => handleUpdateStatus('Late')}>
            <Hourglass className="mr-2 h-4 w-4" />
            Mark as Late
          </DropdownMenuItem>
        }
        <DropdownMenuItem onClick={handleSendReminder}>
          <Send className="mr-2 h-4 w-4" />
          Send Reminder
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => handleUpdateStatus('Cancelled')}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Cancel Appointment
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
