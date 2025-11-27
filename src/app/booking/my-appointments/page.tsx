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
import { AppointmentActions } from '@/components/booking/appointment-actions';


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
        {/* ✅ Today's Appointments */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Appointments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {todaysAppointments.length > 0 ? todaysAppointments.map(appt => (
              <div key={appt.id} className="p-4 rounded-lg border bg-card flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarImage src={(family.find(f => Number(f.id) === appt.familyMemberId)?.avatar || '')} alt={appt.familyMemberName} />
                    <AvatarFallback>{appt.familyMemberName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-lg">{appt.familyMemberName}</p>
                    <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {format(parseISO(appt.date), 'EEE, MMM d, yyyy')}</span>
                      <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {appt.time}</span>
                      {appt.tokenNo && <span className="flex items-center gap-1.5"><Ticket className="h-4 w-4" /> #{appt.tokenNo}</span>}
                    </div>
                    {appt.purpose && <p className="text-sm text-primary font-medium mt-1">{appt.purpose}</p>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 self-stretch justify-between">
                  <p className={`font-semibold text-sm px-2 py-1 rounded-full ${getStatusBadgeClass(appt.status)}`}>{appt.status}</p>
                  <AppointmentActions
                    appointment={appt}
                    schedule={schedule}
                    onReschedule={handleOpenReschedule}
                    onCancel={handleCancelAppointment}
                  />
                </div>
              </div>
            )) : (
              <p className="text-muted-foreground text-center py-8">No appointments for today.</p>
            )}
          </CardContent>
        </Card>

        {/* ✅ Upcoming Appointments */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Appointments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingAppointments.length > 0 ? upcomingAppointments.map(appt => (
              <div key={appt.id} className="p-4 rounded-lg border bg-card flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarImage src={(family.find(f => Number(f.id) === appt.familyMemberId)?.avatar || '')} alt={appt.familyMemberName} />
                    <AvatarFallback>{appt.familyMemberName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-lg">{appt.familyMemberName}</p>
                    <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {format(parseISO(appt.date), 'EEE, MMM d, yyyy')}</span>
                      <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {appt.time}</span>
                      {appt.tokenNo && <span className="flex items-center gap-1.5"><Ticket className="h-4 w-4" /> #{appt.tokenNo}</span>}
                    </div>
                    {appt.purpose && <p className="text-sm text-primary font-medium mt-1">{appt.purpose}</p>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 self-stretch justify-between">
                  <p className={`font-semibold text-sm px-2 py-1 rounded-full ${getStatusBadgeClass(appt.status)}`}>{appt.status}</p>
                  <AppointmentActions
                    appointment={appt}
                    schedule={schedule}
                    onReschedule={handleOpenReschedule}
                    onCancel={handleCancelAppointment}
                  />
                </div>
              </div>
            )) : (
              <p className="text-muted-foreground text-center py-8">No upcoming appointments.</p>
            )}
          </CardContent>
        </Card>

        {/* ✅ Past Appointments */}
        <Card>
          <CardHeader>
            <CardTitle>Past Appointments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pastAppointments.length > 0 ? pastAppointments.map(appt => {
              let finalStatus = appt.status;
              if (finalStatus === 'Booked' && parseISO(appt.date) < new Date(new Date().setHours(0, 0, 0, 0))) {
                finalStatus = 'Missed';
              }
              return (
                <div key={appt.id} className="p-4 rounded-lg border bg-card/50 flex flex-col sm:flex-row items-start justify-between gap-4 opacity-70">
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={(family.find(f => Number(f.id) === appt.familyMemberId)?.avatar || '')} alt={appt.familyMemberName} />
                      <AvatarFallback>{appt.familyMemberName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-lg">{appt.familyMemberName}</p>
                      <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                        <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {format(parseISO(appt.date), 'EEE, MMM d, yyyy')}</span>
                        <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {appt.time}</span>
                      </div>
                    </div>
                  </div>
                  <p className={`font-semibold text-sm px-2 py-1 rounded-full ${getStatusBadgeClass(finalStatus)}`}>{finalStatus}</p>
                </div>
              );
            }) : (
              <p className="text-muted-foreground text-center py-8">No past appointments.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ✅ Reschedule dialog */}
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
