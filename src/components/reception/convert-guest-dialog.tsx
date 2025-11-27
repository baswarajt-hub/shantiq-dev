
'use client';

import { useState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { searchFamilyMembersAction } from '@/app/actions';
import type { FamilyMember, Patient } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';

type SearchByType = 'clinicId' | 'phone' | 'name';

type ConvertGuestDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  guestPatient: Patient;
  onConvertToExisting: (appointmentId: string, selectedPatient: FamilyMember) => void;
  onConvertToNew: (guestPatient: Patient) => void;
};

export function ConvertGuestDialog({
  isOpen,
  onOpenChange,
  guestPatient,
  onConvertToExisting,
  onConvertToNew,
}: ConvertGuestDialogProps) {
  const [searchBy, setSearchBy] = useState<SearchByType>('phone');
  const [searchTerm, setSearchTerm] = useState('');
  const [foundMembers, setFoundMembers] = useState<FamilyMember[]>([]);
  const [isSearching, startSearchTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setFoundMembers([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm.trim() === '') {
        setFoundMembers([]);
        return;
      }
      startSearchTransition(async () => {
        const results = await searchFamilyMembersAction(searchTerm, searchBy);
        setFoundMembers(results.filter(member => !member.isPrimary));
      });
    }, 500);

    return () => clearTimeout(handler);
  }, [searchTerm, searchBy]);

  const handleSelectMember = (member: FamilyMember) => {
    onConvertToExisting(guestPatient.id, member);
    onOpenChange(false);
  };
  
  const handleCreateNew = () => {
    onConvertToNew(guestPatient);
    onOpenChange(false);
  }

  const searchPlaceholders = {
    clinicId: 'Enter Clinic ID...',
    phone: 'Enter 10-digit phone number...',
    name: 'Enter patient name...',
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Convert Guest Booking</DialogTitle>
          <DialogDescription>
            Link this guest appointment for "{guestPatient.guestName}" to an existing patient or create a new registration for them.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex gap-2">
            <Select value={searchBy} onValueChange={(v) => setSearchBy(v as SearchByType)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Search by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="clinicId">Clinic ID</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholders[searchBy]}
            />
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {isSearching ? <p>Searching...</p> : foundMembers.map(member => (
              <div key={member.id} className="p-2 border rounded-md flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <Avatar>
                    <AvatarImage src={member.avatar || ''} alt={member.name} />
                    <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.phone}</p>
                  </div>
                </div>
                 <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm">Select</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Patient Link</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to link the guest booking for "{guestPatient.guestName}" to the existing patient "{member.name}"?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleSelectMember(member)}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
          
           <div className="text-center text-sm text-muted-foreground pt-4">
                <p>Or, if this is a new patient:</p>
                <Button variant="secondary" className="mt-2" onClick={handleCreateNew}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Register as a New Patient
                </Button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
