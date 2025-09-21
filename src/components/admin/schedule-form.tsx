
'use client';

import { useTransition, useState, useEffect } from 'react';
import type { DoctorSchedule, DaySchedule, Session } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Copy, Clock, Users } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Separator } from '../ui/separator';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const allDays = [...weekdays, 'Saturday', 'Sunday'];

type ScheduleFormProps = {
  initialSchedule: DoctorSchedule;
  onSave: (schedule: Partial<DoctorSchedule>) => Promise<void>;
};

function SessionControl({ day, sessionName, session, handleInputChange, handleSwitchChange, disabled }: { day: string, sessionName: 'morning' | 'evening', session: Session, handleInputChange: any, handleSwitchChange: any, disabled: boolean }) {
  return (
    <div className="grid grid-cols-[1fr_auto] sm:grid-cols-1 gap-2">
      <div className="flex items-center gap-2">
        <Input type="time" name={`${day}-${sessionName}-start`} value={session.start} onChange={handleInputChange} disabled={!session.isOpen || disabled} />
        <span className="text-muted-foreground">-</span>
        <Input type="time" name={`${day}-${sessionName}-end`} value={session.end} onChange={handleInputChange} disabled={!session.isOpen || disabled} />
      </div>
      <div className="flex items-center justify-end sm:justify-start space-x-2 pt-2 sm:pt-0">
        <Switch id={`${day}-${sessionName}-isOpen`} name={`${day}-${sessionName}-isOpen`} checked={session.isOpen} onCheckedChange={(checked) => handleSwitchChange(day, sessionName, checked)} disabled={disabled} />
        <Label htmlFor={`${day}-${sessionName}-isOpen`} className="text-sm">{session.isOpen ? "Open" : "Closed"}</Label>
      </div>
    </div>
  )
}

function DayScheduleRow({ day, schedule, handleInputChange, handleSwitchChange, isPending }: { day: string, schedule: DaySchedule, handleInputChange: any, handleSwitchChange: any, isPending: boolean }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[100px_1fr_1fr] gap-x-6 gap-y-4 items-start border-t pt-4">
      <Label className="font-semibold pt-2">{day}</Label>
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground md:hidden">Morning Session</p>
        <SessionControl day={day} sessionName="morning" session={schedule.morning} handleInputChange={handleInputChange} handleSwitchChange={handleSwitchChange} disabled={isPending} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground md:hidden">Evening Session</p>
        <SessionControl day={day} sessionName="evening" session={schedule.evening} handleInputChange={handleInputChange} handleSwitchChange={handleSwitchChange} disabled={isPending} />
      </div>
    </div>
  )
}

export function ScheduleForm({ initialSchedule, onSave }: ScheduleFormProps) {
  const [schedule, setSchedule] = useState<DoctorSchedule>(initialSchedule);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    setSchedule(initialSchedule);
  }, [initialSchedule]);

  const updateSchedule = (updater: (prev: DoctorSchedule) => DoctorSchedule) => {
    setSchedule(updater);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const [day, sessionName, property] = name.split('-');
    
    updateSchedule(prev => {
        const newSchedule = JSON.parse(JSON.stringify(prev));
        newSchedule.days[day as keyof DoctorSchedule['days']][sessionName as 'morning' | 'evening'][property as 'start' | 'end'] = value;
        return newSchedule;
    });
  };

  const handleSwitchChange = (day: string, sessionName: 'morning' | 'evening', isOpen: boolean) => {
    updateSchedule(prev => {
        const newSchedule = JSON.parse(JSON.stringify(prev));
        newSchedule.days[day as keyof DoctorSchedule['days']][sessionName].isOpen = isOpen;
        return newSchedule;
    });
  }

  const handleSlotDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    updateSchedule(prev => ({ ...prev, slotDuration: isNaN(value) ? 0 : value }));
  };
  
  const handleWalkInStrategyChange = (value: 'none' | 'alternateOne' | 'alternateTwo') => {
    updateSchedule(prev => ({ ...prev, walkInReservation: value }));
  }

  const handleReserveFirstFiveChange = (checked: boolean) => {
    updateSchedule(prev => ({ ...prev, reserveFirstFive: checked }));
  }

  const copyToWeekdays = () => {
    if (!schedule || !schedule.days || !schedule.days.Monday) {
      toast({ title: "Error", description: "Schedule data is not loaded yet.", variant: "destructive" });
      return;
    }
    updateSchedule(prev => {
        const newSchedule = JSON.parse(JSON.stringify(prev));
        const mondaySchedule = newSchedule.days.Monday;
        weekdays.slice(1).forEach(day => {
            newSchedule.days[day as keyof DoctorSchedule['days']] = JSON.parse(JSON.stringify(mondaySchedule));
        });
        return newSchedule;
    });
    toast({ title: "Copied Monday's schedule to all weekdays." });
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
        onSave(schedule)
            .then(() => {
                toast({ title: "Success", description: "Schedule changes have been saved."});
            })
            .catch(() => {
                toast({ title: "Error", description: "Failed to save schedule.", variant: "destructive" });
            });
    });
  };

  if (!schedule) {
    return null;
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Doctor Schedule</CardTitle>
          <CardDescription>Set up the clinic's recurring weekly hours and appointment slot duration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
             <div className="hidden md:grid grid-cols-[100px_1fr_1fr] gap-x-6 items-center text-sm text-muted-foreground px-2">
                <span>Day</span>
                <span>Morning Session</span>
                <span>Evening Session</span>
            </div>
            {schedule.days && allDays.map(day => (
              <DayScheduleRow 
                key={day}
                day={day}
                schedule={schedule.days[day as keyof DoctorSchedule['days']]}
                handleInputChange={handleInputChange}
                handleSwitchChange={handleSwitchChange}
                isPending={isPending}
              />
            ))}
             <Button type="button" variant="outline" size="sm" onClick={copyToWeekdays} className="mt-4 gap-2" disabled={isPending}>
                <Copy className="h-4 w-4" />
                Copy Monday to Weekdays
             </Button>
          </div>
          
          <Separator />

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-2">
                <Label htmlFor="slotDuration" className="flex items-center gap-2"><Clock />Token Slot Duration (minutes)</Label>
                <Input 
                    id="slotDuration"
                    type="number" 
                    value={schedule.slotDuration || 0}
                    onChange={handleSlotDurationChange}
                    className="w-[180px]"
                    placeholder="e.g. 10"
                />
            </div>

            <div className="space-y-4">
                <Label className="flex items-center gap-2"><Users />Walk-in Patient Strategy</Label>
                <div className="space-y-3">
                   <div className="flex items-center space-x-2">
                      <Switch id="reserveFirstFive" checked={schedule.reserveFirstFive} onCheckedChange={handleReserveFirstFiveChange} />
                      <Label htmlFor="reserveFirstFive">Reserve first 5 slots of a session for walk-ins</Label>
                   </div>
                   
                   <RadioGroup 
                      onValueChange={handleWalkInStrategyChange} 
                      value={schedule.walkInReservation || 'none'}
                      className="space-y-2 border-l-2 pl-4 ml-2"
                   >
                      <div className="flex items-center space-x-2">
                          <RadioGroupItem value="none" id="r1" />
                          <Label htmlFor="r1">No alternate slots</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                          <RadioGroupItem value="alternateOne" id="r2" />
                          <Label htmlFor="r2">Reserve alternate slots for walk-ins</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                          <RadioGroupItem value="alternateTwo" id="r3" />
                          <Label htmlFor="r3">Reserve alternate two consecutive slots for walk-ins</Label>
                      </div>
                  </RadioGroup>
                </div>

            </div>
          </div>

        </CardContent>
        <CardFooter>
            <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Schedule'}
            </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
