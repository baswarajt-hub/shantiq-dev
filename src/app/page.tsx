

'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import Header from '@/components/header';
import type { DoctorSchedule, DoctorStatus, FamilyMember, Patient, SpecialClosure, Session } from '@/lib/types';
import { format, set, addMinutes, parseISO, isToday, differenceInMinutes } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { ChevronDown, Sun, Moon, UserPlus, Calendar as CalendarIcon, Trash2, Clock, Search, User, CheckCircle, Hourglass, UserX, XCircle, ChevronsRight, Send, EyeOff, Eye, FileClock, Footprints, LogIn, PlusCircle, AlertTriangle, Sparkles, LogOut, Repeat, Shield, Pencil, Ticket, Timer, Stethoscope, Syringe, HelpCircle, Pause, Play, MoreVertical, QrCode, Wrench, ListChecks, PanelsLeftBottom, RefreshCw, UserCheck, Activity, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AdjustTimingDialog } from '@/components/reception/adjust-timing-dialog';
import { AddNewPatientDialog } from '@/components/reception/add-new-patient-dialog';
import { RescheduleDialog } from '@/components/reception/reschedule-dialog';
import { BookWalkInDialog } from '@/components/reception/book-walk-in-dialog';
import { setDoctorStatusAction, emergencyCancelAction, getPatientsAction, addAppointmentAction, addNewPatientAction, updatePatientStatusAction, sendReminderAction, cancelAppointmentAction, checkInPatientAction, updateTodayScheduleOverrideAction, updatePatientPurposeAction, getDoctorScheduleAction, getFamilyAction, recalculateQueueWithETC, updateDoctorStartDelayAction, rescheduleAppointmentAction, markPatientAsLateAndCheckInAction, addPatientAction as addPatientActionType, advanceQueueAction, startLastConsultationAction, getDoctorStatusAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScheduleCalendar } from '@/components/shared/schedule-calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { parse } from 'date-fns';
import type { ActionResult } from '@/lib/types';


type TimeSlot = {
  time: string;
  isBooked: boolean;
  isReservedForWalkIn?: boolean;
  patient?: Patient;
  patientDetails?: Partial<FamilyMember>;
}

const PatientNameWithBadges = ({ patient }: { patient: Patient }) => {
  const nameToDisplay = patient.name;
  return (
    <span className="flex items-center gap-2 font-semibold relative">
      {nameToDisplay}
        <span className="flex gap-1">
            {patient.subType === 'Booked Walk-in' && (
              <sup className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold" title="Booked Walk-in">B</sup>
            )}
            {patient.lateBy && patient.lateBy > 0 && patient.status !== 'Completed' && patient.status !== 'Cancelled' && (
              <sup className="inline-flex items-center justify-center rounded-md bg-red-500 px-1.5 py-0.5 text-white text-[10px] font-bold" title="Late">L</sup>
            )}
            {patient.subStatus === 'Reports' && (
              <sup className="inline-flex items-center justify-center rounded-md bg-purple-500 px-1.5 py-0.5 text-white text-[10px] font-bold" title="Waiting for Reports">R</sup>
            )}
            {patient.status === 'Priority' && (
                <sup className="inline-flex items-center justify-center rounded-md bg-red-700 px-1.5 py-0.5 text-white text-[10px] font-bold" title="Priority">P</sup>
            )}
        </span>
    </span>
  );
};


const statusConfig: Record<Patient['status'], { icon: React.ElementType; color: string }> = {
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
    'Missed': { icon: UserX, color: 'text-yellow-800' }
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

const StatCard: React.FC<{ title: string; value: string | number; icon?: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="group relative rounded-xl border border-neutral-200 bg-white p-3 shadow-sm hover:shadow transition-shadow">
      <div className="flex items-center gap-2 text-xs font-medium text-neutral-600">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-neutral-100">{icon}</span>
        {title}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-neutral-900 text-center">{value}</div>
    </div>
  );

const ToolbarButton: React.FC<{ label: string; icon: React.ReactNode; variant?: "default" | "danger", onClick?: () => void, disabled?: boolean }> = ({ label, icon, variant = "default", onClick, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left text-sm font-medium transition-all disabled:opacity-50",
        variant === "danger"
          ? "border-red-200 bg-red-50 hover:bg-red-100 text-red-700"
          : "border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700",
      )}
    >
      <span className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md",
           variant === "danger" ? "bg-red-100" : "bg-neutral-100"
      )}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );

export default function DashboardPage() {
    const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
    const [family, setFamily] = useState<FamilyMember[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [doctorStatus, setDoctorStatus] = useState<DoctorStatus | null>(null);
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [averageConsultationTime, setAverageConsultationTime] = useState(0);
    const [averageWaitTime, setAverageWaitTime] = useState(0);

    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [isBookWalkInOpen, setBookWalkInOpen] = useState(false);
    const [isNewPatientOpen, setNewPatientOpen] = useState(false);
    const [isRescheduleOpen, setRescheduleOpen] = useState(false);
    const [isAdjustTimingOpen, setAdjustTimingOpen] = useState(false);
    const [selectedSession, setSelectedSession] = useState<'morning' | 'evening'>('morning');
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [phoneToPreFill, setPhoneToPreFill] = useState('');
    const [showCompleted, setShowCompleted] = useState(false);
    
    const [isLoading, setIsLoading] = useState(true);
    const [initialLoad, setInitialLoad] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPending, startTransition] = useTransition();
    
    const { toast } = useToast();

    const getSessionForTime = (appointmentUtcDate: Date) => {
        if (!schedule || !schedule.days) return null;

        const zonedAppt = toZonedTime(appointmentUtcDate, timeZone);
        const dayOfWeek = format(zonedAppt, 'EEEE') as keyof DoctorSchedule['days'];
        const dateStr = format(zonedAppt, 'yyyy-MM-dd');

        let daySchedule = schedule.days[dayOfWeek];
        if (!daySchedule) return null;

        const todayOverride = schedule.specialClosures.find(c => c.date === dateStr);
        if (todayOverride) {
            daySchedule = {
                morning: todayOverride.morningOverride ?? daySchedule.morning,
                evening: todayOverride.eveningOverride ?? daySchedule.evening,
            };
        }

        const checkSession = (session: Session) => {
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

    const loadData = useCallback(() => {
      if (initialLoad) setIsLoading(true);
      else setIsRefreshing(true);
      
      Promise.all([
          getDoctorScheduleAction(),
          getPatientsAction(),
          getFamilyAction(),
          getDoctorStatusAction()
      ]).then(([scheduleData, patientData, familyData, statusData]) => {
          setSchedule(scheduleData);
          setPatients(patientData);
          setFamily(familyData);
          setDoctorStatus(statusData);
      }).catch(err => {
          console.error("Failed to load data", err);
          toast({ title: "Error", description: "Could not load clinic data.", variant: "destructive"});
      }).finally(() => {
         if (initialLoad) setIsLoading(false);
         setInitialLoad(false);
         setIsRefreshing(false);
      });
    }, [initialLoad, toast]);

    useEffect(() => {
        loadData();
        const intervalId = setInterval(loadData, 30000);
        return () => clearInterval(intervalId);
    }, [loadData]);
    
    useEffect(() => {
      const currentHour = new Date().getHours();
      if (currentHour >= 14) {
        setSelectedSession('evening');
      }
    }, []);


    const sessionPatients = patients.filter(p => {
        if (!p.appointmentTime || !selectedDate || !isToday(parseISO(p.appointmentTime)) || p.status === 'Cancelled') return false;

        const apptDate = parseISO(p.appointmentTime);
        const apptSession = getSessionForTime(apptDate);

        return apptSession === selectedSession;
    });

    useEffect(() => {
        // Calculate average consultation time based on session-specific patients
        const completedWithTime = sessionPatients.filter(p => p.status === 'Completed' && typeof p.consultationTime === 'number');
        if (completedWithTime.length > 0) {
            const totalTime = completedWithTime.reduce((acc, p) => acc + (p.consultationTime || 0), 0);
            setAverageConsultationTime(Math.round(totalTime / completedWithTime.length));
        } else {
            setAverageConsultationTime(schedule?.slotDuration || 0);
        }

        // Calculate average wait time
        const currentlyWaiting = sessionPatients.filter(p =>
            ['Waiting', 'Late', 'Priority', 'Up-Next'].includes(p.status) && p.checkInTime
        );

        if (currentlyWaiting.length > 0) {
            const now = new Date();
            const totalWaitMinutes = currentlyWaiting.reduce((acc, p) => {
                if (!p.checkInTime) return acc;
                const wait = differenceInMinutes(now, parseISO(p.checkInTime));
                return acc + (wait > 0 ? wait : 0);
            }, 0);
            setAverageWaitTime(Math.round(totalWaitMinutes / currentlyWaiting.length));
        } else if (schedule) {
            setAverageWaitTime(0); // Set to 0 if no one is waiting
        }

    }, [sessionPatients, schedule?.slotDuration]);


    useEffect(() => {
        if (!schedule || !schedule.days || !selectedDate) return;

        const familyMap = new Map(family.map(f => [`${f.phone}-${f.name}`, f]));

        const dayOfWeek = format(selectedDate, 'EEEE') as keyof DoctorSchedule['days'];
        let daySchedule = schedule.days[dayOfWeek];
        const generatedSlots: TimeSlot[] = [];

        if (!daySchedule) {
            setTimeSlots([]);
            return;
        }

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
                    if (p.status === 'Cancelled' || !p.appointmentTime) return false;
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
                        // Create a fallback object if family member is not found, to prevent crash
                        patientDetails = {
                            name: patientForSlot.name,
                            phone: patientForSlot.phone,
                            gender: 'Other' // or some default
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

    const handleBookAppointment = useCallback(async (familyMember: FamilyMember, appointmentIsoString: string, checkIn: boolean, purpose: string) => {
        startTransition(() => {
            addAppointmentAction(familyMember, appointmentIsoString, purpose, true, checkIn).then(result => {
                if ("error" in result) {
                    toast({ title: "Error", description: result.error, variant: 'destructive'});
                } else {
                    toast({ title: "Success", description: "Appointment booked successfully."});
                    loadData();
                }
            });
        });
    }, [loadData, toast]);

    const handleAddNewPatient = useCallback(async (newPatientData: Omit<FamilyMember, 'id' | 'avatar'>): Promise<FamilyMember | null> => {
        return new Promise((resolve) => {
            startTransition(() => {
                addNewPatientAction(newPatientData).then(result => {
                    if ("error" in result || !('patient' in result)) {
                        toast({ title: "Error", description: (result as any).error || "Failed to add patient", variant: "destructive"});
                        resolve(null);
                    } else {
                        toast({ title: "Success", description: result.success});
                        loadData();
                        resolve(result.patient);
                    }
                });
            });
        });
    }, [loadData, toast]);

    const handleOpenReschedule = (patient: Patient) => {
        setSelectedPatient(patient);
        setRescheduleOpen(true);
    };

    const handleReschedule = useCallback((newDate: string, newTime: string, newPurpose: string) => {
        if (selectedPatient) {
            startTransition(() => {
                const dateObj = parse(newDate, 'yyyy-MM-dd', new Date());
                const timeObj = parse(newTime, 'hh:mm a', dateObj);
                const appointmentTime = timeObj.toISOString();

                rescheduleAppointmentAction(selectedPatient.id, appointmentTime, newPurpose).then(result => {
                    if ("error" in result) {
                        toast({ title: "Error", description: result.error, variant: 'destructive' });
                    } else {
                        toast({ title: 'Success', description: 'Appointment has been rescheduled.' });
                        loadData();
                    }
                });
            });
        }
    }, [selectedPatient, loadData, toast]);

    const handleUpdateStatus = useCallback((patientId: string, status: Patient['status']) => {
        startTransition(() => {
            updatePatientStatusAction(patientId, status).then(result => {
                if ("error" in result) {
                    toast({ title: 'Error', description: result.error, variant: 'destructive' });
                } else {
                    toast({ title: 'Success', description: result.success });
                    loadData();
                }
            });
        });
    }, [loadData, toast]);

    const handleStartLastConsultation = useCallback((patientId: string) => {
        startTransition(() => {
            startLastConsultationAction(patientId).then(result => {
                if ("error" in result) {
                    toast({ title: 'Error', description: result.error, variant: 'destructive' });
                } else {
                    toast({ title: 'Success', description: result.success });
                    loadData();
                }
            });
        });
    }, [loadData, toast]);

    const handleAdvanceQueue = useCallback((patientId: string) => {
        startTransition(() => {
          advanceQueueAction(patientId).then(result => {
              if ("error" in result) {
                  toast({ title: 'Error', description: result.error, variant: 'destructive' });
              } else {
                  toast({ title: 'Success', description: result.success });
                  loadData();
              }
          });
        });
    }, [loadData, toast]);

    const handleUpdatePurpose = useCallback((patientId: string, purpose: string) => {
        startTransition(() => {
            updatePatientPurposeAction(patientId, purpose).then(result => {
                if ("error" in result) {
                    toast({ title: 'Error', description: result.error, variant: 'destructive' });
                } else {
                    toast({ title: 'Success', description: result.success });
                    loadData();
                }
            });
        });
    }, [loadData, toast]);

    const handleSendReminder = useCallback((patientId: string) => {
        startTransition(() => {
            sendReminderAction(patientId).then(result => {
                if ("error" in result) {
                    toast({ title: 'Error', description: result.error, variant: 'destructive' });
                } else {
                    toast({ title: 'Success', description: result.success });
                    loadData();
                }
            });
        });
    }, [loadData, toast]);


    const handleCancelAppointment = useCallback((patientId: string) => {
        startTransition(() => {
            cancelAppointmentAction(patientId).then(result => {
                if ("error" in result) {
                    toast({ title: 'Error', description: 'Failed to cancel appointment.', variant: 'destructive' });
                } else {
                    toast({ title: 'Success', description: 'Appointment cancelled.' });
                    loadData();
                }
            });
        });
    }, [loadData, toast]);

    const handleCheckIn = useCallback((patientId: string) => {
        startTransition(() => {
            checkInPatientAction(patientId).then(result => {
                if ("error" in result) {
                    toast({ title: 'Error', description: result.error, variant: 'destructive' });
                } else {
                    toast({ title: 'Success', description: result.success });
                    loadData();
                }
            });
        });
    }, [loadData, toast]);

    const handleAdjustTiming = useCallback(async (override: SpecialClosure) => {
        startTransition(() => {
            updateTodayScheduleOverrideAction(override).then(result => {
                if ("error" in result) {
                    toast({ title: 'Error', description: result.error, variant: 'destructive' });
                } else {
                    toast({ title: 'Success', description: result.success });
                    loadData();
                }
            });
        });
    }, [loadData, toast]);

    const handleOpenNewPatientDialogFromWalkIn = (searchTerm: string) => {
        setBookWalkInOpen(false);
        // Basic check if the search term could be a phone number
        if (/^\d{5,}$/.test(searchTerm.replace(/\D/g, ''))) {
            setPhoneToPreFill(searchTerm);
        }
        setNewPatientOpen(true);
    };

    const handleToggleStatus = useCallback((field: keyof DoctorStatus) => {
        if (!doctorStatus) return;

        let newStatusValue = !doctorStatus[field];
        let updates: Partial<DoctorStatus> = { [field]: newStatusValue };

        if (field === 'isQrCodeActive' && newStatusValue) {
          // Logic to generate a new token is handled in the server action
        } else if (field === 'isQrCodeActive' && !newStatusValue) {
          updates.walkInSessionToken = null;
        }

        if (field === 'isOnline') {
            if (newStatusValue) { // Going online
                updates.startDelay = 0;
                updates.onlineTime = new Date().toISOString();
            } else { // Going offline
                updates.onlineTime = undefined;
                if(doctorStatus.isPaused) updates.isPaused = false;
            }
        }

        startTransition(() => {
            setDoctorStatusAction(updates).then(result => {
                if ("error" in result) {
                    toast({ title: 'Error', description: `Failed to update status.`, variant: 'destructive' });
                } else {
                    toast({ title: 'Success', description: result.success });
                    loadData();
                }
            });
        });
    }, [doctorStatus, loadData, toast]);

    const handleUpdateDelay = useCallback(() => {
        const delayInput = document.getElementById('doctor-delay') as HTMLInputElement;
        if (delayInput) {
            const delayValue = parseInt(delayInput.value, 10) || 0;
            startTransition(() => {
                updateDoctorStartDelayAction(delayValue).then(result => {
                    if ("error" in result) {
                        toast({ title: 'Error', description: result.error, variant: 'destructive'});
                    } else {
                        toast({ title: 'Success', description: result.success});
                        loadData();
                    }
                });
            });
        }
    }, [loadData, toast]);

    const handleMarkAsLateAndCheckIn = useCallback((patientId: string, penalty: number) => {
        startTransition(() => {
            markPatientAsLateAndCheckInAction(patientId, penalty).then(result => {
                if ("error" in result) {
                    toast({ title: 'Error', description: result.error, variant: 'destructive' });
                } else {
                    toast({ title: 'Success', description: result.success });
                    loadData();
                }
            });
        });
    }, [loadData, toast]);

    const handleRunRecalculation = useCallback(() => {
        startTransition(() => {
            recalculateQueueWithETC().then(result => {
                if ("error" in result) {
                    toast({ title: 'Error', description: result.error, variant: 'destructive' });
                } else {
                    toast({ title: 'Success', description: result.success });
                    loadData();
                }
            });
        });
    }, [loadData, toast]);

    const handleEmergencyCancel = useCallback(() => {
        startTransition(() => {
            emergencyCancelAction().then(result => {
                if ("error" in result) {
                    toast({ title: 'Error', description: result.error, variant: 'destructive' });
                } else {
                    toast({ title: 'Success', description: result.success });
                    loadData();
                }
            });
        });
    }, [loadData, toast]);

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
               (slot.patientDetails.clinicId && String(slot.patientDetails.clinicId).toLowerCase().includes(lowerSearch));
    });

    const canDoctorCheckIn = selectedDate ? isToday(selectedDate) : false;


    if (isLoading || !schedule || !doctorStatus || !selectedDate) {
        return (
            <div className="flex flex-col min-h-screen bg-background">
                 <Header logoSrc={schedule?.clinicDetails?.clinicLogo} clinicName={schedule?.clinicDetails?.clinicName} />
                <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
                    <div className="space-y-6">
                        <Skeleton className="h-12 w-1/3" />
                        <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-4 border-b">
                            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                            </div>
                        </div>
                        <Skeleton className="h-96 w-full" />
                    </div>
                </main>
            </div>
        );
    }

    const doctorOnlineTime = doctorStatus.onlineTime ? new Date(doctorStatus.onlineTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';


    const PatientCard = ({ patient }: { patient: Patient }) => {
        const patientDetails = family.find(f => f.phone === patient.phone && f.name === patient.name) || { name: patient.name, gender: 'Other' };
        const statusKey = patient.status as keyof typeof statusConfig;
        const StatusIcon = statusConfig[statusKey]?.icon || HelpCircle;
        const statusColor = statusConfig[statusKey]?.color || '';
        const PurposeIcon = patient.purpose ? (purposeIcons[patient.purpose as keyof typeof purposeIcons] || HelpCircle) : HelpCircle;
        const isUpNext = upNext?.id === patient.id;
        const isNextInLine = nextInLine?.id === patient.id;
        const isActionable = patient.status !== 'Completed' && patient.status !== 'Cancelled';
        const isLastInQueue = isUpNext && waitingList.length === 0;

        return (
            <div className={cn(
                "p-3 grid grid-cols-[80px_1fr_60px_120px_1fr_150px_auto] items-center gap-4 rounded-xl border bg-white shadow-sm",
                !isActionable && "opacity-60",
                isUpNext && "bg-yellow-100/70 border-yellow-300"
            )}>
                <div className="font-bold text-lg text-primary flex items-center gap-2 justify-start">
                    <Ticket className="h-5 w-5" />
                    #{patient.tokenNo}
                </div>

                <div className={cn('flex items-center gap-2 text-base', getPatientNameColorClass(patient.status, patient.type))}>
                    <PatientNameWithBadges patient={patient} />
                </div>
                
                <div className="flex justify-start">
                   {patientDetails.gender === 'Male' ? <User className="h-4 w-4 text-blue-500" title="Male" /> : patientDetails.gender === 'Female' ? <User className="h-4 w-4 text-pink-500" title="Female"/> : <div className="w-4"/>}
                </div>

                <div className="flex items-center gap-2 justify-start">
                  <Badge variant={patient.type === 'Walk-in' ? 'secondary' : 'outline'} className="whitespace-nowrap">{patient.type}</Badge>
                  {PurposeIcon && <PurposeIcon className="h-4 w-4 text-muted-foreground" title={patient.purpose || undefined} />}
                </div>

                <div className='flex items-center gap-2 text-xs text-muted-foreground justify-start'>
                    <Timer className="h-4 w-4" />
                    ETC:
                    <span className="font-semibold text-green-600">{patient.bestCaseETC ? format(parseISO(patient.bestCaseETC), 'hh:mm a') : '-'}</span>
                    -
                    <span className="font-semibold text-orange-600">{patient.worstCaseETC ? format(parseISO(patient.worstCaseETC), 'hh:mm a') : '-'}</span>
                </div>
                
                <div className="flex items-center gap-2 justify-start">
                    {StatusIcon && <StatusIcon className={cn("h-4 w-4", statusColor)} />}
                    <span className={cn("font-medium", statusColor)}>{patient.status} {patient.lateBy ? `(${patient.lateBy} min)` : ''}</span>
                </div>

                <div className="flex items-center justify-end gap-2">
                    {isActionable && (
                        <>
                            {['Booked', 'Confirmed'].includes(patient.status) && (
                                <Button size="sm" onClick={() => handleCheckIn(patient!.id)} disabled={isPending} className="bg-green-500 text-white hover:bg-green-600">Check-in</Button>
                            )}
                             {isNextInLine && !isUpNext && (
                                <Button size="sm" onClick={() => handleAdvanceQueue(patient!.id)} disabled={isPending || !doctorStatus?.isOnline}>
                                    <ChevronsRight className="mr-2 h-4 w-4" /> Move to Up Next
                                </Button>
                            )}
                            {isLastInQueue && (
                                <Button size="sm" onClick={() => handleStartLastConsultation(patient.id)} disabled={isPending || !doctorStatus?.isOnline}>
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
                                         <DropdownMenuItem onClick={() => handleAdvanceQueue(patient!.id)} disabled={isPending || !doctorStatus?.isOnline}>
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
                                        <DropdownMenuItem onClick={() => handleUpdateStatus(patient!.id, 'In-Consultation')} disabled={isPending || !doctorStatus?.isOnline}>
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
                                            <DropdownMenuRadioGroup value={patient.purpose || ''} onValueChange={(value) => handleUpdatePurpose(patient!.id, value)}>
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
                        </>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen w-full bg-neutral-50">
            <Header logoSrc={schedule?.clinicDetails?.clinicLogo} clinicName={schedule?.clinicDetails?.clinicName} />
            <div className="grid md:grid-cols-[280px_1fr] h-[calc(100vh-57px)]">
                <aside className="fixed top-[57px] left-0 h-full w-[280px] bg-white border-r flex flex-col p-4 space-y-4 overflow-y-auto">
                    <div style={{backgroundColor: '#1775a9'}} className="rounded-xl p-3 text-center text-white">
                        <div className="flex items-center justify-center gap-2 font-bold">
                           <Popover>
                                <PopoverTrigger asChild>
                                  <button><CalendarIcon className="h-5 w-5" /></button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <ScheduleCalendar
                                        mode="single"
                                        selected={selectedDate}
                                        onSelect={(day) => {
                                          if (day && (!selectedDate || day.getTime() !== selectedDate.getTime())) {
                                            setSelectedDate(day);
                                          }
                                        }}
                                        initialFocus
                                        schedule={schedule}
                                    />
                                </PopoverContent>
                            </Popover>
                           {format(selectedDate, 'EEEE, MMM d, yyyy')}
                           {isRefreshing && <RefreshCw className="h-4 w-4 animate-spin" />}
                        </div>
                    </div>

                    <div className="rounded-xl border bg-white p-3 shadow-sm flex-1">
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-700">
                            <Wrench className="h-5 w-5" /> Quick Actions
                        </div>
                        <div className="space-y-2">
                             <div className="flex items-center justify-between p-2 rounded-lg bg-muted">
                                <Label htmlFor="doctor-status-toggle" className="flex items-center text-sm font-medium">
                                    {doctorStatus.isOnline ? <LogIn className="mr-2 h-4 w-4 text-green-500" /> : <LogOut className="mr-2 h-4 w-4 text-red-500" />}
                                    {doctorStatus.isOnline ? `Online` : 'Offline'}
                                </Label>
                                <Switch id="doctor-status-toggle" checked={doctorStatus.isOnline} onCheckedChange={() => handleToggleStatus('isOnline')} disabled={isPending}/>
                            </div>
                             <div className='p-2 rounded-lg bg-muted space-y-2'>
                                <Label htmlFor="doctor-delay-input" className="text-sm">Delay (min)</Label>
                                <div className='flex items-center gap-2'>
                                    <Input id="doctor-delay" type="number" defaultValue={doctorStatus.startDelay || 0} className="w-16 h-8" disabled={isPending || doctorStatus.isOnline} />
                                    <Button size="sm" variant="outline" onClick={handleUpdateDelay} disabled={isPending || doctorStatus.isOnline}>Set</Button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-muted">
                                <Label htmlFor="queue-active-toggle" className="flex items-center text-sm font-medium">
                                    {doctorStatus.isPaused ? <Pause className="mr-2 h-4 w-4 text-orange-500" /> : <Play className="mr-2 h-4 w-4 text-green-500" />}
                                    {doctorStatus.isPaused ? 'Queue Paused' : 'Queue Active'}
                                </Label>
                                <Switch id="queue-active-toggle" checked={!doctorStatus.isPaused} onCheckedChange={() => handleToggleStatus('isPaused')} disabled={isPending || !doctorStatus.isOnline}/>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-muted">
                                <Label htmlFor="qr-code-toggle" className="flex items-center text-sm font-medium">
                                    <QrCode className="mr-2 h-4 w-4" />
                                    QR Code
                                </Label>
                                <Switch id="qr-code-toggle" checked={!!doctorStatus.isQrCodeActive} onCheckedChange={() => handleToggleStatus('isQrCodeActive')} disabled={isPending}/>
                            </div>
                            <ToolbarButton label="New Patient" icon={<UserPlus className="h-5 w-5" />} onClick={() => setNewPatientOpen(true)} />
                            <ToolbarButton label="Adjust Timing" icon={<Clock className="h-5 w-5" />} onClick={() => setAdjustTimingOpen(true)} />
                            <ToolbarButton label="Show Completed" icon={<ListChecks className="h-5 w-5" />} onClick={() => setShowCompleted(prev => !prev)} />
                            <ToolbarButton label="Recalculate Queue" icon={<RefreshCw className="h-5 w-5" />} onClick={handleRunRecalculation} disabled={isPending} />
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <ToolbarButton label="Emergency" icon={<AlertTriangle className="h-5 w-5" />} variant="danger" />
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
                    </div>
                </aside>

                 <main className="md:col-start-2 overflow-y-auto">
                    <div className="sticky top-0 z-10 bg-neutral-50/80 backdrop-blur-sm p-4">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                            <StatCard title="Total Appointments" value={sessionPatients.length} icon={<CalendarIcon className="h-4 w-4" />} />
                            <StatCard title="In Queue" value={waitingList.length + (upNext ? 1 : 0)} icon={<Users className="h-4 w-4" />} />
                            <StatCard title="Yet to Arrive" value={sessionPatients.filter(p => ['Booked', 'Confirmed'].includes(p.status)).length} icon={<UserCheck className="h-4 w-4" />} />
                            <StatCard title="Completed" value={sessionPatients.filter(p => p.status === 'Completed').length} icon={<CheckCircle className="h-4 w-4" />} />
                            <StatCard title="Avg. Wait" value={`${averageWaitTime} min`} icon={<Clock className="h-4 w-4" />} />
                            <StatCard title="Avg. Consult" value={`${averageConsultationTime} min`} icon={<Activity className="h-4 w-4" />} />
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-4 px-1">
                           <div className="relative w-full max-w-xs">
                              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                  type="search"
                                  placeholder="Search patient..."
                                  className="pl-8"
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                              />
                           </div>
                           <div className="w-full max-w-sm">
                             <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center shadow-sm">
                               <div className="text-xs font-medium text-neutral-600">Visit Purpose Breakdown</div>
                                <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-neutral-800">
                                   {(() => {
                                        const purposeCounts = sessionPatients.reduce((acc, p) => { if(p.purpose) acc[p.purpose] = (acc[p.purpose] || 0) + 1; return acc; }, {} as Record<string, number>);
                                        const purposes = Object.entries(purposeCounts);
                                        if (purposes.length > 0) {
                                            return purposes.map(([purpose, count]) => {
                                                const Icon = purposeIcons[purpose] || HelpCircle;
                                                return (
                                                    <span key={purpose} className="flex items-center gap-1.5" title={purpose}>
                                                        <Icon className="h-4 w-4 text-neutral-500" />
                                                        <span className="font-bold">{count}</span>
                                                    </span>
                                                )
                                            });
                                        }
                                        return <span className="text-neutral-500">No purposes specified yet.</span>
                                   })()}
                               </div>
                             </div>
                           </div>
                           <div className="w-full max-w-xs flex justify-end">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                         <Button variant="outline" className='w-48 justify-between'>
                                            {selectedSession === 'morning' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                                            {selectedSession.charAt(0).toUpperCase() + selectedSession.slice(1)} Session
                                            <ChevronDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className='w-48'>
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
                        </div>
                    </div>

                    <div className="p-4">
                      <div className="mt-3 space-y-2">
                          {nowServing && (
                              <div className="p-3 rounded-xl border bg-green-200/60 border-green-400 shadow-md">
                                   <div className="flex items-center gap-4">
                                      <div className="flex items-center gap-2">
                                          <Hourglass className="h-5 w-5 text-green-700 animate-pulse" />
                                          <h3 className="font-bold text-lg text-green-800">Now Serving</h3>
                                      </div>
                                       <div className="flex-1 flex flex-col gap-1">
                                          <div className="flex items-center gap-2 font-semibold text-blue-600 text-lg">
                                              <PatientNameWithBadges patient={nowServing} />
                                          </div>
                                       </div>
                                       <div className="flex items-center gap-2">
                                          <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                  <Button variant="outline" size="sm" className="h-8 bg-white/70">Actions</Button>
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
                                        "p-3 flex items-center rounded-xl border border-dashed hover:bg-neutral-100 cursor-pointer transition-colors",
                                         "bg-neutral-50"
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
                    </div>
                </main>
            </div>

                {schedule && selectedSlot && selectedDate && (
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
                        if (selectedSlot && selectedDate && purpose) {
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
        </div>
    );
}
