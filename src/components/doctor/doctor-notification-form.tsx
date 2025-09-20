
'use client';

import { useTransition, useState, useEffect } from 'react';
import type { Notification } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { format, parseISO, setHours, setMinutes, parse, isFuture } from 'date-fns';
import { CalendarIcon, PlusCircle, Trash2, Edit, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '../ui/sheet';

const BLANK_NOTIFICATION: Omit<Notification, 'id'> = {
    message: '',
    startTime: new Date().toISOString(),
    endTime: new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString(),
    enabled: true
};

type NotificationFormProps = {
  initialNotifications: Notification[];
  onSave: (notifications: Notification[]) => Promise<void>;
};

function DateTimePicker({ label, isoString, onDateChange, onTimeChange, disabled }: { label: string, isoString?: string, onDateChange: (date: Date) => void, onTimeChange: (time: string) => void, disabled?: boolean }) {
    const dateValue = isoString ? parseISO(isoString) : undefined;
    const timeValue = dateValue ? format(dateValue, 'HH:mm') : '';
    
    return (
       <div className="space-y-2">
            <Label>{label}</Label>
            <div className="flex flex-col sm:flex-row gap-2">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          disabled={disabled}
                          className={cn(
                              "w-full justify-start text-left font-normal",
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
                    className="w-full"
                    value={timeValue}
                    onChange={(e) => onTimeChange(e.target.value)}
                    disabled={disabled}
                />
            </div>
       </div>
    );
}

export function DoctorNotificationForm({ initialNotifications, onSave }: NotificationFormProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [currentNotification, setCurrentNotification] = useState<Notification | Omit<Notification, 'id'>>(() => ({...BLANK_NOTIFICATION}));
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentNotification(prev => ({ ...prev, [name]: value }));
  };
  
  const handleDateTimeChange = (field: 'startTime' | 'endTime', date?: Date, time?: string) => {
    setCurrentNotification(prev => {
        const currentISO = prev[field];
        let workingDate = currentISO ? parseISO(currentISO) : new Date();

        if (date) {
            workingDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), workingDate.getHours(), workingDate.getMinutes());
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
    setCurrentNotification(prev => ({ ...prev, enabled: checked }));
  };
  
  const handleSaveOrUpdate = () => {
    startTransition(async () => {
        let updatedNotifications: Notification[];
        if (editingId) {
            updatedNotifications = notifications.map(n => 
                n.id === editingId ? { ...n, ...currentNotification, id: editingId } : n
            );
        } else {
            const newId = `notif_${Date.now()}`;
            updatedNotifications = [...notifications, { ...currentNotification, id: newId }];
        }
        await onSave(updatedNotifications);
        setSheetOpen(false);
    });
  };

  const handleAddNew = () => {
    setEditingId(null);
    setCurrentNotification({ ...BLANK_NOTIFICATION });
    setSheetOpen(true);
  }

  const handleEdit = (id: string) => {
    const notificationToEdit = notifications.find(n => n.id === id);
    if (notificationToEdit) {
        setEditingId(id);
        setCurrentNotification(notificationToEdit);
        setSheetOpen(true);
    }
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
        const updatedNotifications = notifications.filter(n => n.id !== id);
        await onSave(updatedNotifications);
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Patient Portal Notifications</CardTitle>
            <CardDescription>Manage announcements on the patient portal.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={handleAddNew}><PlusCircle className="mr-2 h-4 w-4" /> Add</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {notifications.length > 0 ? notifications.map(notif => {
            const isActive = notif.startTime && notif.endTime && isFuture(parseISO(notif.endTime));
            return (
            <div key={notif.id} className={cn("p-3 border rounded-lg flex justify-between items-start gap-4", !isActive && "opacity-60 bg-muted/50")}>
                <div>
                    <p className={cn("font-semibold", !notif.enabled && "line-through")}>{notif.message}</p>
                    <p className="text-xs text-muted-foreground">
                        {notif.startTime && format(parseISO(notif.startTime), 'MMM d, h:mm a')} - {notif.endTime && format(parseISO(notif.endTime), 'MMM d, h:mm a')}
                    </p>
                </div>
                <div className="flex items-center gap-0 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(notif.id)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(notif.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
            </div>
            )
        }) : (
            <p className="text-sm text-muted-foreground text-center py-4">No notifications saved.</p>
        )}
      </CardContent>

      <Sheet open={isSheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
            <SheetHeader>
                <SheetTitle>{editingId ? 'Edit Notification' : 'Add New Notification'}</SheetTitle>
                <SheetDescription>
                    This message will appear on the main patient booking page for the duration you set.
                </SheetDescription>
            </SheetHeader>
            <div className="py-4 space-y-4">
                 <div className="space-y-2">
                    <Label htmlFor="message">Notification Message</Label>
                    <Textarea
                        id="message"
                        name="message"
                        value={currentNotification.message}
                        onChange={handleInputChange}
                        placeholder="e.g. The clinic will be closed from 2 PM to 4 PM today."
                        rows={5}
                    />
                </div>
                <div className="space-y-4">
                    <DateTimePicker 
                        label="Display From"
                        isoString={currentNotification.startTime}
                        onDateChange={(date) => handleDateTimeChange('startTime', date)}
                        onTimeChange={(time) => handleDateTimeChange('startTime', undefined, time)}
                    />
                    <DateTimePicker 
                        label="Display Until"
                        isoString={currentNotification.endTime}
                        onDateChange={(date) => handleDateTimeChange('endTime', date)}
                        onTimeChange={(time) => handleDateTimeChange('endTime', undefined, time)}
                    />
                </div>
                <div className="flex items-center space-x-2 pt-2">
                    <Switch
                        id="enabled"
                        checked={currentNotification.enabled}
                        onCheckedChange={handleSwitchChange}
                    />
                    <Label htmlFor="enabled">Enable Notification</Label>
                </div>
            </div>
            <SheetFooter>
                <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
                <Button type="button" onClick={handleSaveOrUpdate} disabled={isPending || !currentNotification.message}>
                    {isPending ? 'Saving...' : (editingId ? 'Update' : 'Save')}
                </Button>
            </SheetFooter>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
