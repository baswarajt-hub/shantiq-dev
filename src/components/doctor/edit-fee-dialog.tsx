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
import type { Fee } from '@/lib/types';

type DoctorEditFeeDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  fee: Fee;
  onSave: (feeId: string, updates: Partial<Omit<Fee, 'id'>>) => void;
};

export function DoctorEditFeeDialog({ isOpen, onOpenChange, fee, onSave }: DoctorEditFeeDialogProps) {
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<'Cash' | 'Online'>('Cash');
  const [purpose, setPurpose] = useState('');

  useEffect(() => {
    if (fee) {
      setAmount(fee.amount);
      setMode(fee.mode);
      setPurpose(fee.purpose);
    }
  }, [fee, isOpen]);

  const handleSave = () => {
    const updates: Partial<Omit<Fee, 'id'>> = {
      amount,
      mode,
      purpose,
      status: 'Paid',
    };
    onSave(fee.id, updates);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Fee for {fee.patientName}</DialogTitle>
          <DialogDescription>
            Correct the payment details for this transaction.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="purpose-edit">Purpose of Visit</Label>
            {/* For now, purpose is just text. If purposes become dynamic, use a Select */}
            <Input id="purpose-edit" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount-edit">Amount (₹)</Label>
            <Input id="amount-edit" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Payment Mode</Label>
            <RadioGroup value={mode} onValueChange={(value: 'Cash' | 'Online') => setMode(value)} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Cash" id="cash-edit" />
                <Label htmlFor="cash-edit">Cash</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Online" id="online-edit" />
                <Label htmlFor="online-edit">Online</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
