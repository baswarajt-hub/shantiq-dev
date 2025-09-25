

'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Clock, Edit, Eye, PlusCircle, Trash2, Ticket, Bell } from 'lucide-react';
import type { FamilyMember, Appointment, DoctorSchedule, Patient } from '@/lib/types';
import { AddFamilyMemberDialog } from '@/components/booking/add-family-member-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { RescheduleAppointmentDialog } from '@/components/booking/reschedule-appointment-dialog';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EditFamilyMemberDialog } from '@/components/booking/edit-family-member-dialog';
import { addNewPatientAction, updateFamilyMemberAction, cancelAppointmentAction, rescheduleAppointmentAction, getFamilyByPhoneAction, getPatientsAction, getDoctorScheduleAction, deleteFamilyMemberAction } from '@/app/actions';
import { format, parseISO, isToday, isFuture } from 'date-fns';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const AppointmentActions = ({ appointment, schedule, onReschedule, onCancel }: { appointment: Appointment, schedule: DoctorSchedule | null, onReschedule: (appt: Appointment) => void, onCancel: (id: number) => void }) => {
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
            } else { // now >= sessionEndDate
              setTooltipMessage("The doctor's session is over.");
            }
          }
      }
    };
  
    checkTime();
    const interval = setInterval(checkTime, 60000); // Check every minute
    return () => clearInterval(interval);
  
  }, [appointment, schedule]);
  
  if (appointment.status !== 'Booked') {
    return null;
  }
  
  const hasBeenRescheduled = (appointment.rescheduleCount || 0) > 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <span tabIndex={0}> 
              <Button asChild variant="default" size="sm" className="h-8" disabled={!isQueueButtonActive}>
                <Link href={`/queue-status?id=${appointment.id}`} aria-disabled={!isQueueButtonActive} tabIndex={isQueueButtonActive ? 0 : -1} style={{ pointerEvents: isQueueButtonActive ? 'auto' : 'none' }}>
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

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button variant="outline" size="sm" className="h-8" onClick={() => onReschedule(appointment)} disabled={hasBeenRescheduled}>
                  <Edit className="h-3.5 w-3.5 mr-1.5"/>Reschedule
                </Button>
              </span>
          </TooltipTrigger>
           {hasBeenRescheduled && (
              <TooltipContent>
                <p>This appointment has already been rescheduled once.</p>
              </TooltipContent>
            )}
        </Tooltip>

      </TooltipProvider>

      <AlertDialog>
          <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="h-8"><Trash2 className="h-3.5 w-3.5 mr-1.5" />Cancel</Button>
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
    </div>
  )
}

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
}


export default function MyAppointmentsPage() {
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [isAddMemberOpen, setAddMemberOpen] = useState(false);
  const [isEditMemberOpen, setEditMemberOpen] useState(false);
  const [isRescheduleOpen, setRescheduleOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [phone, setPhone] = useState<string|null>(null);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();


  useEffect(() => {
    const userPhone = localStorage.getItem('userPhone');
    if (!userPhone) {
      router.push('/login');
    } else {
        setPhone(userPhone);
    }
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
    if (phone) {
        loadData(phone);
    }
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
                familyMemberId: famMember?.id || 0,
                familyMemberName: p.name,
                date: p.appointmentTime,
                time: format(appointmentDate, 'hh:mm a'),
                status: p.status, 
                type: p.type,
                purpose: p.purpose,
                rescheduleCount: p.rescheduleCount,
                tokenNo: p.tokenNo,
            }
        });
    setAppointments(appointmentsFromPatients as Appointment[]);
  }, [patients, family]);
  

  const handleAddFamilyMember = useCallback((member: Omit<FamilyMember, 'id' | 'avatar' | 'phone'>) => {
    if (!phone) return;
    startTransition(async () => {
        const result = await addNewPatientAction({ ...member, phone });
        if(result.success){
            toast({ title: "Success", description: "Family member added."});
            loadData(phone);
        } else {
            toast({ title: "Error", description: result.error || "Could not add member", variant: 'destructive'});
        }
    });
  }, [phone, toast, loadData]);
  
  const handleEditFamilyMember = useCallback((updatedMember: FamilyMember) => {
     if (!phone) return;
     startTransition(async () => {
        const result = await updateFamilyMemberAction(updatedMember);
         if(result.success){
            toast({ title: "Success", description: "Family member details updated."});
            loadData(phone);
        } else {
            toast({ title: "Error", description: "Could not update member", variant: 'destructive'});
        }
    });
  }, [phone, toast, loadData]);

  const handleDeleteFamilyMember = useCallback((memberId: string) => {
      if (!phone) return;
      startTransition(async () => {
          const result = await deleteFamilyMemberAction(memberId);
          if(result.success) {
              toast({ title: "Success", description: "Family member removed."});
              loadData(phone);
          } else {
              toast({ title: "Error", description: "Could not remove member", variant: 'destructive'});
          }
      });
  }, [phone, toast, loadData]);

  const handleCancelAppointment = useCallback((appointmentId: number) => {
    if (!phone) return;
    startTransition(async () => {
        const result = await cancelAppointmentAction(appointmentId);
        if (result.success) {
            toast({ title: 'Appointment Cancelled', description: 'Your appointment has been successfully cancelled.' });
            loadData(phone);
        } else {
            toast({ title: 'Error', description: result.error || "Could not cancel appointment", variant: 'destructive' });
        }
    });
  }, [phone, toast, loadData]);

  const handleOpenReschedule = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setRescheduleOpen(true);
  }
  
  const handleOpenEditMember = (member: FamilyMember) => {
    setSelectedMember(member);
    setEditMemberOpen(true);
  }
  
  const handleRescheduleAppointment = useCallback((newDate: string, newTime: string, newPurpose: string) => {
    if (selectedAppointment && phone) {
      startTransition(async () => {
        const dateObj = new Date(`${newDate}T00:00:00`);
        const timeObj = new Date(`1970-01-01T${newTime}`);
        dateObj.setHours(timeObj.getHours(), timeObj.getMinutes());

        const appointmentTime = dateObj.toISOString();

        const result = await rescheduleAppointmentAction(selectedAppointment.id, appointmentTime, newPurpose);
        if(result.success) {
          toast({ title: 'Appointment Rescheduled', description: 'Your appointment has been successfully rescheduled.' });
          loadData(phone);
        } else {
          toast({ title: 'Error', description: result.error || "Could not reschedule", variant: 'destructive' });
        }
      });
    }
  }, [selectedAppointment, phone, toast, loadData]);
  
  const activeAppointments = appointments.filter(appt => !['Completed', 'Cancelled', 'Missed'].includes(appt.status as string));
  const todaysAppointments = activeAppointments.filter(appt => isToday(parseISO(appt.date)));
  const upcomingAppointments = activeAppointments.filter(appt => isFuture(parseISO(appt.date)) && !isToday(parseISO(appt.date)));
  const pastAppointments = appointments.filter(appt => !activeAppointments.some(up => up.id === appt.id));


  const familyPatients = family.filter(member => !member.isPrimary);

  if (!phone || isPending) {
      return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-6xl grid gap-8 md:grid-cols-3">
        {/* Left Column */}
        <div className="md:col-span-1 space-y-8">
            <Card className="bg-blue-50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Family Members</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setAddMemberOpen(true)}>
                  <PlusCircle className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {familyPatients.map(member => (
                  <div key={member.id} className="flex items-center justify-between p-2 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={member.avatar} alt={member.name} data-ai-hint="person" />
                        <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.gender}, Born {member.dob}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditMember(member)}><Edit className="h-4 w-4" /></Button>
                       <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action is permanent and will remove this family member.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteFamilyMember(member.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </div>
                  </div>
                ))}
                {familyPatients.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No family members added yet.</p>
                )}
              </CardContent>
            </Card>
        </div>

        {/* Right Column */}
        <div className="md:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Today's Appointments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {todaysAppointments.length > 0 ? todaysAppointments.map(appt => (
                <div key={appt.id} className="p-4 rounded-lg border bg-background flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                     <Avatar>
                        <AvatarImage src={family.find(f=>f.id === appt.familyMemberId)?.avatar} alt={appt.familyMemberName} data-ai-hint="person" />
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
                     <p className={`font-semibold text-sm px-2 py-1 rounded-full ${getStatusBadgeClass(appt.status as string)}`}>{appt.status}</p>
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
          
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Appointments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingAppointments.length > 0 ? upcomingAppointments.map(appt => (
                <div key={appt.id} className="p-4 rounded-lg border bg-background flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                     <Avatar>
                        <AvatarImage src={family.find(f=>f.id === appt.familyMemberId)?.avatar} alt={appt.familyMemberName} data-ai-hint="person" />
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
                     <p className={`font-semibold text-sm px-2 py-1 rounded-full ${getStatusBadgeClass(appt.status as string)}`}>{appt.status}</p>
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

           <Card>
            <CardHeader>
              <CardTitle>Past Appointments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pastAppointments.length > 0 ? pastAppointments.map(appt => {
                  let finalStatus: Appointment['status'] = appt.status;
                  if (finalStatus === 'Booked' && parseISO(appt.date) < new Date(new Date().setHours(0,0,0,0))) {
                      finalStatus = 'Missed';
                  }

                  return (
                      <div key={appt.id} className="p-4 rounded-lg border bg-background/50 flex flex-col sm:flex-row items-start justify-between gap-4 opacity-70">
                          <div className="flex items-center gap-4">
                              <Avatar>
                                  <AvatarImage src={family.find(f=>f.id === appt.familyMemberId)?.avatar} alt={appt.familyMemberName} data-ai-hint="person" />
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
                           <p className={`font-semibold text-sm px-2 py-1 rounded-full ${getStatusBadgeClass(finalStatus as string)}`}>{finalStatus}</p>
                      </div>
                  );
              }) : (
                <p className="text-muted-foreground text-center py-8">No past appointments.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    
      <AddFamilyMemberDialog 
        isOpen={isAddMemberOpen} 
        onOpenChange={setAddMemberOpen}
        onSave={handleAddFamilyMember} 
      />
      {selectedMember && (
          <EditFamilyMemberDialog
              isOpen={isEditMemberOpen}
              onOpenChange={setEditMemberOpen}
              member={selectedMember}
              onSave={handleEditFamilyMember}
          />
      )}
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

    