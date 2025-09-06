
'use client';
import { useState, useEffect, useTransition } from 'react';
import Header from '@/components/header';
import Stats from '@/components/dashboard/stats';
import type { DoctorSchedule, FamilyMember, Appointment, Patient, SpecialClosure, Session } from '@/lib/types';
import { getDoctorSchedule } from '@/lib/data';
import { format, set } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { ChevronDown, Sun, Moon, UserPlus, Calendar as CalendarIcon, Trash2, Clock, Search, User as MaleIcon, UserSquare as FemaleIcon, CheckCircle, Hourglass, User, UserX, XCircle, ChevronsRight, Send, EyeOff, Eye, FileClock, Footprints } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AdjustTimingDialog } from '@/components/reception/adjust-timing-dialog';
import { AddNewPatientDialog } from '@/components/reception/add-new-patient-dialog';
import { RescheduleDialog } from '@/components/reception/reschedule-dialog';
import { BookWalkInDialog } from '@/components/reception/book-walk-in-dialog';
import { updateTodayScheduleOverrideAction, estimateConsultationTime, getFamily, getPatients, addPatient, addNewPatientAction, updatePatientStatusAction, sendReminderAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';


type TimeSlot = {
  time: string;
  isBooked: boolean;
  isReservedForWalkIn?: boolean;
  appointment?: Appointment;
  patientDetails?: FamilyMember;
  estimatedConsultationTime?: number;
  status?: 'Waiting' | 'Yet to Arrive' | 'In-Consultation' | 'Completed' | 'Cancelled' | 'Late' | 'Waiting for Reports';
  patient?: Patient;
}

const statusConfig = {
    Waiting: { icon: Clock, color: 'text-blue-600' },
    'Yet to Arrive': { icon: CalendarIcon, color: 'text-gray-500' },
    'In-Consultation': { icon: Hourglass, color: 'text-yellow-600 animate-pulse' },
    Completed: { icon: CheckCircle, color: 'text-green-600' },
    Late: { icon: UserX, color: 'text-orange-600' },
    Cancelled: { icon: XCircle, color: 'text-red-600' },
    'Waiting for Reports': { icon: FileClock, color: 'text-purple-600' },
};


export default function DashboardPage() {
    const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
    const [family, setFamily] = useState<FamilyMember[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isBookWalkInOpen, setBookWalkInOpen] = useState(false);
    const [isNewPatientOpen, setNewPatientOpen] = useState(false);
    const [isRescheduleOpen, setRescheduleOpen] = useState(false);
    const [isAdjustTimingOpen, setAdjustTimingOpen] = useState(false);
    const [selectedSession, setSelectedSession] = useState<'morning' | 'evening'>('morning');
    const [currentDate, setCurrentDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [phoneToPreFill, setPhoneToPreFill] = useState('');
    const [showCompleted, setShowCompleted] = useState(false);
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const loadData = async () => {
        const scheduleData = await getDoctorSchedule();
        const patientData = await getPatients();
        const familyData = await getFamily();

        setSchedule(scheduleData);
        setPatients(patientData);
        setFamily(familyData);

        const appointmentsFromPatients = patientData
            .map(p => {
                const famMember = familyData.find(f => f.phone === p.phone && f.name === p.name);
                return {
                    id: p.id,
                    familyMemberId: famMember?.id || 0,
                    familyMemberName: p.name,
                    date: p.appointmentTime,
                    time: format(new Date(p.appointmentTime), 'hh:mm a'),
                    status: p.status,
                    type: p.type as 'Appointment' | 'Walk-in'
                }
            });
        setAppointments(appointmentsFromPatients as Appointment[]);
    }

    useEffect(() => {
        const currentHour = new Date().getHours();
        if (currentHour >= 14) {
            setSelectedSession('evening');
        }
        loadData();
    }, []);

     useEffect(() => {
        setCurrentDate(format(new Date(), 'EEEE, MMMM d, yyyy'));
    }, []);

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
        
        const sessionToGenerate = selectedSession === 'morning' ? daySchedule.morning : daySchedule.evening;

        if (sessionToGenerate.isOpen && sessionToGenerate.start && sessionToGenerate.end) {
            const [startHour, startMinute] = sessionToGenerate.start.split(':').map(Number);
            const [endHour, endMinute] = sessionToGenerate.end.split(':').map(Number);
            
            let currentTime = set(today, { hours: startHour, minutes: startMinute, seconds: 0, milliseconds: 0 });
            const endTime = set(today, { hours: endHour, minutes: endMinute, seconds: 0, milliseconds: 0 });
            
            let slotIndex = 0;
            while (currentTime < endTime) {
                const timeString = format(currentTime, 'hh:mm a');
                const patientInQueue = patients.find(p => format(new Date(p.appointmentTime), 'hh:mm a') === timeString && new Date(p.appointmentTime).toDateString() === today.toDateString());
                
                let status: TimeSlot['status'] | undefined;
                let patientDetails: FamilyMember | undefined;
                let appointmentForSlot: Appointment | undefined;

                if (patientInQueue) {
                    status = patientInQueue.status;
                    patientDetails = family.find(f => f.phone === patientInQueue.phone && f.name === patientInQueue.name);
                    appointmentForSlot = appointments.find(a => a.id === patientInQueue.id);
                } else {
                     const confirmedAppointment = appointments.find(a => a.time === timeString && new Date(a.date).toDateString() === today.toDateString() && a.status === 'Confirmed');
                     if (confirmedAppointment) {
                        status = 'Yet to Arrive';
                        patientDetails = family.find(f => f.id === confirmedAppointment.familyMemberId);
                        appointmentForSlot = confirmedAppointment;
                     }
                }
                
                let isReservedForWalkIn = false;
                if (schedule.reserveFirstFive && slotIndex < 5) {
                    isReservedForWalkIn = true;
                } else {
                    const reservationStrategy = schedule.walkInReservation;
                    const startIndexForAlternate = schedule.reserveFirstFive ? 5 : 0;
                    if (slotIndex >= startIndexForAlternate) {
                        const relativeIndex = slotIndex - startIndexForAlternate;
                        if (reservationStrategy === 'alternateOne') {
                            if (relativeIndex % 2 !== 0) isReservedForWalkIn = true;
                        } else if (reservationStrategy === 'alternateTwo') {
                            if (relativeIndex % 4 === 2 || relativeIndex % 4 === 3) isReservedForWalkIn = true;
                        }
                    }
                }

                generatedSlots.push({
                    time: timeString,
                    isBooked: !!patientInQueue || !!appointmentForSlot,
                    isReservedForWalkIn: isReservedForWalkIn && !patientInQueue && !appointmentForSlot,
                    appointment: appointmentForSlot,
                    patientDetails,
                    status: status,
                    patient: patientInQueue,
                });
                currentTime.setMinutes(currentTime.getMinutes() + schedule.slotDuration);
                slotIndex++;
            }
        }
        

        const runEstimations = async (slots: TimeSlot[]) => {
            const waitingSlots = slots.filter(s => s.isBooked && s.status === 'Waiting');
            for (let i = 0; i < waitingSlots.length; i++) {
                const slot = waitingSlots[i];
                try {
                    const estimation = await estimateConsultationTime({
                        patientFlowData: 'Average consultation time is 15 minutes.',
                        lateArrivals: 'No major late arrivals reported.',
                        doctorDelays: 'Doctor is generally on time.',
                        currentQueueLength: i + 1,
                        appointmentType: slot.appointment?.type === 'Walk-in' ? 'Walk-in' : 'Routine'
                    });
                    const slotIndexInGenerated = generatedSlots.findIndex(s => s.time === slot.time);
                    if (slotIndexInGenerated !== -1) {
                       generatedSlots[slotIndexInGenerated].estimatedConsultationTime = estimation.estimatedConsultationTime;
                    }
                } catch(e) { console.error("Could not estimate time", e)}
            }
            setTimeSlots([...generatedSlots]);
        }

        setTimeSlots(generatedSlots);
        if(patients.length > 0) {
            runEstimations(generatedSlots);
        }

    }, [schedule, appointments, selectedSession, patients, family]);

    const handleSlotClick = (time: string) => {
        const slot = timeSlots.find(s => s.time === time);
        if (slot && (!slot.isBooked || slot.isReservedForWalkIn)) {
          setSelectedSlot(time);
          setBookWalkInOpen(true);
        }
    };

    const handleBookAppointment = async (familyMember: FamilyMember, time: string) => {
        const appointmentTime = new Date();
        const [hours, minutesPart] = time.split(':');
        const minutes = minutesPart.split(' ')[0];
        const ampm = minutesPart.split(' ')[1];
        let hourNumber = parseInt(hours, 10);
        if (ampm === 'PM' && hourNumber < 12) {
            hourNumber += 12;
        }
        if (ampm === 'AM' && hourNumber === 12) {
            hourNumber = 0;
        }
        appointmentTime.setHours(hourNumber, parseInt(minutes, 10), 0, 0);

        await addPatient({
            name: familyMember.name,
            phone: familyMember.phone,
            type: 'Walk-in',
            appointmentTime: appointmentTime.toISOString(),
            checkInTime: new Date().toISOString(),
            status: 'Waiting',
        });
        
        await loadData();
        toast({ title: "Success", description: "Walk-in patient added to queue."});
    };
    
    const handleAddNewPatient = async (newPatientData: Omit<FamilyMember, 'id' | 'avatar'>) => {
        const result = await addNewPatientAction(newPatientData);
        if (result.patient) {
            await loadData();
            toast({ title: "Success", description: result.success});
        }
    };

    const handleOpenReschedule = (appointment: Appointment) => {
        setSelectedAppointment(appointment);
        setRescheduleOpen(true);
    };

    const handleReschedule = (newDate: string, newTime: string) => {
        if (selectedAppointment) {
            // This needs to be backed by a server action to persist
            // For now, it just updates local state
            setAppointments(prev => prev.map(a => 
                a.id === selectedAppointment.id ? { ...a, date: newDate, time: newTime } : a
            ));
            toast({ title: 'Success', description: 'Appointment has been rescheduled.' });
        }
    };

    const handleUpdateStatus = (patientId: number, status: Patient['status']) => {
        startTransition(async () => {
            const result = await updatePatientStatusAction(patientId, status);
            if (result?.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: result.success });
                await loadData();
            }
        });
    };

    const handleSendReminder = (patientId: number) => {
        startTransition(async () => {
            const result = await sendReminderAction(patientId);
            if (result?.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: result.success });
            }
        });
    };


    const handleCancelAppointment = (appointmentId: number) => {
        handleUpdateStatus(appointmentId, 'Cancelled');
    };

    const handleAdjustTiming = async (override: SpecialClosure) => {
        const result = await updateTodayScheduleOverrideAction(override);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: result.success });
            const scheduleData = await getDoctorSchedule();
            setSchedule(scheduleData);
        }
    };
    
    const handleOpenNewPatientDialogFromWalkIn = (searchTerm: string) => {
        setBookWalkInOpen(false);
        // Basic check if the search term could be a phone number
        if (/^\d{5,}$/.test(searchTerm.replace(/\D/g, ''))) {
            setPhoneToPreFill(searchTerm);
        }
        setNewPatientOpen(true);
    };


    const nowServingPatient = patients.find(p => p.status === 'In-Consultation');
    
    let filteredTimeSlots = timeSlots;

    if (searchTerm.trim()) {
        filteredTimeSlots = timeSlots.filter(slot => {
            if (!slot.isBooked || !slot.patientDetails) return false;
            return slot.patientDetails.name.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }

    if (!showCompleted) {
        filteredTimeSlots = filteredTimeSlots.filter(slot => {
            return !slot.status || (slot.status !== 'Completed' && slot.status !== 'Cancelled');
        });
    }


    const confirmedAppointments = timeSlots.filter(s => s.isBooked && s.status !== 'Cancelled');

    if (!schedule) {
        return (
            <div className="flex flex-col min-h-screen bg-background">
                <Header />
                <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
                    <div className="space-y-6">
                        <Skeleton className="h-12 w-1/3" />
                        <div className="grid gap-4 md:grid-cols-3">
                            <Skeleton className="h-28 w-full" />
                            <Skeleton className="h-28 w-full" />
                            <Skeleton className="h-28 w-full" />
                        </div>
                        <Skeleton className="h-96 w-full" />
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <Header />
            <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
                <div className="space-y-6">
                    <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
                    <Stats patients={patients} />
                    
                    <Card>
                        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b">
                            <div className="flex-1">
                                <CardTitle className="text-2xl">Today's Schedule</CardTitle>
                                {currentDate && <CardDescription>{currentDate}</CardDescription>}
                            </div>
                             <div className="flex items-center gap-2 flex-wrap">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        placeholder="Search patient..."
                                        className="pl-8 sm:w-[200px] md:w-[250px]"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                 <Button variant="outline" onClick={() => setShowCompleted(prev => !prev)}>
                                    {showCompleted ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                                    {showCompleted ? 'Hide' : 'Show'} Completed
                                </Button>
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
                        <CardContent className="p-4">
                            <div className="space-y-3">
                            {filteredTimeSlots.length > 0 ? filteredTimeSlots.map((slot, index) => {
                                const isBooked = slot.isBooked;
                                const isActionable = slot.status && slot.status !== 'Completed' && slot.status !== 'Cancelled';
                                if (searchTerm && !isBooked) return null;

                                const StatusIcon = isBooked && slot.status ? statusConfig[slot.status]?.icon : null;
                                const statusColor = isBooked && slot.status ? statusConfig[slot.status]?.color : '';
                                
                                return (
                                <div key={slot.time}>
                                {isBooked && slot.appointment && slot.patientDetails && slot.patient ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild disabled={!isActionable}>
                                            <div className={cn("p-3 flex items-center rounded-lg border bg-card shadow-sm", isActionable ? "cursor-pointer hover:bg-muted/50" : "opacity-60")}>
                                                <div className="w-12 text-center font-bold text-lg text-primary">{confirmedAppointments.findIndex(a => a.time === slot.time) + 1}</div>
                                                <div className="w-24 font-semibold">{slot.time}</div>
                                                <div className="flex-1 flex items-center gap-2 font-semibold">
                                                  {slot.patientDetails.name}
                                                  {slot.patientDetails.gender === 'Male' ? <MaleIcon className="h-4 w-4 text-blue-500" /> : <FemaleIcon className="h-4 w-4 text-pink-500" />}
                                                </div>
                                                <div className="w-28">
                                                    <Badge variant={slot.appointment.type === 'Walk-in' ? 'secondary' : 'outline'}>{slot.appointment.type || 'Appointment'}</Badge>
                                                </div>
                                                <div className="w-40 flex items-center gap-2">
                                                   {StatusIcon && <StatusIcon className={cn("h-4 w-4", statusColor)} />}
                                                   <span className={cn("font-medium", statusColor)}>{slot.status}</span>
                                                    {slot.status === 'Waiting' && slot.patient?.estimatedWaitTime && (
                                                      <span className="text-xs text-muted-foreground">(~{slot.patient?.estimatedWaitTime} min)</span>
                                                   )}
                                                </div>
                                                 <div className="w-48 text-sm text-muted-foreground">
                                                     {slot.status === 'Completed' && slot.patient.consultationEndTime ? (
                                                        `Finished at ${format(new Date(slot.patient.consultationEndTime), 'hh:mm a')}`
                                                     ) : slot.estimatedConsultationTime ? (
                                                        `Est. Consult: ~${slot.estimatedConsultationTime} min`
                                                     ) : nowServingPatient ? (
                                                        `After ${nowServingPatient.name}`
                                                     ) : 'Next in line'}
                                                </div>
                                            </div>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start">
                                            {(slot.status === 'Waiting' || slot.status === 'Late') && (
                                                <DropdownMenuItem onClick={() => handleUpdateStatus(slot.appointment!.id, 'In-Consultation')} disabled={isPending}>
                                                    <ChevronsRight className="mr-2 h-4 w-4" />
                                                    Start Consultation
                                                </DropdownMenuItem>
                                            )}
                                            {slot.status === 'In-Consultation' && (
                                                <>
                                                    <DropdownMenuItem onClick={() => handleUpdateStatus(slot.appointment!.id, 'Completed')} disabled={isPending}>
                                                        <CheckCircle className="mr-2 h-4 w-4" />
                                                        Mark as Completed
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleUpdateStatus(slot.appointment!.id, 'Waiting for Reports')} disabled={isPending}>
                                                        <FileClock className="mr-2 h-4 w-4" />
                                                        Waiting for Reports
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                             {slot.status === 'Waiting' && (
                                                <DropdownMenuItem onClick={() => handleUpdateStatus(slot.appointment!.id, 'Late')} disabled={isPending}>
                                                    <Hourglass className="mr-2 h-4 w-4" />
                                                    Mark as Late
                                                </DropdownMenuItem>
                                            )}
                                            {isActionable && <DropdownMenuSeparator />}
                                            <DropdownMenuItem onClick={() => handleOpenReschedule(slot.appointment!)}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                Reschedule
                                            </DropdownMenuItem>
                                             <DropdownMenuItem onClick={() => handleSendReminder(slot.appointment!.id)} disabled={isPending}>
                                                <Send className="mr-2 h-4 w-4" />
                                                Send Reminder
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <div className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-destructive w-full">
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
                                    <div 
                                      className={cn(
                                          "p-3 flex items-center rounded-lg border border-dashed", 
                                          slot.isReservedForWalkIn ? "bg-amber-50" : "bg-muted/30",
                                          "hover:bg-muted/60 cursor-pointer"
                                      )} 
                                      onClick={() => handleSlotClick(slot.time)}
                                    >
                                         <div className="w-12 text-center font-bold text-lg text-muted-foreground">-</div>
                                         <div className="w-24 font-semibold text-muted-foreground">{slot.time}</div>
                                         <div className={cn("flex-1 font-semibold", slot.isReservedForWalkIn ? "text-amber-600" : "text-green-600")}>
                                           {slot.isReservedForWalkIn ? (
                                             <span className="flex items-center gap-2"><Footprints /> Reserved for Walk-in</span>
                                           ) : "Available"}
                                         </div>
                                    </div>
                                )}
                                </div>
                                )
                            }) : (
                                 <div className="text-center py-16 text-muted-foreground">
                                    <p>{searchTerm ? "No matching appointments found." : "This session is closed or has no available slots."}</p>
                                </div>
                            )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
                {selectedSlot && (
                    <BookWalkInDialog
                        isOpen={isBookWalkInOpen}
                        onOpenChange={setBookWalkInOpen}
                        timeSlot={selectedSlot}
                        onSave={handleBookAppointment}
                        onAddNewPatient={handleOpenNewPatientDialogFromWalkIn}
                    />
                )}
                <AddNewPatientDialog
                    isOpen={isNewPatientOpen}
                    onOpenChange={setNewPatientOpen}
                    onSave={handleAddNewPatient}
                    phoneToPreFill={phoneToPreFill}
                    onClose={() => setPhoneToPreFill('')}
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
