

'use client';
import { useState, useEffect, useTransition } from 'react';
import Header from '@/components/header';
import Stats from '@/components/dashboard/stats';
import type { DoctorSchedule, DoctorStatus, FamilyMember, Patient, SpecialClosure, VisitPurpose } from '@/lib/types';
import { format, set, addMinutes, parseISO, isToday } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { ChevronDown, Sun, Moon, UserPlus, Calendar as CalendarIcon, Trash2, Clock, Search, User as MaleIcon, UserSquare as FemaleIcon, CheckCircle, Hourglass, User, UserX, XCircle, ChevronsRight, Send, EyeOff, Eye, FileClock, Footprints, LogIn, PlusCircle, AlertTriangle, Sparkles, LogOut, Repeat, Shield, MessageSquare, HelpCircle, Stethoscope, Syringe, Ticket, UserCheck, Timer, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AdjustTimingDialog } from '@/components/reception/adjust-timing-dialog';
import { AddNewPatientDialog } from '@/components/reception/add-new-patient-dialog';
import { RescheduleDialog } from '@/components/reception/reschedule-dialog';
import { BookWalkInDialog } from '@/components/reception/book-walk-in-dialog';
import { toggleDoctorStatusAction, emergencyCancelAction, getPatientsAction, addAppointmentAction, addNewPatientAction, updatePatientStatusAction, sendReminderAction, cancelAppointmentAction, checkInPatientAction, updateTodayScheduleOverrideAction, getDoctorStatusAction, updatePatientPurposeAction, getDoctorScheduleAction, getFamilyAction, recalculateQueueWithETC, updateDoctorStartDelayAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScheduleCalendar } from '@/components/shared/schedule-calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { parse } from 'date-fns';


type TimeSlot = {
  time: string;
  isBooked: boolean;
  isReservedForWalkIn?: boolean;
  patient?: Patient;
  patientDetails?: FamilyMember;
}

const statusConfig = {
    Waiting: { icon: Clock, color: 'text-blue-600' },
    'Booked': { icon: CalendarIcon, color: 'text-gray-500' },
    'Confirmed': { icon: UserCheck, color: 'text-indigo-500' }, // This might be legacy, now 'Booked' is used
    'In-Consultation': { icon: Hourglass, color: 'text-yellow-600 animate-pulse' },
    Completed: { icon: CheckCircle, color: 'text-green-600' },
    Late: { icon: UserX, color: 'text-orange-600' },
    Cancelled: { icon: XCircle, color: 'text-red-600' },
    'Waiting for Reports': { icon: FileClock, color: 'text-purple-600' },
};

const purposeIcons: { [key: string]: React.ElementType } = {
    'Consultation': Stethoscope,
    'Follow-up visit': Repeat,
    'Vaccination': Syringe,
    'Others': HelpCircle,
};

export default function DashboardPage() {
    const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
    const [family, setFamily] = useState<FamilyMember[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [doctorStatus, setDoctorStatus] = useState<DoctorStatus | null>(null);
    const [doctorOnlineTime, setDoctorOnlineTime] = useState('');
    const [doctorStartDelay, setDoctorStartDelay] = useState(0);
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [isBookWalkInOpen, setBookWalkInOpen] = useState(false);
    const [isNewPatientOpen, setNewPatientOpen] = useState(false);
    const [isRescheduleOpen, setRescheduleOpen] = useState(false);
    const [isAdjustTimingOpen, setAdjustTimingOpen] = useState(false);
    const [selectedSession, setSelectedSession] = useState<'morning' | 'evening'>('morning');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [phoneToPreFill, setPhoneToPreFill] = useState('');
    const [showCompleted, setShowCompleted] = useState(false);
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const loadData = async () => {
        startTransition(async () => {
            const scheduleData = await getDoctorScheduleAction();
            const patientData = await getPatientsAction();
            const familyData = await getFamilyAction();
            const statusData = await getDoctorStatusAction();
            
            setSchedule(scheduleData);
            setPatients(patientData);
            setFamily(familyData);
            setDoctorStatus(statusData);
            setDoctorStartDelay(statusData.startDelay || 0);
        });
    }

    useEffect(() => {
        const currentHour = new Date().getHours();
        if (currentHour >= 14) {
            setSelectedSession('evening');
        }
        loadData();
    }, []);

    useEffect(() => {
        if (doctorStatus?.isOnline && doctorStatus.onlineTime) {
            setDoctorOnlineTime(new Date(doctorStatus.onlineTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        } else {
            setDoctorOnlineTime('');
        }
    }, [doctorStatus]);


    useEffect(() => {
        if (!schedule) return;

        const familyMap = new Map(family.map(f => [`${f.phone}-${f.name}`, f]));
        
        const dayOfWeek = format(selectedDate, 'EEEE') as keyof DoctorSchedule['days'];
        let daySchedule = schedule.days[dayOfWeek];
        const generatedSlots: TimeSlot[] = [];

        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const todayOverride = schedule.specialClosures.find(c => c.date === dateStr);

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
            
            let currentTime = set(selectedDate, { hours: startHour, minutes: startMinute, seconds: 0, milliseconds: 0 });
            const endTime = set(selectedDate, { hours: endHour, minutes: endMinute, seconds: 0, milliseconds: 0 });
            
            let slotIndex = 0;
            while (currentTime < endTime) {
                const timeString = format(currentTime, 'hh:mm a');
                
                const timeZone = "Asia/Kolkata";
                
                const patientForSlot = patients.find(p => {
                    if (p.status === 'Cancelled') return false;
                    const apptDateUtc = parseISO(p.appointmentTime);
                    const apptInIST = toZonedTime(apptDateUtc, timeZone);
                    
                    const apptTimeStr = format(apptInIST, 'hh:mm a');
                    const apptDateStr = format(apptInIST, 'yyyy-MM-dd');
                    
                    return apptTimeStr === timeString && apptDateStr === format(selectedDate, 'yyyy-MM-dd');
                });
                
                let isBooked = !!patientForSlot;
                
                let isReservedForWalkIn = false;
                if (!isBooked) {
                    if (schedule.reserveFirstFive && slotIndex < 5) {
                        isReservedForWalkIn = true;
                    }

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
                    isBooked: isBooked,
                    isReservedForWalkIn: isReservedForWalkIn,
                    patient: patientForSlot,
                    patientDetails: patientForSlot ? familyMap.get(`${patientForSlot.phone}-${patientForSlot.name}`) : undefined,
                });

                currentTime = addMinutes(currentTime, schedule.slotDuration);
                slotIndex++;
            }
        }
        
        setTimeSlots(generatedSlots);
    }, [schedule, patients, family, selectedSession, selectedDate]);

    const handleSlotClick = (time: string) => {
        const slot = timeSlots.find(s => s.time === time);
        if (slot) {
          setSelectedSlot(time);
          setBookWalkInOpen(true);
        }
    };
    
    const handleBookAppointment = async (familyMember: FamilyMember, appointmentIsoString: string, isWalkIn: boolean, purpose: string) => {
        startTransition(async () => {
             const result = await addAppointmentAction(familyMember, appointmentIsoString, purpose, isWalkIn);

            if (result.success && result.patient) {
                if (isWalkIn) {
                    await checkInPatientAction(result.patient.id);
                }
                await loadData();
                toast({ title: "Success", description: "Appointment booked successfully."});
            } else {
                toast({ title: "Error", description: result.error, variant: 'destructive'});
            }
        });
    };

    const handleAddNewPatient = async (newPatientData: Omit<FamilyMember, 'id' | 'avatar'>): Promise<FamilyMember | null> => {
        const result = await addNewPatientAction(newPatientData);
        if (result.patient) {
            await loadData();
            toast({ title: "Success", description: result.success});
            return result.patient;
        }
        return null;
    };

    const handleOpenReschedule = (patient: Patient) => {
        setSelectedPatient(patient);
        setRescheduleOpen(true);
    };

    const handleReschedule = (newDate: string, newTime: string) => {
        if (selectedPatient) {
            // This needs to be backed by a server action to persist
            // For now, it just updates local state
            setPatients(prev => prev.map(p => 
                p.id === selectedPatient.id ? { ...p, appointmentTime: new Date(newDate).toISOString(), status: 'Booked' } : p
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

    const handleUpdatePurpose = (patientId: number, purpose: string) => {
        startTransition(async () => {
            const result = await updatePatientPurposeAction(patientId, purpose);
            if (result?.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: result.success });
                await loadData();
            }
        });
    }

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


    const handleCancelAppointment = (patientId: number) => {
        startTransition(async () => {
            const result = await cancelAppointmentAction(patientId);
            if (result.success) {
                toast({ title: 'Success', description: 'Appointment cancelled.' });
                await loadData();
            } else {
                toast({ title: 'Error', description: 'Failed to cancel appointment.', variant: 'destructive' });
            }
        });
    };

    const handleCheckIn = (patientId: number) => {
        startTransition(async () => {
            const result = await checkInPatientAction(patientId);
            if (result?.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: result.success });
                await loadData();
            }
        });
    };

    const handleAdjustTiming = async (override: SpecialClosure) => {
        const result = await updateTodayScheduleOverrideAction(override);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: result.success });
            await loadData();
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

    const handleToggleDoctorStatus = () => {
        startTransition(async () => {
            const result = await toggleDoctorStatusAction(!doctorStatus?.isOnline, doctorStatus?.startDelay);
            if (result?.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive'});
            } else {
                toast({ title: 'Success', description: result.success});
                await loadData();
            }
        });
    }

    const handleUpdateDelay = () => {
        startTransition(async () => {
            const result = await updateDoctorStartDelayAction(doctorStartDelay);
            if (result?.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive'});
            } else {
                toast({ title: 'Success', description: result.success});
                await loadData();
            }
        });
    };

    const handleRunRecalculation = () => {
        startTransition(async () => {
            const result = await recalculateQueueWithETC();
            if (result?.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: result.success });
                await loadData(); // Reload data to show new estimates
            }
        });
    };
    const handleEmergencyCancel = () => {
        startTransition(async () => {
            const result = await emergencyCancelAction();
            if (result?.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: result.success });
            }
        });
    };

    let liveQueue = patients
        .filter(p => ['Waiting', 'Late', 'In-Consultation'].includes(p.status))
        .sort((a,b) => (a.bestCaseETC && b.bestCaseETC) ? parseISO(a.bestCaseETC).getTime() - parseISO(b.bestCaseETC).getTime() : 0);

    let bookedPatients = patients.filter(p => p.status === 'Booked');

    const todaysDateStr = format(selectedDate, 'yyyy-MM-dd');
    let displayedTimeSlots = timeSlots.filter(slot => {
        const patient = slot.patient;
        if (!patient) return !showCompleted; // Show empty slots unless hiding completed
        
        const patientDateStr = format(toZonedTime(parseISO(patient.appointmentTime), "Asia/Kolkata"), 'yyyy-MM-dd');
        if (patientDateStr !== todaysDateStr) return false;

        if (showCompleted) return true;

        return patient.status !== 'Completed' && patient.status !== 'Cancelled';
    }).filter(slot => {
        if (!searchTerm.trim()) return true;
        if (!slot.isBooked || !slot.patientDetails) return false;
        const lowerSearch = searchTerm.toLowerCase();
        return slot.patientDetails.name.toLowerCase().includes(lowerSearch) ||
               slot.patientDetails.phone.includes(lowerSearch) ||
               (slot.patientDetails.clinicId && slot.patientDetails.clinicId.toLowerCase().includes(lowerSearch));
    });


    const todaysPatients = patients.filter(p => isToday(parseISO(p.appointmentTime)));
    const canDoctorCheckIn = isToday(selectedDate);


    if (!schedule || !doctorStatus) {
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
                    <Stats patients={todaysPatients} />
                    
                    <Card>
                        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b">
                            <div>
                               <div className="flex items-center gap-2">
                                  <CardTitle className="text-2xl">Schedule</CardTitle>
                                  <Popover>
                                      <PopoverTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-7 w-7">
                                             <CalendarIcon className="h-4 w-4" />
                                          </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0">
                                          <ScheduleCalendar
                                              mode="single"
                                              selected={selectedDate}
                                              onSelect={(day) => day && setSelectedDate(day)}
                                              initialFocus
                                              schedule={schedule}
                                          />
                                      </PopoverContent>
                                  </Popover>
                               </div>
                                <CardDescription>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</CardDescription>
                            </div>
                             <div className="flex items-center gap-2 flex-wrap">
                                 <div className="flex items-center space-x-2">
                                    <Switch id="doctor-status" checked={doctorStatus.isOnline} onCheckedChange={handleToggleDoctorStatus} disabled={isPending || !canDoctorCheckIn}/>
                                    <Label htmlFor="doctor-status" className={cn('flex items-center text-sm', !canDoctorCheckIn && 'text-muted-foreground')}>
                                        {doctorStatus.isOnline ? <LogIn className="mr-2 h-4 w-4 text-green-500" /> : <LogOut className="mr-2 h-4 w-4 text-red-500" />}
                                        {doctorStatus.isOnline ? `Online (since ${doctorOnlineTime})` : 'Offline'}
                                    </Label>
                                </div>
                                <div className='flex items-center space-x-2'>
                                    <Label htmlFor="doctor-delay" className="text-sm">Delay (min)</Label>
                                    <Input id="doctor-delay" type="number" value={doctorStartDelay} onChange={e => setDoctorStartDelay(parseInt(e.target.value))} className="w-16 h-8" disabled={doctorStatus.isOnline} />
                                    <Button size="sm" variant="outline" onClick={handleUpdateDelay} disabled={doctorStatus.isOnline}>Update</Button>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline">
                                            {selectedSession === 'morning' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                                            {selectedSession.charAt(0).toUpperCase() + selectedSession.slice(1)}
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
                                <Button variant="outline" onClick={() => setAdjustTimingOpen(true)}>
                                    <Clock className="mr-2 h-4 w-4" />
                                    Adjust Timing
                                </Button>
                                <Button variant="outline" onClick={() => setNewPatientOpen(true)}>
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    New Patient
                                </Button>
                            </div>
                        </CardHeader>
                        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search patient..."
                                    className="pl-8 sm:w-[200px] md:w-[300px]"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Button variant="outline" onClick={() => setShowCompleted(prev => !prev)}>
                                    {showCompleted ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                                    {showCompleted ? 'Hide' : 'Show'} Completed
                                </Button>
                                <Button variant="outline" onClick={handleRunRecalculation} disabled={isPending}>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    {isPending ? 'Recalculating...' : 'Recalculate Queue'}
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                    <Button variant="destructive">
                                        <AlertTriangle className="mr-2 h-4 w-4" />
                                        Emergency
                                    </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                        This action will cancel all active appointments and notify patients of an emergency. This cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleEmergencyCancel} disabled={isPending}>
                                        {isPending ? 'Cancelling...' : 'Confirm Emergency'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4">
                            <div className="space-y-3">
                            {displayedTimeSlots.length > 0 ? displayedTimeSlots.map((slot, index) => {
                                const isActionable = slot.patient && slot.patient.status !== 'Completed' && slot.patient.status !== 'Cancelled';
                                if (searchTerm && !slot.isBooked) return null;

                                const StatusIcon = slot.isBooked && slot.patient && statusConfig[slot.patient.status] ? statusConfig[slot.patient.status].icon : HelpCircle;
                                const statusColor = slot.isBooked && slot.patient && statusConfig[slot.patient.status] ? statusConfig[slot.patient.status].color : '';
                                const PurposeIcon = slot.patient?.purpose && purposeIcons[slot.patient.purpose] ? purposeIcons[slot.patient.purpose] : HelpCircle;
                                
                                return (
                                <div key={slot.time}>
                                {slot.isBooked && slot.patient && slot.patientDetails ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild disabled={!isActionable}>
                                            <div className={cn("p-3 grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-lg border bg-card shadow-sm", isActionable ? "cursor-pointer hover:bg-muted/50" : "opacity-60")}>
                                               <div className="flex items-center gap-4">
                                                    <div className="w-12 text-center font-bold text-lg text-primary flex flex-col items-center">
                                                        <Ticket className="h-5 w-5 mb-1" />
                                                        #{slot.patient.tokenNo}
                                                    </div>
                                                    <div className="w-24 font-semibold">{slot.time}</div>
                                                </div>

                                                <div className="flex-1 flex flex-col gap-1">
                                                    <div className='flex items-center gap-2 font-semibold'>
                                                        {PurposeIcon && <PurposeIcon className="h-4 w-4 text-muted-foreground" title={slot.patient.purpose} />}
                                                        {slot.patientDetails.name}
                                                        {slot.patientDetails.gender === 'Male' ? <MaleIcon className="h-4 w-4 text-blue-500" /> : <FemaleIcon className="h-4 w-4 text-pink-500" />}
                                                        <Badge variant={slot.patient.type === 'Walk-in' ? 'secondary' : 'outline'}>{slot.patient.type || 'Appointment'}</Badge>
                                                    </div>
                                                    <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                                                        <Timer className="h-4 w-4" />
                                                        ETC:
                                                        <span className="font-semibold text-green-600">{slot.patient.bestCaseETC ? format(parseISO(slot.patient.bestCaseETC), 'hh:mm a') : '-'}</span>
                                                        -
                                                        <span className="font-semibold text-orange-600">{slot.patient.worstCaseETC ? format(parseISO(slot.patient.worstCaseETC), 'hh:mm a') : '-'}</span>

                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <div className="w-40 flex items-center gap-2">
                                                    {StatusIcon && <StatusIcon className={cn("h-4 w-4", statusColor)} />}
                                                    <span className={cn("font-medium", statusColor)}>{slot.patient.status} {slot.patient.lateBy ? `(${slot.patient.lateBy} min)` : ''}</span>
                                                    </div>
                                                    <div className="w-48 text-sm text-muted-foreground">
                                                        {slot.patient.checkInTime ? `Checked in: ${new Date(slot.patient.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}`
                                                        : slot.patient.status === 'Completed' && slot.patient.consultationEndTime ? `Finished at ${new Date(slot.patient.consultationEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}`
                                                        : 'Awaiting Check-in' }
                                                    </div>
                                                </div>
                                            </div>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start">
                                            {slot.patient.status === 'Booked' && (
                                                <DropdownMenuItem onClick={() => handleCheckIn(slot.patient!.id)} disabled={isPending}>
                                                    <LogIn className="mr-2 h-4 w-4" />
                                                    Check-in Patient
                                                </DropdownMenuItem>
                                            )}
                                            {(slot.patient.status === 'Waiting' || slot.patient.status === 'Late') && (
                                                <DropdownMenuItem onClick={() => handleUpdateStatus(slot.patient!.id, 'In-Consultation')} disabled={isPending || !doctorStatus.isOnline}>
                                                    <ChevronsRight className="mr-2 h-4 w-4" />
                                                    Start Consultation
                                                </DropdownMenuItem>
                                            )}
                                            {slot.patient.status === 'In-Consultation' && (
                                                <>
                                                    <DropdownMenuItem onClick={() => handleUpdateStatus(slot.patient!.id, 'Completed')} disabled={isPending}>
                                                        <CheckCircle className="mr-2 h-4 w-4" />
                                                        Mark as Completed
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleUpdateStatus(slot.patient!.id, 'Waiting for Reports')} disabled={isPending}>
                                                        <FileClock className="mr-2 h-4 w-4" />
                                                        Waiting for Reports
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                             {(slot.patient.status === 'Waiting' || slot.patient.status === 'Booked') && (
                                                <DropdownMenuItem onClick={() => handleUpdateStatus(slot.patient!.id, 'Late')} disabled={isPending}>
                                                    <Hourglass className="mr-2 h-4 w-4" />
                                                    Mark as Late
                                                </DropdownMenuItem>
                                            )}
                                            {isActionable && <DropdownMenuSeparator />}
                                            <DropdownMenuSub>
                                                <DropdownMenuSubTrigger>
                                                    <Pencil className="mr-2 h-4 w-4" />
                                                    Change Purpose
                                                </DropdownMenuSubTrigger>
                                                <DropdownMenuSubContent>
                                                     <DropdownMenuRadioGroup value={slot.patient.purpose} onValueChange={(value) => handleUpdatePurpose(slot.patient!.id, value)}>
                                                        {schedule?.visitPurposes.filter(p => p.enabled).map(purpose => (
                                                            <DropdownMenuRadioItem key={purpose.id} value={purpose.name}>{purpose.name}</DropdownMenuRadioItem>
                                                        ))}
                                                    </DropdownMenuRadioGroup>
                                                </DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                            <DropdownMenuItem onClick={() => handleOpenReschedule(slot.patient!)}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                Reschedule
                                            </DropdownMenuItem>
                                             <DropdownMenuItem onClick={() => handleSendReminder(slot.patient!.id)} disabled={isPending}>
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
                                                    <AlertDialogAction onClick={() => handleCancelAppointment(slot.patient!.id)}>Confirm Cancellation</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : (
                                    <div 
                                      className={cn(
                                          "p-3 flex items-center rounded-lg border border-dashed hover:bg-muted/60 cursor-pointer",
                                           "bg-muted/30"
                                      )} 
                                      onClick={() => handleSlotClick(slot.time)}
                                    >
                                         <div className="w-12 text-center font-bold text-lg text-muted-foreground">-</div>
                                         <div className="w-24 font-semibold text-muted-foreground">{slot.time}</div>
                                         <div className={cn("flex-1 font-semibold flex items-center justify-center gap-2", (slot.isReservedForWalkIn) ? "text-amber-600" : "text-green-600")}>
                                           {(slot.isReservedForWalkIn) ? (
                                             <Footprints className="h-4 w-4"/>
                                           ) : (
                                             <PlusCircle className="h-4 w-4"/>
                                           )}
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
                        selectedDate={selectedDate}
                        onSave={handleBookAppointment}
                        onAddNewPatient={handleOpenNewPatientDialogFromWalkIn}
                        visitPurposes={schedule.visitPurposes.filter(p => p.enabled)}
                    />
                )}
                <AddNewPatientDialog
                    isOpen={isNewPatientOpen}
                    onOpenChange={setNewPatientOpen}
                    onSave={handleAddNewPatient}
                    phoneToPreFill={phoneToPreFill}
                    onClose={() => setPhoneToPreFill('')}
                    afterSave={(newPatient, purpose) => {
                        if (selectedSlot && purpose) {
                            const date = new Date(selectedDate);
                            const time = parse(selectedSlot, 'hh:mm a', date);
                            handleBookAppointment(newPatient, time.toISOString(), true, purpose);
                        }
                    }}
                    visitPurposes={schedule.visitPurposes.filter(p => p.enabled)}
                />
                {selectedPatient && (
                    <RescheduleDialog
                        isOpen={isRescheduleOpen}
                        onOpenChange={setRescheduleOpen}
                        patient={selectedPatient}
                        onSave={handleReschedule}
                        bookedSlots={patients.filter(p => p.status === 'Booked' && p.id !== selectedPatient.id).map(p => format(new Date(p.appointmentTime), 'hh:mm a'))}
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
