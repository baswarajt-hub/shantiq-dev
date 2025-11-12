

'use client';

import { useState, useTransition } from 'react';
import type { VisitPurpose } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

type VisitPurposeFormProps = {
  initialPurposes: VisitPurpose[];
  onSave: (purposes: VisitPurpose[]) => Promise<void>;
};

export function VisitPurposeForm({ initialPurposes, onSave }: VisitPurposeFormProps) {
  const [purposes, setPurposes] = useState<VisitPurpose[]>(initialPurposes);
  const [isPending, startTransition] = useTransition();

  const handleAddPurpose = () => {
    const newId = `vp_${Date.now()}`;
    setPurposes([...purposes, { id: newId, name: '', enabled: true, fee: 0 }]);
  };

  const handleRemovePurpose = (id: string) => {
    setPurposes(purposes.filter(p => p.id !== id));
  };

  const handlePurposeChange = (id: string, field: keyof VisitPurpose, value: string | boolean | number) => {
    setPurposes(purposes.map(p => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await onSave(purposes);
    });
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Purpose of Visit Options</CardTitle>
          <CardDescription>Manage the options available for patients and set default fees.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {purposes.map((purpose, index) => (
            <div key={purpose.id} className="flex flex-col md:flex-row items-start gap-4 p-4 border rounded-lg">
              <div className="grid gap-4 flex-1">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`purpose-name-${index}`}>Purpose Name</Label>
                    <Input
                      id={`purpose-name-${index}`}
                      value={purpose.name}
                      onChange={(e) => handlePurposeChange(purpose.id, 'name', e.target.value)}
                      placeholder="e.g. Consultation"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`purpose-desc-${index}`}>Description (Optional)</Label>
                    <Textarea
                      id={`purpose-desc-${index}`}
                      value={purpose.description || ''}
                      onChange={(e) => handlePurposeChange(purpose.id, 'description', e.target.value)}
                      placeholder="e.g. Follow-up within 5 days"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`purpose-fee-${index}`}>Default Fee</Label>
                    <Input
                      id={`purpose-fee-${index}`}
                      type="number"
                      value={purpose.fee || ''}
                      onChange={(e) => handlePurposeChange(purpose.id, 'fee', parseInt(e.target.value, 10) || 0)}
                      placeholder="e.g. 400"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-2 md:pt-8">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`purpose-enabled-${index}`}
                    checked={purpose.enabled}
                    onCheckedChange={(checked) => handlePurposeChange(purpose.id, 'enabled', checked)}
                  />
                  <Label htmlFor={`purpose-enabled-${index}`}>Enabled</Label>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleRemovePurpose(purpose.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={handleAddPurpose} className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Add Purpose
          </Button>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Visit Purposes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
