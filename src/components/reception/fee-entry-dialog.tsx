
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Fee, Patient, VisitPurpose } from '@/lib/types';

type FeeEntryDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  patient: Patient;
  visitPurposes: VisitPurpose[];
  onSave: (feeData: Omit<Fee, 'id' | 'createdAt' | 'createdBy' | 'session' | 'date'>) => void;
};

export function FeeEntryDialog({ isOpen, onOpenChange, patient, visitPurposes, onSave }: FeeEntryDialogProps) {
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<'Cash' | 'Online'>('Cash');
  const [onlineType, setOnlineType] = useState<'Easebuzz' | 'Paytm' | 'PhonePe' | 'Other'>('Easebuzz');

  useEffect(() => {
    if (patient && visitPurposes) {
      const purpose = visitPurposes.find(p => p.name === patient.purpose);
      setAmount(purpose?.fee || 0);
    }
  }, [patient, visitPurposes, isOpen]);

  const handleSave = () => {
    if (!patient || amount <= 0) return;
    onSave({
      patientId: patient.id,
      patientName: patient.name,
      purpose: patient.purpose || 'Unknown',
      amount,
      mode,
      onlineType: mode === 'Online' ? onlineType : undefined,
      status: 'Paid',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fee Entry for {patient.name}</DialogTitle>
          <DialogDescription>Record the consultation fee payment.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="purpose-display">Purpose of Visit</Label>
            <Input id="purpose-display" value={patient.purpose || 'N/A'} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (INR)</Label>
            <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Payment Mode</Label>
            <RadioGroup value={mode} onValueChange={(value: 'Cash' | 'Online') => setMode(value)} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Cash" id="cash" />
                <Label htmlFor="cash">Cash</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Online" id="online" />
                <Label htmlFor="online">Online</Label>
              </div>
            </RadioGroup>
          </div>
          {mode === 'Online' && (
            <div className="space-y-2">
              <Label htmlFor="onlineType">Online Payment Type</Label>
              <Select value={onlineType} onValueChange={(value) => setOnlineType(value as 'Easebuzz' | 'Paytm' | 'PhonePe' | 'Other')}>
                <SelectTrigger id="onlineType">
                  <SelectValue placeholder="Select online payment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easebuzz">Easebuzz</SelectItem>
                  <SelectItem value="Paytm">Paytm</SelectItem>
                  <SelectItem value="PhonePe">PhonePe</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
