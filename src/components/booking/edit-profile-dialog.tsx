
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
import { format } from 'date-fns';

type EditProfileDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  member: FamilyMember;
  onSave: (member: FamilyMember) => void;
};

export function EditProfileDialog({ isOpen, onOpenChange, member, onSave }: EditProfileDialogProps) {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    if (member) {
        setName(member.name);
        setDob(member.dob || '');
        setGender(member.gender || '');
        setEmail(member.email || '');
        setLocation(member.location || '');
        setCity(member.city || '');
    }
  }, [member, isOpen]);

  const handleSave = () => {
    if (name && gender && location && city) {
      onSave({ 
        ...member, 
        name, 
        dob, 
        gender, 
        email, 
        location, 
        city 
    });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit My Profile</DialogTitle>
          <DialogDescription>Update your personal registration details.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={member.phone} disabled />
            </div>
             <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth (Optional)</Label>
                    <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={format(new Date(), 'yyyy-MM-dd')} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select value={gender} onValueChange={setGender}>
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
                <Label htmlFor="email">Email (Optional)</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. you@example.com" />
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
