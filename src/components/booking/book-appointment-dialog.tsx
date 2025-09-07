
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScheduleCalendar } from '@/components/shared/schedule-calendar';
import type { FamilyMember, DoctorSchedule, Patient } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { format, set, addMinutes, parse } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Info } from 'lucide-react';

type BookAppointmentDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  familyMembers: FamilyMember[];
  schedule: DoctorSchedule | null;
  onSave: (familyMember: FamilyMember, date: string, time: string, purpose: string) => void;
  bookedPatients: Patient[];
};

type SlotState = 'available' | 'booked' | 'reserved' | 'past';

type AvailableSlot = {
    time: string;
    state: SlotState;
};


export function BookAppointmentDialog({ isOpen, onOpenChange, familyMembers, schedule, onSave, bookedPatients }: BookAppointmentDialogProps) {
  const [step, setStep] = useState(1);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSession, setSelectedSession] = useState('morning');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [selectedPurpose, setSelectedPurpose] = useState('Consultation');
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const { toast } = useToast();

  const activeVisitPurposes = schedule?.visitPurposes.filter(p => p.enabled) || [];

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
        .filter(p => new Date(p.appointmentTime).toDateString() === selectedDate.toDateString())
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
            // Rule 1: Reserve first 5 slots
            if (schedule.reserveFirstFive && slotIndex < 5) {
              isReservedForWalkIn = true;
            }

            // Rule 2: Alternate reservation strategies (applies after the first 5 if that rule is active)
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
  }

  const handleClose = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  }

  const handleSave = () => {
    const selectedMember = familyMembers.find(f => f.id.toString() === selectedMemberId);
    if (selectedMember && selectedDate && selectedSlot && selectedPurpose) {
      toast({ title: 'Processing Payment...', description: 'Please wait.' });
      setTimeout(() => {
          onSave(selectedMember, format(selectedDate, 'yyyy-MM-dd'), selectedSlot, selectedPurpose);
          handleClose(false);
      }, 1500)
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

  const selectedPurposeDetails = activeVisitPurposes.find(p => p.name === selectedPurpose);

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
                        <Info className="h-3 w-3 mt-0.5 shrink-0"/>
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
              />
            </div>
            <RadioGroup defaultValue="morning" onValueChange={(value) => { setSelectedSession(value); setSelectedSlot(''); }} className="flex justify-center gap-4">
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
              <Button onClick={() => setStep(3)} disabled={!selectedDate} className="w-full">Next</Button>
            </div>
          </div>
        )}

        {step === 3 && (
            <div className="space-y-4 py-4">
                <Label>Select an available time slot</Label>
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
                 <Label className="text-sm text-muted-foreground pt-4 block">A nominal fee will be charged upon confirmation.</Label>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setStep(2)} className="w-full">Back</Button>
                    <Button onClick={handleSave} disabled={!selectedSlot} className="w-full">Pay & Confirm</Button>
                </DialogFooter>
            </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
