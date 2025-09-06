
'use client';

import { useState, useTransition, useCallback, useEffect } from 'react';
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
import { getFamilyByPhoneAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Info } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { format } from 'date-fns';

type PatientFormProps = {
    phone: string;
    name: string;
    setName: (value: string) => void;
    dob: string;
    setDob: (value: string) => void;
    gender: string;
    setGender: (value: string) => void;
    clinicId: string;
    setClinicId: (value: string) => void;
};

const PatientForm = ({ phone, name, setName, dob, setDob, gender, setGender, clinicId, setClinicId }: PatientFormProps) => (
    <div className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="phone-display">Phone Number</Label>
            <Input id="phone-display" value={phone} disabled />
        </div>
        <div className="space-y-2">
            <Label htmlFor="name">Patient's Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Doe" required/>
        </div>
        <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth</Label>
            <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} required max={format(new Date(), 'yyyy-MM-dd')}/>
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
        <div className="space-y-2">
            <Label htmlFor="clinicId">Clinic ID (Optional)</Label>
            <Input id="clinicId" value={clinicId} onChange={(e) => setClinicId(e.target.value)} placeholder="e.g. C12345" />
        </div>
    </div>
);

type AddNewPatientDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (member: Omit<FamilyMember, 'id' | 'avatar'>) => Promise<void>;
  phoneToPreFill?: string;
  onClose?: () => void;
};

export function AddNewPatientDialog({ isOpen, onOpenChange, onSave, phoneToPreFill, onClose }: AddNewPatientDialogProps) {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [clinicId, setClinicId] = useState('');
  const [isPending, startTransition] = useTransition();
  const [foundFamily, setFoundFamily] = useState<FamilyMember[] | null>(null);
  const { toast } = useToast();

  const handlePhoneCheck = useCallback(async (phoneNumber: string) => {
    if (!phoneNumber) {
        toast({ title: "Error", description: "Phone number is required.", variant: 'destructive'});
        return;
    }
    startTransition(async () => {
        const family = await getFamilyByPhoneAction(phoneNumber);
        setFoundFamily(family);
        setStep(2);
    });
  }, [toast]);

  useEffect(() => {
    if (isOpen && phoneToPreFill) {
      setPhone(phoneToPreFill);
      handlePhoneCheck(phoneToPreFill);
    }
  }, [isOpen, phoneToPreFill, handlePhoneCheck]);

  const resetState = () => {
    setStep(1);
    setPhone('');
    setName('');
    setDob('');
    setGender('');
    setClinicId('');
    setFoundFamily(null);
    if(onClose) onClose();
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  }

  const handleSave = () => {
    if (!phone || !name || !dob || !gender) {
        toast({ title: "Error", description: "Please fill all required fields.", variant: 'destructive'});
        return;
    }
    startTransition(async () => {
        const newPatientData: Omit<FamilyMember, 'id' | 'avatar'> = { name, dob, gender, clinicId, phone };
        await onSave(newPatientData);
        handleClose(false);
    });
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Patient</DialogTitle>
           <DialogDescription>
            {step === 1 && "Enter patient's phone number to begin."}
            {step === 2 && (foundFamily && foundFamily.length > 0 ? "This family is already registered. Add a new member." : "This is a new family. Please enter patient details.")}
          </DialogDescription>
        </DialogHeader>
        
        {step === 1 && (
            <div className="py-4 space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Enter 10-digit phone number"/>
                </div>
                <Button onClick={() => handlePhoneCheck(phone)} disabled={isPending || !phone} className="w-full">
                    {isPending ? "Checking..." : "Check Phone Number"}
                </Button>
            </div>
        )}

        {step === 2 && foundFamily !== null && (
             <div className="py-4 space-y-4">
                {foundFamily.length > 0 && (
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Existing Family Found</AlertTitle>
                        <AlertDescription>
                            The following members are registered with this phone number. Fill the form below to add a new family member.
                        </AlertDescription>
                         <div className="flex flex-wrap gap-2 mt-2">
                            {foundFamily.map(member => (
                                <div key={member.id} className="flex items-center gap-2 p-2 border rounded-md bg-muted/50 text-sm">
                                     <Avatar className="h-6 w-6">
                                        <AvatarImage src={member.avatar} alt={member.name} data-ai-hint="person" />
                                        <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span>{member.name}</span>
                                </div>
                            ))}
                        </div>
                    </Alert>
                )}
                <PatientForm 
                    phone={phone}
                    name={name}
                    setName={setName}
                    dob={dob}
                    setDob={setDob}
                    gender={gender}
                    setGender={setGender}
                    clinicId={clinicId}
                    setClinicId={setClinicId}
                />
                <DialogFooter>
                    <Button variant="outline" onClick={() => { setStep(1); setFoundFamily(null); }}>Back</Button>
                    <Button onClick={handleSave} disabled={isPending}>
                        {isPending ? "Saving..." : (foundFamily.length > 0 ? "Save Member" : "Save Patient")}
                    </Button>
                </DialogFooter>
             </div>
        )}
        
      </DialogContent>
    </Dialog>
  );
}
