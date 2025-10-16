
'use client';

import { useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FamilyMember } from '@/lib/types';
import { format } from 'date-fns';

type AdminAddFamilyMemberDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (member: Omit<FamilyMember, 'id' | 'avatar' | 'phone'>) => void;
};

export function AdminAddFamilyMemberDialog({ isOpen, onOpenChange, onSave }: AdminAddFamilyMemberDialogProps) {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | ''>('');
  const [clinicId, setClinicId] = useState('');

  const handleSave = () => {
    if (name && dob && gender) {
      onSave({ name, dob, gender, clinicId });
      onOpenChange(false);
      // Reset form
      setName('');
      setDob('');
      setGender('');
      setClinicId('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Family Member</DialogTitle>
          <DialogDescription>Enter the details for the new family member. This will be associated with the selected family's phone number.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Doe" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={format(new Date(), 'yyyy-MM-dd')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={gender} onValueChange={(value) => setGender(value as 'Male' | 'Female' | 'Other')}>
                  <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
              </Select>
            </div>
          </div>
           <div className="space-y-2">
            <Label htmlFor="clinicId">Clinic ID (Optional)</Label>
            <Input
              id="clinicId"
              value={clinicId}
              onChange={(e) => setClinicId(e.target.value)}
              placeholder="Enter unique Clinic ID"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Member</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
