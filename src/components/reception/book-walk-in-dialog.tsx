
'use client';
import { useState, useEffect, useTransition } from 'react';
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
import type { FamilyMember, VisitPurpose } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { UserPlus } from 'lucide-react';
import { searchFamilyMembersAction } from '@/app/actions';
import { AddNewPatientDialog } from './add-new-patient-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

type BookWalkInDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  timeSlot: string;
  selectedDate: Date;
  onSave: (familyMember: FamilyMember, appointmentIsoString: string, isWalkIn: boolean, purpose: string) => void;
  onAddNewPatient: (searchTerm: string) => void;
  visitPurposes: VisitPurpose[];
};

export function BookWalkInDialog({ isOpen, onOpenChange, timeSlot, selectedDate, onSave, onAddNewPatient, visitPurposes }: BookWalkInDialogProps) {
  const [step, setStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [foundMembers, setFoundMembers] = useState<FamilyMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [selectedPurpose, setSelectedPurpose] = useState('Consultation');
  const [isPending, startTransition] = useTransition();
  
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm.trim() === '') {
        setFoundMembers([]);
        return;
      }
      startTransition(async () => {
        const results = await searchFamilyMembersAction(searchTerm);
        setFoundMembers(results);
      });
    }, 300); // Debounce search

    return () => clearTimeout(handler);
  }, [searchTerm]);


  const handleSelectMember = (member: FamilyMember) => {
    setSelectedMember(member);
    setStep(2);
  }

  const handleConfirmBooking = () => {
    if (selectedMember && selectedPurpose) {
        const [time, ampm] = timeSlot.split(' ');
        const [hours, minutes] = time.split(':');
        let hourNumber = parseInt(hours, 10);
        if (ampm.toLowerCase() === 'pm' && hourNumber < 12) {
            hourNumber += 12;
        }
        if (ampm.toLowerCase() === 'am' && hourNumber === 12) {
            hourNumber = 0;
        }
        const appointmentDate = new Date(selectedDate);
        appointmentDate.setHours(hourNumber, parseInt(minutes, 10), 0, 0);

        onSave(selectedMember, appointmentDate.toISOString(), true, selectedPurpose);
        handleClose(false);
    }
  };

  const resetState = () => {
    setStep(1);
    setSearchTerm('');
    setFoundMembers([]);
    setSelectedMember(null);
    setSelectedPurpose('Consultation');
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  const goBackToSearch = () => {
    setStep(1);
    setSelectedMember(null);
  }

  const handleOpenNewPatientDialog = () => {
    onAddNewPatient(searchTerm);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book Walk-in for {timeSlot}</DialogTitle>
          <DialogDescription>
            {step === 1 && "Find patient by Clinic ID, name, or phone number."}
            {step === 2 && "Confirm the appointment details."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
            <div className="py-4 space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="search">Search Patient</Label>
                    <Input id="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="e.g. C101, John Doe, or 5551112222"/>
                </div>
                
                {searchTerm && (
                     <div className="space-y-2 max-h-60 overflow-y-auto">
                        {isPending ? <p>Searching...</p> : foundMembers.length > 0 ? (
                            foundMembers.map(member => (
                                <div key={member.id} className="p-2 border rounded-md flex items-center justify-between cursor-pointer hover:bg-muted" onClick={() => handleSelectMember(member)}>
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarImage src={member.avatar} alt={member.name} data-ai-hint="person" />
                                            <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold">{member.name}</p>
                                            <p className="text-xs text-muted-foreground">{member.phone} &bull; Born {member.dob}</p>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm">Select</Button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-sm text-muted-foreground py-4 space-y-3">
                                <p>No patients found with this search term.</p>
                                <Button variant="secondary" onClick={handleOpenNewPatientDialog}>
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Add New Patient
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}
        
        {step === 2 && selectedMember && (
            <div className="py-4 space-y-4">
                <p>You are booking a walk-in appointment for:</p>
                <div className="p-3 border rounded-md bg-muted flex items-center gap-3">
                     <Avatar>
                        <AvatarImage src={selectedMember.avatar} alt={selectedMember.name} data-ai-hint="person" />
                        <AvatarFallback>{selectedMember.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-bold text-lg">{selectedMember.name}</p>
                        <p>at <span className="font-semibold">{timeSlot}</span></p>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="purpose">Purpose of Visit</Label>
                    <Select value={selectedPurpose} onValueChange={setSelectedPurpose}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select purpose" />
                        </SelectTrigger>
                        <SelectContent>
                            {visitPurposes.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={goBackToSearch}>Back to Search</Button>
                    <Button onClick={handleConfirmBooking} disabled={!selectedPurpose}>Confirm & Check-in</Button>
                </DialogFooter>
            </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
