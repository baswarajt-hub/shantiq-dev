
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

type AdminEditFamilyMemberDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  member: FamilyMember;
  onSave: (member: FamilyMember) => void;
};

export function AdminEditFamilyMemberDialog({ isOpen, onOpenChange, member, onSave }: AdminEditFamilyMemberDialogProps) {
  const [formData, setFormData] = useState<FamilyMember>(member);

  useEffect(() => {
    if (member) {
        setFormData(member);
    }
  }, [member, isOpen]);

  const handleInputChange = (field: keyof FamilyMember, value: string) => {
    setFormData(prev => ({...prev, [field]: value}));
  }

  const handleSave = () => {
    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Member: {member.name}</DialogTitle>
          <DialogDescription>Update the registration details. Use with caution.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input id="dob" type="date" value={formData.dob || ''} onChange={(e) => handleInputChange('dob', e.target.value)} max={format(new Date(), 'yyyy-MM-dd')} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                        <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formData.email || ''} onChange={(e) => handleInputChange('email', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="location">Location Area</Label>
                    <Input id="location" value={formData.location || ''} onChange={(e) => handleInputChange('location', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" value={formData.city || ''} onChange={(e) => handleInputChange('city', e.target.value)} />
                </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor="clinicId">Clinic ID</Label>
                <Input id="clinicId" value={formData.clinicId || ''} onChange={(e) => handleInputChange('clinicId', e.target.value)} />
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
