
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import type { Appointment, DoctorSchedule } from '@/lib/types';
import { isToday } from 'date-fns';

export function AppointmentActions({
  appointment,
  schedule,
  onReschedule,
  onCancel,
}: {
  appointment: Appointment;
  schedule: DoctorSchedule | null;
  onReschedule: (appt: Appointment) => void;
  onCancel: (id: string) => void;
}) {
  const isAppointmentToday = isToday(parseISO(appointment.date));
  const isQueueButtonActive = appointment.status === 'Booked' && isAppointmentToday;
  
  const hasBeenRescheduled = (appointment.rescheduleCount || 0) > 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button asChild variant="default" size="sm" className="h-8" disabled={!isQueueButtonActive}>
          <Link
            href={`/queue-status?id=${appointment.id}`}
            aria-disabled={!isQueueButtonActive}
            tabIndex={isQueueButtonActive ? 0 : -1}
            style={{ pointerEvents: isQueueButtonActive ? 'auto' : 'none' }}
          >
            <Bell className="h-3.5 w-3.5 mr-1.5" />
            View Queue
          </Link>
      </Button>
      
        {appointment.status === 'Booked' && (
           <Popover>
            <PopoverTrigger asChild>
              <span tabIndex={0}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => onReschedule(appointment)}
                  disabled={hasBeenRescheduled}
                >
                  <Edit className="h-3.5 w-3.5 mr-1.5" />Reschedule
                </Button>
              </span>
            </PopoverTrigger>
            {hasBeenRescheduled && (
              <PopoverContent side="top" align="center" className="w-auto p-2 text-sm">
                This appointment has already been rescheduled once.
              </PopoverContent>
            )}
          </Popover>
        )}

      {appointment.status === 'Booked' && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="h-8">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />Cancel
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action is permanent and you will not receive a refund. Are you sure you want to cancel this appointment?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Go Back</AlertDialogCancel>
              <AlertDialogAction onClick={() => onCancel(appointment.id)}>Confirm Cancellation</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
