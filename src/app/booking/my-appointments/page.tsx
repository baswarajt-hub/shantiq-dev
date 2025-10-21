'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Clock, Edit, Trash2, Ticket, Bell } from 'lucide-react';
import type { FamilyMember, Appointment, DoctorSchedule, Patient } from '@/lib/types';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { RescheduleAppointmentDialog } from '@/components/booking/reschedule-appointment-dialog';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  cancelAppointmentAction,
  rescheduleAppointmentAction,
  getFamilyByPhoneAction,
  getPatientsAction,
  getDoctorScheduleAction
} from '@/app/actions';
import { format, parseISO, parse, isToday } from 'date-fns';
import { useRouter } from 'next/navigation';
import { getAppointmentStatus } from '@/lib/dateHelpers';

const AppointmentActions = ({ appointment, schedule, onReschedule, onCancel }: {
  appointment: Appointment,
  schedule: DoctorSchedule | null,
  onReschedule: (appt: Appointment) => void,
  onCancel: (id: string) => void
}) => {
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
      const appointmentHour24 = parseISO(appointment.date).getHours();
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
          setTooltipMessage("View the live queue now.");
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
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
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
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipMessage}</p>
          </TooltipContent>
        </Tooltip>

        {appointment.status === 'Booked' && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
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
            </TooltipTrigger>
            {hasBeenRescheduled && (
              <TooltipContent>
                <p>This appointment has already been rescheduled once.</p>
              </TooltipContent>
            )}
          </Tooltip>
        )}
      </TooltipProvider>

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
};

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'Booked': return 'bg-blue-100 text-blue-800';
    case 'Completed': return 'bg-green-100 text-green-800';
    case 'Cancelled': return 'bg-red-100 text-red-800';
    case 'Missed': return 'bg-yellow-100 text-yellow-800';
    case 'Waiting': return 'bg-indigo-100 text-indigo-800';
    case 'Late': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export default function MyAppointmentsPage() {
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [isRescheduleOpen, setRescheduleOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const userPhone = localStorage.getItem('userPhone');
    if (!userPhone) router.push('/login');
    else setPhone(userPhone);
  }, [router]);

  const loadData = useCallback(async (userPhone: string) => {
    startTransition(async () => {
      const [familyData, patientData, scheduleData] = await Promise.all([
        getFamilyByPhoneAction(userPhone),
        getPatientsAction(),
        getDoctorScheduleAction(),
      ]);
      setFamily(familyData);
      setPatients(patientData);
      setSchedule(scheduleData);
    });
  }, []);

  useEffect(() => {
    if (phone) loadData(phone);
  }, [phone, loadData]);

  useEffect(() => {
    if (!family.length || !patients.length) return;
    const appointmentsFromPatients = patients
      .filter(p => family.some(f => f.phone === p.phone))
      .map(p => {
        const famMember = family.find(f => f.phone === p.phone && f.name === p.name);
        const appointmentDate = parseISO(p.appointmentTime);
        return {
          id: p.id,
          familyMemberId: Number(famMember?.id || '0'),
          familyMemberName: p.name,
          date: p.appointmentTime,
          time: format(appointmentDate, 'hh:mm a'),
          status: p.status,
          type: p.type,
          purpose: p.purpose,
          rescheduleCount: p.rescheduleCount,
          tokenNo: p.tokenNo,
        };
      });
    setAppointments(appointmentsFromPatients as Appointment[]);
  }, [patients, family]);

  const handleCancelAppointment = useCallback((appointmentId: string) => {
    if (!phone) return;
    startTransition(async () => {
      const result = await cancelAppointmentAction(appointmentId);
      if ('error' in result) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Appointment Cancelled', description: 'Your appointment has been successfully cancelled.' });
        loadData(phone);
      }
    });
  }, [phone, toast, loadData]);

  const handleOpenReschedule = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setRescheduleOpen(true);
  };

  const handleRescheduleAppointment = useCallback((newDate: string, newTime: string, newPurpose: string) => {
    if (selectedAppointment && phone) {
      startTransition(async () => {
        try {
          // ✅ Safe parsing using date-fns
          const dateObj = parse(newDate, 'yyyy-MM-dd', new Date());
          const timeObj = parse(newTime, 'hh:mm a', new Date());
          if (isNaN(dateObj.getTime()) || isNaN(timeObj.getTime())) {
            throw new Error('Invalid date or time');
          }
          dateObj.setHours(timeObj.getHours(), timeObj.getMinutes(), 0, 0);
          const appointmentTime = dateObj.toISOString();

          const result = await rescheduleAppointmentAction(selectedAppointment.id, appointmentTime, newPurpose);
          if ('error' in result) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
          } else {
            toast({ title: 'Appointment Rescheduled', description: 'Your appointment has been successfully rescheduled.' });
            loadData(phone);
          }
        } catch {
          toast({ title: 'Error', description: 'Invalid date or time selected.', variant: 'destructive' });
        }
      });
    }
  }, [selectedAppointment, phone, toast, loadData]);

  const activeAppointments = appointments.filter(appt => !['Completed', 'Cancelled', 'Missed'].includes(appt.status));
  const safeGetStatus = (dateStr: string): 'today' | 'future' | 'past' => {
  try {
    return getAppointmentStatus(dateStr);
  } catch {
    return 'past'; // fallback
  }
};

const todaysAppointments = activeAppointments.filter(
  appt => safeGetStatus(appt.date) === 'today'
);

const upcomingAppointments = activeAppointments.filter(
  appt => safeGetStatus(appt.date) === 'future'
);

const pastAppointments = appointments.filter(
  appt => safeGetStatus(appt.date) === 'past'
);

  if (!phone || isPending) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        {/* Cards same as before (no change) */}
        {/* ... */}
      </div>
      {selectedAppointment && schedule && (
        <RescheduleAppointmentDialog
          isOpen={isRescheduleOpen}
          onOpenChange={setRescheduleOpen}
          appointment={selectedAppointment}
          schedule={schedule}
          onSave={handleRescheduleAppointment}
          bookedPatients={patients}
        />
      )}
    </main>
  );
}
