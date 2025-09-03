'use client';

import { useTransition, useState } from 'react';
import type { DoctorSchedule, DaySchedule, Session } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { updateDoctorScheduleAction } from '@/app/actions';
import { Copy } from 'lucide-react';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const allDays = [...weekdays, 'Saturday', 'Sunday'];

function SessionControl({ day, sessionName, session, handleInputChange, handleSwitchChange }: { day: string, sessionName: 'morning' | 'evening', session: Session, handleInputChange: any, handleSwitchChange: any }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 flex-1">
        <Input type="time" name={`${day}-${sessionName}-start`} value={session.start} onChange={handleInputChange} disabled={!session.isOpen} />
        <span className="text-muted-foreground">-</span>
        <Input type="time" name={`${day}-${sessionName}-end`} value={session.end} onChange={handleInputChange} disabled={!session.isOpen} />
      </div>
      <div className="flex items-center space-x-2">
        <Label htmlFor={`${day}-${sessionName}-isOpen`}>{session.isOpen ? "Open" : "Closed"}</Label>
        <Switch id={`${day}-${sessionName}-isOpen`} name={`${day}-${sessionName}-isOpen`} checked={session.isOpen} onCheckedChange={(checked) => handleSwitchChange(day, sessionName, checked)} />
      </div>
    </div>
  )
}

function DayScheduleRow({ day, schedule, handleInputChange, handleSwitchChange }: { day: string, schedule: DaySchedule, handleInputChange: any, handleSwitchChange: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center border-t pt-4">
      <Label className="font-semibold">{day}</Label>
      <SessionControl day={day} sessionName="morning" session={schedule.morning} handleInputChange={handleInputChange} handleSwitchChange={handleSwitchChange} />
      <SessionControl day={day} sessionName="evening" session={schedule.evening} handleInputChange={handleInputChange} handleSwitchChange={handleSwitchChange} />
    </div>
  )
}

export function ScheduleForm({ initialSchedule }: { initialSchedule: DoctorSchedule }) {
  const [schedule, setSchedule] = useState(initialSchedule);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const [day, session, property] = name.split('-');
    
    setSchedule(prev => ({
      ...prev,
      days: {
        ...prev.days,
        [day as keyof DoctorSchedule['days']]: {
          ...prev.days[day as keyof DoctorSchedule['days']],
          [session as 'morning' | 'evening']: {
            ...prev.days[day as keyof DoctorSchedule['days']][session as 'morning' | 'evening'],
            [property as 'start' | 'end']: value
          }
        }
      }
    }));
  };

  const handleSwitchChange = (day: string, session: 'morning' | 'evening', isOpen: boolean) => {
     setSchedule(prev => ({
      ...prev,
      days: {
        ...prev.days,
        [day as keyof DoctorSchedule['days']]: {
          ...prev.days[day as keyof DoctorSchedule['days']],
          [session]: {
            ...prev.days[day as keyof DoctorSchedule['days']][session],
            isOpen
          }
        }
      }
    }));
  }

  const handleSlotDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSchedule(prev => ({...prev, slotDuration: parseInt(value, 10) || 0 }));
  };
  
  const copyToWeekdays = () => {
    const mondaySchedule = schedule.days.Monday;
    const newDays = {...schedule.days};
    weekdays.slice(1).forEach(day => {
        newDays[day as keyof DoctorSchedule['days']] = JSON.parse(JSON.stringify(mondaySchedule));
    });
    setSchedule(prev => ({...prev, days: newDays}));
    toast({ title: "Copied Monday's schedule to all weekdays." });
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateDoctorScheduleAction(schedule);
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: result.success });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Doctor Schedule</CardTitle>
        <CardDescription>Set up the clinic hours and appointment slot duration.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Weekly Schedule</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center text-sm text-muted-foreground px-2">
                <span>Day</span>
                <span>Morning Session</span>
                <span>Evening Session</span>
            </div>
            {allDays.map(day => (
              <DayScheduleRow 
                key={day}
                day={day}
                schedule={schedule.days[day as keyof DoctorSchedule['days']]}
                handleInputChange={handleInputChange}
                handleSwitchChange={handleSwitchChange}
              />
            ))}
             <Button type="button" variant="outline" size="sm" onClick={copyToWeekdays} className="gap-2">
                <Copy className="h-4 w-4" />
                Copy Monday to Weekdays
             </Button>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="slotDuration">Token Slot Duration (minutes)</Label>
             <Input 
                id="slotDuration"
                type="number" 
                value={schedule.slotDuration}
                onChange={handleSlotDurationChange}
                className="w-[180px]"
                placeholder="e.g. 10"
              />
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Schedule'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
