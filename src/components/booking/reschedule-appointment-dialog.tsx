
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import type { Appointment, DoctorSchedule } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertTriangle } from 'lucide-react';
import { addMinutes, format, set } from 'date-fns';

type RescheduleAppointmentDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  appointment: Appointment;
  schedule: DoctorSchedule;
  onSave: (newDate: Date, newTime: string) => void;
};

export function RescheduleAppointmentDialog({ isOpen, onOpenChange, appointment, schedule, onSave }: RescheduleAppointmentDialogProps) {
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date(appointment.date));
  const [selectedSession, setSelectedSession] = useState('morning');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  useEffect(() => {
    if (schedule && selectedDate) {
      const generatedSlots: string[] = [];
      const dayOfWeek = format(selectedDate, 'EEEE') as keyof DoctorSchedule['days'];
      const daySchedule = schedule.days[dayOfWeek];
      const sessionSchedule = selectedSession === 'morning' ? daySchedule.morning : daySchedule.evening;

      if (sessionSchedule.isOpen) {
        const [startHour, startMinute] = sessionSchedule.start.split(':').map(Number);
        const [endHour, endMinute] = sessionSchedule.end.split(':').map(Number);
        
        let currentTime = set(selectedDate, { hours: startHour, minutes: startMinute });
        const endTime = set(selectedDate, { hours: endHour, minutes: endMinute });

        while (currentTime < endTime) {
          generatedSlots.push(format(currentTime, 'hh:mm a'));
          currentTime = addMinutes(currentTime, schedule.slotDuration);
        }
      }
      setAvailableSlots(generatedSlots);
    }
  }, [schedule, selectedDate, selectedSession]);

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
      onSave(selectedDate, selectedSlot);
      handleClose(false);
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
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1))}
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
              <Button onClick={() => setStep(3)} disabled={!selectedDate} className="w-full">Next</Button>
            </div>
          </div>
        )}

        {step === 3 && (
            <div className="space-y-4 py-4">
                <Label>Select a new available time slot</Label>
                {availableSlots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                      {availableSlots.map(slot => (
                          <Button 
                              key={slot} 
                              variant={selectedSlot === slot ? 'default' : 'outline'}
                              onClick={() => setSelectedSlot(slot)}
                          >
                              {slot}
                          </Button>
                      ))}
                  </div>
                 ) : (
                  <p className="text-center text-muted-foreground">No slots available for this session.</p>
                )}
                <div className="flex gap-2 pt-4">
                    <Button variant="outline" onClick={() => setStep(2)} className="w-full">Back</Button>
                    <Button onClick={handleSave} disabled={!selectedSlot} className="w-full">Confirm Reschedule</Button>
                </div>
            </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
