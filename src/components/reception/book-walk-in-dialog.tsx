
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
import type { FamilyMember } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { UserPlus } from 'lucide-react';
import { searchFamilyMembersAction } from '@/app/actions';
import { AddNewPatientDialog } from './add-new-patient-dialog';

type BookWalkInDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  timeSlot: string;
  onSave: (familyMember: FamilyMember, time: string) => void;
  onAddNewPatient: (member: Omit<FamilyMember, 'id' | 'avatar'>) => Promise<FamilyMember | null>;
};

export function BookWalkInDialog({ isOpen, onOpenChange, timeSlot, onSave, onAddNewPatient }: BookWalkInDialogProps) {
  const [step, setStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [foundMembers, setFoundMembers] = useState<FamilyMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isNewPatientDialogOpen, setIsNewPatientDialogOpen] = useState(false);
  const [phoneToPreFill, setPhoneToPreFill] = useState('');

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

  const goBackToSearch = () => {
    setStep(1);
    setSelectedMember(null);
  }

  const handleOpenNewPatientDialog = () => {
    if (/^\d{5,}$/.test(searchTerm.replace(/\D/g, ''))) {
      setPhoneToPreFill(searchTerm);
    }
    setIsNewPatientDialogOpen(true);
  };

  const handleNewPatientSaved = (newPatient: FamilyMember) => {
    onSave(newPatient, timeSlot);
    handleClose(false);
  };

  return (
    <>
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
                <p>You are booking an appointment for:</p>
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
                <DialogFooter>
                    <Button variant="outline" onClick={goBackToSearch}>Back to Search</Button>
                    <Button onClick={handleConfirmBooking}>Confirm Appointment</Button>
                </DialogFooter>
            </div>
        )}

      </DialogContent>
    </Dialog>
     <AddNewPatientDialog
        isOpen={isNewPatientDialogOpen}
        onOpenChange={setIsNewPatientDialogOpen}
        onSave={onAddNewPatient}
        phoneToPreFill={phoneToPreFill}
        onClose={() => setPhoneToPreFill('')}
        afterSave={handleNewPatientSaved}
      />
    </>
  );
}
