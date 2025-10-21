

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FamilyMember } from '@/lib/types';
import format from 'date-fns/format';

type EditFamilyMemberDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  member: FamilyMember;
  onSave: (member: FamilyMember) => void;
};

export function EditFamilyMemberDialog({ isOpen, onOpenChange, member, onSave }: EditFamilyMemberDialogProps) {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | ''>('');
  const [clinicId, setClinicId] = useState('');

  useEffect(() => {
    if (member) {
        setName(member.name || '');
        setDob(member.dob || '');
        setGender(member.gender || '');
        setClinicId(member.clinicId || '');
    }
  }, [member, isOpen]);

  const handleSave = () => {
    if (name && dob && gender) {
      onSave({ 
        ...member, 
        name, 
        dob: dob || null, 
        gender: gender || null, 
        clinicId: clinicId || undefined 
    });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Family Member</DialogTitle>
          <DialogDescription>Update the details for this family member.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth</Label>
            <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={format(new Date(), 'yyyy-MM-dd')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select value={gender} onValueChange={(value: 'Male' | 'Female' | 'Other') => setGender(value)}>
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
           <div className="space-y-2">
            <Label htmlFor="clinicId">Clinic ID</Label>
            <Input
              id="clinicId"
              value={clinicId || ''}
              disabled
              placeholder="Assigned by clinic"
              className="bg-muted cursor-not-allowed"
            />
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

    