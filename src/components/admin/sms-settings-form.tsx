
'use client';

import { useTransition, useState, useEffect } from 'react';
import type { SmsSettings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const EMPTY_SETTINGS: SmsSettings = {
  provider: 'none',
  apiKey: '',
  senderId: '',
};

type SmsSettingsFormProps = {
  initialSettings?: SmsSettings | null;
  onSave: (settings: SmsSettings) => Promise<void>;
};

export function SmsSettingsForm({ initialSettings, onSave }: SmsSettingsFormProps) {
  const [settings, setSettings] = useState<SmsSettings>(initialSettings || EMPTY_SETTINGS);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSettings(initialSettings || EMPTY_SETTINGS);
  }, [initialSettings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProviderChange = (value: 'none' | 'bulksms' | 'twilio') => {
    setSettings(prev => ({ ...prev, provider: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await onSave(settings);
    });
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>SMS Provider Settings</CardTitle>
          <CardDescription>Configure your SMS provider to send OTP and notifications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="provider">SMS Provider</Label>
            <Select onValueChange={handleProviderChange} value={settings.provider}>
              <SelectTrigger id="provider">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Disabled)</SelectItem>
                <SelectItem value="bulksms">BulkSMS</SelectItem>
                <SelectItem value="twilio">Twilio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {settings.provider !== 'none' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input id="apiKey" name="apiKey" type="password" value={settings.apiKey} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senderId">Sender ID</Label>
                <Input id="senderId" name="senderId" value={settings.senderId} onChange={handleInputChange} />
                <p className="text-sm text-muted-foreground">
                  For Twilio, this is your Twilio phone number. For BulkSMS, this is your Sender ID.
                </p>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save SMS Settings'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
