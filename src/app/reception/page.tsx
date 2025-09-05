
'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { Appointment, DoctorSchedule, FamilyMember, Session, SpecialClosure } from '@/lib/types';
import { format, set } from 'date-fns';
import { BookWalkInDialog } from '@/components/reception/book-walk-in-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ChevronDown, Sun, Moon, UserPlus, Calendar, Trash2, Clock } from 'lucide-react';
import { AddNewPatientDialog } from '@/components/reception/add-new-patient-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { RescheduleDialog } from '@/components/reception/reschedule-dialog';
import { getDoctorSchedule } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { AdjustTimingDialog } from '@/components/reception/adjust-timing-dialog';
import { updateTodayScheduleOverrideAction } from '../actions';

type TimeSlot = {
  time: string;
  isBooked: boolean;
  appointment?: Appointment;
}

export default function ReceptionPage() {
    const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
    const [family, setFamily] = useState<FamilyMember[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isBookWalkInOpen, setBookWalkInOpen] = useState(false);
    const [isNewPatientOpen, setNewPatientOpen] = useState(false);
    const [isRescheduleOpen, setRescheduleOpen] = useState(false);
    const [isAdjustTimingOpen, setAdjustTimingOpen] = useState(false);
    const [selectedSession, setSelectedSession] = useState<'morning' | 'evening'>('morning');
    const [currentDate, setCurrentDate] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        const currentHour = new Date().getHours();
        if (currentHour >= 14) { // 2 PM
            setSelectedSession('evening');
        }
        
        async function loadData() {
            const scheduleData = await getDoctorSchedule();
            setSchedule(scheduleData);
            // Here you would normally fetch family and appointments
            // setFamily(await getFamily());
            // setAppointments(await getAppointmentsForToday());
        }
        loadData();

    }, []);
    
    useEffect(() => {
        setCurrentDate(format(new Date(), 'EEEE, MMMM d, yyyy'));
    }, [])

    useEffect(() => {
        if (!schedule) return;

        const today = new Date();
        const dayOfWeek = format(today, 'EEEE') as keyof DoctorSchedule['days'];
        let daySchedule = schedule.days[dayOfWeek];
        const generatedSlots: TimeSlot[] = [];

        const todayStr = format(today, 'yyyy-MM-dd');
        const todayOverride = schedule.specialClosures.find(c => c.date === todayStr);

        if (todayOverride) {
            daySchedule = {
                morning: todayOverride.morningOverride ?? daySchedule.morning,
                evening: todayOverride.eveningOverride ?? daySchedule.evening
            }
        }

        const generateSessionSlots = (session: Session) => {
            if (!session.isOpen || !session.start || !session.end) return;

            const [startHour, startMinute] = session.start.split(':').map(Number);
            const [endHour, endMinute] = session.end.split(':').map(Number);
            
            let currentTime = set(today, { hours: startHour, minutes: startMinute, seconds: 0, milliseconds: 0 });
            const endTime = set(today, { hours: endHour, minutes: endMinute, seconds: 0, milliseconds: 0 });

            while (currentTime < endTime) {
                const timeString = format(currentTime, 'hh:mm a');
                const existingAppointment = appointments.find(a => a.time === timeString && new Date(a.date).toDateString() === today.toDateString() && a.status === 'Confirmed');
                
                generatedSlots.push({
                    time: timeString,
                    isBooked: !!existingAppointment,
                    appointment: existingAppointment,
                });
                currentTime.setMinutes(currentTime.getMinutes() + schedule.slotDuration);
            }
        }
        
        if (selectedSession === 'morning') {
            generateSessionSlots(daySchedule.morning);
        } else {
            generateSessionSlots(daySchedule.evening);
        }
        setTimeSlots(generatedSlots);

    }, [schedule, appointments, selectedSession]);
    
    const handleSlotClick = (time: string) => {
        const slot = timeSlots.find(s => s.time === time);
        if (slot && !slot.isBooked) {
          setSelectedSlot(time);
          setBookWalkInOpen(true);
        }
    };

    const handleBookAppointment = (familyMember: FamilyMember, time: string) => {
        const newAppointment: Appointment = {
            id: Date.now(),
            familyMemberId: familyMember.id,
            familyMemberName: familyMember.name,
            date: new Date().toISOString(),
            time: time,
            status: 'Confirmed'
        };
        setAppointments(prev => [...prev, newAppointment]);
    };
    
    const handleAddNewPatient = (newPatient: FamilyMember) => {
        setFamily(prev => [...prev, newPatient]);
    }

    const handleOpenReschedule = (appointment: Appointment) => {
        setSelectedAppointment(appointment);
        setRescheduleOpen(true);
    };

    const handleReschedule = (newDate: string, newTime: string) => {
        if (selectedAppointment) {
            setAppointments(prev => prev.map(a => 
                a.id === selectedAppointment.id ? { ...a, date: newDate, time: newTime } : a
            ));
            toast({ title: 'Success', description: 'Appointment has been rescheduled.' });
        }
    };

    const handleCancelAppointment = (appointmentId: number) => {
        setAppointments(prev => prev.map(a => 
            a.id === appointmentId ? { ...a, status: 'Cancelled' } : a
        ));
        toast({ title: 'Success', description: 'Appointment has been cancelled.' });
    };

    const handleAdjustTiming = async (override: SpecialClosure) => {
        const result = await updateTodayScheduleOverrideAction(override);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: result.success });
            // Re-fetch schedule to reflect changes
            const scheduleData = await getDoctorSchedule();
            setSchedule(scheduleData);
        }
    };
    
  if (!schedule) {
    return (
        <div className="flex flex-col min-h-screen bg-muted/40">
            <Header />
            <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {Array.from({ length: 18 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <Header />
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
        <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                    <CardTitle className="text-2xl">Reception Desk - Today's Schedule</CardTitle>
                    <CardDescription>{currentDate}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                     <Button variant="outline" onClick={() => setAdjustTimingOpen(true)}>
                        <Clock className="mr-2 h-4 w-4" />
                        Adjust Timing
                    </Button>
                    <Button variant="outline" onClick={() => setNewPatientOpen(true)}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        New Patient
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                {selectedSession === 'morning' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                                {selectedSession.charAt(0).toUpperCase() + selectedSession.slice(1)} Session
                                <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedSession('morning')}>
                                <Sun className="mr-2 h-4 w-4" />
                                Morning
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSelectedSession('evening')}>
                                <Moon className="mr-2 h-4 w-4" />
                                Evening
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>
            <CardContent>
                {timeSlots.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {timeSlots.map(slot => (
                            <div key={slot.time}>
                                {slot.isBooked && slot.appointment ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button 
                                                variant="secondary"
                                                className="h-auto w-full py-3 flex flex-col items-center justify-center relative cursor-pointer"
                                            >
                                                <span className="text-lg font-semibold">{slot.time}</span>
                                                <span className="text-xs text-muted-foreground">{slot.appointment.familyMemberName}</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start">
                                            <DropdownMenuItem onClick={() => handleOpenReschedule(slot.appointment!)}>
                                                <Calendar className="mr-2 h-4 w-4" />
                                                Reschedule
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                             <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <div className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-destructive w-full">
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Cancel Appointment
                                                    </div>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This action cannot be undone. This will permanently cancel the appointment.
                                                    </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                    <AlertDialogCancel>Go Back</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleCancelAppointment(slot.appointment!.id)}>Confirm Cancellation</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : (
                                    <Button 
                                        variant='outline'
                                        className="h-auto w-full py-3 flex flex-col items-center justify-center relative"
                                        onClick={() => handleSlotClick(slot.time)}
                                    >
                                        <span className="text-lg font-semibold">{slot.time}</span>
                                        <span className="text-xs text-primary/80">Available</span>
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 text-muted-foreground">
                        <p>This session is closed or has no available slots.</p>
                    </div>
                )}
            </CardContent>
        </Card>
        {selectedSlot && (
            <BookWalkInDialog
                isOpen={isBookWalkInOpen}
                onOpenChange={setBookWalkInOpen}
                timeSlot={selectedSlot}
                onSave={handleBookAppointment}
                mockFamily={family}
            />
        )}
        <AddNewPatientDialog
            isOpen={isNewPatientOpen}
            onOpenChange={setNewPatientOpen}
            onSave={handleAddNewPatient}
            existingFamily={family}
        />
        {selectedAppointment && (
            <RescheduleDialog
                isOpen={isRescheduleOpen}
                onOpenChange={setRescheduleOpen}
                appointment={selectedAppointment}
                onSave={handleReschedule}
                bookedSlots={appointments.filter(a => a.status === 'Confirmed' && a.id !== selectedAppointment.id).map(a => a.time)}
            />
        )}
        {schedule && (
            <AdjustTimingDialog
                isOpen={isAdjustTimingOpen}
                onOpenChange={setAdjustTimingOpen}
                schedule={schedule}
                onSave={handleAdjustTiming}
            />
        )}
      </main>
    </div>
  );
}
