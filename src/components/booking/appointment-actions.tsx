
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
  const [isQueueButtonActive, setQueueButtonActive] = useState(false);
  const [tooltipMessage, setTooltipMessage] = useState("You can view live queue status an hour before the doctor's session starts.");

  useEffect(() => {
    if (appointment.status !== 'Booked' || !schedule || !isToday(parseISO(appointment.date))) {
      setQueueButtonActive(false);
      return;
    }

    const checkTime = () => {
      const now = new Date();
      const appointmentDate = parseISO(appointment.date);
      const dayOfWeek = format(appointmentDate, 'EEEE') as keyof DoctorSchedule['days'];
      let daySchedule = schedule.days[dayOfWeek];

      const todayOverride = schedule.specialClosures.find(c => c.date === format(appointmentDate, 'yyyy-MM-dd'));
      if (todayOverride) {
        daySchedule = {
          morning: todayOverride.morningOverride ?? daySchedule.morning,
          evening: todayOverride.eveningOverride ?? daySchedule.evening,
        };
      }

      let sessionStartTimeStr: string | null = null;
      let sessionEndTimeStr: string | null = null;
      const appointmentHour24 = appointmentDate.getHours();
      const morningEndHour = daySchedule.morning.isOpen ? parseInt(daySchedule.morning.end.split(':')[0], 10) : 0;

      if (daySchedule.morning.isOpen && appointmentHour24 < morningEndHour) {
        sessionStartTimeStr = daySchedule.morning.start;
        sessionEndTimeStr = daySchedule.morning.end;
      } else if (daySchedule.evening.isOpen) {
        sessionStartTimeStr = daySchedule.evening.start;
        sessionEndTimeStr = daySchedule.evening.end;
      }

      if (sessionStartTimeStr && sessionEndTimeStr) {
        const [startHours, startMinutes] = sessionStartTimeStr.split(':').map(Number);
        const [endHours, endMinutes] = sessionEndTimeStr.split(':').map(Number);
        const sessionStartDate = new Date(appointmentDate);
        sessionStartDate.setHours(startHours, startMinutes, 0, 0);
        const sessionEndDate = new Date(appointmentDate);
        sessionEndDate.setHours(endHours, endMinutes, 0, 0);
        const oneHourBeforeSession = new Date(sessionStartDate.getTime() - 60 * 60 * 1000);

        if (now >= oneHourBeforeSession && now < sessionEndDate) {
          setQueueButtonActive(true);
          setTooltipMessage('View the live queue now.');
        } else {
          setQueueButtonActive(false);
          if (now < oneHourBeforeSession) {
            setTooltipMessage("You can view live queue status an hour before the doctor's session starts.");
          } else {
            setTooltipMessage("The doctor's session is over.");
          }
        }
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, [appointment, schedule]);

  const hasBeenRescheduled = (appointment.rescheduleCount || 0) > 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover>
        <PopoverTrigger asChild>
          <span tabIndex={0}>
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
          </span>
        </PopoverTrigger>
        {!isQueueButtonActive && (
          <PopoverContent side="top" align="center" className="w-auto p-2 text-sm">
            {tooltipMessage}
          </PopoverContent>
        )}
      </Popover>

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
