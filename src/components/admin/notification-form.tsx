
'use client';

import { useTransition, useState, useEffect } from 'react';
import type { Notification } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { formatISO, parseISO } from 'date-fns';

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

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // value is in "yyyy-MM-ddThh:mm" format, which is ISO 8601 compatible
    setNotification(prev => ({ ...prev, [name]: value ? new Date(value).toISOString() : undefined }));
  }

  const handleSwitchChange = (checked: boolean) => {
    setNotification(prev => ({ ...prev, enabled: checked }));
  };
  
  const formatDateTimeLocal = (isoString?: string) => {
    if (!isoString) return '';
    try {
        // Just slice the ISO string to fit the datetime-local input format
        return isoString.slice(0, 16);
    } catch (e) {
        return '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await onSave(notification);
    });
  };

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
            <div className="space-y-2">
              <Label htmlFor="startTime">Display From</Label>
              <Input
                id="startTime"
                name="startTime"
                type="datetime-local"
                value={formatDateTimeLocal(notification.startTime)}
                onChange={handleDateChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Display Until</Label>
              <Input
                id="endTime"
                name="endTime"
                type="datetime-local"
                value={formatDateTimeLocal(notification.endTime)}
                onChange={handleDateChange}
              />
            </div>
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
