
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


export function DoctorNotificationForm({ initialNotifications, onSave }: NotificationFormProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [currentNotification, setCurrentNotification] = useState<Notification | Omit<Notification, 'id'>>(() => ({...BLANK_NOTIFICATION}));
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingField, setEditingField] = useState<'startTime' | 'endTime'>('startTime');


  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentNotification(prev => ({ ...prev, [name]: value }));
  };
  
  const handleDateTimeChange = (field: 'startTime' | 'endTime', date: Date | undefined, time?: string) => {
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
    setEditingField('startTime');
    setSheetOpen(true);
  }

  const handleEdit = (id: string) => {
    const notificationToEdit = notifications.find(n => n.id === id);
    if (notificationToEdit) {
        setEditingId(id);
        setCurrentNotification(notificationToEdit);
        setEditingField('startTime');
        setSheetOpen(true);
    }
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
        const updatedNotifications = notifications.filter(n => n.id !== id);
        await onSave(updatedNotifications);
    });
  };

  const selectedDate = editingField === 'startTime' 
    ? (currentNotification.startTime ? parseISO(currentNotification.startTime) : undefined)
    : (currentNotification.endTime ? parseISO(currentNotification.endTime) : undefined);
    
  const timeValue = selectedDate ? format(selectedDate, 'HH:mm') : '';

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
                    This message will appear on the main patient booking page.
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
                        placeholder="e.g. The clinic will be closed..."
                        rows={5}
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <Button variant={editingField === 'startTime' ? 'default' : 'outline'} onClick={() => setEditingField('startTime')}>
                        From: {currentNotification.startTime ? format(parseISO(currentNotification.startTime), 'MMM d, h:mma') : '...'}
                    </Button>
                    <Button variant={editingField === 'endTime' ? 'default' : 'outline'} onClick={() => setEditingField('endTime')}>
                       To: {currentNotification.endTime ? format(parseISO(currentNotification.endTime), 'MMM d, h:mma') : '...'}
                    </Button>
                </div>

                <div className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(day) => handleDateTimeChange(editingField, day)}
                      initialFocus
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="time-input">Time for {editingField === 'startTime' ? 'Start Date' : 'End Date'}</Label>
                    <Input
                        id="time-input"
                        type="time"
                        className="w-full"
                        value={timeValue}
                        onChange={(e) => handleDateTimeChange(editingField, undefined, e.target.value)}
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
