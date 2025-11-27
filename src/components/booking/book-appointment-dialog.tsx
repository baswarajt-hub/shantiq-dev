'use client';

import { useState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScheduleCalendar } from '@/components/shared/schedule-calendar';
import type { FamilyMember, DoctorSchedule, Patient } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { format } from 'date-fns';
import { set } from 'date-fns';
import { addMinutes } from 'date-fns';
import { parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Info, PlusCircle } from 'lucide-react';
import { createEasebuzzPaymentSessionAction } from '@/app/actions';
import crypto from 'crypto';

// This is required to tell TypeScript about the Easebuzz object from the script (kept for compatibility)
declare var Easebuzz: any;

type BookAppointmentDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  familyMembers: FamilyMember[];
  schedule: DoctorSchedule | null;
  onSave: (familyMember: FamilyMember, date: string, time: string, purpose: string) => void;
  bookedPatients: Patient[];
  initialMemberId?: string | null;
  onAddNewMember: () => void;
  onDialogClose?: () => void;
};

type SlotState = 'available' | 'booked' | 'reserved' | 'past';

type AvailableSlot = {
  time: string;
  state: SlotState;
};

export function BookAppointmentDialog({
  isOpen,
  onOpenChange,
  familyMembers,
  schedule,
  onSave,
  bookedPatients,
  initialMemberId,
  onAddNewMember,
  onDialogClose
}: BookAppointmentDialogProps) {
  const [step, setStep] = useState(1);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSession, setSelectedSession] = useState('morning');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [selectedPurpose, setSelectedPurpose] = useState('Consultation');
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [showAdvisory, setShowAdvisory] = useState(false);

  const activeVisitPurposes = schedule?.visitPurposes?.filter(p => p.enabled) || [];

  useEffect(() => {
    // Only run on the client after mounting to avoid hydration mismatch
    if (typeof window !== 'undefined' && !localStorage.getItem('hideSlotAdvisory')) {
      setShowAdvisory(true);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (initialMemberId) {
        setSelectedMemberId(initialMemberId.toString());
        setStep(1);
      }
      const currentHour = new Date().getHours();
      if (currentHour >= 14) {
        setSelectedSession('evening');
      } else {
        setSelectedSession('morning');
      }
    }
  }, [isOpen, initialMemberId]);

  useEffect(() => {
    if (schedule && selectedDate) {
      const generatedSlots: AvailableSlot[] = [];
      const dayOfWeek = format(selectedDate, 'EEEE') as keyof DoctorSchedule['days'];
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      let daySchedule = schedule.days[dayOfWeek];
      const closure = schedule.specialClosures?.find(c => c.date === dateStr);

      if (closure) {
        daySchedule = {
          morning: closure.morningOverride ?? daySchedule.morning,
          evening: closure.eveningOverride ?? daySchedule.evening
        };
      }

      const sessionSchedule = selectedSession === 'morning' ? daySchedule.morning : daySchedule.evening;
      const isSessionClosed = selectedSession === 'morning' ? closure?.isMorningClosed : closure?.isEveningClosed;

      const timeZone = 'Asia/Kolkata';
      const bookedSlotsForDay = bookedPatients
        .filter(p => {
          if (p.status === 'Cancelled') return false;
          const apptDate = toZonedTime(parseISO(p.appointmentTime), timeZone);
          return format(apptDate, 'yyyy-MM-dd') === dateStr;
        })
        .map(p => format(toZonedTime(parseISO(p.appointmentTime), timeZone), 'hh:mm a'));

      if (sessionSchedule.isOpen && !isSessionClosed) {
        const [startHour, startMinute] = sessionSchedule.start.split(':').map(Number);
        const [endHour, endMinute] = sessionSchedule.end.split(':').map(Number);

        let currentTime = set(selectedDate, { hours: startHour, minutes: startMinute, seconds: 0, milliseconds: 0 });
        const endTime = set(selectedDate, { hours: endHour, minutes: endMinute, seconds: 0, milliseconds: 0 });

        let slotIndex = 0;
        const now = new Date();

        while (currentTime < endTime) {
          const timeString = format(currentTime, 'hh:mm a');
          let slotState: SlotState = 'available';

          const isBooked = bookedSlotsForDay.includes(timeString);
          let isReservedForWalkIn = false;

          if (currentTime < now) {
            slotState = 'past';
          } else if (isBooked) {
            slotState = 'booked';
          } else {
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

            if (isReservedForWalkIn) {
              slotState = 'reserved';
            }
          }

          generatedSlots.push({ time: timeString, state: slotState });
          currentTime = addMinutes(currentTime, schedule.slotDuration);
          slotIndex++;
        }
      }
      setAvailableSlots(generatedSlots);
    }
  }, [schedule, selectedDate, selectedSession, bookedPatients, isOpen]);

  const resetState = () => {
    setStep(1);
    setSelectedMemberId('');
    setSelectedDate(new Date());
    setSelectedSession('morning');
    setSelectedSlot('');
    setSelectedPurpose('Consultation');
    if (onDialogClose) onDialogClose();
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  const handleSave = () => {
    const selectedMember = familyMembers.find(f => f.id.toString() === selectedMemberId);
    if (selectedMember && selectedDate && selectedSlot && selectedPurpose) {
      startTransition(async () => {
        // Payment gateway configured?
        const paymentSettings = schedule?.paymentGatewaySettings;
        const isPaymentGatewayConfigured =
          Boolean(paymentSettings?.provider) &&
          String(paymentSettings?.provider).toLowerCase() === 'easebuzz' &&
          Boolean(paymentSettings?.key) &&
          Boolean(paymentSettings?.salt);

        // FOR TESTING: set true to simulate the payment flow
        const SIMULATE_PAYMENT = false;

        // Determine amount using purpose.onlinePaymentEnabled and clinic bookingFee
        const purposeObj = schedule?.visitPurposes?.find(
          p => p.id === selectedPurpose || p.name === selectedPurpose
        );

        // If onlinePaymentEnabled is missing on purpose, treat as false by default (admin must enable)
        const isOnlinePaymentPurpose = Boolean((purposeObj as any)?.onlinePaymentEnabled ?? false);

        const bookingFee = schedule?.clinicDetails?.bookingFee ?? 0;
        const amount = isOnlinePaymentPurpose ? bookingFee : 0;

        // If amount is 0, skip payment and directly save appointment
        if (amount <= 0) {
          try {
            onSave(selectedMember, format(selectedDate, 'yyyy-MM-dd'), selectedSlot, selectedPurpose);
            handleClose(false);
            toast({ title: 'Booking Confirmed!', description: 'Your appointment has been booked.' });
          } catch (err: any) {
            toast({ title: 'Error', description: String(err?.message || 'Failed to book'), variant: 'destructive' });
          }
          return;
        }

        // If payment gateway missing or simulation is on, simulate payment
        if (!isPaymentGatewayConfigured || SIMULATE_PAYMENT) {
          toast({ title: 'Simulating Payment...', description: 'This is a test booking.' });
          await new Promise(resolve => setTimeout(resolve, 1500));
          try {
            onSave(selectedMember, format(selectedDate, 'yyyy-MM-dd'), selectedSlot, selectedPurpose);
            handleClose(false);
            toast({ title: 'Booking Confirmed!', description: 'Your appointment has been booked.' });
          } catch (err: any) {
            toast({ title: 'Error', description: String(err?.message || 'Failed to book'), variant: 'destructive' });
          }
          return;
        }

        // LIVE PAYMENT FLOW — create payment session and submit to Easebuzz
        try {
          toast({ title: 'Connecting to Payment Gateway...', description: 'Redirecting to payment page...' });

          const paymentPayload = await createEasebuzzPaymentSessionAction({
            amount,
            firstname: selectedMember.name,
            email: selectedMember.email || 'patient@example.com',
            phone: selectedMember.phone,
            productinfo: purposeObj?.name || selectedPurpose,
            bookingId: `${selectedMember.id}_${Date.now()}`
          });

          if ('error' in paymentPayload) {
            toast({ title: 'Payment Failed', description: String((paymentPayload as any).error), variant: 'destructive' });
            return;
          }

          const { formFields, payUrl } = (paymentPayload as any).data;

          // Auto-submit POST form to Easebuzz
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = payUrl;
          form.style.display = 'none';

          Object.entries(formFields).forEach(([k, v]) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = k;
            input.value = String(v ?? '');
            form.appendChild(input);
          });

          document.body.appendChild(form);
          form.submit();

          // user is now redirected to Easebuzz payment page
        } catch (e: any) {
          toast({ title: 'Payment Error', description: String(e?.message || 'Payment failed'), variant: 'destructive' });
        }
      });
    }
  };

  const getTooltipMessage = (state: SlotState) => {
    switch (state) {
      case 'booked': return 'Already booked';
      case 'reserved': return 'Reserved for walk-ins';
      case 'past': return 'Time has passed';
      default: return '';
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const selectedPurposeDetails = activeVisitPurposes.find(p => p.name === selectedPurpose);

  // compute whether a payment is required (for UI note)
  const purposeObjForUi = schedule?.visitPurposes?.find(p => p.id === selectedPurpose || p.name === selectedPurpose);
  const isOnlinePaymentPurposeForUi = Boolean((purposeObjForUi as any)?.onlinePaymentEnabled ?? false);
  const bookingFeeForUi = schedule?.clinicDetails?.bookingFee ?? 0;
  const amountForUi = isOnlinePaymentPurposeForUi ? bookingFeeForUi : 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book Appointment - Step {step} of 3</DialogTitle>
          <DialogDescription>Select a family member and find a time that works for you.</DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Family Member</Label>
              <Select onValueChange={setSelectedMemberId} value={selectedMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a family member" />
                </SelectTrigger>
                <SelectContent>
                  {familyMembers.map(member => (
                    <SelectItem key={member.id} value={member.id.toString()}>{member.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="link" size="sm" className="p-0 h-auto" onClick={onAddNewMember}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New Family Member
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Purpose of Visit</Label>
              <Select onValueChange={setSelectedPurpose} value={selectedPurpose}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason for your visit" />
                </SelectTrigger>
                <SelectContent>
                  {activeVisitPurposes.map(purpose => (
                    <SelectItem key={purpose.id} value={purpose.name}>{purpose.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPurposeDetails?.description && (
                <div className="text-xs text-muted-foreground p-2 flex gap-2 items-start">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{selectedPurposeDetails.description}</span>
                </div>
              )}
            </div>
            <Button onClick={() => setStep(2)} disabled={!selectedMemberId || !selectedPurpose} className="w-full">Next</Button>
          </div>
        )}

        {step === 2 && schedule && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <ScheduleCalendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                schedule={schedule}
                className="p-0"
              />
            </div>
            <RadioGroup value={selectedSession} onValueChange={(value) => { setSelectedSession(value); setSelectedSlot(''); }} className="flex justify-center gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="morning" id="r1" />
                <Label htmlFor="r1">Morning</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="evening" id="r2" />
                <Label htmlFor="r2">Evening</Label>
              </div>
            </RadioGroup>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBack} className="w-full">Back</Button>
              <Button onClick={() => setStep(3)} disabled={!selectedDate} className="w-full">Next</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 py-4">
            <Label>Select an available time slot</Label>

            {showAdvisory && (
              <div
                className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-900 shadow-sm animate-slide-in"
                style={{ animation: 'slide-in 0.4s ease-out' }}
              >
                <p>
                  ⏱️ <strong>Note:</strong> Appointment time is an <em>expected consultation time</em> and may vary
                  depending on real-time clinic flow. Please check for updates and watch the{' '}
                  <span className="font-semibold text-blue-700">live queue</span> for your actual turn.
                </p>
                <div className="text-right mt-2">
                  <button
                    onClick={(e) => {
                      localStorage.setItem('hideSlotAdvisory', 'true');
                      const advisoryEl = (e.target as HTMLElement).closest('.animate-slide-in');
                      if (advisoryEl) {
                        advisoryEl.classList.add('animate-fade-out');
                      }
                      setTimeout(() => setShowAdvisory(false), 400);
                    }}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline"
                  >
                    Got it
                  </button>
                </div>
              </div>
            )}

            {availableSlots.length > 0 ? (
              <TooltipProvider>
                <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto p-1">
                  {availableSlots.map(slot => (
                    <Tooltip key={slot.time} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>
                          <Button
                            variant={selectedSlot === slot.time ? 'default' : 'outline'}
                            onClick={() => setSelectedSlot(slot.time)}
                            disabled={slot.state !== 'available'}
                            className="w-full"
                          >
                            {slot.time}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {slot.state !== 'available' && (
                        <TooltipContent>
                          <p>{getTooltipMessage(slot.state)}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            ) : (
              <p className="text-center text-muted-foreground">No slots available for this session.</p>
            )}

            {/* Payment note (only when booking fee is payable) */}
            {amountForUi > 0 && (
              <div className="text-sm text-orange-600 mt-2">
                <strong>Note:</strong> This booking fee is collected only to confirm your appointment.
                The full consultation fee must be paid at the clinic. If you cancel or do not attend, this booking fee is non-refundable.
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(2)} className="w-full">
                Back
              </Button>
              <Button onClick={handleSave} disabled={isPending || !selectedSlot} className="w-full">
                {isPending ? 'Processing...' : 'Confirm Booking'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
