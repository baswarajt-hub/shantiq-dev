
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
import { Calendar } from '@/components/ui/calendar';
import type { Appointment } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { format } from 'date-fns';

const morningSlots = [ '09:00 AM', '09:15 AM', '09:30 AM', '09:45 AM', '10:00 AM', '10:15 AM', '10:30 AM', '10:45 AM', '11:00 AM', '11:15 AM', '11:30 AM', '11:45 AM', '12:00 PM', '12:15 PM', '12:30 PM', '12:45 PM' ];
const eveningSlots = [ '04:00 PM', '04:15 PM', '04:30 PM', '04:45 PM', '05:00 PM', '05:15 PM', '05:30 PM', '05:45 PM', '06:00 PM', '06:15 PM', '06:30 PM', '06:45 PM' ];


type RescheduleDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  appointment: Appointment;
  onSave: (newDate: string, newTime: string) => void;
  bookedSlots: string[];
};

export function RescheduleDialog({ isOpen, onOpenChange, appointment, onSave, bookedSlots }: RescheduleDialogProps) {
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date(appointment.date));
  const [selectedSession, setSelectedSession] = useState('morning');
  const [selectedSlot, setSelectedSlot] = useState('');

  useEffect(() => {
    // Reset selected slot when session changes
    setSelectedSlot('');
  }, [selectedSession]);

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
      onSave(selectedDate.toISOString(), selectedSlot);
      handleClose(false);
    }
  };

  const currentSlots = selectedSession === 'morning' ? morningSlots : eveningSlots;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule Appointment</DialogTitle>
           <DialogDescription>
            For {appointment.familyMemberName}. Original: {format(new Date(appointment.date), 'PPP')} at {appointment.time}
          </DialogDescription>
        </DialogHeader>
        
        {step === 1 && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1))}
              />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
                <Button onClick={() => setStep(2)} disabled={!selectedDate}>Next</Button>
            </DialogFooter>
          </div>
        )}

        {step === 2 && (
            <div className="space-y-4 py-4">
                <RadioGroup defaultValue="morning" onValueChange={setSelectedSession} className="flex justify-center gap-4">
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="morning" id="r1" />
                        <Label htmlFor="r1">Morning</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="evening" id="r2" />
                        <Label htmlFor="r2">Evening</Label>
                    </div>
                </RadioGroup>
                <Label>Select an available time slot</Label>
                <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                    {currentSlots.map(slot => (
                        <Button 
                            key={slot} 
                            variant={selectedSlot === slot ? 'default' : 'outline'}
                            onClick={() => setSelectedSlot(slot)}
                            disabled={bookedSlots.includes(slot)}
                        >
                            {slot}
                        </Button>
                    ))}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                    <Button onClick={handleSave} disabled={!selectedSlot}>Confirm Reschedule</Button>
                </DialogFooter>
            </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
