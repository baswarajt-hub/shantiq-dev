'use client';

import { useTransition, useState, useEffect } from 'react';
import type { Notification, TranslatedMessage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { parseISO } from 'date-fns';
import { setHours } from 'date-fns';
import { setMinutes } from 'date-fns';
import { parse } from 'date-fns';
import { isFuture } from 'date-fns';
import { CalendarIcon, PlusCircle, Trash2, Edit } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';

const BLANK_NOTIFICATION: Omit<Notification, 'id'> = {
  message: { en: '', hi: '', te: '' },
  startTime: new Date().toISOString(),
  endTime: new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString(),
  enabled: true,
};

type NotificationFormProps = {
  initialNotifications: Notification[];
  onSave: (notifications: Notification[]) => Promise<void>;
};

export function DoctorNotificationForm({ initialNotifications, onSave }: NotificationFormProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [currentNotification, setCurrentNotification] = useState<Notification | Omit<Notification, 'id'>>({
    ...BLANK_NOTIFICATION,
  });
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingField, setEditingField] = useState<'startTime' | 'endTime'>('startTime');

  // Sync external updates
  useEffect(() => setNotifications(initialNotifications), [initialNotifications]);

  /** Handles message language text updates */
  const handleMessageChange = (lang: keyof TranslatedMessage, value: string) => {
    setCurrentNotification((prev) => {
      const baseMessage =
        typeof prev.message === 'string'
          ? { en: '', hi: '', te: '' }
          : { ...prev.message };
      return { ...prev, message: { ...baseMessage, [lang]: value } };
    });
  };

  /** Handles date and time field changes */
  const handleDateTimeChange = (field: 'startTime' | 'endTime', date?: Date, time?: string) => {
    setCurrentNotification((prev) => {
      const currentISO = prev[field];
      let workingDate = currentISO ? parseISO(currentISO) : new Date();

      if (date) {
        workingDate = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          workingDate.getHours(),
          workingDate.getMinutes()
        );
      }

      if (time) {
        try {
          const parsedTime = parse(time, 'HH:mm', new Date());
          workingDate = setHours(workingDate, parsedTime.getHours());
          workingDate = setMinutes(workingDate, parsedTime.getMinutes());
        } catch {
          console.warn('Invalid time format:', time);
        }
      }

      return { ...prev, [field]: workingDate.toISOString() };
    });
  };

  /** Enables or disables a notification */
  const handleSwitchChange = (checked: boolean) =>
    setCurrentNotification((prev) => ({ ...prev, enabled: checked }));

  /** Save or update a notification */
  const handleSaveOrUpdate = () => {
    startTransition(async () => {
      const messageToSave =
        typeof currentNotification.message === 'string'
          ? { en: currentNotification.message, hi: '', te: '' }
          : currentNotification.message;

      let updatedNotifications: Notification[];
      if (editingId) {
        updatedNotifications = notifications.map((n) =>
          n.id === editingId ? { ...n, ...currentNotification, id: editingId, message: messageToSave } : n
        );
      } else {
        const newId = `notif_${Date.now()}`;
        updatedNotifications = [...notifications, { ...currentNotification, id: newId, message: messageToSave }];
      }

      await onSave(updatedNotifications);
      setNotifications(updatedNotifications);
      setSheetOpen(false);
      setEditingId(null);
      setCurrentNotification({ ...BLANK_NOTIFICATION });
    });
  };

  /** Start editing an existing notification */
  const handleEdit = (id: string) => {
    const notificationToEdit = notifications.find((n) => n.id === id);
    if (!notificationToEdit) return;

    const normalizedMessage =
      typeof notificationToEdit.message === 'string'
        ? { en: notificationToEdit.message, hi: '', te: '' }
        : notificationToEdit.message;

    setEditingId(id);
    setCurrentNotification({ ...notificationToEdit, message: normalizedMessage });
    setEditingField('startTime');
    setSheetOpen(true);
  };

  /** Delete a notification */
  const handleDelete = (id: string) => {
    startTransition(async () => {
      const updated = notifications.filter((n) => n.id !== id);
      await onSave(updated);
      setNotifications(updated);
    });
  };

  /** Start new notification */
  const handleAddNew = () => {
    setEditingId(null);
    setCurrentNotification({ ...BLANK_NOTIFICATION });
    setEditingField('startTime');
    setSheetOpen(true);
  };

  const selectedDate =
    editingField === 'startTime'
      ? currentNotification.startTime
        ? parseISO(currentNotification.startTime)
        : undefined
      : currentNotification.endTime
      ? parseISO(currentNotification.endTime)
      : undefined;

  const timeValue = selectedDate ? format(selectedDate, 'HH:mm') : '';
  const messages =
    typeof currentNotification.message === 'object'
      ? currentNotification.message
      : { en: currentNotification.message || '', hi: '', te: '' };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Patient Portal Notifications</CardTitle>
          <CardDescription>Manage announcements displayed on the patient booking portal.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={handleAddNew}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add
        </Button>
      </CardHeader>

      <CardContent className="space-y-2">
        {notifications.length > 0 ? (
          notifications.map((notif) => {
            const isActive =
              !!notif.enabled &&
              !!notif.endTime &&
              isFuture(parseISO(notif.endTime));
            const displayMessage =
              typeof notif.message === 'string' ? notif.message : notif.message.en;

            return (
              <div
                key={notif.id}
                className={cn(
                  'p-3 border rounded-lg flex justify-between items-start gap-4',
                  !isActive && 'opacity-60 bg-muted/50'
                )}
              >
                <div>
                  <p className={cn('font-semibold', !notif.enabled && 'line-through')}>
                    {displayMessage}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {notif.startTime &&
                      format(parseISO(notif.startTime), 'MMM d, h:mm a')}{' '}
                    -{' '}
                    {notif.endTime &&
                      format(parseISO(notif.endTime), 'MMM d, h:mm a')}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleEdit(notif.id)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDelete(notif.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No notifications saved.
          </p>
        )}
      </CardContent>

      {/* Edit/Add Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full max-w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? 'Edit Notification' : 'Add New Notification'}</SheetTitle>
            <SheetDescription>This message appears on the patient booking page.</SheetDescription>
          </SheetHeader>

          <div className="py-4 space-y-4">
            {/* Message fields */}
            <div className="space-y-2">
              <Label htmlFor="msg-en">Message (English)</Label>
              <Textarea
                id="msg-en"
                value={messages.en}
                onChange={(e) => handleMessageChange('en', e.target.value)}
                placeholder="Enter English message..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="msg-hi">Message (हिन्दी)</Label>
              <Textarea
                id="msg-hi"
                value={messages.hi || ''}
                onChange={(e) => handleMessageChange('hi', e.target.value)}
                placeholder="Enter Hindi message..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="msg-te">Message (తెలుగు)</Label>
              <Textarea
                id="msg-te"
                value={messages.te || ''}
                onChange={(e) => handleMessageChange('te', e.target.value)}
                placeholder="Enter Telugu message..."
                rows={3}
              />
            </div>

            {/* Date selection */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={editingField === 'startTime' ? 'default' : 'outline'}
                onClick={() => setEditingField('startTime')}
              >
                From:{' '}
                {currentNotification.startTime
                  ? format(parseISO(currentNotification.startTime), 'MMM d, h:mma')
                  : '...'}
              </Button>
              <Button
                variant={editingField === 'endTime' ? 'default' : 'outline'}
                onClick={() => setEditingField('endTime')}
              >
                To:{' '}
                {currentNotification.endTime
                  ? format(parseISO(currentNotification.endTime), 'MMM d, h:mma')
                  : '...'}
              </Button>
            </div>

            <div className="flex justify-center rounded-md border">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(day) => handleDateTimeChange(editingField, day)}
                initialFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time-input">
                Time for {editingField === 'startTime' ? 'Start Date' : 'End Date'}
              </Label>
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
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveOrUpdate}
              disabled={isPending || !messages.en.trim()}
            >
              {isPending ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
