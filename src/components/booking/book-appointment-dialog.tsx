
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import type { FamilyMember, Appointment, DoctorSchedule } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { format, set, addMinutes } from 'date-fns';

type BookAppointmentDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  familyMembers: FamilyMember[];
  schedule: DoctorSchedule | null;
  onSave: (appointment: Omit<Appointment, 'id' | 'status' | 'familyMemberName'>) => void;
};

export function BookAppointmentDialog({ isOpen, onOpenChange, familyMembers, schedule, onSave }: BookAppointmentDialogProps) {
  const [step, setStep] = useState(1);
  const [selectedMember, setSelectedMember] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSession, setSelectedSession] = useState('morning');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [availableSlots, setAvailableSlots] = useState<{time: string, isReserved: boolean}[]>([]);

  useEffect(() => {
    if (schedule && selectedDate) {
      const generatedSlots: {time: string, isReserved: boolean}[] = [];
      const dayOfWeek = format(selectedDate, 'EEEE') as keyof DoctorSchedule['days'];
      const daySchedule = schedule.days[dayOfWeek];
      const sessionSchedule = selectedSession === 'morning' ? daySchedule.morning : daySchedule.evening;

      if (sessionSchedule.isOpen) {
        const [startHour, startMinute] = sessionSchedule.start.split(':').map(Number);
        const [endHour, endMinute] = sessionSchedule.end.split(':').map(Number);
        
        let currentTime = set(selectedDate, { hours: startHour, minutes: startMinute });
        const endTime = set(selectedDate, { hours: endHour, minutes: endMinute });
        
        let slotIndex = 0;
        while (currentTime < endTime) {
          const timeString = format(currentTime, 'hh:mm a');
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
          generatedSlots.push({ time: timeString, isReserved: isReservedForWalkIn });
          currentTime = addMinutes(currentTime, schedule.slotDuration);
          slotIndex++;
        }
      }
      setAvailableSlots(generatedSlots);
    }
  }, [schedule, selectedDate, selectedSession]);

  const resetState = () => {
    setStep(1);
    setSelectedMember('');
    setSelectedDate(new Date());
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
    if (selectedMember && selectedDate && selectedSlot) {
      console.log('Simulating payment processing...');
      onSave({ 
        familyMemberId: parseInt(selectedMember, 10), 
        date: selectedDate.toISOString(), 
        time: selectedSlot 
      });
      handleClose(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book Appointment - Step {step} of 3</DialogTitle>
        </DialogHeader>
        
        {step === 1 && (
          <div className="space-y-4 py-4">
            <Label>Select Family Member</Label>
            <Select onValueChange={setSelectedMember} value={selectedMember}>
              <SelectTrigger>
                <SelectValue placeholder="Select a family member" />
              </SelectTrigger>
              <SelectContent>
                {familyMembers.map(member => (
                  <SelectItem key={member.id} value={member.id.toString()}>{member.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setStep(2)} disabled={!selectedMember} className="w-full">Next</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1))}
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
                  <div className="grid grid-cols-3 gap-2">
                      {availableSlots.map(slot => (
                          <Button 
                              key={slot.time} 
                              variant={selectedSlot === slot.time ? 'default' : 'outline'}
                              onClick={() => setSelectedSlot(slot.time)}
                              disabled={slot.isReserved}
                              title={slot.isReserved ? "Reserved for Walk-in" : ""}
                          >
                              {slot.time}
                          </Button>
                      ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground">No slots available for this session.</p>
                )}
                 <Label className="text-sm text-muted-foreground pt-4 block">A nominal fee will be charged upon confirmation.</Label>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(2)} className="w-full">Back</Button>
                    <Button onClick={handleSave} disabled={!selectedSlot} className="w-full">Pay & Confirm</Button>
                </div>
            </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
