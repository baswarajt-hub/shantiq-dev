

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
import type { Patient, DoctorSchedule } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { format, set, addMinutes, parseISO, toDate } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertTriangle, Info } from 'lucide-react';


type RescheduleDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  patient: Patient;
  schedule: DoctorSchedule;
  onSave: (newDate: string, newTime: string, newPurpose: string) => void;
  bookedPatients: Patient[];
};

type SlotState = 'available' | 'booked' | 'past';

type AvailableSlot = {
    time: string;
    state: SlotState;
};

export function RescheduleDialog({ isOpen, onOpenChange, patient, schedule, onSave, bookedPatients }: RescheduleDialogProps) {
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date(patient.appointmentTime));
  const [selectedSession, setSelectedSession] = useState('morning');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [selectedPurpose, setSelectedPurpose] = useState(patient.purpose || 'Consultation');
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  
  const activeVisitPurposes = schedule?.visitPurposes.filter(p => p.enabled) || [];

   useEffect(() => {
     if (schedule && selectedDate) {
      const generatedSlots: AvailableSlot[] = [];
      const dayOfWeek = format(selectedDate, 'EEEE') as keyof DoctorSchedule['days'];
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      let daySchedule = schedule.days[dayOfWeek];
      const closure = schedule.specialClosures.find(c => c.date === dateStr);

      if (closure) {
          daySchedule = {
              morning: closure.morningOverride ?? daySchedule.morning,
              evening: closure.eveningOverride ?? daySchedule.evening
          }
      }

      const sessionSchedule = selectedSession === 'morning' ? daySchedule.morning : daySchedule.evening;
      const isSessionClosed = selectedSession === 'morning' ? closure?.isMorningClosed : closure?.isEveningClosed;
      
      const timeZone = "Asia/Kolkata";
      const bookedSlotsForDay = bookedPatients
        .filter(p => {
          if (p.status === 'Cancelled' || p.id === patient.id) return false;
          const apptDate = toZonedTime(parseISO(p.appointmentTime), timeZone);
          return format(apptDate, 'yyyy-MM-dd') === dateStr;
        })
        .map(p => format(toZonedTime(parseISO(p.appointmentTime), timeZone), 'hh:mm a'));


      if (sessionSchedule.isOpen && !isSessionClosed) {
        const [startHour, startMinute] = sessionSchedule.start.split(':').map(Number);
        const [endHour, endMinute] = sessionSchedule.end.split(':').map(Number);
        
        let currentTime = set(selectedDate, { hours: startHour, minutes: startMinute, seconds: 0, milliseconds: 0 });
        const endTime = set(selectedDate, { hours: endHour, minutes: endMinute, seconds: 0, milliseconds: 0 });
        
        const now = new Date();

        while (currentTime < endTime) {
          const timeString = format(currentTime, 'hh:mm a');
          let slotState: SlotState = 'available';

          const isBooked = bookedSlotsForDay.includes(timeString);

          if (currentTime < now) {
            slotState = 'past';
          } else if (isBooked) {
            slotState = 'booked';
          } 
          
          generatedSlots.push({ time: timeString, state: slotState });
          currentTime = addMinutes(currentTime, schedule.slotDuration);
        }
      }
      setAvailableSlots(generatedSlots);
    }
  }, [schedule, selectedDate, selectedSession, bookedPatients, patient.id, isOpen]);

  const resetState = () => {
    setStep(1);
    setSelectedDate(new Date(patient.appointmentTime));
    setSelectedSession('morning');
    setSelectedSlot('');
    setSelectedPurpose(patient.purpose || 'Consultation');
  }

  const handleClose = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  }

  const handleSave = () => {
    if (selectedDate && selectedSlot) {
      onSave(format(selectedDate, 'yyyy-MM-dd'), selectedSlot, selectedPurpose);
      handleClose(false);
    }
  };
  
  const getTooltipMessage = (state: SlotState) => {
    switch (state) {
        case 'booked': return "Already booked";
        case 'past': return "Time has passed";
        default: return "";
    }
  };

  const selectedPurposeDetails = activeVisitPurposes.find(p => p.name === selectedPurpose);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule Appointment</DialogTitle>
           <DialogDescription>
            For {patient.name}. Original: {format(new Date(patient.appointmentTime), 'PPP')} at {format(new Date(patient.appointmentTime), 'hh:mm a')}
          </DialogDescription>
        </DialogHeader>
        
        {step === 1 && (
            <div className="space-y-4 py-4">
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
                        <Info className="h-3 w-3 mt-0.5 shrink-0"/>
                        <span>{selectedPurposeDetails.description}</span>
                    </div>
                )}
            </div>
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
              <Button variant="outline" onClick={() => handleClose(false)} className="w-full">Cancel</Button>
              <Button onClick={() => setStep(2)} disabled={!selectedDate || !selectedPurpose}>Next</Button>
            </div>
          </div>
        )}

        {step === 2 && (
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
                    <Button variant="outline" onClick={() => setStep(1)} className="w-full">Back</Button>
                    <Button onClick={handleSave} disabled={!selectedSlot}>Confirm Reschedule</Button>
                </DialogFooter>
            </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
