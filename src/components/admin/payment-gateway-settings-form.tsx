
'use client';

import { useTransition, useState, useEffect } from 'react';
import type { PaymentGatewaySettings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const EMPTY_SETTINGS: PaymentGatewaySettings = {
  provider: 'none',
  key: '',
  salt: '',
  environment: 'test',
};

type PaymentGatewaySettingsFormProps = {
  initialSettings?: PaymentGatewaySettings | null;
  onSave: (settings: PaymentGatewaySettings) => Promise<void>;
};

export function PaymentGatewaySettingsForm({ initialSettings, onSave }: PaymentGatewaySettingsFormProps) {
  const [settings, setSettings] = useState<PaymentGatewaySettings>(initialSettings || EMPTY_SETTINGS);
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

  const handleProviderChange = (value: 'none' | 'easebuzz') => {
    setSettings(prev => ({ ...prev, provider: value }));
  };

  const handleEnvironmentChange = (value: 'test' | 'production') => {
    setSettings(prev => ({ ...prev, environment: value }));
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
          <CardTitle>Payment Gateway Settings</CardTitle>
          <CardDescription>Configure your payment provider to accept online payments for bookings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="provider">Payment Provider</Label>
            <Select onValueChange={handleProviderChange} value={settings.provider}>
              <SelectTrigger id="provider">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Disabled)</SelectItem>
                <SelectItem value="easebuzz">Easebuzz</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {settings.provider === 'easebuzz' && (
            <>
              <div className="space-y-2">
                <Label>Environment</Label>
                <RadioGroup
                  onValueChange={handleEnvironmentChange}
                  value={settings.environment}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="test" id="r1" />
                    <Label htmlFor="r1">Test</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="production" id="r2" />
                    <Label htmlFor="r2">Production</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="key">Key</Label>
                <Input id="key" name="key" type="password" value={settings.key} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salt">Salt</Label>
                <Input id="salt" name="salt" type="password" value={settings.salt} onChange={handleInputChange} />
              </div>
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Payment Settings'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
