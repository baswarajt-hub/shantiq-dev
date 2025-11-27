

'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import Header from '@/components/header';
import type { DoctorSchedule, DoctorStatus, FamilyMember, Patient, SpecialClosure, Session, Fee, VisitPurpose, ClinicDetails } from '@/lib/types';
import { format, set, addMinutes, parseISO, isToday, differenceInMinutes } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { ChevronDown, Sun, Moon, UserPlus, Calendar as CalendarIcon, Trash2, Clock, Search, User, CheckCircle, Hourglass, UserX, XCircle, ChevronsRight, Send, EyeOff, Eye, FileClock, Footprints, LogIn, PlusCircle, AlertTriangle, Sparkles, LogOut, Repeat, Shield, Pencil, Ticket, Timer, Stethoscope, Syringe, HelpCircle, Pause, Play, MoreVertical, QrCode, Wrench, ListChecks, PanelsLeftBottom, RefreshCw, UserCheck, Activity, Users, IndianRupee, LinkIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AdjustTimingDialog } from '@/components/reception/adjust-timing-dialog';
import { AddNewPatientDialog } from '@/components/reception/add-new-patient-dialog';
import { RescheduleDialog } from '@/components/reception/reschedule-dialog';
import { BookWalkInDialog } from '@/components/reception/book-walk-in-dialog';
import { getDoctorStatusAction, setDoctorStatusAction, emergencyCancelAction, getPatientsAction, addAppointmentAction, addNewPatientAction, updatePatientStatusAction, sendReminderAction, cancelAppointmentAction, checkInPatientAction, updateTodayScheduleOverrideActionHandler, updatePatientPurposeAction, getDoctorScheduleAction, getFamilyAction, updateDoctorStartDelayAction, rescheduleAppointmentAction, markPatientAsLateAndCheckInAction, consultNextAction, saveFeeAction, getSessionFeesAction, convertGuestToExistingAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn, toProperCase } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScheduleCalendar } from '@/components/shared/schedule-calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { parse } from 'date-fns';
import type { ActionResult } from '@/lib/types';
import { FamilyDetailsDialog } from '@/components/reception/family-details-dialog';
import { FeeEntryDialog } from '@/components/reception/fee-entry-dialog';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SplitButton } from '@/components/ui/split-button';
import { ConvertGuestDialog } from '@/components/reception/convert-guest-dialog';




type TimeSlot = {
  time: string;
  isBooked: boolean;
  isReservedForWalkIn?: boolean;
  patient?: Patient & { clinicId?: string };
  patientDetails?: Partial<FamilyMember>;
  tokenNo: number;
}

const PatientNameWithBadges = ({ patient, patientDetails }: { patient: Patient, patientDetails?: Partial<FamilyMember> }) => {
  const { toast } = useToast();
  const nameToDisplay = patient.isGuest ? patient.guestName : patient.name;
  const clinicId = patientDetails?.clinicId;

  const handleCopy = () => {
    if (clinicId) {
      navigator.clipboard.writeText(clinicId);
      toast({
        title: 'Copied!',
        description: `Clinic ID ${clinicId} copied to clipboard.`,
      });
    }
  };
  
  return (
    <span className="flex items-center gap-2 font-semibold relative">
      {nameToDisplay}
      {patient.isGuest && (
         <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Badge variant="guest">Guest</Badge>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>This guest booking needs to be converted to a registered patient before check-in.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
      )}
      {clinicId && (
        <button
          onClick={handleCopy}
          className="text-xs font-mono text-muted-foreground ml-2 hover:text-primary transition-colors cursor-pointer"
          title="Click to copy Clinic ID"
        >
          ({clinicId})
        </button>
      )}
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
  let localDate: Date;
  if (/[ap]m$/i.test(sessionTime)) {
    localDate = parse(`${dateStr} ${sessionTime}`, 'yyyy-MM-dd hh:mm a', new Date());
  } else {
    localDate = parse(`${dateStr} ${sessionTime}`, 'yyyy-MM-dd HH:mm', new Date());
  }
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

const ToolbarButton: React.FC<{ label: string; icon: React.ReactNode; variant?: "default" | "danger", onClick?: () => void, disabled?: boolean, asChild?: boolean, href?: string }> = ({ label, icon, variant = "default", onClick, disabled, asChild, href }) => {
    const content = (
        <span
            className={cn(
                "flex w-full items-center justify-start gap-3 rounded-lg border p-2.5 text-left text-sm font-medium transition-all disabled:opacity-50",
                variant === "danger"
                ? "border-red-200 bg-red-50 hover:bg-red-100 text-red-700"
                : "border-neutral-200 bg-background hover:bg-neutral-50 text-neutral-700",
            )}
        >
            <span className={cn(
                "inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md",
                variant === "danger" ? "bg-red-100" : "bg-neutral-100"
            )}>{icon}</span>
            <span className="truncate">{label}</span>
        </span>
    );
    
    if (asChild && href) {
        return <Link href={href}>{content}</Link>;
    }

    return <button onClick={onClick} disabled={disabled} className="w-full">{content}</button>;
  };

export default function DashboardPage() {
    const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
    const [family, setFamily] = useState<FamilyMember[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [fees, setFees] = useState<Fee[]>([]);
    const [doctorStatus, setDoctorStatus] = useState<DoctorStatus | null>(null);
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [averageConsultationTime, setAverageConsultationTime] = useState(0);
    const [averageWaitTime, setAverageWaitTime] = useState(0);

    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [isBookWalkInOpen, setBookWalkInOpen] = useState(false);
    const [isNewPatientOpen, setNewPatientOpen] = useState(false);
    const [isRescheduleOpen, setRescheduleOpen] = useState(false);
    const [isAdjustTimingOpen, setAdjustTimingOpen] = useState(false);
    const [isConvertGuestOpen, setConvertGuestOpen] = useState(false);
    const [selectedSession, setSelectedSession] = useState<'morning' | 'evening'>('morning');
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [phoneToPreFill, setPhoneToPreFill] = useState('');
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [showCompleted, setShowCompleted] = useState(false);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPending, startTransition] = useTransition();

    const [isFamilyDetailsOpen, setFamilyDetailsOpen] = useState(false);
    const [phoneForFamilyDetails, setPhoneForFamilyDetails] = useState('');
    const [isFeeEntryOpen, setFeeEntryOpen] = useState(false);
    const [feeToEdit, setFeeToEdit] = useState<Fee | undefined>(undefined);
    const [guestToConvert, setGuestToConvert] = useState<Patient | null>(null);
    
    const { toast } = useToast();

    const getSessionForTime = useCallback((appointmentUtcDate: Date) => {
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
    }, [schedule]);


    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async (isInitial: boolean) => {
      if (isInitial) setIsLoading(true);
      else setIsRefreshing(true);
    
      try {
        const dateStr = format(new Date(), 'yyyy-MM-dd');
        const [scheduleData, patientData, familyData, statusData, morningFees, eveningFees] = await Promise.all([
          getDoctorScheduleAction(),
          getPatientsAction(),
          getFamilyAction(),
          getDoctorStatusAction(),
          getSessionFeesAction(dateStr, 'morning'),
          getSessionFeesAction(dateStr, 'evening'),
        ]);
        
        if (!scheduleData || !statusData) {
          throw new Error("Invalid data received from server");
        }
        
        setSchedule(scheduleData);
        setPatients(patientData);
        setFamily(familyData);
        setDoctorStatus(statusData);
        setFees([...morningFees, ...eveningFees]);
        setError(null);
      } catch (error) {
        console.error("Failed to load data", error);
        const errorMessage = error instanceof Error ? error.message : "Could not load clinic data.";
        setError(errorMessage);
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        if (isInitial) setIsLoading(false);
        setIsRefreshing(false);
      }
    }, [toast]);
    
    useEffect(() => {
        loadData(true); // Initial load
        
        const intervalId = setInterval(() => {
            loadData(false); // Polling
        }, 30000);
        
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

    const purposeCounts = sessionPatients.reduce((acc, p) => { if(p.purpose) acc[p.purpose] = (acc[p.purpose] || 0) + 1; return acc; }, {} as Record<string, number>);

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
      if (!schedule || !schedule.days || !selectedDate) {
        setTimeSlots([]);
        return;
      }
    
      try {
        const familyMap = new Map(family.map(f => [`${f.phone}-${f.name}`, f]));
    
        const dayOfWeek = format(selectedDate, 'EEEE') as keyof DoctorSchedule['days'];
        let daySchedule = schedule.days[dayOfWeek];
        if (!daySchedule) {
          setTimeSlots([]);
          return;
        }
    
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const closure = schedule.specialClosures.find(c => c.date === dateStr);
    
        if (closure) {
          daySchedule = {
            morning: closure.morningOverride ?? daySchedule.morning,
            evening: closure.eveningOverride ?? daySchedule.evening,
          };
        }
    
        const sessionToGenerate =
          selectedSession === 'morning' ? daySchedule.morning : daySchedule.evening;
    
        const isSessionClosed =
          selectedSession === 'morning' ? closure?.isMorningClosed : closure?.isEveningClosed;
    
        if (!sessionToGenerate.isOpen || isSessionClosed) {
          setTimeSlots([]);
          return;
        }
    
        const [startHour, startMinute] = sessionToGenerate.start.split(':').map(Number);
        const [endHour, endMinute] = sessionToGenerate.end.split(':').map(Number);
    
        let currentTime = set(selectedDate, {
          hours: startHour,
          minutes: startMinute,
          seconds: 0,
          milliseconds: 0,
        });
        const endTime = set(selectedDate, {
          hours: endHour,
          minutes: endMinute,
          seconds: 0,
          milliseconds: 0,
        });
    
        const slots: TimeSlot[] = [];
        let slotIndex = 0;
    
        while (currentTime < endTime) {
          const timeString = format(currentTime, 'hh:mm a');
    
          const patientForSlot = patients.find(p => {
            if (p.status === 'Cancelled' || !p.appointmentTime) return false;
            const apptDateUtc = parseISO(p.appointmentTime);
            const apptInIST = toZonedTime(apptDateUtc, "Asia/Kolkata");
            return (
              format(apptInIST, 'hh:mm a') === timeString &&
              format(apptInIST, 'yyyy-MM-dd') === dateStr
            );
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
              if (reservationStrategy === 'alternateOne' && relativeIndex % 2 !== 0) {
                isReservedForWalkIn = true;
              } else if (
                reservationStrategy === 'alternateTwo' &&
                (relativeIndex % 4 === 2 || relativeIndex % 4 === 3)
              ) {
                isReservedForWalkIn = true;
              }
            }
          }
    
          let patientDetails = patientForSlot
            ? familyMap.get(`${patientForSlot.phone}-${patientForSlot.name}`)
            : undefined;

          slots.push({
            time: timeString,
            isBooked,
            isReservedForWalkIn,
            patient: patientForSlot,
            patientDetails,
            tokenNo: slotIndex + 1,
          });
    
          currentTime = addMinutes(currentTime, schedule.slotDuration);
          slotIndex++;
        }
    
        setTimeSlots(slots);
      } catch (err) {
        console.error('❌ Error generating time slots:', err);
        setTimeSlots([]);
      }
    }, [schedule, patients, family, selectedSession, selectedDate]);

    const handleSlotClick = (time: string) => {
        const slot = timeSlots.find(s => s.time === time);
        if (slot) {
          setSelectedSlot(time);
          setBookWalkInOpen(true);
        }
    };

    const handleBookAppointment = useCallback(async (familyMember: FamilyMember, appointmentIsoString: string, checkIn: boolean, purpose: string) => {
        const result = await addAppointmentAction(familyMember, appointmentIsoString, purpose, true, checkIn);
        if ('error' in result) {
            toast({ title: "Error", description: result.error, variant: 'destructive'});
        } else {
            toast({ title: "Success", description: "Appointment booked successfully."});
            loadData(false);
        }
        return result;
    }, [loadData, toast]);

    const handleAddNewPatient = useCallback(async (newPatientData: Omit<FamilyMember, 'id' | 'avatar'>): Promise<FamilyMember | null> => {
    return new Promise((resolve) => {
        startTransition(() => {
            addNewPatientAction(newPatientData).then(result => {
                if ("error" in result || !('patient' in result)) {
                    toast({
                        title: "Error",
                        description: String((result as any).error || "Failed to add patient"),
                        variant: "destructive"
                    });
                    resolve(null);
                } else {
                    toast({
                        title: "Success",
                        description: String(result.success)
                    });

                    if (guestToConvert) {
                        convertGuestToExistingAction(guestToConvert.id, result.patient.id)
                            .then(conversionResult => {
                                if ('error' in conversionResult) {
                                    toast({
                                        title: "Conversion Failed",
                                        description: `New patient was created, but linking failed: ${conversionResult.error}`,
                                        variant: 'destructive'
                                    });
                                } else {
                                    toast({
                                        title: "Guest Converted",
                                        description: "Guest has been registered and linked."
                                    });
                                }

                                setGuestToConvert(null);
                                loadData(false);
                            });
                    } else {
                        loadData(false);
                    }

                    resolve(result.patient);
                }
            });
        });
    });
}, [loadData, toast, guestToConvert]);


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
                        loadData(false);
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
                    loadData(false);
                }
            });
        });
    }, [loadData, toast]);
    
    const handleConsultNext = useCallback(() => {
        startTransition(() => {
            consultNextAction().then(result => {
                if ("error" in result) {
                    toast({ title: 'Error', description: result.error, variant: 'destructive' });
                } else {
                    toast({ title: 'Success', description: result.success });
                    loadData(false);
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
                    loadData(false);
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
                    loadData(false);
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
                    loadData(false);
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
                    loadData(false);
                }
            });
        });
    }, [loadData, toast]);

    const handleAdjustTiming = useCallback(async (override: SpecialClosure) => {
        startTransition(() => {
            updateTodayScheduleOverrideActionHandler(override).then(result => {
                if ("error" in result) {
                    toast({ title: 'Error', description: result.error, variant: 'destructive' });
                } else {
                    toast({ title: 'Success', description: result.success });
                    loadData(false);
                }
            });
        });
    }, [loadData, toast]);

    const handleOpenNewPatientDialogFromWalkIn = (phone: string) => {
        setBookWalkInOpen(false);
        setPhoneToPreFill(phone);
        setNewPatientOpen(true);
    };

    const handleToggleStatus = useCallback((field: keyof DoctorStatus) => {
      if (!doctorStatus) return;
      startTransition(async () => {
        const result = await setDoctorStatusAction({ [field]: !doctorStatus?.[field] });
        if ('error' in result) {
          toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
          toast({ title: 'Success', description: result.success });
          loadData(false); // Refresh data
        }
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
                        loadData(false);
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
                    loadData(false);
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
                    loadData(false);
                }
            });
        });
    }, [loadData, toast]);

    const handleOpenFamilyDetails = (phone: string) => {
        setPhoneForFamilyDetails(phone);
        setFamilyDetailsOpen(true);
    };

    const handleOpenFeeDialog = (patient: Patient) => {
        if (patient.isGuest) {
            toast({ title: "Action Required", description: "Please convert this guest booking to a registered patient before entering a fee.", variant: 'destructive'});
            return;
        }
        const fee = fees.find(f => f.patientId === patient.id);
        setFeeToEdit(fee);
        setSelectedPatient(patient);
        setFeeEntryOpen(true);
    };

    const handleSaveFee = (feeData: Omit<Fee, 'id' | 'createdAt' | 'createdBy' | 'session' | 'date'>, existingFeeId?: string) => {
        startTransition(async () => {
            const result = await saveFeeAction(feeData, existingFeeId);
            if ('error' in result) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: result.success });
                loadData(false);
            }
        });
    };

    const handleOpenConvertGuest = (patient: Patient) => {
        setSelectedPatient(patient);
        setConvertGuestOpen(true);
    }
    
    const handleConvertToExisting = (appointmentId: string, selectedFamilyMember: FamilyMember) => {
    startTransition(async () => {
        const result = await convertGuestToExistingAction(appointmentId, selectedFamilyMember.id);
        if ('error' in result) {
            toast({ title: "Conversion Failed", description: result.error, variant: 'destructive'});
        } else {
            toast({ title: "Success", description: result.success});
            loadData(false);
        }
    });
};


    const handleConvertToNew = (guestPatient: Patient) => {
        setGuestToConvert(guestPatient);
        setNewPatientOpen(true);
    };
    

    const nowServing = sessionPatients.find(p => p.status === 'In-Consultation');
    const upNext = sessionPatients.find(p => p.status === 'Up-Next');
    
    const displayedTimeSlots = timeSlots.filter(slot => {
        if (slot.patient && (slot.patient.status === 'In-Consultation' || slot.patient.status === 'Up-Next')) {
            return false;
        }

        if (!showCompleted && slot.patient && (slot.patient.status === 'Completed' || slot.patient.status === 'Cancelled')) {
            return false;
        }

        if (!searchTerm) return true;

        if (!slot.isBooked || (!slot.patient && !slot.patientDetails)) return false;
        const lowerSearch = searchTerm.toLowerCase();

        const nameToSearch = slot.patient?.isGuest ? slot.patient.guestName : slot.patient?.name;

        return nameToSearch?.toLowerCase().includes(lowerSearch) ||
               slot.patient?.phone?.includes(lowerSearch) ||
               (slot.patientDetails?.clinicId && String(slot.patientDetails.clinicId).toLowerCase().includes(lowerSearch));
    });


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
    
    if (error) {
        return (
          <div className="flex flex-col min-h-screen bg-background">
            <Header logoSrc={schedule?.clinicDetails?.clinicLogo} clinicName={schedule?.clinicDetails?.clinicName} />
            <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
              <div className="flex flex-col items-center justify-center space-y-4 py-16">
                <AlertTriangle className="h-12 w-12 text-red-500" />
                <h2 className="text-xl font-semibold">Failed to Load Data</h2>
                <p className="text-muted-foreground">{error}</p>

                <Button onClick={() => loadData(true)}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            </main>
          </div>
        );
      }


    const PatientCard = ({ patient, patientDetails }: { patient: Patient, patientDetails?: Partial<FamilyMember> }) => {
        const statusKey = patient.status as keyof typeof statusConfig;
        const StatusIcon = statusConfig[statusKey]?.icon || HelpCircle;
        const statusColor = statusConfig[statusKey]?.color || '';
        const PurposeIcon = patient.purpose ? (purposeIcons[patient.purpose as keyof typeof purposeIcons] || HelpCircle) : HelpCircle;
        
        const isUpNext = upNext?.id === patient.id;
        const isActionable = patient.status !== 'Completed' && patient.status !== 'Cancelled';
        const isCurrentlyServing = patient.status === 'In-Consultation';

        if (schedule == null) {
            return <div></div>;
        }

        const purposeDetails = schedule.visitPurposes.find(p => p.name === patient.purpose);
        const isZeroFee = purposeDetails?.fee === 0;

        const feeRecord = fees.find(f => f.patientId === patient.id);

        let feeStatusClass = 'bg-red-500 border-red-600'; // Default: Pending
        let feeTooltip = 'Fee Pending';
        
        if (isZeroFee) {
            feeStatusClass = 'bg-[#F97A00] border-[#F97A00]';
            feeTooltip = patient.purpose || 'Zero Fee Visit';
        } else if (feeRecord?.status === 'Paid') {
            if (feeRecord.mode === 'Cash') {
                feeStatusClass = 'bg-[#31694E] border-[#31694E]';
                feeTooltip = 'Paid (Cash)';
            } else {
                feeStatusClass = 'bg-[#B0CE88] border-[#B0CE88]';
                feeTooltip = `Paid (Online - ${feeRecord.onlineType || 'N/A'})`;
            }
        }
        
        return (
            <TooltipProvider>
             <div className={cn(
                "p-3 grid grid-cols-[60px_auto_1fr_320px_120px_100px] items-center gap-4 rounded-xl border bg-white shadow-sm",
                !isActionable && "opacity-60",
                isUpNext && "bg-yellow-100/70 border-yellow-300",
                isCurrentlyServing && "bg-green-100/60 border-green-300"
            )}>
                {/* Token */}
                <div className="flex justify-start items-center font-bold text-lg text-primary gap-2">
                    <Ticket className="h-5 w-5" />
                    {patient.tokenNo}
                </div>
                 {/* Fee Status */}
                <Tooltip>
                    <TooltipTrigger asChild>
                         <button 
                            onClick={() => isActionable && handleOpenFeeDialog(patient)} 
                            disabled={!isActionable || isCurrentlyServing || patient.isGuest}
                            className="flex justify-center items-center" 
                        >
                            <div className={cn("w-3.5 h-3.5 rounded-full border-2", feeStatusClass)} style={{ backgroundColor: feeStatusClass.startsWith('bg-[') ? feeStatusClass.split('[')[1].split(']')[0] : ''}}/>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{feeTooltip}</p>
                    </TooltipContent>
                </Tooltip>

                {/* Name */}
                <div className={cn('flex items-center gap-2 text-base font-semibold', getPatientNameColorClass(patient.status, patient.type))}>
                    <PatientNameWithBadges patient={patient} patientDetails={patientDetails} />
                </div>

                {/* Details */}
                <div className="grid grid-cols-[24px_80px_24px_1fr] items-center gap-x-3 text-sm text-muted-foreground">
                    <div title={patientDetails?.gender || 'Gender not specified'} className="flex justify-center">
                        {patientDetails?.gender === 'Male' ? <User className="h-4 w-4 text-blue-500" /> : <User className="h-4 w-4 text-pink-500" />}
                    </div>
                    {patient.type !== 'Guest' && (
                        <Badge variant={patient.type === 'Walk-in' ? 'secondary' : 'outline'}>{patient.type}</Badge>
                    )}
                    <div title={patient.purpose || 'No purpose specified'} className="flex justify-center">
                       <PurposeIcon className="h-4 w-4" />
                    </div>
                     <div className='flex items-center gap-1.5' title="Estimated Time of Consultation">
                        <Timer className="h-4 w-4" />
                        <span className="font-semibold text-green-600">{patient.bestCaseETC ? format(parseISO(patient.bestCaseETC), 'hh:mm a') : '-'}</span>
                        <span>-</span>
                        <span className="font-semibold text-orange-600">{patient.worstCaseETC ? format(parseISO(patient.worstCaseETC), 'hh:mm a') : '-'}</span>
                    </div>
                </div>
                
                {/* Status */}
                 <div className="flex items-center justify-start gap-2">
                    <StatusIcon className={cn("h-4 w-4", statusColor)} />
                    <span className={cn("font-medium text-sm", statusColor)}>
                        {patient.status}
                        {patient.lateBy ? ` (${patient.lateBy}m)` : ''}
                    </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1">
                    {patient.isGuest ? (
                        <div className="flex items-center gap-1">
                            <Button
                                size="sm"
                                className="h-8 bg-yellow-500 hover:bg-yellow-600 text-white"
                                onClick={() => handleOpenConvertGuest(patient)}
                                disabled={isPending}
                            >
                                <LinkIcon className="mr-2 h-4 w-4"/>
                                Convert
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleCancelAppointment(patient.id)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Cancel Guest Booking</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ) : isUpNext ? (
                         <div className="flex items-center gap-1">
                            <Button size="sm" onClick={handleConsultNext} disabled={isPending || !doctorStatus?.isOnline} className="bg-blue-600 hover:bg-blue-700 h-8">
                                <ChevronsRight className="mr-2 h-4 w-4" /> Next
                            </Button>
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger><Pencil className="mr-2 h-4 w-4" />Change Purpose</DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent>
                                            <DropdownMenuRadioGroup value={patient.purpose || ''} onValueChange={(value) => handleUpdatePurpose(patient.id, value)}>
                                                {schedule?.visitPurposes.filter(p => p.enabled).map(purpose => (
                                                    <DropdownMenuRadioItem key={purpose.id} value={purpose.name}>{purpose.name}</DropdownMenuRadioItem>
                                                ))}
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                    <DropdownMenuItem onClick={() => handleOpenReschedule(patient)}><CalendarIcon className="mr-2 h-4 w-4" /> Reschedule</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenFamilyDetails(patient.phone)}><Users className="mr-2 h-4 w-4" />Update Family</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleSendReminder(patient.id)} disabled={isPending}><Send className="mr-2 h-4 w-4" />Send Reminder</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleCancelAppointment(patient.id)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Cancel Appointment</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ) : ['Booked', 'Confirmed'].includes(patient.status) ? (
                        <div className="flex items-center gap-1">
                          <Button size="sm" onClick={() => handleCheckIn(patient!.id)} disabled={isPending} className="bg-green-500 text-white hover:bg-green-600 h-8">Check-in</Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
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
                              <DropdownMenuSeparator/>
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger><Pencil className="mr-2 h-4 w-4" />Change Purpose</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  <DropdownMenuRadioGroup value={patient.purpose || ''} onValueChange={(value) => handleUpdatePurpose(patient!.id, value)}>
                                    {schedule?.visitPurposes.filter(p => p.enabled).map(purpose => (
                                      <DropdownMenuRadioItem key={purpose.id} value={purpose.name}>{purpose.name}</DropdownMenuRadioItem>
                                    ))}
                                  </DropdownMenuRadioGroup>
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuItem onClick={() => handleOpenReschedule(patient!)}><CalendarIcon className="mr-2 h-4 w-4" />Reschedule</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenFamilyDetails(patient.phone)}><Users className="mr-2 h-4 w-4" />Update Family</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSendReminder(patient!.id)} disabled={isPending}><Send className="mr-2 h-4 w-4" />Send Reminder</DropdownMenuItem>
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
                                          <AlertDialogDescription>This will permanently cancel the appointment.</AlertDialogDescription>
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
                    ) : isActionable ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {isCurrentlyServing && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleUpdateStatus(patient!.id, 'Completed')} disabled={isPending}>
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Mark Completed
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleUpdateStatus(patient!.id, 'Waiting for Reports')} disabled={isPending}>
                                        <FileClock className="mr-2 h-4 w-4" />
                                        Waiting for Reports
                                    </DropdownMenuItem>
                                  </>
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
                                <DropdownMenuItem onClick={() => handleOpenFamilyDetails(patient.phone)}>
                                    <Users className="mr-2 h-4 w-4" />
                                    Update Family
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
                    ) : null}
                </div>
            </div>
            </TooltipProvider>
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
                            <ToolbarButton label="Finance" icon={<IndianRupee className="h-5 w-5" />} asChild href="/finance" />
                             
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
                    <div className="sticky top-0 z-10 bg-neutral-50/80 backdrop-blur-sm p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                            <StatCard title="Total Appointments" value={sessionPatients.length} icon={<CalendarIcon className="h-4 w-4" />} />
                            <StatCard title="In Queue" value={sessionPatients.filter(p => ['Waiting', 'Late', 'Priority', 'Up-Next'].includes(p.status)).length} icon={<Users className="h-4 w-4" />} />
                            <StatCard title="Yet to Arrive" value={sessionPatients.filter(p => ['Booked', 'Confirmed'].includes(p.status)).length} icon={<UserCheck className="h-4 w-4" />} />
                            <StatCard title="Completed" value={sessionPatients.filter(p => p.status === 'Completed').length} icon={<CheckCircle className="h-4 w-4" />} />
                            <StatCard title="Avg. Wait" value={`${averageWaitTime} min`} icon={<Clock className="h-4 w-4" />} />
                            <StatCard title="Avg. Consult" value={`${averageConsultationTime} min`} icon={<Activity className="h-4 w-4" />} />
                        </div>
                        <div className="grid grid-cols-3 gap-3 items-center">
                           <div className="relative">
                              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                  type="search"
                                  placeholder="Search patient..."
                                  className="pl-8 w-full"
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                              />
                           </div>
                           <div className="flex justify-center">
                            <div className="rounded-xl border border-neutral-200 bg-white p-2 shadow-sm hover:shadow transition-shadow">
                                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-sm text-neutral-800">
                                   {Object.keys(purposeCounts).length > 0 ? (
                                        Object.entries(purposeCounts).map(([purpose, count]) => {
                                            const Icon = purposeIcons[purpose] || HelpCircle;
                                            return (
                                                <span key={purpose} className="flex items-center gap-1" title={purpose}>
                                                    <Icon className="h-3.5 w-3.5 text-neutral-500" />
                                                    <span className="font-bold">{count}</span>
                                                </span>
                                            );
                                        })
                                    ) : (
                                        <span className="text-xs text-neutral-500">No purposes specified.</span>
                                    )}
                               </div>
                            </div>
                           </div>
                           <div className="flex justify-end">
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
                            <PatientCard patient={nowServing} patientDetails={family.find(f => f.phone === nowServing.phone && f.name === nowServing.name)} />
                          )}
                          {upNext && (
                            <PatientCard patient={upNext} patientDetails={family.find(f => f.phone === upNext.phone && f.name === upNext.name)} />
                          )}
                          {displayedTimeSlots.length > 0 ? displayedTimeSlots.map((slot, index) => {

                              if (searchTerm && !slot.isBooked) return null;
                              
                              if (slot.isBooked && slot.patient) {
                                return <PatientCard key={slot.patient.id} patient={slot.patient} patientDetails={slot.patientDetails} />
                              }

                              return (
                              <div key={slot.time}>
                                  <div
                                    className={cn(
                                        "p-3 grid grid-cols-[60px_auto_1fr_320px_120px_100px] items-center gap-4 rounded-xl border border-dashed hover:bg-neutral-100 cursor-pointer transition-colors",
                                         "bg-neutral-50"
                                    )}
                                    onClick={() => handleSlotClick(slot.time)}
                                  >
                                       <div className="flex justify-start items-center font-bold text-lg text-blue-600 gap-2">
                                          <Ticket className="h-5 w-5" />
                                          {slot.tokenNo}
                                       </div>
                                       <div className='w-3'></div> {/* Spacer */}
                                       <div className="font-semibold text-muted-foreground">{slot.time}</div>
                                       <div className={cn("flex-1 font-semibold flex items-center justify-start gap-2", (slot.isReservedForWalkIn) ? "text-amber-600" : "text-green-600")}>
                                         {(slot.isReservedForWalkIn) ? (
                                           <Footprints className="h-4 w-4"/>
                                         ) : (
                                           <PlusCircle className="h-4 w-4"/>
                                         )}
                                       </div>
                                  </div>
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
                        clinicDetails={schedule.clinicDetails}
                    />
                )}
                <AddNewPatientDialog
                    isOpen={isNewPatientOpen}
                    onOpenChange={setNewPatientOpen}
                    onSave={handleAddNewPatient}
                    phoneToPreFill={phoneToPreFill}
                    onClose={() => { setPhoneToPreFill(''); setGuestToConvert(null); }}
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
                 <FamilyDetailsDialog
                    isOpen={isFamilyDetailsOpen}
                    onOpenChange={setFamilyDetailsOpen}
                    phone={phoneForFamilyDetails}
                    onUpdate={() => loadData(false)}
                />
                {selectedPatient && schedule && (
                    <FeeEntryDialog 
                        isOpen={isFeeEntryOpen}
                        onOpenChange={setFeeEntryOpen}
                        patient={selectedPatient}
                        fee={feeToEdit}
                        visitPurposes={schedule.visitPurposes}
                        onSave={handleSaveFee}
                        clinicDetails={schedule.clinicDetails}
                    />
                )}
                {selectedPatient && isConvertGuestOpen && (
                    <ConvertGuestDialog 
                        isOpen={isConvertGuestOpen}
                        onOpenChange={setConvertGuestOpen}
                        guestPatient={selectedPatient}
                        onConvertToExisting={handleConvertToExisting}
                        onConvertToNew={handleConvertToNew}
                    />
                )}
        </div>
    );
}



    


    













