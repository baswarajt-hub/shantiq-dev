
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FamilyMember } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

type BookWalkInDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  timeSlot: string;
  onSave: (familyMember: FamilyMember, time: string) => void;
  mockFamily: FamilyMember[]; // In a real app, you'd fetch this
};

export function BookWalkInDialog({ isOpen, onOpenChange, timeSlot, onSave, mockFamily }: BookWalkInDialogProps) {
  const [step, setStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [foundMembers, setFoundMembers] = useState<FamilyMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);

  const handleSearch = () => {
    // In a real app, this would be an API call
    const results = mockFamily.filter(m => m.clinicId?.toLowerCase() === searchTerm.toLowerCase() || m.name.toLowerCase().includes(searchTerm.toLowerCase()));
    setFoundMembers(results);
    if(results.length > 0) {
        setStep(2);
    } else {
        // Handle no results found
        console.log("No members found");
    }
  };

  const handleSelectMember = (member: FamilyMember) => {
    setSelectedMember(member);
    setStep(3);
  }

  const handleConfirmBooking = () => {
    if (selectedMember) {
        onSave(selectedMember, timeSlot);
        handleClose(false);
    }
  };

  const resetState = () => {
    setStep(1);
    setSearchTerm('');
    setFoundMembers([]);
    setSelectedMember(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book Walk-in for {timeSlot}</DialogTitle>
          <DialogDescription>
            {step === 1 && "Find patient by Clinic ID or name."}
            {step === 2 && "Select the family member for the appointment."}
            {step === 3 && "Confirm the appointment details."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
            <div className="py-4 space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="search">Clinic ID or Patient Name</Label>
                    <Input id="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="e.g. C101 or John Doe"/>
                </div>
                <Button onClick={handleSearch} className="w-full">Search Patient</Button>
            </div>
        )}
        
        {step === 2 && (
            <div className="py-4 space-y-4">
                <Label>Select Family Member</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                {foundMembers.map(member => (
                    <div key={member.id} className="p-2 border rounded-md flex items-center justify-between cursor-pointer hover:bg-muted" onClick={() => handleSelectMember(member)}>
                        <div className="flex items-center gap-3">
                            <Avatar>
                                <AvatarImage src={member.avatar} alt={member.name} data-ai-hint="person" />
                                <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-semibold">{member.name}</p>
                                <p className="text-xs text-muted-foreground">{member.gender}, Born {member.dob}</p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm">Select</Button>
                    </div>
                ))}
                </div>
                 <Button variant="outline" onClick={() => setStep(1)} className="w-full">Back to Search</Button>
            </div>
        )}

        {step === 3 && selectedMember && (
            <div className="py-4 space-y-4">
                <p>You are booking an appointment for:</p>
                <div className="p-3 border rounded-md bg-muted">
                    <p className="font-bold text-lg">{selectedMember.name}</p>
                    <p>at <span className="font-semibold">{timeSlot}</span></p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                    <Button onClick={handleConfirmBooking}>Confirm Appointment</Button>
                </DialogFooter>
            </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
