

'use client';

import { useTransition, useState, useEffect } from 'react';
import type { Notification } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { format, parseISO, setHours, setMinutes, parse } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { CalendarIcon, PlusCircle, Trash2, Edit } from 'lucide-react';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

const BLANK_NOTIFICATION: Omit<Notification, 'id'> = {
    message: { en: '' },
    startTime: new Date().toISOString(),
    endTime: new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString(),
    enabled: true
};

type NotificationFormProps = {
  initialNotifications: Notification[];
  onSave: (notifications: Notification[]) => Promise<void>;
};

export function NotificationForm({ initialNotifications, onSave }: NotificationFormProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [currentNotification, setCurrentNotification] = useState<Notification | Omit<Notification, 'id'>>(() => ({...BLANK_NOTIFICATION}));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentNotification(prev => {
        const newMessage = typeof prev.message === 'string' ? { en: prev.message } : { ...prev.message };
        newMessage.en = value;
        return { ...prev, message: newMessage };
    });
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
        const messageToSave = typeof currentNotification.message === 'string' ? { en: currentNotification.message } : currentNotification.message;
        
        if (editingId) {
            // Update existing notification
            updatedNotifications = notifications.map(n => 
                n.id === editingId ? { ...n, ...currentNotification, id: editingId, message: messageToSave } : n
            );
        } else {
            // Add new notification
            const newId = `notif_${Date.now()}`;
            updatedNotifications = [...notifications, { ...currentNotification, id: newId, message: messageToSave }];
        }
        await onSave(updatedNotifications);
        setEditingId(null);
        setCurrentNotification({...BLANK_NOTIFICATION});
    });
  };

  const handleEdit = (id: string) => {
    const notificationToEdit = notifications.find(n => n.id === id);
    if (notificationToEdit) {
        setEditingId(id);
        setCurrentNotification(notificationToEdit);
    }
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
        const updatedNotifications = notifications.filter(n => n.id !== id);
        await onSave(updatedNotifications);
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setCurrentNotification({...BLANK_NOTIFICATION});
  }
  
  const DateTimePicker = ({ label, isoString, onDateChange, onTimeChange, disabled }: { label: string, isoString?: string, onDateChange: (date: Date) => void, onTimeChange: (time: string) => void, disabled?: boolean }) => {
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
                              "w-full sm:w-auto justify-start text-left font-normal",
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
                    className="w-full sm:w-[120px]"
                    value={timeValue}
                    onChange={(e) => onTimeChange(e.target.value)}
                    disabled={disabled}
                />
            </div>
       </div>
    );
  }
  
  const messageText = typeof currentNotification.message === 'string' ? currentNotification.message : currentNotification.message.en;


  return (
    <Card>
        <CardHeader>
          <CardTitle>Patient Portal Notifications</CardTitle>
          <CardDescription>Manage temporary announcements on the main patient portal page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="p-4 border rounded-lg space-y-4">
                <h3 className="font-semibold text-lg">{editingId ? 'Edit Notification' : 'Add New Notification'}</h3>
                 <div className="space-y-2">
                    <Label htmlFor="message">Notification Message (in English)</Label>
                    <Textarea
                    id="message"
                    name="message"
                    value={messageText}
                    onChange={handleInputChange}
                    placeholder="e.g. The clinic will be closed from 2 PM to 4 PM today."
                    />
                    <p className="text-xs text-muted-foreground">This will be auto-translated to Hindi and Telugu.</p>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
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
                <div className="flex items-center space-x-2">
                    <Switch
                    id="enabled"
                    checked={currentNotification.enabled}
                    onCheckedChange={handleSwitchChange}
                    />
                    <Label htmlFor="enabled">Enable Notification</Label>
                </div>
                 <div className="flex gap-2">
                    <Button type="button" onClick={handleSaveOrUpdate} disabled={isPending || !messageText}>
                        {isPending ? 'Saving...' : (editingId ? 'Update Notification' : 'Save Notification')}
                    </Button>
                    {editingId && (
                        <Button type="button" variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                    )}
                 </div>
            </div>
            
            <Separator />

            <div>
                <h3 className="font-semibold text-lg mb-4">Saved Notifications</h3>
                <div className="space-y-4">
                    {notifications.length > 0 ? notifications.map(notif => {
                         const displayMessage = typeof notif.message === 'string' ? notif.message : notif.message.en;
                        return (
                        <div key={notif.id} className="p-4 border rounded-lg flex justify-between items-start gap-4">
                            <div>
                                <p className={cn("font-semibold", !notif.enabled && "text-muted-foreground line-through")}>{displayMessage}</p>
                                <p className="text-sm text-muted-foreground">
                                    {notif.startTime && format(parseISO(notif.startTime), 'MMM d, h:mm a')} - {notif.endTime && format(parseISO(notif.endTime), 'MMM d, h:mm a')}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(notif.id)}><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(notif.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                        </div>
                    )}) : (
                        <p className="text-sm text-muted-foreground text-center">No notifications saved.</p>
                    )}
                </div>
            </div>
        </CardContent>
    </Card>
  );
}
