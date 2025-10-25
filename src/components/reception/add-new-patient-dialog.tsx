
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
import type { FamilyMember, VisitPurpose } from '@/lib/types';
import { getFamilyByPhoneAction, registerUserAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Info, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { format } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

type PatientFormProps = {
    phone: string;
    name: string;
    setName: (value: string) => void;
    dob: string;
    setDob: (value: string) => void;
    gender: 'Male' | 'Female' | 'Other' | '';
    setGender: (value: 'Male' | 'Female' | 'Other' | '') => void;
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
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} required max={format(new Date(), 'yyyy-MM-dd')}/>
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
            <Input id="clinicId" value={clinicId} onChange={(e) => setClinicId(e.target.value)} placeholder="e.g. C12345" />
        </div>
    </div>
);

type AddNewPatientDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (member: Omit<FamilyMember, 'id' | 'avatar'>) => Promise<FamilyMember | null>;
  phoneToPreFill?: string;
  onClose?: () => void;
  afterSave?: (newPatient: FamilyMember, purpose: string, checkIn: boolean) => void;
  visitPurposes: VisitPurpose[];
};

export function AddNewPatientDialog({ isOpen, onOpenChange, onSave, phoneToPreFill, onClose, afterSave, visitPurposes }: AddNewPatientDialogProps) {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | ''>('');
  const [clinicId, setClinicId] = useState('');
  const [isPending, startTransition] = useTransition();
  const [foundFamily, setFoundFamily] = useState<FamilyMember[] | null>(null);
  const { toast } = useToast();

  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [primaryContact, setPrimaryContact] = useState<'Father' | 'Mother'>('Father');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [city, setCity] = useState('');

  const handlePhoneCheck = useCallback(async (phoneNumber: string) => {
    if (!phoneNumber) {
        toast({ title: "Error", description: "Phone number is required.", variant: 'destructive'});
        return;
    }
    startTransition(async () => {
        const family = await getFamilyByPhoneAction(phoneNumber);
        setFoundFamily(family);
        if (family.length > 0) {
            setStep(3); // Existing family found, go to add member
        } else {
            setStep(2); // New family, go to register parent
        }
    });
  }, [toast]);

  useEffect(() => {
    if (isOpen && phoneToPreFill) {
      setPhone(phoneToPreFill);
      if (step === 1 && !foundFamily) {
        handlePhoneCheck(phoneToPreFill);
      }
    }
  }, [isOpen, phoneToPreFill, handlePhoneCheck, step, foundFamily]);

  const resetState = () => {
    setStep(1);
    setPhone('');
    setName('');
    setDob('');
    setGender('');
    setClinicId('');
    setFoundFamily(null);
    setFatherName('');
    setMotherName('');
    setPrimaryContact('Father');
    setEmail('');
    setLocation('');
    setCity('');
    if(onClose) onClose();
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  }

  const handleRegisterParent = () => {
    if (!fatherName || !motherName || !location || !city) {
      toast({ title: 'Missing Information', description: 'Please fill out all parent details.', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const result = await registerUserAction({ phone, fatherName, motherName, primaryContact, location, city, email });
      if ('error' in result) {
        toast({ title: 'Registration Failed', description: result.error, variant: 'destructive' });
      } else {
        const family = await getFamilyByPhoneAction(phone);
        setFoundFamily(family);
        setStep(3);
        toast({ title: 'Family Registered', description: 'Now, please add the patient\'s details.' });
      }
    });
  };

  const handleSavePatient = () => {
    if (!phone || !name || !dob || !gender) {
        toast({ title: "Error", description: "Please fill all required patient fields.", variant: 'destructive'});
        return;
    }
    startTransition(async () => {
        const newPatientData: Omit<FamilyMember, 'id' | 'avatar'> = { name, dob, gender, clinicId, phone };
        const newPatient = await onSave(newPatientData);
        if (newPatient) {
          handleClose(false);
        }
    });
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Patient</DialogTitle>
           <DialogDescription>
            {step === 1 && "Enter patient's phone number to begin."}
            {step === 2 && "This is a new family. Please register the parent details first."}
            {step === 3 && (foundFamily && foundFamily.length > 0 ? "This family is already registered. Add a new member." : "Enter patient details.")}
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

        {step === 2 && (
             <div className="py-4 space-y-4">
                <h3 className="font-semibold">Step 1: Register Parents</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <Label htmlFor="fatherName">Father's Name</Label>
                      <Input id="fatherName" value={fatherName} onChange={(e) => setFatherName(e.target.value)} placeholder="Father's Name"/>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="motherName">Mother's Name</Label>
                      <Input id="motherName" value={motherName} onChange={(e) => setMotherName(e.target.value)} placeholder="Mother's Name"/>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Primary Contact</Label>
                  <RadioGroup value={primaryContact} onValueChange={(value: 'Father' | 'Mother') => setPrimaryContact(value)} className="flex gap-4">
                      <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Father" id="reg-father" />
                          <Label htmlFor="reg-father">Father</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Mother" id="reg-mother" />
                          <Label htmlFor="reg-mother">Mother</Label>
                      </div>
                  </RadioGroup>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="location">Location Area</Label>
                        <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Ameerpet"/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g., Hyderabad"/>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Email (Optional)</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. parent@example.com" />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => { setStep(1); setFoundFamily(null); }}>Back</Button>
                    <Button onClick={handleRegisterParent} disabled={isPending}>
                        {isPending ? "Registering..." : "Register Family & Add Patient"}
                    </Button>
                </DialogFooter>
             </div>
        )}

        {step === 3 && foundFamily !== null && (
             <div className="py-4 space-y-4">
                {foundFamily.length > 0 && (
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Existing Family Found</AlertTitle>
                        <AlertDescription>
                            <p>Phone: {phone}</p>
                            <p>Parents: {foundFamily[0].fatherName} & {foundFamily[0].motherName}</p>
                        </AlertDescription>
                    </Alert>
                )}
                 <h3 className="font-semibold">Step {foundFamily.length > 0 ? 2 : 1}: Add Patient Details</h3>
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
                    <Button onClick={handleSavePatient} disabled={isPending}>Save Patient</Button>
                </DialogFooter>
             </div>
        )}
        
      </DialogContent>
    </Dialog>
  );
}
