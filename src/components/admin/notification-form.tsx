
'use client';

import { useTransition, useState, useEffect } from 'react';
import type { Notification } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { format, parseISO, setHours, setMinutes, parse } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';

type NotificationFormProps = {
  initialNotification?: Notification;
  onSave: (notification: Notification) => Promise<void>;
};

export function NotificationForm({ initialNotification, onSave }: NotificationFormProps) {
  const [notification, setNotification] = useState<Notification>(
    initialNotification || { message: '', enabled: false }
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (initialNotification) {
      setNotification(initialNotification);
    }
  }, [initialNotification]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNotification(prev => ({ ...prev, [name]: value }));
  };

  const handleDateTimeChange = (field: 'startTime' | 'endTime', date?: Date, time?: string) => {
    setNotification(prev => {
        const currentISO = prev[field];
        let workingDate = currentISO ? parseISO(currentISO) : new Date();

        if (date) {
            workingDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
        }

        if (time) {
            try {
                const parsedTime = parse(time, 'HH:mm', new Date());
                workingDate = setHours(workingDate, parsedTime.getHours());
                workingDate = setMinutes(workingDate, parsedTime.getMinutes());
            } catch (e) {
                console.error("Invalid time format", time);
            }
        }
        
        return { ...prev, [field]: workingDate.toISOString() };
    });
  }


  const handleSwitchChange = (checked: boolean) => {
    setNotification(prev => ({ ...prev, enabled: checked }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await onSave(notification);
    });
  };
  
  const DateTimePicker = ({ label, isoString, onDateChange, onTimeChange }: { label: string, isoString?: string, onDateChange: (date: Date) => void, onTimeChange: (time: string) => void }) => {
    const dateValue = isoString ? parseISO(isoString) : undefined;
    const timeValue = dateValue ? format(dateValue, 'HH:mm') : '';
    
    return (
       <div className="space-y-2">
            <Label>{label}</Label>
            <div className="flex gap-2">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        variant={"outline"}
                        className={cn(
                            "w-[200px] justify-start text-left font-normal",
                            !dateValue && "text-muted-foreground"
                        )}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateValue ? format(dateValue, "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                        mode="single"
                        selected={dateValue}
                        onSelect={(day) => day && onDateChange(day)}
                        initialFocus
                        />
                    </PopoverContent>
                </Popover>
                <Input
                    type="time"
                    className="w-[120px]"
                    value={timeValue}
                    onChange={(e) => onTimeChange(e.target.value)}
                />
            </div>
       </div>
    );
  }


  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Patient Portal Notification</CardTitle>
          <CardDescription>Display a temporary announcement on the main patient portal page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="message">Notification Message</Label>
            <Textarea
              id="message"
              name="message"
              value={notification.message}
              onChange={handleInputChange}
              placeholder="e.g. The clinic will be closed from 2 PM to 4 PM today."
            />
          </div>
          <div className="grid md:grid-cols-2 gap-6">
             <DateTimePicker 
                label="Display From"
                isoString={notification.startTime}
                onDateChange={(date) => handleDateTimeChange('startTime', date)}
                onTimeChange={(time) => handleDateTimeChange('startTime', undefined, time)}
             />
             <DateTimePicker 
                label="Display Until"
                isoString={notification.endTime}
                onDateChange={(date) => handleDateTimeChange('endTime', date)}
                onTimeChange={(time) => handleDateTimeChange('endTime', undefined, time)}
             />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="enabled"
              checked={notification.enabled}
              onCheckedChange={handleSwitchChange}
            />
            <Label htmlFor="enabled">Enable Notification</Label>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Notification'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
