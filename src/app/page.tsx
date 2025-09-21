

'use client';
import { useState, useEffect, useTransition, useCallback } from 'react';
import Header from '@/components/header';
import Stats from '@/app/dashboard/stats';
import type { DoctorSchedule, DoctorStatus, FamilyMember, Patient, SpecialClosure, VisitPurpose } from '@/lib/types';
import { format, set, addMinutes, parseISO, isToday } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { ChevronDown, Sun, Moon, UserPlus, Calendar as CalendarIcon, Trash2, Clock, Search, User as MaleIcon, UserSquare as FemaleIcon, CheckCircle, Hourglass, UserX, XCircle, ChevronsRight, Send, EyeOff, Eye, FileClock, Footprints, LogIn, PlusCircle, AlertTriangle, Sparkles, LogOut, Repeat, Shield, Pencil, Ticket, Timer, Stethoscope, Syringe, HelpCircle, Pause, Play, MoreVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AdjustTimingDialog } from '@/components/reception/adjust-timing-dialog';
import { AddNewPatientDialog } from '@/components/reception/add-new-patient-dialog';
import { RescheduleDialog } from '@/components/reception/reschedule-dialog';
import { BookWalkInDialog } from '@/components/reception/book-walk-in-dialog';
import { setDoctorStatusAction, emergencyCancelAction, getPatientsAction, addAppointmentAction, addNewPatientAction, updatePatientStatusAction, sendReminderAction, cancelAppointmentAction, checkInPatientAction, updateTodayScheduleOverrideAction, updatePatientPurposeAction, getDoctorScheduleAction, getFamilyAction, recalculateQueueWithETC, updateDoctorStartDelayAction, rescheduleAppointmentAction, markPatientAsLateAndCheckInAction, addPatientAction, advanceQueueAction, startLastConsultationAction, getDoctorStatusAction } from '@/app/actions';
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
  patientDetails?: Partial<FamilyMember>;
}

const statusConfig = {
    Waiting: { icon: Clock, color: 'text-blue-600' },
    'Up-Next': { icon: ChevronsRight, color: 'text-yellow-600' },
    'Booked': { icon: CalendarIcon, color: 'text-gray-500' },
    'Confirmed': { icon: CalendarIcon, color: 'text-gray-500' }, 
    'In-Consultation': { icon: Hourglass, color: 'text-green-600 animate-pulse' },
    Completed: { icon: CheckCircle, color: 'text-green-600' },
    Late: { icon: UserX, color: 'text-orange-600' },
    Cancelled: { icon: XCircle, color: 'text-red-600' },
    'Waiting for Reports': { icon: FileClock, color: 'text-purple-600' },
    Priority: { icon: Shield, color: 'text-red-700 font-bold' },
};

const purposeIcons: { [key: string]: React.ElementType } = {
    'Consultation': Stethoscope,
    'Follow-up visit': Repeat,
    'Vaccination': Syringe,
    'Others': HelpCircle,
};

const getPatientNameColorClass = (status: Patient['status'], type: Patient['type']) => {
    if (status === 'Completed') return 'text-green-600';
    if (['Waiting', 'Late', 'In-Consultation', 'Priority', 'Up-Next'].includes(status)) return 'text-blue-600';
    if (status === 'Booked' || status === 'Confirmed') {
        if (type === 'Walk-in') return 'text-amber-800'; // Brown/Amber for walk-ins
        return 'text-foreground'; // Black/Default for appointments
    }
    return 'text-foreground'; // Default color
};


const timeZone = "Asia/Kolkata";

/**
 * Helper: convert a session time string ("HH:mm" or "h:mm a") anchored to dateStr (yyyy-MM-dd)
 * into a UTC Date (the instant when that local time occurs).
 */
function sessionLocalToUtc(dateStr: string, sessionTime: string) {
  // Try 24-hour format first
  let localDate: Date;
  if (/^\d{1,2}:\d{2}$/.test(sessionTime)) {
    // "HH:mm" (24-hour)
    localDate = parse(`${dateStr} ${sessionTime}`, 'yyyy-MM-dd HH:mm', new Date());
  } else {
    // attempt 12-hour with AM/PM: "h:mm a" or "hh:mm a"
    localDate = parse(`${dateStr} ${sessionTime}`, 'yyyy-MM-dd hh:mm a', new Date());
  }
  // fromZonedTime will give us the UTC Date object corresponding to that wall-clock time in the specified zone.
  return fromZonedTime(localDate, timeZone);
}

export default function DashboardPage() {
    const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
    const [family, setFamily] = useState<FamilyMember[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [doctorStatus, setDoctorStatus] = useState<DoctorStatus | null>(null);
    const [doctorOnlineTime, setDoctorOnlineTime] = useState('');
    const [doctorStartDelay, setDoctorStartDelay] = useState(0);
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [averageConsultationTime, setAverageConsultationTime] = useState(0);
    
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

    const getSessionForTime = (appointmentUtcDate: Date) => {
        if (!schedule || !schedule.days) return null;
        
        const zonedAppt = toZonedTime(appointmentUtcDate, timeZone);
        const dayOfWeek = format(zonedAppt, 'EEEE') as keyof DoctorSchedule['days'];
        const dateStr = format(zonedAppt, 'yyyy-MM-dd');

        let daySchedule = schedule.days[dayOfWeek];
        const todayOverride = schedule.specialClosures.find(c => c.date === dateStr);
        if (todayOverride) {
            daySchedule = {
            morning: todayOverride.morningOverride ?? daySchedule.morning,
            evening: todayOverride.eveningOverride ?? daySchedule.evening,
            };
        }

        const checkSession = (session: any) => { // Using `any` for session to bypass strict type checks for a moment.
            if (!session.isOpen) return false;
            const startUtc = sessionLocalToUtc(dateStr, session.start);
            const endUtc = sessionLocalToUtc(dateStr, session.end);
            const apptMs = appointmentUtcDate.getTime();
            return apptMs >= startUtc.getTime() && apptMs < endUtc.getTime();
        };

        if (checkSession(daySchedule.morning)) return 'morning';
        if (checkSession(daySchedule.evening)) return 'evening';
        return null;
    };

    const loadData = useCallback(async () => {
        await recalculateQueueWithETC();
        const [scheduleData, patientData, familyData, statusData] = await Promise.all([
            getDoctorScheduleAction(),
            getPatientsAction(),
            getFamilyAction(),
            getDoctorStatusAction()
        ]);

        setSchedule(scheduleData);
        setPatients(patientData);
        setFamily(familyData);
        setDoctorStatus(statusData);
    }, []);

    useEffect(() => {
        loadData(); // Initial load
        const intervalId = setInterval(loadData, 5000); // Poll every 5 seconds for faster updates

        return () => clearInterval(intervalId); // Cleanup on unmount
    }, [loadData]);


    useEffect(() => {
        const currentHour = new Date().getHours();
        if (currentHour >= 14) {
            setSelectedSession('evening');
        }
        
    }, []);

    useEffect(() => {
        if (doctorStatus?.isOnline && doctorStatus.onlineTime) {
            setDoctorOnlineTime(new Date(doctorStatus.onlineTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        } else {
            setDoctorOnlineTime('');
        }
        // Initialize delay state only when status data arrives
        if (doctorStatus) {
            setDoctorStartDelay(doctorStatus.startDelay || 0);
        }
    }, [doctorStatus]);

    const sessionPatients = patients.filter(p => {
        if (!isToday(parseISO(p.appointmentTime))) return false;
        
        const apptDate = parseISO(p.appointmentTime);
        const apptSession = getSessionForTime(apptDate);

        return apptSession === selectedSession;
    });

    useEffect(() => {
        // Calculate average consultation time based on session-specific patients
        const completedWithTime = sessionPatients.filter(p => p.status === 'Completed' && typeof p.consultationTime === 'number');
        if (completedWithTime.length > 0) {
            const totalTime = completedWithTime.reduce((acc, p) => acc + p.consultationTime!, 0);
            setAverageConsultationTime(Math.round(totalTime / completedWithTime.length));
        } else {
            setAverageConsultationTime(schedule?.slotDuration || 0);
        }

    }, [sessionPatients, schedule?.slotDuration]);


    useEffect(() => {
        if (!schedule || !schedule.days) return;

        const familyMap = new Map(family.map(f => [`${f.phone}-${f.name}`, f]));
        
        const dayOfWeek = format(selectedDate, 'EEEE') as keyof DoctorSchedule['days'];
        let daySchedule = schedule.days[dayOfWeek];
        const generatedSlots: TimeSlot[] = [];

        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const closure = schedule.specialClosures.find(c => c.date === dateStr);

        if (closure) {
            daySchedule = {
                morning: closure.morningOverride ?? daySchedule.morning,
                evening: closure.eveningOverride ?? daySchedule.evening
            }
        }
        
        const sessionToGenerate = selectedSession === 'morning' ? daySchedule.morning : daySchedule.evening;
        const isSessionClosed = selectedSession === 'morning' ? closure?.isMorningClosed : closure?.isEveningClosed;

        if (sessionToGenerate.isOpen && !isSessionClosed) {
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

                let patientDetails: Partial<FamilyMember> | undefined;
                if (patientForSlot) {
                    patientDetails = familyMap.get(`${patientForSlot.phone}-${patientForSlot.name}`);
                    if (!patientDetails) {
                        patientDetails = {
                            name: patientForSlot.name,
                            phone: patientForSlot.phone,
                            gender: 'Other' 
                        };
                    }
                }


                generatedSlots.push({
                    time: timeString,
                    isBooked: isBooked,
                    isReservedForWalkIn: isReservedForWalkIn,
                    patient: patientForSlot,
                    patientDetails: patientDetails,
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
    
    const handleBookAppointment = async (familyMember: FamilyMember, appointmentIsoString: string, checkIn: boolean, purpose: string) => {
        startTransition(async () => {
             const result = await addAppointmentAction(familyMember, appointmentIsoString, purpose, true, checkIn);

            if (result.success) {
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
        toast({ title: "Error", description: result.error, variant: 'destructive'});
        return null;
    };

    const handleOpenReschedule = (patient: Patient) => {
        setSelectedPatient(patient);
        setRescheduleOpen(true);
    };

    const handleReschedule = (newDate: string, newTime: string, newPurpose: string) => {
        if (selectedPatient) {
            startTransition(async () => {
                const dateObj = parse(newDate, 'yyyy-MM-dd', new Date());
                const timeObj = parse(newTime, 'hh:mm a', dateObj);
                const appointmentTime = timeObj.toISOString();

                const result = await rescheduleAppointmentAction(selectedPatient.id, appointmentTime, newPurpose);
                if (result.success) {
                    toast({ title: 'Success', description: 'Appointment has been rescheduled.' });
                    await loadData();
                } else {
                    toast({ title: "Error", description: result.error, variant: 'destructive' });
                }
            });
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
    
    const handleStartLastConsultation = (patientId: number) => {
        startTransition(async () => {
            const result = await startLastConsultationAction(patientId);
            if (result?.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: result.success });
                await loadData();
            }
        });
    };

    const handleAdvanceQueue = (patientId: number) => {
      startTransition(async () => {
          const result = await advanceQueueAction(patientId);
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
            const isGoingOnline = !doctorStatus?.isOnline;
            const newStatus = {
                isOnline: isGoingOnline,
                onlineTime: isGoingOnline ? new Date().toISOString() : undefined,
                // Reset delay only when going online
                startDelay: isGoingOnline ? 0 : doctorStartDelay 
            };
            
            const result = await setDoctorStatusAction(newStatus);
            
            if (result?.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive'});
            } else {
                toast({ title: 'Success', description: `Doctor is now ${newStatus.isOnline ? 'Online' : 'Offline'}.`});
                // If we just went online, also reset the local delay input state
                if (isGoingOnline) {
                    setDoctorStartDelay(0);
                }
                await loadData();
            }
        });
    }

    const handleToggleQueuePause = () => {
        startTransition(async () => {
            const newStatus = { isPaused: !doctorStatus?.isPaused };
            const result = await setDoctorStatusAction(newStatus);
            if (result?.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive'});
            } else {
                toast({ title: 'Success', description: `Queue is now ${newStatus.isPaused ? 'paused' : 'resumed'}.`});
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
    
    const handleMarkAsLateAndCheckIn = (patientId: number, penalty: number) => {
        startTransition(async () => {
            const result = await markPatientAsLateAndCheckInAction(patientId, penalty);
            if (result?.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: result.success });
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
                await loadData();
            }
        });
    };

    const nowServing = sessionPatients.find(p => p.status === 'In-Consultation');
    const upNext = sessionPatients.find(p => p.status === 'Up-Next');
    
    const waitingList = sessionPatients
      .filter(p => ['Waiting', 'Late', 'Priority'].includes(p.status) && p.id !== upNext?.id)
      .sort((a, b) => {
          const timeA = a.bestCaseETC ? parseISO(a.bestCaseETC).getTime() : Infinity;
          const timeB = b.bestCaseETC ? parseISO(b.bestCaseETC).getTime() : Infinity;
          if (timeA === Infinity && timeB === Infinity) {
              // Fallback to token number if ETC is not available (e.g., before session start)
              return (a.tokenNo || 0) - (b.tokenNo || 0);
          }
          return timeA - timeB;
      });

    const nextInLine = waitingList[0];
    
    const displayedTimeSlots = timeSlots.filter(slot => {
        if (slot.patient && (slot.patient.status === 'In-Consultation' || slot.patient.status === 'Up-Next')) {
            return false;
        }

        if (!showCompleted && slot.patient && (slot.patient.status === 'Completed' || slot.patient.status === 'Cancelled')) {
            return false;
        }

        if (!searchTerm) return true;
        
        if (!slot.isBooked || !slot.patientDetails) return false;
        const lowerSearch = searchTerm.toLowerCase();
        return slot.patientDetails.name?.toLowerCase().includes(lowerSearch) ||
               slot.patientDetails.phone?.includes(lowerSearch) ||
               (slot.patientDetails.clinicId && slot.patientDetails.clinicId.toLowerCase().includes(lowerSearch));
    });

    const canDoctorCheckIn = isToday(selectedDate);


    if (!schedule || !doctorStatus) {
        return (
            <div className="flex flex-col min-h-screen bg-background">
                <Header logoSrc={schedule?.clinicDetails?.clinicLogo} clinicName={schedule?.clinicDetails?.clinicName} />
                <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
                    <div className="space-y-6">
                        <Skeleton className="h-12 w-1/3" />
                        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                            <Skeleton className="h-28 w-full" />
                            <Skeleton className="h-28 w-full" />
                            <Skeleton className="h-28 w-full" />
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

    const PatientCard = ({ patient }: { patient: Patient }) => {
        const patientDetails = family.find(f => f.phone === patient.phone && f.name === patient.name) || { name: patient.name, gender: 'Other' };
        const StatusIcon = statusConfig[patient.status]?.icon || HelpCircle;
        const statusColor = statusConfig[patient.status]?.color || '';
        const PurposeIcon = purposeIcons[patient.purpose || ''] || HelpCircle;
        const isUpNext = upNext?.id === patient.id;
        const isNextInLine = nextInLine?.id === patient.id;
        const isActionable = patient.status !== 'Completed' && patient.status !== 'Cancelled';
        const isLastInQueue = isUpNext && waitingList.length === 0;

        return (
            <div className={cn(
                "p-3 grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 rounded-lg border bg-card shadow-sm",
                !isActionable && "opacity-60",
                isUpNext && "bg-yellow-100/70 border-yellow-300"
            )}>
                <div className="flex items-center gap-4">
                    <div className="w-12 text-center font-bold text-lg text-primary flex flex-col items-center">
                        <Ticket className="h-5 w-5 mb-1" />
                        #{patient.tokenNo}
                    </div>
                </div>

                <div className="flex-1 flex flex-col gap-1">
                    <div className={cn(
                        'flex items-center gap-2 font-semibold',
                        getPatientNameColorClass(patient.status, patient.type)
                    )}>
                        {PurposeIcon && <PurposeIcon className="h-4 w-4 text-muted-foreground" title={patient.purpose} />}
                        {patientDetails.name}
                        {patientDetails.gender === 'Male' ? <MaleIcon className="h-4 w-4 text-blue-500" /> : patientDetails.gender === 'Female' ? <FemaleIcon className="h-4 w-4 text-pink-500" /> : null}
                        <Badge variant={patient.type === 'Walk-in' ? 'secondary' : 'outline'}>{patient.type}</Badge>
                        {patient.status === 'Priority' && <Badge variant="destructive">Priority</Badge>}
                    </div>
                    <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                        <Timer className="h-4 w-4" />
                        ETC:
                        <span className="font-semibold text-green-600">{patient.bestCaseETC ? format(parseISO(patient.bestCaseETC), 'hh:mm a') : '-'}</span>
                        -
                        <span className="font-semibold text-orange-600">{patient.worstCaseETC ? format(parseISO(patient.worstCaseETC), 'hh:mm a') : '-'}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="w-40 flex items-center gap-2">
                        {StatusIcon && <StatusIcon className={cn("h-4 w-4", statusColor)} />}
                        <span className={cn("font-medium", statusColor)}>{patient.status} {patient.lateBy ? `(${patient.lateBy} min)` : ''}</span>
                    </div>
                    
                    {isActionable && (
                        <div className="flex items-center gap-2">
                            {['Booked', 'Confirmed'].includes(patient.status) && (
                                <Button size="sm" onClick={() => handleCheckIn(patient!.id)} disabled={isPending} className="bg-check-in text-check-in-foreground hover:bg-check-in/90">Check-in</Button>
                            )}
                             {isNextInLine && !isUpNext && (
                                <Button size="sm" onClick={() => handleAdvanceQueue(patient!.id)} disabled={isPending || !doctorStatus.isOnline}>
                                    <ChevronsRight className="mr-2 h-4 w-4" /> Move to Up Next
                                </Button>
                            )}
                            {isLastInQueue && (
                                <Button size="sm" onClick={() => handleStartLastConsultation(patient.id)} disabled={isPending || !doctorStatus.isOnline}>
                                     <LogIn className="mr-2 h-4 w-4" /> Start Consultation
                                </Button>
                            )}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {isActionable && !isNextInLine && !isUpNext && (
                                         <DropdownMenuItem onClick={() => handleAdvanceQueue(patient!.id)} disabled={isPending || !doctorStatus.isOnline}>
                                            <ChevronsRight className="mr-2 h-4 w-4" /> Move to Up Next
                                        </DropdownMenuItem>
                                    )}
                                     {(patient.status === 'Booked' || patient.status === 'Confirmed') && (
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger>
                                                <Hourglass className="mr-2 h-4 w-4" />
                                                Mark as Late
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuSubContent>
                                                <DropdownMenuLabel>Push Down By</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {[1, 2, 3, 4, 5, 6, 7].map(penalty => (
                                                    <DropdownMenuItem key={penalty} onClick={() => handleMarkAsLateAndCheckIn(patient!.id, penalty)}>
                                                        {`${penalty} position${penalty > 1 ? 's' : ''}`}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuSubContent>
                                        </DropdownMenuSub>
                                    )}
                                    {patient.status === 'In-Consultation' && (
                                        <DropdownMenuItem onClick={() => handleUpdateStatus(patient!.id, 'Waiting for Reports')} disabled={isPending}>
                                            <FileClock className="mr-2 h-4 w-4" />
                                            Waiting for Reports
                                        </DropdownMenuItem>
                                    )}
                                    {patient.status === 'Waiting for Reports' && (
                                        <DropdownMenuItem onClick={() => handleUpdateStatus(patient!.id, 'In-Consultation')} disabled={isPending || !doctorStatus.isOnline}>
                                            <ChevronsRight className="mr-2 h-4 w-4" />
                                            Consult (Reports)
                                        </DropdownMenuItem>
                                    )}
                                    {(patient.status === 'Waiting' || patient.status === 'Late') && (
                                        <DropdownMenuItem onClick={() => handleUpdateStatus(patient!.id, 'Priority')} disabled={isPending} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                                            <Shield className="mr-2 h-4 w-4" />
                                            Consult Now (Priority)
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Change Purpose
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent>
                                            <DropdownMenuRadioGroup value={patient.purpose} onValueChange={(value) => handleUpdatePurpose(patient!.id, value)}>
                                                {schedule?.visitPurposes.filter(p => p.enabled).map(purpose => (
                                                    <DropdownMenuRadioItem key={purpose.id} value={purpose.name}>{purpose.name}</DropdownMenuRadioItem>
                                                ))}
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                    <DropdownMenuItem onClick={() => handleOpenReschedule(patient!)}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        Reschedule
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleSendReminder(patient!.id)} disabled={isPending}>
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
                                                <AlertDialogAction onClick={() => handleCancelAppointment(patient!.id)}>Confirm Cancellation</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <Header logoSrc={schedule.clinicDetails?.clinicLogo} clinicName={schedule.clinicDetails?.clinicName} />
            <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
                <div className="space-y-6">
                    <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
                    <Stats patients={sessionPatients} averageConsultationTime={averageConsultationTime} />
                    
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
                                    <Switch id="pause-queue" checked={doctorStatus.isPaused} onCheckedChange={handleToggleQueuePause} disabled={isPending || !doctorStatus.isOnline}/>
                                    <Label htmlFor="pause-queue" className='flex items-center text-sm'>
                                        {doctorStatus.isPaused ? <Pause className="mr-2 h-4 w-4 text-orange-500" /> : <Play className="mr-2 h-4 w-4 text-green-500" />}
                                        {doctorStatus.isPaused ? 'Queue Paused' : 'Queue Active'}
                                    </Label>
                                </div>
                                <div className='flex items-center space-x-2'>
                                    <Label htmlFor="doctor-delay" className="text-sm">Delay (min)</Label>
                                    <Input id="doctor-delay" type="number" value={doctorStartDelay || 0} onChange={e => setDoctorStartDelay(parseInt(e.target.value) || 0)} className="w-16 h-8" disabled={doctorStatus.isOnline} />
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
                                {nowServing && (
                                    <div className="p-3 rounded-lg border bg-green-200/60 border-green-400">
                                         <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2">
                                                <Hourglass className="h-5 w-5 text-green-700 animate-pulse" />
                                                <h3 className="font-bold text-lg text-green-800">Now Serving</h3>
                                            </div>
                                             <div className="flex-1 flex flex-col gap-1">
                                                <div className="flex items-center gap-2 font-semibold text-blue-600">
                                                    {nowServing.name}
                                                    {nowServing.subStatus === 'Reports' && <span className="text-sm ml-2 font-semibold text-purple-600">(Reports)</span>}
                                                </div>
                                             </div>
                                             <div className="flex items-center gap-2">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="sm" className="h-8">Actions</Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem onClick={() => handleUpdateStatus(nowServing!.id, 'Completed')} disabled={isPending}>
                                                            Mark Completed
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleUpdateStatus(nowServing!.id, 'Waiting for Reports')} disabled={isPending}>
                                                            Waiting for Reports
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                             </div>
                                         </div>
                                    </div>
                                )}
                                {upNext && <PatientCard patient={upNext} />}

                            {displayedTimeSlots.length > 0 ? displayedTimeSlots.map((slot, index) => {
                                
                                if (searchTerm && !slot.isBooked) return null;
                                
                                return (
                                <div key={slot.time}>
                                {slot.isBooked && slot.patient ? (
                                    <PatientCard patient={slot.patient} />
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
                {schedule && selectedSlot && (
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
                    afterSave={(newPatient, purpose, checkIn) => {
                        if (selectedSlot && purpose) {
                            const date = new Date(selectedDate);
                            const time = parse(selectedSlot, 'hh:mm a', date);
                            handleBookAppointment(newPatient, time.toISOString(), checkIn, purpose);
                        }
                    }}
                    visitPurposes={schedule.visitPurposes.filter(p => p.enabled)}
                />
                {selectedPatient && schedule && (
                    <RescheduleDialog
                        isOpen={isRescheduleOpen}
                        onOpenChange={setRescheduleOpen}
                        patient={selectedPatient}
                        schedule={schedule}
                        onSave={handleReschedule}
                        bookedPatients={patients.filter(p => p.id !== selectedPatient.id)}
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
    

    














    

    

