

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
import type { FamilyMember } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

type EditProfileDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  member: FamilyMember;
  onSave: (member: FamilyMember) => void;
};

export function EditProfileDialog({ isOpen, onOpenChange, member, onSave }: EditProfileDialogProps) {
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [primaryContact, setPrimaryContact] = useState<'Father' | 'Mother'>('Father');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    if (member) {
        setFatherName(member.fatherName || '');
        setMotherName(member.motherName || '');
        setPrimaryContact(member.primaryContact || 'Father');
        setEmail(member.email || '');
        setLocation(member.location || '');
        setCity(member.city || '');
    }
  }, [member, isOpen]);

  const handleSave = () => {
    if (fatherName && motherName && location && city) {
      const name = primaryContact === 'Father' ? fatherName : motherName;
      onSave({ 
        ...member, 
        name,
        fatherName: fatherName || null, 
        motherName: motherName || null,
        primaryContact: primaryContact || null,
        email: email || null, 
        location: location || null, 
        city: city || null
    });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit My Profile</DialogTitle>
          <DialogDescription>Update your family's registration details.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={member.phone} disabled />
            </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="fatherName">Father's Name</Label>
                    <Input id="fatherName" value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="motherName">Mother's Name</Label>
                    <Input id="motherName" value={motherName} onChange={(e) => setMotherName(e.target.value)} />
                </div>
            </div>
             <div className="space-y-2">
                <Label>Primary Contact</Label>
                <RadioGroup value={primaryContact} onValueChange={(value: 'Father' | 'Mother') => setPrimaryContact(value)} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Father" id="edit-father" />
                        <Label htmlFor="edit-father">Father</Label>
                    </div>
                     <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Mother" id="edit-mother" />
                        <Label htmlFor="edit-mother">Mother</Label>
                    </div>
                </RadioGroup>
            </div>
            <div className="space-y-2">
                <Label htmlFor="email">Email (Optional)</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. parent@example.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="location">Location Area</Label>
                    <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Ameerpet" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g., Hyderabad" />
                </div>
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
