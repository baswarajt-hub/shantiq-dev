
'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Clock, Edit, Eye, PlusCircle, Trash2, User as UserIcon } from 'lucide-react';
import type { FamilyMember, Appointment } from '@/lib/types';
import { AddFamilyMemberDialog } from '@/components/booking/add-family-member-dialog';
import { BookAppointmentDialog } from '@/components/booking/book-appointment-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { RescheduleAppointmentDialog } from '@/components/booking/reschedule-appointment-dialog';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


const mockFamily: FamilyMember[] = [
  { id: 1, name: 'John Doe', dob: '1985-05-20', gender: 'Male', avatar: 'https://picsum.photos/id/237/200/200' },
  { id: 2, name: 'Jane Doe', dob: '1988-10-15', gender: 'Female', avatar: 'https://picsum.photos/id/238/200/200' },
  { id: 3, name: 'Jimmy Doe', dob: '2015-02-25', gender: 'Male', avatar: 'https://picsum.photos/id/239/200/200' },
];

const mockAppointments: Appointment[] = [
  { id: 1, familyMemberId: 3, familyMemberName: 'Jimmy Doe', date: '2024-08-15', time: '10:30 AM', status: 'Confirmed' },
  { id: 2, familyMemberId: 1, familyMemberName: 'John Doe', date: '2024-08-20', time: '04:00 PM', status: 'Confirmed' },
  { id: 3, familyMemberId: 2, familyMemberName: 'Jane Doe', date: '2024-07-10', time: '11:00 AM', status: 'Completed' },
  { id: 4, familyMemberId: 1, familyMemberName: 'John Doe', date: '2024-06-05', time: '09:00 AM', status: 'Cancelled' },
  { id: 5, familyMemberId: 3, familyMemberName: 'Jimmy Doe', date: '2024-07-25', time: '05:00 PM', status: 'Confirmed' },
];

const weeklySchedule = {
  Monday: { morning: '09:00 AM - 01:00 PM', evening: '04:00 PM - 07:00 PM' },
  Tuesday: { morning: '09:00 AM - 01:00 PM', evening: '04:00 PM - 07:00 PM' },
  Wednesday: { morning: '09:00 AM - 01:00 PM', evening: '04:00 PM - 07:00 PM' },
  Thursday: { morning: '09:00 AM - 01:00 PM', evening: '04:00 PM - 07:00 PM' },
  Friday: { morning: '09:00 AM - 01:00 PM', evening: '04:00 PM - 07:00 PM' },
  Saturday: { morning: '10:00 AM - 02:00 PM', evening: 'Closed' },
  Sunday: { morning: 'Closed', evening: 'Closed' },
};

type DaySchedule = {
    morning: string;
    evening: string;
};

const AppointmentActions = ({ appointment, onReschedule, onCancel }: { appointment: Appointment, onReschedule: (appt: Appointment) => void, onCancel: (id: number) => void }) => {
  const [isQueueButtonActive, setQueueButtonActive] = useState(false);
  const [tooltipMessage, setTooltipMessage] = useState("You can view live queue status an hour before the doctor's session starts.");

  useEffect(() => {
    if (appointment.status === 'Confirmed') {
        const appointmentDate = new Date(appointment.date.split('T')[0]);
        const dayOfWeek = appointmentDate.toLocaleString('en-us', { weekday: 'long' }) as keyof typeof weeklySchedule;
        const daySchedule = weeklySchedule[dayOfWeek];

        let sessionStartTimeStr: string | null = null;
        
        const appointmentHour12 = parseInt(appointment.time.split(':')[0], 10);
        const isPM = appointment.time.includes('PM');
        let appointmentHour24 = appointmentHour12;
        if (isPM && appointmentHour12 < 12) {
            appointmentHour24 += 12;
        } else if (!isPM && appointmentHour12 === 12) { // Midnight case
            appointmentHour24 = 0;
        }
        
        const morningSessionStartHour = daySchedule.morning !== 'Closed' ? parseInt(daySchedule.morning.split(':')[0]) : null;
        
        if (morningSessionStartHour !== null && appointmentHour24 < 13) {
            sessionStartTimeStr = daySchedule.morning.split(' - ')[0];
        } else if (daySchedule.evening !== 'Closed') {
            sessionStartTimeStr = daySchedule.evening.split(' - ')[0];
        }

        if (sessionStartTimeStr) {
            const [hoursStr, minutesStr] = sessionStartTimeStr.split(':');
            const [hours, minutes] = [parseInt(hoursStr, 10), parseInt(minutesStr.split(' ')[0], 10)];
            
            const sessionStartDate = new Date(appointmentDate);
            let sessionStartHour24 = hours;
            if (sessionStartTimeStr.includes('PM') && hours < 12) {
                sessionStartHour24 += 12;
            }
            sessionStartDate.setHours(sessionStartHour24, minutes, 0, 0);

            const oneHourBeforeSession = new Date(sessionStartDate.getTime() - 60 * 60 * 1000);
            
            const appointmentDateTime = new Date(appointmentDate);
            appointmentDateTime.setHours(appointmentHour24, parseInt(appointment.time.split(':')[1].split(' ')[0], 10), 0, 0);


            const checkTime = () => {
                const now = new Date();
                if (now >= oneHourBeforeSession && now < appointmentDateTime) {
                    setQueueButtonActive(true);
                    setTooltipMessage("View the live queue now.");
                } else {
                    setQueueButtonActive(false);
                    if (now < oneHourBeforeSession) {
                        setTooltipMessage(`You can view live queue status from ${oneHourBeforeSession.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} onwards.`);
                    } else { // now >= appointmentDateTime
                        setTooltipMessage("Queue is no longer active for this appointment.");
                    }
                }
            };

            checkTime();
            const interval = setInterval(checkTime, 60000); // Check every minute
            return () => clearInterval(interval);
        }
    }
  }, [appointment]);
  
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
                This action is permanent and you will not receive a refund. Are you sure you want to cancel?
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
  const [family, setFamily] = useState<FamilyMember[]>(mockFamily);
  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);
  const [isAddMemberOpen, setAddMemberOpen] = useState(false);
  const [isBookingOpen, setBookingOpen] = useState(false);
  const [isRescheduleOpen, setRescheduleOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<DaySchedule | null>(null);
  const [currentDate, setCurrentDate] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const today = new Date();
    const dayOfWeek = today.toLocaleString('en-us', { weekday: 'long' }) as keyof typeof weeklySchedule;
    setTodaySchedule(weeklySchedule[dayOfWeek]);
    setCurrentDate(today.toDateString());
  }, []);

  const handleAddFamilyMember = (member: Omit<FamilyMember, 'id' | 'avatar'>) => {
    const newMember = { ...member, id: Date.now(), avatar: `https://picsum.photos/seed/${Date.now()}/200/200` };
    setFamily(prev => [...prev, newMember]);
  };

  const handleBookAppointment = (appointment: Omit<Appointment, 'id' | 'status' | 'familyMemberName'>) => {
    const familyMember = family.find(f => f.id === appointment.familyMemberId);
    if (familyMember) {
      const newAppointment = { ...appointment, id: Date.now(), status: 'Confirmed' as const, familyMemberName: familyMember.name };
      setAppointments(prev => [...prev, newAppointment].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    }
  };

  const handleCancelAppointment = (appointmentId: number) => {
    setAppointments(prev => prev.map(appt => appt.id === appointmentId ? { ...appt, status: 'Cancelled' } : appt));
    toast({ title: 'Appointment Cancelled', description: 'Your appointment has been successfully cancelled.' });
  }

  const handleOpenReschedule = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setRescheduleOpen(true);
  }

  const handleRescheduleAppointment = (newDate: Date, newTime: string) => {
    if (selectedAppointment) {
      setAppointments(prev => 
        prev.map(appt => 
          appt.id === selectedAppointment.id 
            ? { ...appt, date: newDate.toISOString(), time: newTime } 
            : appt
        )
      );
      toast({ title: 'Appointment Rescheduled', description: 'Your appointment has been successfully rescheduled.' });
    }
  };
  
  const upcomingAppointments = appointments.filter(appt => appt.status === 'Confirmed' && new Date(appt.date) >= new Date(new Date().setHours(0,0,0,0)));
  const pastAppointments = appointments.filter(appt => appt.status !== 'Confirmed' || new Date(appt.date) < new Date(new Date().setHours(0,0,0,0)));

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
                {todaySchedule ? (
                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Morning:</span>
                      <span className="font-semibold">{todaySchedule.morning}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Evening:</span>
                      <span className="font-semibold">{todaySchedule.evening}</span>
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
                       <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
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
                  <Button size="lg" onClick={() => setBookingOpen(true)}>Book an Appointment</Button>
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
                            <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {new Date(appt.date).toDateString()}</span>
                            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {appt.time}</span>
                         </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 self-stretch justify-between">
                       <p className={`font-semibold text-sm px-2 py-1 rounded-full ${getStatusBadgeClass(appt.status)}`}>{appt.status}</p>
                       <AppointmentActions 
                          appointment={appt} 
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
                    if (finalStatus === 'Confirmed' && new Date(appt.date) < new Date(new Date().setHours(0,0,0,0))) {
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
                                        <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {new Date(appt.date).toDateString()}</span>
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
        </div>
        
        <AddFamilyMemberDialog 
          isOpen={isAddMemberOpen} 
          onOpenChange={setAddMemberOpen}
          onSave={handleAddFamilyMember} 
        />
        <BookAppointmentDialog
          isOpen={isBookingOpen}
          onOpenChange={setBookingOpen}
          familyMembers={family}
          onSave={handleBookAppointment}
        />
        {selectedAppointment && (
          <RescheduleAppointmentDialog
            isOpen={isRescheduleOpen}
            onOpenChange={setRescheduleOpen}
            appointment={selectedAppointment}
            onSave={handleRescheduleAppointment}
          />
        )}

      </main>
    </div>
  );
}
