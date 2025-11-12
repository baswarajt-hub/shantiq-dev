
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
import type { FamilyMember, VisitPurpose, Fee, ClinicDetails, Patient } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserPlus, Info } from 'lucide-react';
import { searchFamilyMembersAction } from '@/app/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { saveFeeAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

type BookWalkInDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  timeSlot: string;
  selectedDate: Date;
  onSave: (familyMember: FamilyMember, appointmentIsoString: string, checkIn: boolean, purpose: string) => Promise<{ success: string; patient: Patient; } | { error: string; }>;
  onAddNewPatient: (searchTerm: string) => void;
  visitPurposes: VisitPurpose[];
  clinicDetails: ClinicDetails;
};

type SearchByType = 'clinicId' | 'phone' | 'dob';

export function BookWalkInDialog({ isOpen, onOpenChange, timeSlot, selectedDate, onSave, onAddNewPatient, visitPurposes, clinicDetails }: BookWalkInDialogProps) {
  const [step, setStep] = useState(1);
  const [searchBy, setSearchBy] = useState<SearchByType>('clinicId');
  const [searchTerm, setSearchTerm] = useState('');
  const [foundMembers, setFoundMembers] = useState<FamilyMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [selectedPurpose, setSelectedPurpose] = useState('Consultation');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  // Fee state
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<'Cash' | 'Online'>('Cash');
  const [onlineType, setOnlineType] = useState<string>('');
  const [isPaid, setIsPaid] = useState(false);
  
  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm.trim() === '') {
        setFoundMembers([]);
        return;
      }
      startTransition(async () => {
        const results = await searchFamilyMembersAction(searchTerm, searchBy);
        const nonPrimaryMembers = results.filter(member => !member.isPrimary);
        setFoundMembers(nonPrimaryMembers);
      });
    }, 500);

    return () => clearTimeout(handler);
  }, [searchTerm, searchBy]);

   useEffect(() => {
    if(selectedPurpose) {
        const purposeDetails = visitPurposes.find(p => p.name === selectedPurpose);
        const fee = purposeDetails?.fee ?? 0;
        setAmount(fee);
        if (fee > 0) {
            setIsPaid(true);
        } else {
            setIsPaid(false);
        }
    }
   }, [selectedPurpose, visitPurposes]);

   useEffect(() => {
     if (clinicDetails.onlinePaymentTypes && clinicDetails.onlinePaymentTypes.length > 0) {
        setOnlineType(clinicDetails.onlinePaymentTypes[0].name);
     }
   }, [clinicDetails.onlinePaymentTypes]);

  const handleSearchByChange = (value: SearchByType) => {
    setSearchBy(value);
    setSearchTerm('');
    setFoundMembers([]);
  };

  const handleSelectMember = (member: FamilyMember) => {
    setSelectedMember(member);
    setStep(2);
  }

  const handleConfirmBooking = (checkIn: boolean) => {
    if (!selectedMember || !selectedPurpose) return;

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

    startTransition(async () => {
      // Step 1: Create the appointment first
      const appointmentResult = await onSave(selectedMember, appointmentDate.toISOString(), checkIn, selectedPurpose);

      if ('error' in appointmentResult) {
        toast({ title: 'Booking Error', description: appointmentResult.error, variant: 'destructive' });
        return;
      }
      
      // Step 2: If appointment is successful AND fee needs to be saved, save the fee.
      if (isPaid && amount > 0) {
        const newPatient = appointmentResult.patient;
        const feeData: Omit<Fee, 'id' | 'createdAt' | 'createdBy' | 'session' | 'date'> = {
          patientId: newPatient.id,
          patientName: newPatient.name,
          purpose: newPatient.purpose || 'Unknown',
          amount,
          mode,
          onlineType: mode === 'Online' ? onlineType : undefined,
          status: 'Paid',
        };
        
        const feeResult = await saveFeeAction(feeData);
        if ('error' in feeResult) {
          toast({ title: 'Fee Error', description: `Appointment was booked, but fee failed to save: ${feeResult.error}`, variant: 'destructive' });
        }
      }

      handleClose(false);
    });
  };

  const resetState = () => {
    setStep(1);
    setSearchTerm('');
    setSearchBy('clinicId');
    setFoundMembers([]);
    setSelectedMember(null);
    setSelectedPurpose('Consultation');
    setAmount(0);
    setMode('Cash');
    setOnlineType(clinicDetails.onlinePaymentTypes?.[0]?.name || '');
    setIsPaid(false);
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
    handleClose(false);
  };

  const selectedPurposeDetails = visitPurposes.find(p => p.name === selectedPurpose);

  const searchPlaceholders = {
      clinicId: 'Enter Clinic ID...',
      phone: 'Enter 10-digit phone number...',
      dob: ''
  };
  
  const isZeroFee = amount === 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book Walk-in for {timeSlot}</DialogTitle>
          <DialogDescription>
            {step === 1 && "Find a patient to book a walk-in appointment."}
            {step === 2 && "Confirm the appointment and payment details."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
            <div className="py-4 space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="search">Search Patient</Label>
                    <div className="flex gap-2">
                        <Select value={searchBy} onValueChange={handleSearchByChange}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Search by..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="clinicId">Clinic ID</SelectItem>
                                <SelectItem value="phone">Phone</SelectItem>
                                <SelectItem value="dob">DOB</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input 
                            id="search" 
                            type={searchBy === 'dob' ? 'date' : 'text'}
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            placeholder={searchPlaceholders[searchBy]}
                        />
                    </div>
                </div>
                
                {searchTerm && (
                     <div className="space-y-2 max-h-60 overflow-y-auto">
                        {isPending ? <p>Searching...</p> : foundMembers.length > 0 ? (
                            foundMembers.map(member => (
                                <div key={member.id} className="p-2 border rounded-md flex items-center justify-between cursor-pointer hover:bg-muted" onClick={() => handleSelectMember(member)}>
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarImage src={member.avatar || ''} alt={member.name} data-ai-hint="person" />
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
                <p>Booking a walk-in appointment for:</p>
                <div className="p-3 border rounded-md bg-muted flex items-center gap-3">
                     <Avatar>
                        <AvatarImage src={selectedMember.avatar || ''} alt={selectedMember.name} data-ai-hint="person" />
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
                    {selectedPurposeDetails?.description && (
                        <div className="text-xs text-muted-foreground p-2 flex gap-2 items-start">
                            <Info className="h-3 w-3 mt-0.5 shrink-0"/>
                            <span>{selectedPurposeDetails.description}</span>
                        </div>
                    )}
                </div>

                <div className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center space-x-2">
                        <input type="checkbox" id="isPaid" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} className="h-4 w-4" disabled={isZeroFee} />
                        <Label htmlFor="isPaid" className="text-base font-medium">Mark as Paid</Label>
                    </div>

                    {isPaid && (
                        <>
                           <div className="space-y-2">
                                <Label htmlFor="amount">Amount (₹)</Label>
                                <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Payment Mode</Label>
                                <RadioGroup value={mode} onValueChange={(value: 'Cash' | 'Online') => setMode(value)} className="flex gap-4" disabled={isZeroFee}>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="Cash" id="cash" disabled={isZeroFee}/>
                                    <Label htmlFor="cash">Cash</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="Online" id="online" disabled={isZeroFee}/>
                                    <Label htmlFor="online">Online</Label>
                                </div>
                                </RadioGroup>
                            </div>
                             {mode === 'Online' && !isZeroFee && (
                                <div className="space-y-2">
                                <Label htmlFor="onlineType">Online Payment Type</Label>
                                <Select value={onlineType} onValueChange={(value) => setOnlineType(value)}>
                                    <SelectTrigger id="onlineType">
                                    <SelectValue placeholder="Select online payment type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                    {(clinicDetails.onlinePaymentTypes || []).map(type => (
                                        <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={goBackToSearch}>Back to Search</Button>
                    <div className="flex gap-2">
                         <Button variant="secondary" onClick={() => handleConfirmBooking(false)} disabled={isPending || !selectedPurpose}>Save & Book</Button>
                        <Button onClick={() => handleConfirmBooking(true)} disabled={isPending || !selectedPurpose}>Save & Check-in</Button>
                    </div>
                </DialogFooter>
            </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
