
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { ScheduleCalendar } from '@/components/shared/schedule-calendar';
import type { Appointment, DoctorSchedule, Patient } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertTriangle } from 'lucide-react';
import { addMinutes, format, set } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

type RescheduleAppointmentDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  appointment: Appointment;
  schedule: DoctorSchedule;
  onSave: (newDate: string, newTime: string) => void;
  bookedPatients: Patient[];
};

type SlotState = 'available' | 'booked' | 'reserved' | 'past';

type AvailableSlot = {
    time: string;
    state: SlotState;
};

export function RescheduleAppointmentDialog({ isOpen, onOpenChange, appointment, schedule, onSave, bookedPatients }: RescheduleAppointmentDialogProps) {
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date(appointment.date));
  const [selectedSession, setSelectedSession] = useState('morning');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);

  useEffect(() => {
     if (schedule && selectedDate) {
      const generatedSlots: AvailableSlot[] = [];
      const dayOfWeek = format(selectedDate, 'EEEE') as keyof DoctorSchedule['days'];
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      let daySchedule = schedule.days[dayOfWeek];
      const todayOverride = schedule.specialClosures.find(c => c.date === dateStr);

      if (todayOverride) {
          daySchedule = {
              morning: todayOverride.morningOverride ?? daySchedule.morning,
              evening: todayOverride.eveningOverride ?? daySchedule.evening
          }
      }

      const sessionSchedule = selectedSession === 'morning' ? daySchedule.morning : daySchedule.evening;

      const bookedSlotsForDay = bookedPatients
        .filter(p => new Date(p.appointmentTime).toDateString() === selectedDate.toDateString() && p.id !== appointment.id)
        .map(p => format(new Date(p.appointmentTime), 'hh:mm a'));


      if (sessionSchedule.isOpen) {
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
            if(isReservedForWalkIn) {
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
  }, [schedule, selectedDate, selectedSession, bookedPatients, appointment.id, isOpen]);

  const resetState = () => {
    setStep(1);
    setSelectedDate(new Date(appointment.date));
    setSelectedSession('morning');
    setSelectedSlot('');
  }

  const handleClose = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  }

  const handleSave = () => {
    if (selectedDate && selectedSlot) {
      onSave(format(selectedDate, 'yyyy-MM-dd'), selectedSlot);
      handleClose(false);
    }
  };
  
  const getTooltipMessage = (state: SlotState) => {
    switch (state) {
        case 'booked': return "Already booked";
        case 'reserved': return "Reserved for walk-ins";
        case 'past': return "Time has passed";
        default: return "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule Appointment</DialogTitle>
          <DialogDescription>
            For {appointment.familyMemberName} on {new Date(appointment.date).toDateString()} at {appointment.time}
          </DialogDescription>
        </DialogHeader>
        
        {step === 1 && (
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                You can only reschedule this appointment once. This action cannot be undone.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleClose(false)} className="w-full">Cancel</Button>
                <Button onClick={() => setStep(2)} className="w-full">Continue</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <ScheduleCalendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                schedule={schedule}
              />
            </div>
            <RadioGroup defaultValue="morning" onValueChange={(v) => {setSelectedSession(v); setSelectedSlot('')}} className="flex justify-center gap-4">
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
              <Button variant="outline" onClick={() => setStep(1)} className="w-full">Back</Button>
              <Button onClick={() => setStep(3)} disabled={!selectedDate}>Next</Button>
            </div>
          </div>
        )}

        {step === 3 && (
            <div className="space-y-4 py-4">
                <Label>Select a new available time slot</Label>
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
                <DialogFooter>
                    <Button variant="outline" onClick={() => setStep(2)} className="w-full">Back</Button>
                    <Button onClick={handleSave} disabled={!selectedSlot} className="w-full">Confirm Reschedule</Button>
                </DialogFooter>
            </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
