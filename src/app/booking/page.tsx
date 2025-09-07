

'use client';

import { useState, useEffect, useTransition } from 'react';
import Header from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Clock, Edit, Eye, PlusCircle, Trash2, User as UserIcon } from 'lucide-react';
import type { FamilyMember, Appointment, DoctorSchedule, Patient } from '@/lib/types';
import { AddFamilyMemberDialog } from '@/components/booking/add-family-member-dialog';
import { BookAppointmentDialog } from '@/components/booking/book-appointment-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { RescheduleAppointmentDialog } from '@/components/booking/reschedule-appointment-dialog';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EditFamilyMemberDialog } from '@/components/booking/edit-family-member-dialog';
import { getDoctorSchedule, getFamily, getPatientsAction, addNewPatientAction, updateFamilyMemberAction, cancelAppointmentAction, rescheduleAppointmentAction, addAppointmentAction } from '@/app/actions';
import { format, parseISO, parse as parseDate } from 'date-fns';


const AppointmentActions = ({ appointment, schedule, onReschedule, onCancel }: { appointment: Appointment, schedule: DoctorSchedule | null, onReschedule: (appt: Appointment) => void, onCancel: (id: number) => void }) => {
  const [isQueueButtonActive, setQueueButtonActive] = useState(false);
  const [tooltipMessage, setTooltipMessage] = useState("You can view live queue status an hour before the doctor's session starts.");

  useEffect(() => {
    if (appointment.status !== 'Confirmed' || !schedule) {
      return;
    }
  
    const checkTime = () => {
      const now = new Date();
      const appointmentDate = parseISO(appointment.date);
      const dayOfWeek = format(appointmentDate, 'EEEE') as keyof DoctorSchedule['days'];
      const daySchedule = schedule.days[dayOfWeek];
  
      let sessionStartTimeStr: string | null = null;
      let sessionEndTimeStr: string | null = null;
      
      const appointmentHour12 = parseInt(appointment.time.split(':')[0], 10);
      const isPM = appointment.time.includes('PM');
      let appointmentHour24 = appointmentHour12;
      if (isPM && appointmentHour12 < 12) {
          appointmentHour24 += 12;
      } else if (!isPM && appointmentHour12 === 12) { // 12 AM case
          appointmentHour24 = 0;
      }
      
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
              setTooltipMessage("The doctor's session is over for today.");
            }
          }
      }
    };
  
    checkTime();
    const interval = setInterval(checkTime, 60000); // Check every minute
    return () => clearInterval(interval);
  
  }, [appointment, schedule]);
  
  if (appointment.status !== 'Confirmed') {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <span tabIndex={0}> 
              <Button asChild variant="default" size="sm" className="h-8" disabled={!isQueueButtonActive}>
                <Link href="/queue-status" aria-disabled={!isQueueButtonActive} tabIndex={isQueueButtonActive ? 0 : -1} style={{ pointerEvents: isQueueButtonActive ? 'auto' : 'none' }}>
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  View Queue
                </Link>
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button variant="outline" size="sm" className="h-8" onClick={() => onReschedule(appointment)}><Edit className="h-3.5 w-3.5 mr-1.5"/>Reschedule</Button>
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
        case 'Confirmed': return 'bg-blue-100 text-blue-800';
        case 'Completed': return 'bg-green-100 text-green-800';
        case 'Cancelled': return 'bg-red-100 text-red-800';
        case 'Missed': return 'bg-yellow-100 text-yellow-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}


export default function BookingPage() {
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [isAddMemberOpen, setAddMemberOpen] = useState(false);
  const [isEditMemberOpen, setEditMemberOpen] = useState(false);
  const [isBookingOpen, setBookingOpen] = useState(false);
  const [isRescheduleOpen, setRescheduleOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [currentDate, setCurrentDate] = useState('');
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    startTransition(async () => {
        const familyData = await getFamily();
        const patientData = await getPatientsAction();
        const scheduleData = await getDoctorSchedule();
        
        setFamily(familyData);
        setPatients(patientData);
        setSchedule(scheduleData);
    });
  };

  useEffect(() => {
    loadData();
    const today = new Date();
    setCurrentDate(today.toDateString());
  }, []);

  useEffect(() => {
    const appointmentsFromPatients = patients
        .filter(p => p.type === 'Appointment' || p.status === 'Confirmed') 
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
            }
        });
    setAppointments(appointmentsFromPatients as Appointment[]);
  }, [patients, family]);
  
  const todaySchedule = () => {
    if (!schedule) return null;
    const today = new Date();
    const dayOfWeek = format(today, 'EEEE') as keyof DoctorSchedule['days'];
    let todaySch = schedule.days[dayOfWeek];

    const dateStr = format(today, 'yyyy-MM-dd');
    const todayOverride = schedule.specialClosures.find(c => c.date === dateStr);
    if(todayOverride) {
        todaySch = {
            morning: todayOverride.morningOverride ?? todaySch.morning,
            evening: todayOverride.eveningOverride ?? todaySch.evening,
        };
    }


    const formatSession = (session: {start: string, end: string, isOpen: boolean}) => {
        if (!session.isOpen) return 'Closed';
        const formatTime = (time: string) => {
            const [h, m] = time.split(':');
            const d = new Date();
            d.setHours(parseInt(h, 10), parseInt(m, 10));
            return format(d, 'hh:mm a');
        }
        return `${formatTime(session.start)} - ${formatTime(session.end)}`;
    }

    return {
        morning: formatSession(todaySch.morning),
        evening: formatSession(todaySch.evening),
    }
  }


  const handleAddFamilyMember = (member: Omit<FamilyMember, 'id' | 'avatar' | 'phone'>) => {
    startTransition(async () => {
        // This is a simplified version, in a real app you'd associate the new member
        // with the logged-in user's family via their phone number.
        const phone = family.length > 0 ? family[0].phone : '5551112222';
        const result = await addNewPatientAction({...member, phone });
        if(result.success){
            toast({ title: "Success", description: "Family member added."});
            await loadData();
        } else {
            toast({ title: "Error", description: "Could not add member", variant: 'destructive'});
        }
    });
  };
  
  const handleEditFamilyMember = (updatedMember: FamilyMember) => {
     startTransition(async () => {
        const result = await updateFamilyMemberAction(updatedMember);
         if(result.success){
            toast({ title: "Success", description: "Family member details updated."});
            await loadData();
        } else {
            toast({ title: "Error", description: "Could not update member", variant: 'destructive'});
        }
    });
  }

  const handleBookAppointment = (familyMember: FamilyMember, date: string, time: string, purpose: string) => {
     startTransition(async () => {
        const dateObj = parseDate(date, 'yyyy-MM-dd', new Date());
        const timeObj = parseDate(time, 'hh:mm a', dateObj);
        const appointmentTime = timeObj.toISOString();

        const result = await addAppointmentAction(familyMember, appointmentTime, purpose);
        if (result.success) {
            toast({ title: "Success", description: "Appointment booked."});
            await loadData();
        } else {
            toast({ title: "Error", description: result.error, variant: 'destructive'});
        }
    });
  };

  const handleCancelAppointment = (appointmentId: number) => {
    startTransition(async () => {
        const result = await cancelAppointmentAction(appointmentId);
        if (result.success) {
            toast({ title: 'Appointment Cancelled', description: 'Your appointment has been successfully cancelled.' });
            await loadData();
        } else {
            toast({ title: 'Error', description: "Could not cancel appointment", variant: 'destructive' });
        }
    });
  }

  const handleOpenReschedule = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setRescheduleOpen(true);
  }
  
  const handleOpenEditMember = (member: FamilyMember) => {
    setSelectedMember(member);
    setEditMemberOpen(true);
  }

  const handleRescheduleAppointment = (newDate: string, newTime: string, newPurpose: string) => {
    if (selectedAppointment) {
      startTransition(async () => {
        const dateObj = parseDate(newDate, 'yyyy-MM-dd', new Date());
        const timeObj = parseDate(newTime, 'hh:mm a', dateObj);
        const appointmentTime = timeObj.toISOString();

        const result = await rescheduleAppointmentAction(selectedAppointment.id, appointmentTime, newPurpose);
        if(result.success) {
          toast({ title: 'Appointment Rescheduled', description: 'Your appointment has been successfully rescheduled.' });
          await loadData();
        } else {
          toast({ title: 'Error', description: "Could not reschedule", variant: 'destructive' });
        }
      });
    }
  };
  
  const upcomingAppointments = appointments.filter(appt => appt.status === 'Confirmed' && parseISO(appt.date) >= new Date(new Date().setHours(0,0,0,0)));
  const pastAppointments = appointments.filter(appt => appt.status !== 'Confirmed' || parseISO(appt.date) < new Date(new Date().setHours(0,0,0,0)));

  const currentDaySchedule = todaySchedule();

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <Header />
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Left Column */}
          <div className="md:col-span-1 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Today's Schedule</CardTitle>
                <CardDescription>{currentDate}</CardDescription>
              </CardHeader>
              <CardContent>
                {currentDaySchedule ? (
                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Morning:</span>
                      <span className="font-semibold">{currentDaySchedule.morning}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Evening:</span>
                      <span className="font-semibold">{currentDaySchedule.evening}</span>
                    </div>
                  </div>
                ) : (
                  <p>Loading schedule...</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Family Members</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setAddMemberOpen(true)}>
                  <PlusCircle className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {family.map(member => (
                  <div key={member.id} className="flex items-center justify-between">
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
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="md:col-span-2 space-y-8">
             <Card className="bg-gradient-to-br from-primary/20 to-background">
                <CardHeader>
                  <CardTitle className="text-2xl">Book Your Next Visit</CardTitle>
                  <CardDescription>Select a family member and find a time that works for you.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button size="lg" onClick={() => setBookingOpen(true)} disabled={family.length === 0}>
                    {family.length === 0 ? "Add a family member to book" : "Book an Appointment"}
                    </Button>
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
                    let finalStatus = appt.status;
                    if (finalStatus === 'Confirmed' && parseISO(appt.date) < new Date(new Date().setHours(0,0,0,0))) {
                        finalStatus = 'Missed';
                    }

                    return (
                        <div key={appt.id} className="p-4 rounded-lg border bg-background/50 flex items-start justify-between gap-4 opacity-70">
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
        <BookAppointmentDialog
          isOpen={isBookingOpen}
          onOpenChange={setBookingOpen}
          familyMembers={family}
          schedule={schedule}
          onSave={handleBookAppointment}
          bookedPatients={patients}
        />
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
    </div>
  );
}

    
