

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
import type { Fee, Patient, VisitPurpose, ClinicDetails } from '@/lib/types';

type FeeEntryDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  patient: Patient;
  fee?: Fee;
  visitPurposes: VisitPurpose[];
  onSave: (feeData: Omit<Fee, 'id' | 'createdAt' | 'createdBy' | 'session' | 'date'>, existingFeeId?: string) => void;
  clinicDetails: ClinicDetails;
};

export function FeeEntryDialog({ isOpen, onOpenChange, patient, fee, visitPurposes, onSave, clinicDetails }: FeeEntryDialogProps) {
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<'Cash' | 'Online'>('Cash');
  const [onlineType, setOnlineType] = useState<string>('');
  const [purpose, setPurpose] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (fee) {
        // Editing an existing fee
        setPurpose(fee.purpose);
        setAmount(fee.amount);
        setMode(fee.mode);
        setOnlineType(fee.onlineType || clinicDetails.onlinePaymentTypes?.[0]?.name || '');
      } else {
        // Creating a new fee record
        const currentPurpose = patient.purpose || 'Consultation';
        const purposeDetails = visitPurposes.find(p => p.name === currentPurpose);
        const feeAmount = purposeDetails?.fee ?? 0;
        
        setPurpose(currentPurpose);
        setAmount(feeAmount);
        setMode('Cash');
        setOnlineType(clinicDetails.onlinePaymentTypes?.[0]?.name || '');
      }
    }
  }, [patient, fee, visitPurposes, isOpen, clinicDetails]);
  
  const handlePurposeChange = (newPurpose: string) => {
    setPurpose(newPurpose);
    const purposeDetails = visitPurposes.find(p => p.name === newPurpose);
    const feeAmount = purposeDetails?.fee ?? 0;
    setAmount(feeAmount);
  }

  const handleSave = () => {
    if (!patient) return;
    onSave({
      patientId: patient.id,
      patientName: patient.name,
      purpose: purpose,
      amount,
      mode,
      onlineType: mode === 'Online' ? onlineType : undefined,
      status: 'Paid',
    }, fee?.id);
    onOpenChange(false);
  };
  
  const isZeroFee = amount === 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fee Entry for {patient.name}</DialogTitle>
          <DialogDescription>Record the consultation fee payment.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="purpose-select">Purpose of Visit</Label>
            <Select value={purpose} onValueChange={handlePurposeChange}>
                <SelectTrigger id="purpose-select">
                    <SelectValue placeholder="Select purpose" />
                </SelectTrigger>
                <SelectContent>
                    {visitPurposes.map(p => (
                        <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Payment Mode</Label>
            <RadioGroup value={mode} onValueChange={(value: 'Cash' | 'Online') => setMode(value)} className="flex gap-4" disabled={isZeroFee}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Cash" id="cash" disabled={isZeroFee}/>
                <Label htmlFor="cash">Cash</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Online" id="online" disabled={isZeroFee}/>
                <Label htmlFor="online">Online</Label>
              </div>
            </RadioGroup>
          </div>
          {mode === 'Online' && !isZeroFee && (
            <div className="space-y-2">
              <Label htmlFor="onlineType">Online Payment Type</Label>
              <Select value={onlineType} onValueChange={(value) => setOnlineType(value)}>
                <SelectTrigger id="onlineType">
                  <SelectValue placeholder="Select online payment type" />
                </SelectTrigger>
                <SelectContent>
                   {(clinicDetails.onlinePaymentTypes || []).map(type => (
                    <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!isZeroFee && amount <= 0}>Save Payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
